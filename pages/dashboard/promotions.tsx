import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '@/components/DashboardLayout';
import Toast from '@/components/Toast';
import PromotionCustomerCardPreview from '@/components/promotions/PromotionCustomerCardPreview';
import { supabase } from '@/utils/supabaseClient';

type PromotionType =
  | 'basket_discount'
  | 'voucher'
  | 'multibuy_bogo'
  | 'spend_get_item'
  | 'bundle_fixed_price'
  | 'delivery_promo'
  | 'loyalty_redemption';

type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'archived';

type PromotionRow = {
  id: string;
  restaurant_id: string;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  priority: number;
  is_recurring: boolean;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  time_window_start: string | null;
  time_window_end: string | null;
  channels: string[];
  order_types: string[];
  min_subtotal: number | null;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  created_at: string;
};

type WizardErrors = Record<string, string>;

type SchemaHealthRow = {
  promotions_exists: string | null;
  promotion_rewards_exists: string | null;
  promotion_voucher_codes_exists: string | null;
  restaurant_promo_terms_exists: string | null;
  promotion_redemptions_exists: string | null;
  loyalty_config_exists: string | null;
  loyalty_ledger_exists: string | null;
};

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const SUPPORTED_TYPES: PromotionType[] = ['basket_discount', 'delivery_promo', 'voucher'];
const STEP_TITLES = ['Type', 'Offer', 'Schedule', 'Audience', 'Terms', 'Review'];

