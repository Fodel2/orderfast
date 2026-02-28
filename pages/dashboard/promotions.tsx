import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '@/components/DashboardLayout';
import Toast from '@/components/Toast';
import PromotionTermsModal from '@/components/promotions/PromotionTermsModal';
import PromotionCustomerCardPreview from '@/components/promotions/PromotionCustomerCardPreview';
import { buildPromotionTermsPreview } from '@/lib/promotionTerms';
import { formatPromotionTypeLabel } from '@/lib/promotionTypeLabel';
import { fetchLoyaltyConfig, LoyaltyConfig, upsertLoyaltyConfig } from '@/lib/customerPromotions';
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
  promo_terms: string | null;
  created_at: string;
};

type WizardErrors = Record<string, string>;


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
  const [schemaErrorDetails, setSchemaErrorDetails] = useState<string | null>(null);

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<WizardErrors>({});
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [showArchivedPromotions, setShowArchivedPromotions] = useState(false);
  const [archivingPromotionId, setArchivingPromotionId] = useState<string | null>(null);
  const [managingPromotion, setManagingPromotion] = useState<PromotionRow | null>(null);

  const [type, setType] = useState<PromotionType>('basket_discount');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingPriority, setEditingPriority] = useState(100);
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
  const [promotionRewards, setPromotionRewards] = useState<Record<string, Record<string, unknown>>>({});
  const [termsModalPromotion, setTermsModalPromotion] = useState<PromotionRow | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [loyaltySaved, setLoyaltySaved] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [showDisableLoyaltyConfirm, setShowDisableLoyaltyConfirm] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig>({
    enabled: false,
    points_per_currency_unit: 1,
    reward_points_required: 100,
    reward_value: 5,
  });
  const [draftLoyaltyConfig, setDraftLoyaltyConfig] = useState<LoyaltyConfig>({
    enabled: false,
    points_per_currency_unit: 1,
    reward_points_required: 100,
    reward_value: 5,
  });
  const [unlockSpend, setUnlockSpend] = useState(50);
  const [rewardValueOption, setRewardValueOption] = useState<5 | 10>(5);

  const LOYALTY_POINTS_REQUIRED = 500;

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
      await Promise.all([
        fetchPromotions(membership.restaurant_id),
        fetchGlobalTerms(membership.restaurant_id),
        fetchLoyaltySettings(membership.restaurant_id),
      ]);
      setLoading(false);
    };

    load();
  }, [router]);

  const fetchPromotions = async (currentRestaurantId: string) => {
    const { data, error } = await supabase
      .from('promotions')
      .select(
        'id,restaurant_id,name,type,status,priority,is_recurring,starts_at,ends_at,days_of_week,time_window_start,time_window_end,channels,order_types,min_subtotal,max_uses_total,max_uses_per_customer,promo_terms,created_at'
      )
      .eq('restaurant_id', currentRestaurantId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      handleSupabaseError('Failed to load promotions', error.message);
      return;
    }

    const rows = (data || []) as PromotionRow[];
    setPromotions(rows);

    const promotionIds = rows.map((row) => row.id);
    if (!promotionIds.length) {
      setPromotionRewards({});
      return;
    }

    const { data: rewardsData } = await supabase
      .from('promotion_rewards')
      .select('promotion_id,reward')
      .in('promotion_id', promotionIds);

    const rewardMap = (rewardsData || []).reduce((acc, row) => {
      const key = String(row.promotion_id || '');
      if (!key) return acc;
      acc[key] = (row.reward as Record<string, unknown>) || {};
      return acc;
    }, {} as Record<string, Record<string, unknown>>);
    setPromotionRewards(rewardMap);
  };

  const fetchGlobalTerms = async (currentRestaurantId: string) => {
    const { data } = await supabase
      .from('restaurant_promo_terms')
      .select('global_terms')
      .eq('restaurant_id', currentRestaurantId)
      .maybeSingle();

    setGlobalTerms(data?.global_terms || '');
  };

  const fetchLoyaltySettings = async (currentRestaurantId: string) => {
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    try {
      const config = await fetchLoyaltyConfig(currentRestaurantId);
      const next = config || {
        enabled: false,
        points_per_currency_unit: 10,
        reward_points_required: LOYALTY_POINTS_REQUIRED,
        reward_value: 5,
      };

      const normalizedReward = Number(next.reward_value) >= 10 ? 10 : 5;
      const pointsPerCurrency = Math.max(1, Math.floor(Number(next.points_per_currency_unit || 1)));
      const derivedUnlockSpend = Math.max(5, Math.min(500, Math.round(LOYALTY_POINTS_REQUIRED / pointsPerCurrency)));

      setRewardValueOption(normalizedReward);
      setUnlockSpend(derivedUnlockSpend);

      const computed = {
        enabled: !!next.enabled,
        points_per_currency_unit: Math.max(1, Math.round(LOYALTY_POINTS_REQUIRED / derivedUnlockSpend)),
        reward_points_required: LOYALTY_POINTS_REQUIRED,
        reward_value: normalizedReward,
      };

      setLoyaltyConfig(computed);
      setDraftLoyaltyConfig(computed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load loyalty settings.';
      setLoyaltyError(message);
    } finally {
      setLoyaltyLoading(false);
    }
  };

  const normalizedUnlockSpend = useMemo(() => {
    const value = Math.round(Number(unlockSpend) || 0);
    return Math.max(5, Math.min(500, value));
  }, [unlockSpend]);

  const computedPointsPerCurrencyUnit = useMemo(() => {
    return Math.max(1, Math.round(LOYALTY_POINTS_REQUIRED / normalizedUnlockSpend));
  }, [LOYALTY_POINTS_REQUIRED, normalizedUnlockSpend]);

  useEffect(() => {
    setDraftLoyaltyConfig((prev) => ({
      ...prev,
      points_per_currency_unit: computedPointsPerCurrencyUnit,
      reward_points_required: LOYALTY_POINTS_REQUIRED,
      reward_value: rewardValueOption,
    }));
  }, [computedPointsPerCurrencyUnit, LOYALTY_POINTS_REQUIRED, rewardValueOption]);

  const isLoyaltyDirty = useMemo(() => {
    const computedNext = {
      ...draftLoyaltyConfig,
      points_per_currency_unit: computedPointsPerCurrencyUnit,
      reward_points_required: LOYALTY_POINTS_REQUIRED,
      reward_value: rewardValueOption,
    };
    return JSON.stringify(loyaltyConfig) !== JSON.stringify(computedNext);
  }, [loyaltyConfig, draftLoyaltyConfig, computedPointsPerCurrencyUnit, LOYALTY_POINTS_REQUIRED, rewardValueOption]);

  const loyaltyEffectiveRate = useMemo(() => {
    if (!normalizedUnlockSpend) return 0;
    return (rewardValueOption / normalizedUnlockSpend) * 100;
  }, [rewardValueOption, normalizedUnlockSpend]);

  const effectiveRateLabel = useMemo(() => {
    const whole = Math.round(loyaltyEffectiveRate);
    if (Math.abs(loyaltyEffectiveRate - whole) < 0.05) return `${whole}%`;
    return `${loyaltyEffectiveRate.toFixed(1)}%`;
  }, [loyaltyEffectiveRate]);

  const guidance = useMemo(() => {
    if (loyaltyEffectiveRate < 8) return { label: 'Low incentive', hint: loyaltyEffectiveRate < 6 ? 'May feel slow to customers.' : '' };
    if (loyaltyEffectiveRate < 12) return { label: 'Cost-effective', hint: '' };
    if (loyaltyEffectiveRate < 18) return { label: 'Balanced', hint: '' };
    if (loyaltyEffectiveRate <= 22) return { label: 'Strong driver', hint: '' };
    return { label: 'Very generous', hint: loyaltyEffectiveRate > 25 ? 'Check margin impact.' : '' };
  }, [loyaltyEffectiveRate]);

  const loyaltyInputValid = normalizedUnlockSpend >= 5 && normalizedUnlockSpend <= 500;

  const saveLoyaltySettings = async () => {
    if (!restaurantId) return;
    setLoyaltySaving(true);
    setLoyaltySaved(false);
    setLoyaltyError(null);
    try {
      const payload = {
        enabled: draftLoyaltyConfig.enabled,
        points_per_currency_unit: computedPointsPerCurrencyUnit,
        reward_points_required: LOYALTY_POINTS_REQUIRED,
        reward_value: rewardValueOption,
      };
      const saved = await upsertLoyaltyConfig(restaurantId, payload);
      setLoyaltyConfig(saved);
      setDraftLoyaltyConfig(saved);
      setLoyaltySaved(true);
      setTimeout(() => setLoyaltySaved(false), 2200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save loyalty settings.';
      setLoyaltyError(message);
    } finally {
      setLoyaltySaving(false);
    }
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


  const activePromotions = useMemo(
    () => promotions.filter((promotion) => promotion.status !== 'archived'),
    [promotions]
  );
  const archivedPromotions = useMemo(
    () => promotions.filter((promotion) => promotion.status === 'archived'),
    [promotions]
  );

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

  const recurringPreview = useMemo(() => {
    if (!isRecurring) return '';
    const selected = DAYS.filter((day) => daysOfWeek.includes(day.value)).map((day) => day.label).join(', ');
    const window = timeWindowStart && timeWindowEnd ? `${timeWindowStart}–${timeWindowEnd}` : 'time window pending';
    return `Active ${selected || 'select days'} ${window}`;
  }, [isRecurring, daysOfWeek, timeWindowStart, timeWindowEnd]);

  const rewardSummaryPreview = useMemo(() => {
    if (type === 'delivery_promo') {
      const threshold = freeDeliveryMinSubtotal ? ` on orders £${freeDeliveryMinSubtotal}+` : '';
      if (deliveryFeeCap) return `Delivery capped to £${deliveryFeeCap}${threshold}`;
      return `Free delivery${threshold}`;
    }

    const amount = discountValue || '0';
    if (discountType === 'fixed') return `£${amount} off subtotal`;
    return `${amount}% off subtotal`;
  }, [type, freeDeliveryMinSubtotal, deliveryFeeCap, discountType, discountValue]);

  const minSpendLine = useMemo(() => {
    if (type === 'delivery_promo' && freeDeliveryMinSubtotal) {
      return `Minimum spend £${freeDeliveryMinSubtotal}`;
    }
    if (minSubtotal) return `Minimum spend £${minSubtotal}`;
    return null;
  }, [type, minSubtotal, freeDeliveryMinSubtotal]);

  const wizardTermsPreview = useMemo(
    () => buildPromotionTermsPreview(
      {
        type,
        channels,
        order_types: orderTypes,
        min_subtotal: minSubtotal ? Number(minSubtotal) : null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        is_recurring: isRecurring,
        days_of_week: daysOfWeek,
        time_window_start: timeWindowStart || null,
        time_window_end: timeWindowEnd || null,
        max_uses_total: maxUsesTotal ? Number(maxUsesTotal) : null,
        max_uses_per_customer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
      },
      {
        discount_type: discountType,
        discount_value: discountValue ? Number(discountValue) : null,
        max_discount_cap: maxDiscountCap ? Number(maxDiscountCap) : null,
        delivery_fee_cap: deliveryFeeCap ? Number(deliveryFeeCap) : null,
        free_delivery_min_subtotal: freeDeliveryMinSubtotal ? Number(freeDeliveryMinSubtotal) : null,
      }
    ),
    [
      type,
      channels,
      orderTypes,
      minSubtotal,
      startsAt,
      endsAt,
      isRecurring,
      daysOfWeek,
      timeWindowStart,
      timeWindowEnd,
      maxUsesTotal,
      maxUsesPerCustomer,
      discountType,
      discountValue,
      maxDiscountCap,
      deliveryFeeCap,
      freeDeliveryMinSubtotal,
    ]
  );

  const resetWizard = () => {
    setStep(0);
    setErrors({});
    setType('basket_discount');
    setName('');
    setDescription('');
    setEditingPriority(100);
    setDiscountType('percent');
    setDiscountValue('');
    setMaxDiscountCap('');
    setMinSubtotal('');
    setFreeDeliveryMinSubtotal('');
    setDeliveryFeeCap('');
    setVoucherCodesRaw('');
    setMaxUsesTotal('');
    setMaxUsesPerCustomer('');
    setShowCodeGenerator(true);
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
      if (!isRecurring && startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
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
    if (!SUPPORTED_TYPES.includes(promotion.type)) {
      setToastMessage('This legacy promotion type can be viewed but not edited in this wizard.');
      return;
    }

    setErrors({});
    setEditingPromotionId(promotion.id);
    setShowWizard(true);
    setStep(1);

    setType(promotion.type);
    setName(promotion.name || '');
    setDescription('');
    setEditingPriority(promotion.priority ?? 100);
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
    setPromoTerms(promotion.promo_terms || '');

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
      const loadedCodes = (codes || []).map((row) => row.code).join('\n');
      setVoucherCodesRaw(loadedCodes);
      setShowCodeGenerator((codes || []).length === 0);
    } else {
      setVoucherCodesRaw('');
      setShowCodeGenerator(false);
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
      priority: editingPromotionId ? editingPriority || 100 : 100,
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Loyalty</h2>
              <p className="mt-1 text-sm text-gray-600">Reward regulars with points and simple voucher unlocks.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (draftLoyaltyConfig.enabled) {
                  setShowDisableLoyaltyConfirm(true);
                  return;
                }
                setDraftLoyaltyConfig((prev) => ({ ...prev, enabled: true }));
              }}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${draftLoyaltyConfig.enabled ? 'bg-teal-600' : 'bg-gray-300'}`}
              aria-label="Toggle loyalty"
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draftLoyaltyConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {loyaltyLoading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100" /> : null}
          {loyaltyError ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loyaltyError}</p> : null}

          {!loyaltyLoading ? (
            <>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="grid gap-5 md:grid-cols-2 md:gap-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Setup</p>
                      <div className="mt-2 space-y-4 rounded-2xl bg-gray-50/70 p-3">
                        <div>
                          <p className="text-xs font-medium text-gray-600">Reward</p>
                          <div className="mt-2 inline-flex h-10 rounded-full bg-gray-200/80 p-1">
                            {[5, 10].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setRewardValueOption(value as 5 | 10)}
                                className={`h-8 rounded-full px-4 text-sm font-semibold transition ${rewardValueOption === value ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                              >
                                £{value}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="block">
                          <p className="text-xs font-medium text-gray-600">Unlock after</p>
                          <div className="mt-2 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-gray-200">
                            <div className="relative max-w-[110px]">
                              <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-sm text-gray-500">£</span>
                              <input
                                type="number"
                                min="5"
                                max="500"
                                step="1"
                                value={normalizedUnlockSpend}
                                onChange={(e) => {
                                  const value = Math.max(5, Math.min(500, Math.round(Number(e.target.value) || 5)));
                                  setUnlockSpend(value);
                                }}
                                className="h-10 w-full rounded-xl border-0 bg-gray-50 pl-8 pr-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-teal-200"
                              />
                            </div>
                            <input
                              type="range"
                              min="5"
                              max="500"
                              step="1"
                              value={normalizedUnlockSpend}
                              onChange={(e) => setUnlockSpend(Number(e.target.value))}
                              className="mt-3 w-full accent-teal-600"
                            />
                            <p className="mt-2 text-[11px] text-gray-500">Controls how long it takes to earn the reward.</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500">Presets</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          { rate: 10, hint: 'Cost-effective' },
                          { rate: 15, hint: 'Balanced' },
                          { rate: 20, hint: 'Strong driver' },
                        ].map((preset) => {
                          const isSelected = Math.round(loyaltyEffectiveRate) === preset.rate;
                          return (
                            <button
                              key={preset.rate}
                              type="button"
                              onClick={() => setUnlockSpend(Math.max(5, Math.round(rewardValueOption / (preset.rate / 100))))}
                              className={`h-12 rounded-xl border px-2 text-center transition ${isSelected ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white text-gray-700 hover:border-teal-200 hover:text-teal-700'}`}
                            >
                              <span className="block text-xs font-semibold">{preset.rate}%</span>
                              <span className="block text-[10px] text-gray-500">{preset.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-gray-900">£{rewardValueOption} after ~£{normalizedUnlockSpend}</p>
                          <p className="text-sm text-gray-600">That&apos;s {effectiveRateLabel} back</p>
                        </div>
                        <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">{guidance.label}</span>
                      </div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, (loyaltyEffectiveRate / 25) * 100))}%` }}
                        />
                      </div>
                      {guidance.hint ? <p className="mt-2 text-[11px] text-gray-500">{guidance.hint}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gray-600">
                    Customers unlock £{rewardValueOption} after ~£{normalizedUnlockSpend} spend ({effectiveRateLabel} back).
                  </p>
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {loyaltySaved ? <span className="text-xs font-medium text-emerald-700">Saved</span> : null}
                    <button
                      type="button"
                      onClick={saveLoyaltySettings}
                      disabled={!isLoyaltyDirty || loyaltySaving || !loyaltyInputValid}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${isLoyaltyDirty ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {loyaltySaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Promotions</h2>
              <p className="text-xs text-gray-500">Active offers in customer channels.</p>
            </div>
            <span className="text-sm text-gray-500">{activePromotions.length} active</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Schedule</th>
                  <th className="py-2 pr-4">Min spend</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activePromotions.map((promotion) => (
                  <tr key={promotion.id} className={`border-b last:border-b-0 ${promotion.status === 'paused' ? 'opacity-65' : ''}`}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900">
                      <div className="inline-flex items-center gap-2">
                        <span>{promotion.name}</span>
                        {promotion.status === 'paused' ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">Paused</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">{formatPromotionTypeLabel(promotion.type)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{scheduleSummary(promotion)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{promotion.min_subtotal != null ? `£${promotion.min_subtotal}` : '—'}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setManagingPromotion(promotion)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${promotion.status === 'paused' ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
                {activePromotions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No active promotions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {archivedPromotions.length ? (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setShowArchivedPromotions((prev) => !prev)}
                className="text-xs font-semibold text-gray-500 transition hover:text-gray-700 hover:underline"
              >
                {showArchivedPromotions ? 'Hide archived' : `View archived (${archivedPromotions.length})`}
              </button>

              {showArchivedPromotions ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Type</th>
                        <th className="py-2 pr-4">Schedule</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedPromotions.map((promotion) => (
                        <tr key={promotion.id} className={`border-b last:border-b-0 ${promotion.status === 'paused' ? 'opacity-65' : ''}`}>
                          <td className="py-2 pr-4 font-medium text-gray-900">{promotion.name}</td>
                          <td className="py-2 pr-4 text-gray-700">{formatPromotionTypeLabel(promotion.type)}</td>
                          <td className="py-2 pr-4 text-gray-600">{scheduleSummary(promotion)}</td>
                          <td className="py-2 text-gray-500">archived</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
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


      {managingPromotion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Manage promotion</h3>
                <p className="mt-1 text-sm text-gray-600">{managingPromotion.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setManagingPromotion(null)}
                className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const target = managingPromotion;
                  setManagingPromotion(null);
                  openEditPromotion(target);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Edit
              </button>
              {managingPromotion.status === 'active' || managingPromotion.status === 'paused' ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = managingPromotion;
                    setManagingPromotion(null);
                    handleToggleStatus(target);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {managingPromotion.status === 'active' ? 'Pause' : 'Resume'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setTermsModalPromotion(managingPromotion);
                  setManagingPromotion(null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Terms
              </button>
              {managingPromotion.status !== 'archived' ? (
                <button
                  type="button"
                  onClick={() => {
                    setArchivingPromotionId(managingPromotion.id);
                    setManagingPromotion(null);
                  }}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showDisableLoyaltyConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Disable loyalty?</h3>
            <p className="mt-2 text-sm text-slate-600">Turning off loyalty won’t delete existing customer points or vouchers. Customers can still use vouchers they already have.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisableLoyaltyConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftLoyaltyConfig((prev) => ({ ...prev, enabled: false }));
                  setShowDisableLoyaltyConfirm(false);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Disable
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
                      {['basket_discount', 'delivery_promo', 'voucher'].map((option) => {
                        const optionType = option as PromotionType;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setType(optionType)}
                            className={`rounded-xl border px-3 py-3 text-left transition ${
                              type === optionType ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <p className="font-medium text-gray-900">{formatPromotionTypeLabel(option)}</p>
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

                    <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Reward preview: <span className="font-medium text-gray-900">{rewardSummaryPreview}</span>
                    </p>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">Schedule mode</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'One-time', value: false },
                          { label: 'Recurring', value: true },
                        ].map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => setIsRecurring(option.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              isRecurring === option.value
                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                : 'border-gray-300 text-gray-600'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!isRecurring ? (
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
                    ) : null}

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
                        <p className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700">{recurringPreview}</p>
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

                    <details className="rounded-xl border border-gray-200 bg-gray-50 p-3" open={Boolean(errors.maxUsesTotal || errors.maxUsesPerCustomer)}>
                      <summary className="cursor-pointer text-sm font-medium text-gray-700">Advanced</summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                    </details>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-4">
                    {type === 'voucher' ? (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setShowCodeGenerator((prev) => !prev)}
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {showCodeGenerator ? 'Hide generator' : 'Show generator'}
                          </button>
                          <button
                            type="button"
                            onClick={exportVoucherCodesCsv}
                            disabled={voucherCodes.length === 0}
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
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

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Customer terms preview</label>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          {wizardTermsPreview.length ? (
                            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                              {wizardTermsPreview.map((term) => (
                                <li key={term}>{term}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">Terms will appear as you configure this promotion.</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Add custom note (optional)</label>
                        <textarea
                          value={promoTerms}
                          onChange={(e) => setPromoTerms(e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                          placeholder="Add any extra conditions for customers."
                        />
                      </div>
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

      <PromotionTermsModal
        open={!!termsModalPromotion}
        onClose={() => setTermsModalPromotion(null)}
        title={termsModalPromotion?.name}
        offerTerms={termsModalPromotion ? buildPromotionTermsPreview(termsModalPromotion, promotionRewards[termsModalPromotion.id]) : []}
        restaurantNote={termsModalPromotion?.promo_terms || ''}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