export default function PromotionsPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTerms, setSavingTerms] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [globalTerms, setGlobalTerms] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [schemaHealth, setSchemaHealth] = useState<SchemaHealthRow | null>(null);
  const [schemaHealthError, setSchemaHealthError] = useState<string | null>(null);
  const [schemaErrorDetails, setSchemaErrorDetails] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<'active' | 'archived'>('active');
  const [archivingPromotionId, setArchivingPromotionId] = useState<string | null>(null);

  const [type, setType] = useState<PromotionType>('basket_discount');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('100');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscountCap, setMaxDiscountCap] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('');
  const [freeDeliveryMinSubtotal, setFreeDeliveryMinSubtotal] = useState('');
  const [deliveryFeeCap, setDeliveryFeeCap] = useState('');
  const [voucherCodesRaw, setVoucherCodesRaw] = useState('');
  const [maxUsesTotal, setMaxUsesTotal] = useState('');
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState('');
  const [showCodeGenerator, setShowCodeGenerator] = useState(false);
  const [generatorQuantity, setGeneratorQuantity] = useState('10');
  const [generatorLength, setGeneratorLength] = useState('8');
  const [generatorPrefix, setGeneratorPrefix] = useState('');
  const [generatorAvoidConfusing, setGeneratorAvoidConfusing] = useState(true);

  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timeWindowStart, setTimeWindowStart] = useState('');
  const [timeWindowEnd, setTimeWindowEnd] = useState('');

  const [channels, setChannels] = useState<string[]>(['website']);
  const [orderTypes, setOrderTypes] = useState<string[]>(['delivery', 'collection']);

  const [promoTerms, setPromoTerms] = useState('');

  const parseVoucherCodes = (raw: string) => {
    const seen = new Set<string>();
    const lines = raw
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);

    const unique: string[] = [];
    for (const line of lines) {
      const normalized = line.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      unique.push(line);
    }
    return unique;
  };

  const voucherCodes = useMemo(() => parseVoucherCodes(voucherCodesRaw), [voucherCodesRaw]);


  const isSupportedType = SUPPORTED_TYPES.includes(type);

  const configuredSupabaseProjectRef = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return 'unknown';
    try {
      const host = new URL(url).hostname;
      return host.split('.')[0] || 'unknown';
    } catch {
      return 'unknown';
    }
  }, []);

  const isSchemaCacheError = (message: string | undefined | null) => {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return (
      normalized.includes('schema cache')
      || normalized.includes("could not find the table")
      || normalized.includes('pgrst205')
    );
  };

  const setPremiumSchemaError = (rawMessage: string) => {
    setToastMessage('Database schema missing in this environment. Apply the promotions migration to this Supabase project and reload schema.');
    setSchemaErrorDetails(rawMessage);
  };

  const handleSupabaseError = (prefix: string, message: string) => {
    if (isSchemaCacheError(message)) {
      setPremiumSchemaError(message);
      return;
    }
    setToastMessage(`${prefix}: ${message}`);
  };

  const runSchemaHealthCheck = async () => {
    const { data, error } = await supabase.rpc('promotions_schema_health_check');
    if (error) {
      setSchemaHealthError(error.message);
      return;
    }

    const row = ((data || [])[0] || null) as SchemaHealthRow | null;
    setSchemaHealth(row);
  };

  const copyReloadSql = async () => {
    const snippet = "NOTIFY pgrst, 'reload schema';";
    try {
      await navigator.clipboard.writeText(snippet);
      setToastMessage('Schema reload SQL copied.');
    } catch {
      setToastMessage(`Copy this SQL manually: ${snippet}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      setRestaurantId(membership.restaurant_id);
      await Promise.all([fetchPromotions(membership.restaurant_id), fetchGlobalTerms(membership.restaurant_id), runSchemaHealthCheck()]);
      setLoading(false);
    };

    load();
  }, [router]);

  const fetchPromotions = async (currentRestaurantId: string) => {
    const { data, error } = await supabase
      .from('promotions')
      .select(
        'id,restaurant_id,name,type,status,priority,is_recurring,starts_at,ends_at,days_of_week,time_window_start,time_window_end,channels,order_types,min_subtotal,max_uses_total,max_uses_per_customer,created_at'
      )
      .eq('restaurant_id', currentRestaurantId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      handleSupabaseError('Failed to load promotions', error.message);
      return;
    }

    setPromotions((data || []) as PromotionRow[]);
  };

  const fetchGlobalTerms = async (currentRestaurantId: string) => {
    const { data } = await supabase
      .from('restaurant_promo_terms')
      .select('global_terms')
      .eq('restaurant_id', currentRestaurantId)
      .maybeSingle();

    setGlobalTerms(data?.global_terms || '');
  };

  const scheduleSummary = (promotion: PromotionRow) => {
    if (promotion.is_recurring) {
      const selected = DAYS.filter((d) => promotion.days_of_week?.includes(d.value)).map((d) => d.label).join(', ');
      const window = promotion.time_window_start && promotion.time_window_end
        ? `${promotion.time_window_start.slice(0, 5)}-${promotion.time_window_end.slice(0, 5)}`
        : 'Any time';
      return `Recurring • ${selected || 'No days'} • ${window}`;
    }
    if (promotion.starts_at || promotion.ends_at) {
      const start = promotion.starts_at ? new Date(promotion.starts_at).toLocaleString() : 'Now';
      const end = promotion.ends_at ? new Date(promotion.ends_at).toLocaleString() : 'No end';
      return `${start} → ${end}`;
    }
    return 'Always on';
  };


  const displayedPromotions = useMemo(() => {
    if (listFilter === 'archived') return promotions.filter((promotion) => promotion.status === 'archived');
    return promotions.filter((promotion) => promotion.status !== 'archived');
  }, [listFilter, promotions]);

  const valueLabel = useMemo(() => {
    if (type === 'delivery_promo') {
      if (deliveryFeeCap) return `Delivery capped at £${deliveryFeeCap}`;
      return 'Free delivery';
    }

    const base = discountValue || '0';
    return discountType === 'percent' ? `${base}% off` : `£${base} off`;
  }, [type, deliveryFeeCap, discountType, discountValue]);

  const previewSchedule = useMemo(() => {
    if (isRecurring) {
      const selected = DAYS.filter((d) => daysOfWeek.includes(d.value)).map((d) => d.label).join(', ');
      const window = timeWindowStart && timeWindowEnd ? `${timeWindowStart}-${timeWindowEnd}` : 'Any time';
      return `Recurring • ${selected || 'Select days'} • ${window}`;
    }

    if (startsAt || endsAt) {
      return `${startsAt ? new Date(startsAt).toLocaleString() : 'Now'} → ${
        endsAt ? new Date(endsAt).toLocaleString() : 'No end'
      }`;
    }

    return 'Always available';
  }, [isRecurring, daysOfWeek, timeWindowStart, timeWindowEnd, startsAt, endsAt]);

  const minSpendLine = useMemo(() => {
    if (type === 'delivery_promo' && freeDeliveryMinSubtotal) {
      return `Minimum spend £${freeDeliveryMinSubtotal}`;
    }
    if (minSubtotal) return `Minimum spend £${minSubtotal}`;
    return null;
  }, [type, minSubtotal, freeDeliveryMinSubtotal]);

  const resetWizard = () => {
    setStep(0);
    setErrors({});
    setType('basket_discount');
    setName('');
    setDescription('');
    setPriority('100');
    setDiscountType('percent');
    setDiscountValue('');
    setMaxDiscountCap('');
    setMinSubtotal('');
    setFreeDeliveryMinSubtotal('');
    setDeliveryFeeCap('');
    setVoucherCodesRaw('');
    setMaxUsesTotal('');
    setMaxUsesPerCustomer('');
    setShowCodeGenerator(false);
    setGeneratorQuantity('10');
    setGeneratorLength('8');
    setGeneratorPrefix('');
    setGeneratorAvoidConfusing(true);
    setStartsAt('');
    setEndsAt('');
    setIsRecurring(false);
    setDaysOfWeek([]);
    setTimeWindowStart('');
    setTimeWindowEnd('');
    setChannels(['website']);
    setOrderTypes(['delivery', 'collection']);
    setPromoTerms('');
  };

  const toggleChannel = (value: string) => {
    setChannels((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleOrderType = (value: string) => {
    setOrderTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const validateStep = (currentStep: number) => {
    const nextErrors: WizardErrors = {};

    if (currentStep === 0 && !isSupportedType) {
      nextErrors.type = 'This promotion type is coming soon.';
    }

    if (currentStep === 1) {
      if (!name.trim()) nextErrors.name = 'Promotion name is required.';

      if (type === 'basket_discount' || type === 'voucher') {
        const val = Number(discountValue);
        if (!discountValue || Number.isNaN(val)) {
          nextErrors.discountValue = 'Discount value is required.';
        } else if (discountType === 'percent' && (val < 1 || val > 100)) {
          nextErrors.discountValue = 'Percent discount must be between 1 and 100.';
        } else if (discountType === 'fixed' && val <= 0) {
          nextErrors.discountValue = 'Fixed discount must be greater than 0.';
        }

        if (maxDiscountCap) {
          const cap = Number(maxDiscountCap);
          if (Number.isNaN(cap) || cap <= 0) {
            nextErrors.maxDiscountCap = 'Max cap must be greater than 0.';
          }
        }
      }

      if (type === 'delivery_promo') {
        if (freeDeliveryMinSubtotal && Number(freeDeliveryMinSubtotal) < 0) {
          nextErrors.freeDeliveryMinSubtotal = 'Minimum spend must be 0 or greater.';
        }
        if (deliveryFeeCap && Number(deliveryFeeCap) < 0) {
          nextErrors.deliveryFeeCap = 'Delivery fee cap must be 0 or greater.';
        }
      }

      if (minSubtotal && Number(minSubtotal) < 0) {
        nextErrors.minSubtotal = 'Minimum subtotal must be 0 or greater.';
      }
    }

    if (currentStep === 2) {
      if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
        nextErrors.endsAt = 'End date must be after start date.';
      }

      if (isRecurring) {
        if (daysOfWeek.length === 0) nextErrors.daysOfWeek = 'Pick at least one day.';
        if (!timeWindowStart || !timeWindowEnd) nextErrors.timeWindow = 'Set a recurring time window.';
      }
    }

    if (currentStep === 3) {
      if (channels.length === 0) nextErrors.channels = 'Pick at least one channel.';
      if (orderTypes.length === 0) nextErrors.orderTypes = 'Pick at least one order type.';

      if (maxUsesTotal) {
        const total = Number(maxUsesTotal);
        if (!Number.isInteger(total) || total <= 0) {
          nextErrors.maxUsesTotal = 'Total usage limit must be a whole number greater than 0.';
        }
      }

      if (maxUsesPerCustomer) {
        const perCustomer = Number(maxUsesPerCustomer);
        if (!Number.isInteger(perCustomer) || perCustomer <= 0) {
          nextErrors.maxUsesPerCustomer = 'Per-customer limit must be a whole number greater than 0.';
        }
      }
    }

    if (currentStep === 4 && type === 'voucher') {
      if (voucherCodes.length === 0) nextErrors.voucherCodes = 'Add at least one voucher code.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(5, s + 1));
  };

  const handleToggleStatus = async (promotion: PromotionRow) => {
    if (!restaurantId) return;
    if (promotion.status === 'scheduled') return;

    const nextStatus: PromotionStatus = promotion.status === 'active' ? 'paused' : 'active';
    setTogglingId(promotion.id);

    const { error } = await supabase
      .from('promotions')
      .update({ status: nextStatus })
      .eq('id', promotion.id)
      .eq('restaurant_id', restaurantId);

    setTogglingId(null);

    if (error) {
      handleSupabaseError('Failed to update status', error.message);
      return;
    }

    setPromotions((prev) => prev.map((p) => (p.id === promotion.id ? { ...p, status: nextStatus } : p)));
    setToastMessage(`Promotion ${nextStatus === 'active' ? 'activated' : 'paused'}.`);
  };

  const handleSaveTerms = async (e: FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    setSavingTerms(true);

    const { error } = await supabase.from('restaurant_promo_terms').upsert(
      {
        restaurant_id: restaurantId,
        global_terms: globalTerms,
      },
      { onConflict: 'restaurant_id' }
    );

    setSavingTerms(false);

    if (error) {
      handleSupabaseError('Failed to save terms', error.message);
      return;
    }

    setToastMessage('Global promotion terms saved.');
  };


  const generateVoucherCodes = (replaceExisting: boolean) => {
    const quantity = Math.max(1, Math.min(500, Number(generatorQuantity) || 10));
    const length = Math.max(4, Math.min(24, Number(generatorLength) || 8));
    const prefix = generatorPrefix.trim().toUpperCase();
    const charset = generatorAvoidConfusing ? 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    const generated: string[] = [];
    const existing = parseVoucherCodes(voucherCodesRaw);
    const seen = new Set((replaceExisting ? [] : existing).map((code) => code.toLowerCase()));

    while (generated.length < quantity) {
      let core = '';
      for (let i = 0; i < length; i += 1) {
        core += charset[Math.floor(Math.random() * charset.length)];
      }
      const fullCode = prefix ? `${prefix}${core}` : core;
      const normalized = fullCode.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      generated.push(fullCode);
    }

    const nextCodes = replaceExisting ? generated : [...existing, ...generated];
    setVoucherCodesRaw(nextCodes.join('\n'));
  };

  const exportVoucherCodesCsv = () => {
    const rows = ['code', ...voucherCodes];
    const csv = rows.map((value) => `"${value.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voucher-codes.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openEditPromotion = async (promotion: PromotionRow) => {
    if (!restaurantId) return;

    setErrors({});
    setEditingPromotionId(promotion.id);
    setShowWizard(true);
    setStep(1);

    setType(promotion.type);
    setName(promotion.name || '');
    setDescription('');
    setPriority(String(promotion.priority ?? 100));
    setMinSubtotal(promotion.min_subtotal != null ? String(promotion.min_subtotal) : '');
    setMaxUsesTotal(promotion.max_uses_total != null ? String(promotion.max_uses_total) : '');
    setMaxUsesPerCustomer(promotion.max_uses_per_customer != null ? String(promotion.max_uses_per_customer) : '');
    setStartsAt(promotion.starts_at ? promotion.starts_at.slice(0, 16) : '');
    setEndsAt(promotion.ends_at ? promotion.ends_at.slice(0, 16) : '');
    setIsRecurring(!!promotion.is_recurring);
    setDaysOfWeek(promotion.days_of_week || []);
    setTimeWindowStart(promotion.time_window_start || '');
    setTimeWindowEnd(promotion.time_window_end || '');
    setChannels(promotion.channels || ['website']);
    setOrderTypes(promotion.order_types || ['delivery', 'collection']);

    const { data: rewardRow } = await supabase
      .from('promotion_rewards')
      .select('reward')
      .eq('promotion_id', promotion.id)
      .maybeSingle();

    const reward = rewardRow?.reward as Record<string, unknown> | undefined;
    if (promotion.type === 'delivery_promo') {
      setFreeDeliveryMinSubtotal(
        typeof reward?.free_delivery_min_subtotal === 'number' || typeof reward?.free_delivery_min_subtotal === 'string'
          ? String(reward.free_delivery_min_subtotal)
          : ''
      );
      setDeliveryFeeCap(
        typeof reward?.delivery_fee_cap === 'number' || typeof reward?.delivery_fee_cap === 'string'
          ? String(reward.delivery_fee_cap)
          : ''
      );
      setDiscountType('percent');
      setDiscountValue('');
      setMaxDiscountCap('');
    } else {
      setDiscountType(reward?.discount_type === 'fixed' ? 'fixed' : 'percent');
      setDiscountValue(
        typeof reward?.discount_value === 'number' || typeof reward?.discount_value === 'string'
          ? String(reward.discount_value)
          : ''
      );
      setMaxDiscountCap(
        typeof reward?.max_discount_cap === 'number' || typeof reward?.max_discount_cap === 'string'
          ? String(reward.max_discount_cap)
          : ''
      );
      setFreeDeliveryMinSubtotal('');
      setDeliveryFeeCap('');
    }

    if (promotion.type === 'voucher') {
      const { data: codes } = await supabase
        .from('promotion_voucher_codes')
        .select('code')
        .eq('promotion_id', promotion.id)
        .order('created_at', { ascending: true });
      setVoucherCodesRaw((codes || []).map((row) => row.code).join('\n'));
    } else {
      setVoucherCodesRaw('');
    }
  };

  const archivePromotion = async () => {
    if (!restaurantId || !archivingPromotionId) return;
    const { error } = await supabase
      .from('promotions')
      .update({ status: 'archived' })
      .eq('id', archivingPromotionId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      handleSupabaseError('Failed to archive promotion', error.message);
      return;
    }

    setPromotions((prev) => prev.map((promotion) => (
      promotion.id === archivingPromotionId ? { ...promotion, status: 'archived' } : promotion
    )));
    setArchivingPromotionId(null);
    setToastMessage('Promotion archived.');
  };

  const handleCreatePromotion = async () => {
    if (!restaurantId) return;
    if (!validateStep(5)) return;
    setSubmitting(true);

    const now = new Date();
    const startDate = startsAt ? new Date(startsAt) : null;
    const promotionStatus: PromotionStatus = startDate && startDate > now ? 'scheduled' : 'active';

    const promotionPayload = {
      restaurant_id: restaurantId,
      name: name.trim(),
      description: description.trim(),
      type,
      status: promotionStatus,
      priority: Number(priority) || 100,
      is_recurring: isRecurring,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      days_of_week: isRecurring ? daysOfWeek : null,
      time_window_start: isRecurring ? timeWindowStart || null : null,
      time_window_end: isRecurring ? timeWindowEnd || null : null,
      channels,
      order_types: orderTypes,
      min_subtotal: minSubtotal ? Number(minSubtotal) : null,
      promo_terms: promoTerms,
      max_uses_total: maxUsesTotal ? Number(maxUsesTotal) : null,
      max_uses_per_customer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
    };

    const saveQuery = editingPromotionId
      ? supabase
          .from('promotions')
          .update(promotionPayload)
          .eq('id', editingPromotionId)
          .eq('restaurant_id', restaurantId)
          .select('id')
          .single()
      : supabase
          .from('promotions')
          .insert(promotionPayload)
          .select('id')
          .single();

    const { data: insertedPromotion, error: insertError } = await saveQuery;

    if (insertError || !insertedPromotion?.id) {
      setSubmitting(false);
      handleSupabaseError(editingPromotionId ? 'Failed to update promotion' : 'Failed to create promotion', insertError?.message || 'unknown error');
      return;
    }

    const rewardPayload =
      type === 'delivery_promo'
        ? {
            ...(freeDeliveryMinSubtotal ? { free_delivery_min_subtotal: Number(freeDeliveryMinSubtotal) } : {}),
            ...(deliveryFeeCap ? { delivery_fee_cap: Number(deliveryFeeCap) } : {}),
          }
        : {
            discount_type: discountType,
            discount_value: Number(discountValue),
            ...(maxDiscountCap ? { max_discount_cap: Number(maxDiscountCap) } : {}),
          };

    const { error: rewardError } = await supabase.from('promotion_rewards').upsert(
      {
        promotion_id: insertedPromotion.id,
        reward: rewardPayload,
      },
      { onConflict: 'promotion_id' }
    );

    if (rewardError) {
      setSubmitting(false);
      handleSupabaseError('Promotion created but reward failed', rewardError.message);
      return;
    }

    if (type === 'voucher') {
      const desiredCodes = voucherCodes.map((code) => code.trim()).filter(Boolean);
      const { data: existingCodes, error: existingCodesError } = await supabase
        .from('promotion_voucher_codes')
        .select('id,code')
        .eq('promotion_id', insertedPromotion.id);

      if (existingCodesError) {
        setSubmitting(false);
        handleSupabaseError('Failed to load voucher codes', existingCodesError.message);
        return;
      }

      const existingByNormalized = new Map((existingCodes || []).map((row) => [row.code.toLowerCase(), row]));
      const desiredSet = new Set(desiredCodes.map((code) => code.toLowerCase()));

      const codesToInsert = desiredCodes.filter((code) => !existingByNormalized.has(code.toLowerCase()));
      if (codesToInsert.length > 0) {
        const { error: insertCodesError } = await supabase.from('promotion_voucher_codes').insert(
          codesToInsert.map((code) => ({ promotion_id: insertedPromotion.id, code }))
        );
        if (insertCodesError) {
          setSubmitting(false);
          handleSupabaseError('Failed to save voucher codes', insertCodesError.message);
          return;
        }
      }

      const removable = (existingCodes || []).filter((row) => !desiredSet.has(row.code.toLowerCase()));
      if (removable.length > 0) {
        const removableIds = removable.map((row) => row.id);
        const { data: redeemedRows } = await supabase
          .from('promotion_redemptions')
          .select('voucher_code_id')
          .in('voucher_code_id', removableIds);
        const usedIds = new Set((redeemedRows || []).map((row) => row.voucher_code_id));
        const deletableIds = removableIds.filter((id) => !usedIds.has(id));

        if (deletableIds.length > 0) {
          const { error: deleteCodesError } = await supabase
            .from('promotion_voucher_codes')
            .delete()
            .in('id', deletableIds);
          if (deleteCodesError) {
            setSubmitting(false);
            handleSupabaseError('Failed to remove voucher codes', deleteCodesError.message);
            return;
          }
        }
      }
    }

    await fetchPromotions(restaurantId);
    setSubmitting(false);
    setShowWizard(false);
    setEditingPromotionId(null);
    resetWizard();
    setToastMessage(editingPromotionId ? 'Promotion updated successfully.' : 'Promotion created successfully.');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 md:p-8">Loading promotions…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Promotions</h1>
            <p className="mt-1 text-sm text-gray-600">Create and manage offers for your customers.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingPromotionId(null);
              resetWizard();
              setShowWizard(true);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Create promotion
          </button>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Schema health check</h2>
              <p className="mt-1 text-sm text-gray-600">Validates required promotions tables in this connected Supabase project.</p>
              <p className="mt-1 text-xs text-gray-500">Configured project ref: <span className="font-mono">{configuredSupabaseProjectRef}</span></p>
            </div>
            <button
              type="button"
              onClick={copyReloadSql}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Copy: NOTIFY pgrst, 'reload schema';
            </button>
          </div>

          {schemaHealthError ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Unable to run schema health check: {schemaHealthError}
            </p>
          ) : null}

          {schemaHealth ? (
            (schemaHealth.promotions_exists == null
              || schemaHealth.promotion_rewards_exists == null
              || schemaHealth.promotion_voucher_codes_exists == null
              || schemaHealth.restaurant_promo_terms_exists == null
              || schemaHealth.promotion_redemptions_exists == null
              || schemaHealth.loyalty_config_exists == null
              || schemaHealth.loyalty_ledger_exists == null
            ) ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-semibold text-rose-700">
                  Promotions DB tables are missing in this Supabase project. Run the promotions migration in this project’s SQL editor.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                Promotions schema detected in this environment.
              </div>
            )
          ) : (
            <div className="mt-3 h-10 animate-pulse rounded-lg bg-gray-100" />
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Promotions</h2>
              <p className="text-xs text-gray-500">Manage active and archived promotions.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setListFilter('active')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${listFilter === 'active' ? 'bg-teal-100 text-teal-800' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setListFilter('archived')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${listFilter === 'archived' ? 'bg-teal-100 text-teal-800' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Archived
              </button>
              <span className="text-sm text-gray-500">{displayedPromotions.length} shown</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Schedule</th>
                  <th className="py-2 pr-4">Channels</th>
                  <th className="py-2 pr-4">Order types</th>
                  <th className="py-2 pr-4">Min subtotal</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedPromotions.map((promotion) => (
                  <tr key={promotion.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-medium text-gray-900">{promotion.name}</td>
                    <td className="py-3 pr-4 text-gray-700">{promotion.type}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                        {promotion.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{scheduleSummary(promotion)}</td>
                    <td className="py-3 pr-4 text-gray-600">{promotion.channels.join(', ')}</td>
                    <td className="py-3 pr-4 text-gray-600">{promotion.order_types.join(', ')}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {promotion.min_subtotal != null ? `£${promotion.min_subtotal}` : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPromotion(promotion)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        {promotion.status === 'active' || promotion.status === 'paused' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(promotion)}
                            disabled={togglingId === promotion.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                          >
                            {togglingId === promotion.id
                              ? 'Saving...'
                              : promotion.status === 'active'
                                ? 'Pause'
                                : 'Activate'}
                          </button>
                        ) : null}
                        {promotion.status !== 'archived' ? (
                          <button
                            type="button"
                            onClick={() => setArchivingPromotionId(promotion.id)}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No promotions found for this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Global promotion terms</h2>
          <p className="mt-1 text-sm text-gray-600">Shown with offers across your customer channels.</p>
          <form className="mt-4 space-y-3" onSubmit={handleSaveTerms}>
            <textarea
              value={globalTerms}
              onChange={(e) => setGlobalTerms(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="Add your global promotion terms..."
            />
            <div>
              <button
                type="submit"
                disabled={savingTerms}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                {savingTerms ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {archivingPromotionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Archive promotion?</h3>
            <p className="mt-2 text-sm text-gray-600">This will hide the promotion from customers and checkout. Past redemptions remain for reporting.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchivingPromotionId(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={archivePromotion}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWizard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b bg-white px-4 py-3 md:px-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editingPromotionId ? 'Edit promotion' : 'Create promotion'}</h3>
                <button
                  type="button"
                  onClick={() => { setShowWizard(false); setEditingPromotionId(null); resetWizard(); }}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
                {STEP_TITLES.map((label, idx) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        idx <= step
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-gray-300 bg-white text-gray-500'
                      }`}
                    >
                      {idx < step ? <CheckCircleIcon className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span className={idx === step ? 'font-semibold text-gray-900' : 'text-gray-500'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-4 md:px-6 md:py-5">
              <div className="transition-all duration-200">
                {step === 0 ? (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Choose promotion type</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        'basket_discount',
                        'delivery_promo',
                        'voucher',
                        'multibuy_bogo',
                        'spend_get_item',
                        'bundle_fixed_price',
                        'loyalty_redemption',
                      ].map((option) => {
                        const optionType = option as PromotionType;
                        const supported = SUPPORTED_TYPES.includes(optionType);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setType(optionType)}
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              type === optionType ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <p className="font-medium text-gray-900">{option}</p>
                            {!supported ? <p className="text-xs text-amber-600">Coming soon</p> : null}
                          </button>
                        );
                      })}
                    </div>
                    {errors.type ? <p className="text-sm text-red-600">{errors.type}</p> : null}
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Promotion name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        placeholder="e.g. Weekend 20% Off"
                      />
                      {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>

                    {(type === 'basket_discount' || type === 'voucher') && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Discount type</label>
                          <select
                            value={discountType}
                            onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          >
                            <option value="percent">Percent</option>
                            <option value="fixed">Fixed</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Discount value</label>
                          <input
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            type="number"
                            min="0.01"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.discountValue ? <p className="mt-1 text-xs text-red-600">{errors.discountValue}</p> : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Max discount cap (optional)</label>
                          <input
                            value={maxDiscountCap}
                            onChange={(e) => setMaxDiscountCap(e.target.value)}
                            type="number"
                            min="0.01"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.maxDiscountCap ? <p className="mt-1 text-xs text-red-600">{errors.maxDiscountCap}</p> : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Minimum subtotal (optional)</label>
                          <input
                            value={minSubtotal}
                            onChange={(e) => setMinSubtotal(e.target.value)}
                            type="number"
                            min="0"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.minSubtotal ? <p className="mt-1 text-xs text-red-600">{errors.minSubtotal}</p> : null}
                        </div>
                      </div>
                    )}

                    {type === 'delivery_promo' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Free delivery min subtotal (optional)</label>
                          <input
                            value={freeDeliveryMinSubtotal}
                            onChange={(e) => setFreeDeliveryMinSubtotal(e.target.value)}
                            type="number"
                            min="0"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.freeDeliveryMinSubtotal ? (
                            <p className="mt-1 text-xs text-red-600">{errors.freeDeliveryMinSubtotal}</p>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Delivery fee cap (optional)</label>
                          <input
                            value={deliveryFeeCap}
                            onChange={(e) => setDeliveryFeeCap(e.target.value)}
                            type="number"
                            min="0"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.deliveryFeeCap ? <p className="mt-1 text-xs text-red-600">{errors.deliveryFeeCap}</p> : null}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Minimum subtotal (optional)</label>
                          <input
                            value={minSubtotal}
                            onChange={(e) => setMinSubtotal(e.target.value)}
                            type="number"
                            min="0"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          />
                          {errors.minSubtotal ? <p className="mt-1 text-xs text-red-600">{errors.minSubtotal}</p> : null}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Starts at (optional)</label>
                        <input
                          value={startsAt}
                          onChange={(e) => setStartsAt(e.target.value)}
                          type="datetime-local"
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Ends at (optional)</label>
                        <input
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          type="datetime-local"
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                        {errors.endsAt ? <p className="mt-1 text-xs text-red-600">{errors.endsAt}</p> : null}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4"
                      />
                      Recurring schedule
                    </label>

                    {isRecurring ? (
                      <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                        <div>
                          <p className="mb-2 text-sm font-medium text-gray-700">Days of week</p>
                          <div className="flex flex-wrap gap-2">
                            {DAYS.map((day) => (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => toggleDay(day.value)}
                                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                  daysOfWeek.includes(day.value)
                                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                                    : 'border-gray-300 text-gray-600'
                                }`}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                          {errors.daysOfWeek ? <p className="mt-1 text-xs text-red-600">{errors.daysOfWeek}</p> : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Time window start</label>
                            <input
                              value={timeWindowStart}
                              onChange={(e) => setTimeWindowStart(e.target.value)}
                              type="time"
                              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Time window end</label>
                            <input
                              value={timeWindowEnd}
                              onChange={(e) => setTimeWindowEnd(e.target.value)}
                              type="time"
                              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                            />
                          </div>
                        </div>
                        {errors.timeWindow ? <p className="text-xs text-red-600">{errors.timeWindow}</p> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">Channels</p>
                      <div className="flex flex-wrap gap-2">
                        {['website', 'kiosk', 'pos'].map((channel) => (
                          <button
                            key={channel}
                            type="button"
                            onClick={() => toggleChannel(channel)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              channels.includes(channel)
                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            {channel}
                          </button>
                        ))}
                      </div>
                      {errors.channels ? <p className="mt-1 text-xs text-red-600">{errors.channels}</p> : null}
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">Order types</p>
                      <div className="flex flex-wrap gap-2">
                        {['delivery', 'collection', 'dine_in'].map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => toggleOrderType(kind)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              orderTypes.includes(kind)
                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            {kind}
                          </button>
                        ))}
                      </div>
                      {errors.orderTypes ? <p className="mt-1 text-xs text-red-600">{errors.orderTypes}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
                      <input
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        type="number"
                        className="w-full max-w-[180px] rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Max uses total (optional)</label>
                        <input
                          value={maxUsesTotal}
                          onChange={(e) => setMaxUsesTotal(e.target.value)}
                          type="number"
                          min="1"
                          step="1"
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                        {errors.maxUsesTotal ? <p className="mt-1 text-xs text-red-600">{errors.maxUsesTotal}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Max uses per customer (optional)</label>
                        <input
                          value={maxUsesPerCustomer}
                          onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                          type="number"
                          min="1"
                          step="1"
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                        />
                        {errors.maxUsesPerCustomer ? <p className="mt-1 text-xs text-red-600">{errors.maxUsesPerCustomer}</p> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-4">
                    {type === 'voucher' ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCodeGenerator((prev) => !prev)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Generate codes
                          </button>
                          <button
                            type="button"
                            onClick={exportVoucherCodesCsv}
                            disabled={voucherCodes.length === 0}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            Export CSV
                          </button>
                        </div>

                        {showCodeGenerator ? (
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">Quantity</label>
                                <input
                                  value={generatorQuantity}
                                  onChange={(e) => setGeneratorQuantity(e.target.value)}
                                  type="number"
                                  min="1"
                                  max="500"
                                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">Code length</label>
                                <input
                                  value={generatorLength}
                                  onChange={(e) => setGeneratorLength(e.target.value)}
                                  type="number"
                                  min="4"
                                  max="24"
                                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700">Prefix (optional)</label>
                                <input
                                  value={generatorPrefix}
                                  onChange={(e) => setGeneratorPrefix(e.target.value)}
                                  type="text"
                                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs uppercase"
                                />
                              </div>
                              <label className="flex items-center gap-2 text-xs text-gray-700 sm:pt-5">
                                <input
                                  type="checkbox"
                                  checked={generatorAvoidConfusing}
                                  onChange={(e) => setGeneratorAvoidConfusing(e.target.checked)}
                                />
                                Avoid confusing chars (0/O, 1/I)
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => generateVoucherCodes(false)}
                                className="rounded bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                              >
                                Append generated
                              </button>
                              <button
                                type="button"
                                onClick={() => generateVoucherCodes(true)}
                                className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                              >
                                Replace existing
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Voucher codes (one per line)</label>
                          <textarea
                            value={voucherCodesRaw}
                            onChange={(e) => setVoucherCodesRaw(e.target.value)}
                            rows={6}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                            placeholder={'SAVE10\nWELCOME20'}
                          />
                          <p className="mt-1 text-xs text-gray-500">Duplicates are removed automatically (case-insensitive).</p>
                          {errors.voucherCodes ? <p className="mt-1 text-xs text-red-600">{errors.voucherCodes}</p> : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No extra configuration required for this promotion type.</p>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Promotion terms (optional)</label>
                      <textarea
                        value={promoTerms}
                        onChange={(e) => setPromoTerms(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                ) : null}

                {step === 5 ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                      Review your offer before saving.
                    </div>
                    <PromotionCustomerCardPreview
                      title={name}
                      valueLabel={valueLabel}
                      scheduleLine={previewSchedule}
                      minSpendLine={minSpendLine}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-white px-4 py-3 md:px-6">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0 || submitting}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  Back
                </button>
                {step < 5 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!isSupportedType && step === 0}
                    className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreatePromotion}
                    disabled={submitting}
                    className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-40"
                  >
                    {submitting ? (editingPromotionId ? 'Saving...' : 'Creating...') : (editingPromotionId ? 'Save changes' : 'Create promotion')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {schemaErrorDetails ? (
        <div className="fixed bottom-20 right-4 z-[1001] w-[min(460px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-gray-800">Details</summary>
            <p className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600">{schemaErrorDetails}</p>
          </details>
        </div>
      ) : null}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
