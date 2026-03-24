import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { requestPrintJobCreation, requestPrintQueueNudge } from '@/lib/print-jobs/request';
import { buildTicketDocument, renderTicketDocumentSvg, type PrintRuleLike, type TicketType } from '@/lib/server/printContentBuilder';

type Printer = {
  id: string;
  name: string;
  role: string;
  provider: string | null;
  serial_number: string | null;
  enabled: boolean;
  is_default: boolean;
};

type PrinterSettings = {
  printing_enabled: boolean;
  voice_alert_enabled: boolean;
  voice_message: string;
  voice_repeat_count: number;
  voice_reminder_enabled: boolean;
  voice_reminder_delay_seconds: number;
  voice_reminder_message: string;
  require_print_for_voice: boolean;
};

type PrintRule = {
  id: string;
  ticket_type: string;
  enabled: boolean;
  trigger_event: string;
  copies: number;
  item_grouping: string | null;
  print_order_time: boolean;
  print_item_notes: boolean;
  print_phone: boolean;
  print_address: boolean;
  highlight_age_restricted: boolean;
  divider_lines: boolean;
  print_logo: boolean;
  print_restaurant_details: boolean;
  show_vat_breakdown: boolean;
  custom_message: string | null;
};

type PrintJob = {
  id: string;
  created_at: string;
  ticket_type: string | null;
  status: string | null;
  attempts: number | null;
  printer_id: string | null;
  print_rule_id: string | null;
  order_id?: string | null;
};

const defaultSettings: PrinterSettings = {
  printing_enabled: true,
  voice_alert_enabled: false,
  voice_message: 'New order received.',
  voice_repeat_count: 1,
  voice_reminder_enabled: false,
  voice_reminder_delay_seconds: 60,
  voice_reminder_message: 'Please check the printer.',
  require_print_for_voice: false,
};

const defaultPreviewRule: PrintRuleLike = {
  print_order_time: true,
  print_phone: true,
  print_address: true,
  print_item_notes: true,
  highlight_age_restricted: true,
  divider_lines: true,
  print_restaurant_details: true,
  show_vat_breakdown: true,
  print_logo: false,
  custom_message: 'Thanks for your order.',
  item_grouping: 'none',
};

const printerRoles = ['kitchen', 'receipt', 'packing', 'bar', 'dessert', 'expo'];

type PreviewTicketType = 'KOT' | 'Invoice';
type PrinterOnlineState = 'online' | 'offline' | 'unknown';
type RestaurantBranding = {
  name: string | null;
  website_title: string | null;
  logo_url: string | null;
  logo_shape: 'square' | 'round' | 'rectangular' | null;
  contact_number: string | null;
};
export type PrintingSubTab = 'printers' | 'kitchen-tickets' | 'receipts' | 'alerts' | 'diagnostics';

const printingSubTabItems: Array<{ key: PrintingSubTab; label: string }> = [
  { key: 'printers', label: 'Printers' },
  { key: 'kitchen-tickets', label: 'Kitchen Tickets' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'diagnostics', label: 'Diagnostics' },
];

export const PRINTING_SUB_TAB_ITEMS = printingSubTabItems;

const ticketTypeOrder: PreviewTicketType[] = ['KOT', 'Invoice'];

const normalizeTicketType = (value: string | null | undefined): PreviewTicketType | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'kot') return 'KOT';
  if (normalized === 'invoice') return 'Invoice';
  return null;
};

const toDbTicketType = (value: PreviewTicketType) => (value === 'KOT' ? 'kot' : 'invoice');


const normalizePrinterOnlineState = (payload: any): PrinterOnlineState => {
  const candidates = [
    payload?.status,
    payload?.status?.status,
    payload?.status?.online,
    payload?.status?.onlineStatus,
    payload?.raw?.data?.list?.[0]?.is_online,
    payload?.raw?.data?.is_online,
  ];

  for (const candidate of candidates) {
    if (candidate === true || candidate === 1 || String(candidate).trim() === '1') return 'online';
    if (candidate === false || candidate === 0 || String(candidate).trim() === '0') return 'offline';

    const normalized = String(candidate ?? '').trim().toLowerCase();
    if (!normalized) continue;
    if (['online', 'on', 'connected', 'ready'].includes(normalized) || normalized.includes('online')) return 'online';
    if (['offline', 'off', 'disconnected', 'unreachable'].includes(normalized) || normalized.includes('offline')) return 'offline';
  }

  return 'unknown';
};

const printerStateBadgeClass: Record<PrinterOnlineState, string> = {
  online: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  offline: 'bg-rose-100 text-rose-700 border-rose-200',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200',
};

const buildDefaultRuleDraft = (ticketType: PreviewTicketType): PrintRule => ({
  id: `fallback-${ticketType.toLowerCase()}`,
  ticket_type: ticketType,
  enabled: true,
  trigger_event: ticketType === 'KOT' ? 'order_accepted' : 'order_completed',
  copies: 1,
  item_grouping: 'none',
  print_order_time: true,
  print_item_notes: true,
  print_phone: true,
  print_address: true,
  highlight_age_restricted: true,
  divider_lines: true,
  print_logo: false,
  print_restaurant_details: true,
  show_vat_breakdown: true,
  custom_message: 'Thanks for your order.',
});

const triggerOptionsByTicketType: Record<PreviewTicketType, { value: string; label: string }[]> = {
  KOT: [
    { value: 'order_created', label: 'When order is created' },
    { value: 'order_accepted', label: 'When order is accepted' },
    { value: 'manual_only', label: 'Manual prints only' },
  ],
  Invoice: [
    { value: 'order_completed', label: 'When order is completed' },
    { value: 'order_paid', label: 'When payment is captured' },
    { value: 'manual_only', label: 'Manual prints only' },
  ],
};

export default function PrinterSettingsTab({
  restaurantId,
  canEdit,
  onToast,
  activeSubTab,
  onChangeSubTab,
  showInternalSubTabNav = true,
}: {
  restaurantId: string;
  canEdit: boolean;
  onToast: (message: string) => void;
  activeSubTab?: PrintingSubTab;
  onChangeSubTab?: (nextTab: PrintingSubTab) => void;
  showInternalSubTabNav?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PrinterSettings>(defaultSettings);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [rules, setRules] = useState<PrintRule[]>([]);
  const [rulePrinterMap, setRulePrinterMap] = useState<Record<string, string[]>>({});
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [localSubTab, setLocalSubTab] = useState<PrintingSubTab>('printers');
  const [editorTicketType, setEditorTicketType] = useState<PreviewTicketType>('KOT');
  const [printerDraft, setPrinterDraft] = useState({
    name: '',
    role: 'kitchen',
    serial_number: '',
    is_default: false,
  });
  const [ruleDraft, setRuleDraft] = useState<PrintRule | null>(null);
  const [rulePrinterDraftIds, setRulePrinterDraftIds] = useState<string[]>([]);
  const [onlineStatusByPrinterId, setOnlineStatusByPrinterId] = useState<Record<string, PrinterOnlineState>>({});
  const [statusLoadingByPrinterId, setStatusLoadingByPrinterId] = useState<Record<string, boolean>>({});
  const [restaurantBranding, setRestaurantBranding] = useState<RestaurantBranding>({
    name: null,
    website_title: null,
    logo_url: null,
    logo_shape: null,
    contact_number: null,
  });
  const [previewTicketType, setPreviewTicketType] = useState<PreviewTicketType>('KOT');
  const lastQueueNudgeAtRef = useRef(0);
  const queueNudgeInFlightRef = useRef(false);

  const currentSubTab = activeSubTab ?? localSubTab;
  const setCurrentSubTab = (nextTab: PrintingSubTab) => {
    onChangeSubTab?.(nextTab);
    if (activeSubTab === undefined) setLocalSubTab(nextTab);
  };

  const printerById = useMemo(
    () => printers.reduce<Record<string, Printer>>((acc, p) => ((acc[p.id] = p), acc), {}),
    [printers]
  );


  const nudgeQueueProcessing = async (reason: string) => {
    const now = Date.now();
    if (queueNudgeInFlightRef.current) return;
    if (now - lastQueueNudgeAtRef.current < 15000) return;

    queueNudgeInFlightRef.current = true;
    lastQueueNudgeAtRef.current = now;
    try {
      await requestPrintQueueNudge({ restaurantId, batchSize: 5 });
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[printer-settings] queue nudge completed', { restaurantId, reason });
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[printer-settings] queue nudge skipped', { restaurantId, reason, error });
      }
    } finally {
      queueNudgeInFlightRef.current = false;
    }
  };

  const loadData = async () => {
    setLoading(true);
    const [settingsRes, printersRes, rulesRes, jobsRes, restaurantRes] = await Promise.all([
      supabase.from('printer_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase
        .from('printers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true }),
      supabase
        .from('print_rules')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('ticket_type', { ascending: true }),
      supabase
        .from('print_jobs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('restaurants')
        .select('name,website_title,logo_url,logo_shape,contact_number')
        .eq('id', restaurantId)
        .maybeSingle(),
    ]);

    if (settingsRes.data) setSettings({ ...defaultSettings, ...(settingsRes.data as any) });
    if (printersRes.data) {
      const nextPrinters = printersRes.data as any as Printer[];
      setPrinters(nextPrinters);
      void refreshPrinterStatuses(nextPrinters, { silent: true });
    }

    if (rulesRes.data) {
      const list = rulesRes.data as PrintRule[];
      let normalizedRules = list
        .map((rule) => {
          const normalizedType = normalizeTicketType(rule.ticket_type);
          if (!normalizedType) return null;
          return { ...rule, ticket_type: normalizedType };
        })
        .filter(Boolean) as PrintRule[];

      const presentTypes = new Set(normalizedRules.map((rule) => rule.ticket_type as PreviewTicketType));
      const missingTypes = ticketTypeOrder.filter((type) => !presentTypes.has(type));

      if (missingTypes.length && canEdit) {
        const insertPayload = missingTypes.map((type) => {
          const fallback = buildDefaultRuleDraft(type);
          return {
            restaurant_id: restaurantId,
            ticket_type: toDbTicketType(type),
            enabled: fallback.enabled,
            trigger_event: fallback.trigger_event,
            copies: fallback.copies,
            item_grouping: fallback.item_grouping,
            print_order_time: fallback.print_order_time,
            print_item_notes: fallback.print_item_notes,
            print_phone: fallback.print_phone,
            print_address: fallback.print_address,
            highlight_age_restricted: fallback.highlight_age_restricted,
            divider_lines: fallback.divider_lines,
            print_logo: fallback.print_logo,
            print_restaurant_details: fallback.print_restaurant_details,
            show_vat_breakdown: fallback.show_vat_breakdown,
            custom_message: fallback.custom_message,
          };
        });
        const { data: inserted } = await supabase.from('print_rules').insert(insertPayload).select('*');
        const insertedNormalized = (inserted || [])
          .map((rule: any) => {
            const normalizedType = normalizeTicketType(rule.ticket_type);
            if (!normalizedType) return null;
            return { ...(rule as PrintRule), ticket_type: normalizedType };
          })
          .filter(Boolean) as PrintRule[];
        normalizedRules = [...normalizedRules, ...insertedNormalized];
      }

      const fallbackMissing = ticketTypeOrder.filter(
        (type) => !normalizedRules.some((rule) => rule.ticket_type === type)
      );
      if (fallbackMissing.length) {
        normalizedRules = [...normalizedRules, ...fallbackMissing.map(buildDefaultRuleDraft)];
      }

      setRules(
        [...normalizedRules].sort(
          (a, b) => ticketTypeOrder.indexOf(a.ticket_type as PreviewTicketType) - ticketTypeOrder.indexOf(b.ticket_type as PreviewTicketType)
        )
      );

      const persistedRuleIds = normalizedRules.map((r) => r.id).filter((id) => !String(id).startsWith('fallback-'));
      if (persistedRuleIds.length) {
        const { data } = await supabase
          .from('print_rule_printers')
          .select('print_rule_id,printer_id')
          .in('print_rule_id', persistedRuleIds);
        const next: Record<string, string[]> = {};
        (data || []).forEach((row: any) => {
          if (!next[row.print_rule_id]) next[row.print_rule_id] = [];
          next[row.print_rule_id].push(row.printer_id);
        });
        setRulePrinterMap(next);
      } else {
        setRulePrinterMap({});
      }
    }

    if (jobsRes.data) setJobs(jobsRes.data as any);
    if (restaurantRes.data) {
      setRestaurantBranding({
        name: restaurantRes.data.name ?? null,
        website_title: restaurantRes.data.website_title ?? null,
        logo_url: restaurantRes.data.logo_url ?? null,
        logo_shape: (restaurantRes.data.logo_shape as RestaurantBranding['logo_shape']) ?? null,
        contact_number: restaurantRes.data.contact_number ?? null,
      });
    }
    setLoading(false);
    await nudgeQueueProcessing('settings_load');
  };

  useEffect(() => {
    if (restaurantId) loadData();
  }, [restaurantId]);

  const resolvedPreviewRestaurantName = useMemo(() => {
    const websiteTitle = (restaurantBranding.website_title || '').trim();
    if (websiteTitle) return websiteTitle;
    const restaurantName = (restaurantBranding.name || '').trim();
    return restaurantName || null;
  }, [restaurantBranding.website_title, restaurantBranding.name]);

  useEffect(() => {
    if (!restaurantId) return;
    const source = (restaurantBranding.website_title || '').trim() ? 'website_title' : 'name';
    console.info('[printer-settings] Visible preview restaurant name', {
      restaurant_id: restaurantId,
      source,
      restaurant_name: resolvedPreviewRestaurantName,
    });
  }, [restaurantId, restaurantBranding.website_title, resolvedPreviewRestaurantName]);

  const saveSettings = async () => {
    if (!canEdit) return;
    const { error } = await supabase
      .from('printer_settings')
      .upsert({ restaurant_id: restaurantId, ...settings }, { onConflict: 'restaurant_id' });
    onToast(error ? `Could not save printing settings: ${error.message}` : 'Printing settings saved.');
  };

  const savePrinter = async () => {
    if (!canEdit) return;
    const payload = {
      restaurant_id: restaurantId,
      name: printerDraft.name,
      role: printerDraft.role,
      serial_number: printerDraft.serial_number || null,
      is_default: printerDraft.is_default,
      enabled: true,
    };

    const { error } = editingPrinter
      ? await supabase.from('printers').update(payload).eq('id', editingPrinter.id)
      : await supabase.from('printers').insert(payload);

    if (error) return onToast(`Could not save printer: ${error.message}`);
    setShowAddPrinter(false);
    setEditingPrinter(null);
    setPrinterDraft({ name: '', role: 'kitchen', serial_number: '', is_default: false });
    onToast('Printer saved.');
    await loadData();
  };

  const queueJob = async (
    source: 'manual_print' | 'manual_reprint' | 'retry' | 'test',
    job: Partial<PrintJob> & { order_id?: string | null }
  ) => {
    if (!canEdit) return;
    if (!job.order_id) {
      onToast('Cannot queue print job without an order context.');
      return;
    }

    try {
      await requestPrintJobCreation({
        restaurantId,
        orderId: job.order_id,
        ticketType: String(job.ticket_type || 'KOT').toLowerCase() === 'invoice' ? 'invoice' : 'kot',
        source,
      });
      onToast('Print job queued.');
      await loadData();
      await nudgeQueueProcessing(`manual_${source}`);
    } catch (error: any) {
      onToast(`Could not create print job: ${error?.message || 'Unknown error'}`);
    }
  };

  const checkOnlineStatus = async (printerId: string, options?: { silent?: boolean }) => {
    setStatusLoadingByPrinterId((prev) => ({ ...prev, [printerId]: true }));
    try {
      const response = await fetch('/api/printers/online-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_id: printerId, restaurant_id: restaurantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Status check failed');
      }

      setOnlineStatusByPrinterId((prev) => ({
        ...prev,
        [printerId]: normalizePrinterOnlineState(payload),
      }));

      if (!options?.silent) {
        onToast('Printer status updated.');
        await nudgeQueueProcessing('check_status');
      }
    } catch (error: any) {
      setOnlineStatusByPrinterId((prev) => ({ ...prev, [printerId]: 'unknown' }));
      if (!options?.silent) onToast(`Could not check printer status: ${error?.message || 'Unknown error'}`);
    } finally {
      setStatusLoadingByPrinterId((prev) => ({ ...prev, [printerId]: false }));
    }
  };

  const refreshPrinterStatuses = async (nextPrinters: Printer[], options?: { silent?: boolean }) => {
    const eligiblePrinters = nextPrinters.filter((printer) => printer.provider === 'sunmi_cloud' && printer.serial_number);
    if (!eligiblePrinters.length) {
      setOnlineStatusByPrinterId({});
      setStatusLoadingByPrinterId({});
      return;
    }

    if (options?.silent) {
      setStatusLoadingByPrinterId((prev) => ({
        ...prev,
        ...Object.fromEntries(eligiblePrinters.map((printer) => [printer.id, true])),
      }));
    }

    await Promise.all(eligiblePrinters.map((printer) => checkOnlineStatus(printer.id, options)));
  };

  const queueTestPrint = async (printerId: string) => {
    try {
      const response = await fetch('/api/printers/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer_id: printerId, restaurant_id: restaurantId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to queue test print');
      onToast('Test print queued.');
      await loadData();
      await nudgeQueueProcessing('test_print');
    } catch (error: any) {
      onToast(`Could not create test print: ${error?.message || 'Unknown error'}`);
    }
  };

  const saveRule = async () => {
    if (!canEdit || !ruleDraft) return;
    const normalizedDraftType = normalizeTicketType(ruleDraft.ticket_type) || editorTicketType;
    const rulePayload = {
      ticket_type: toDbTicketType(normalizedDraftType),
      enabled: ruleDraft.enabled,
      trigger_event: ruleDraft.trigger_event,
      copies: ruleDraft.copies,
      item_grouping: ruleDraft.item_grouping,
      print_order_time: ruleDraft.print_order_time,
      print_item_notes: ruleDraft.print_item_notes,
      print_phone: ruleDraft.print_phone,
      print_address: ruleDraft.print_address,
      highlight_age_restricted: ruleDraft.highlight_age_restricted,
      divider_lines: ruleDraft.divider_lines,
      print_logo: ruleDraft.print_logo,
      print_restaurant_details: ruleDraft.print_restaurant_details,
      show_vat_breakdown: ruleDraft.show_vat_breakdown,
      custom_message: ruleDraft.custom_message,
    };

    const isFallbackRule = String(ruleDraft.id).startsWith('fallback-');
    let persistedRuleId = ruleDraft.id;

    if (isFallbackRule) {
      const { data: insertedRule, error } = await supabase
        .from('print_rules')
        .insert({ restaurant_id: restaurantId, ...rulePayload })
        .select('id')
        .single();
      if (error) return onToast(`Could not save rule: ${error.message}`);
      persistedRuleId = insertedRule.id;
    } else {
      const { error } = await supabase
        .from('print_rules')
        .update(rulePayload)
        .eq('id', ruleDraft.id)
        .eq('restaurant_id', restaurantId);
      if (error) return onToast(`Could not save rule: ${error.message}`);
    }

    const { error: deleteError } = await supabase
      .from('print_rule_printers')
      .delete()
      .eq('print_rule_id', persistedRuleId);
    if (deleteError) return onToast(`Could not update assigned printers: ${deleteError.message}`);

    if (rulePrinterDraftIds.length) {
      const { error: insertError } = await supabase
        .from('print_rule_printers')
        .insert(rulePrinterDraftIds.map((printer_id) => ({ print_rule_id: persistedRuleId, printer_id })));
      if (insertError) return onToast(`Could not update assigned printers: ${insertError.message}`);
    }

    setRuleDraft(null);
    onToast('Print rule saved.');
    await loadData();
  };

  const activeRule = useMemo(
    () => rules.find((rule) => normalizeTicketType(rule.ticket_type) === editorTicketType) || null,
    [rules, editorTicketType]
  );

  useEffect(() => {
    if (!activeRule) {
      setRuleDraft(null);
      setRulePrinterDraftIds([]);
      return;
    }
    setRuleDraft(activeRule);
    setRulePrinterDraftIds(rulePrinterMap[activeRule.id] || []);
  }, [activeRule, rulePrinterMap]);

  useEffect(() => {
    setPreviewTicketType(editorTicketType);
  }, [editorTicketType]);

  useEffect(() => {
    if (currentSubTab === 'kitchen-tickets') setEditorTicketType('KOT');
    if (currentSubTab === 'receipts') setEditorTicketType('Invoice');
  }, [currentSubTab]);

  const previewRule = useMemo(() => {
    const baseRule = rules.find((rule) => normalizeTicketType(rule.ticket_type) === previewTicketType);
    const editingSameRule = ruleDraft && normalizeTicketType(ruleDraft.ticket_type) === previewTicketType;
    return { ...defaultPreviewRule, ...(baseRule || {}), ...(editingSameRule ? ruleDraft : {}) } as PrintRuleLike;
  }, [rules, ruleDraft, previewTicketType]);

  const previewPayload = useMemo(
    () => ({
      order_id: 'preview-order-id',
      order_number: 4271,
      created_at: new Date().toISOString(),
      accepted_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      scheduled_for: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      order_type: 'delivery',
      customer_name: 'Alex Johnson',
      customer_phone: '+44 7700 900123',
      customer_notes: 'Ring the side door bell once and send sauces separately.',
      delivery_address: {
        address_line_1: '12 Market Street',
        address_line_2: 'Flat 3B',
        postcode: 'E1 6AN',
      },
      payment_status: 'paid',
      payment_method: 'card',
      restaurant_name: resolvedPreviewRestaurantName,
      restaurant_phone: (restaurantBranding.contact_number || '').trim() || null,
      restaurant_logo_url: restaurantBranding.logo_url,
      restaurant_logo_shape: restaurantBranding.logo_shape,
      subtotal: 2295,
      delivery_fee: 185,
      discount_amount: 0,
      vat_amount: 185,
      total: 2480,
      items: [
        {
          order_item_id: 'it-1',
          item_id: 'menu-1',
          category: 'Mains',
          name: 'Chicken Biryani',
          quantity: 2,
          price: 1090,
          notes: 'No coriander please.',
          age_restricted: false,
          addons: [
            { order_addon_id: 'ad-1', option_id: 'opt-1', name: 'Raita', quantity: 1, price: 120 },
            { order_addon_id: 'ad-2', option_id: 'opt-2', name: 'Extra Spicy', quantity: 1, price: 0 },
          ],
        },
        {
          order_item_id: 'it-2',
          item_id: 'menu-2',
          category: 'Drinks',
          name: 'Craft Beer Bottle',
          quantity: 1,
          price: 450,
          notes: null,
          age_restricted: true,
          addons: [],
        },
        {
          order_item_id: 'it-3',
          item_id: 'menu-3',
          category: 'Desserts',
          name: 'Gulab Jamun',
          quantity: 1,
          price: 350,
          notes: 'Pack separately.',
          age_restricted: false,
          addons: [],
        },
      ],
    }),
    [restaurantBranding, resolvedPreviewRestaurantName]
  );

  const previewDocument = useMemo(
    () =>
      buildTicketDocument(
        {
          id: 'preview-print-job',
          ticket_type: previewTicketType as TicketType,
          source: 'manual_print',
          payload_json: previewPayload,
        },
        previewRule,
        { width: '80mm' }
      ),
    [previewPayload, previewRule, previewTicketType]
  );

  const previewSvg = useMemo(() => renderTicketDocumentSvg(previewDocument), [previewDocument]);
  const previewSvgDataUrl = useMemo(() => `data:image/svg+xml;base64,${typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(previewSvg.svg))) : Buffer.from(previewSvg.svg, 'utf8').toString('base64')}`, [previewSvg]);

  if (loading) return <div className="bg-white p-6 rounded-lg shadow">Loading printer settings...</div>;

  const isTicketTab = currentSubTab === 'kitchen-tickets' || currentSubTab === 'receipts';
  const activeTicketType: PreviewTicketType = currentSubTab === 'receipts' ? 'Invoice' : 'KOT';
  const triggerOptions = triggerOptionsByTicketType[activeTicketType];
  const draftTriggerValue = ruleDraft?.trigger_event || triggerOptions[0]?.value || '';

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          You can view these settings, but only RP-level users can make changes.
        </div>
      )}

      {showInternalSubTabNav && (
      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <nav className="flex flex-wrap gap-2" aria-label="Printing settings sections">
          {printingSubTabItems.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentSubTab(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${currentSubTab === key ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </section>
      )}

      {currentSubTab === 'alerts' && (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Printing Status</h2>
            <p className="text-sm text-gray-500">Global printing controls that apply across all tickets.</p>
          </div>
          <button
            onClick={saveSettings}
            disabled={!canEdit}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
          >
            Save Global Settings
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <label className="flex items-center justify-between border rounded-lg p-3">
            <span>Printing Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.printing_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, printing_enabled: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between border rounded-lg p-3">
            <span>Voice Alerts Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.voice_alert_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, voice_alert_enabled: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between border rounded-lg p-3">
            <span>Voice Reminder Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.voice_reminder_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, voice_reminder_enabled: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between border rounded-lg p-3">
            <span>Require Print for Voice</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.require_print_for_voice}
              onChange={(e) => setSettings((s) => ({ ...s, require_print_for_voice: e.target.checked }))}
            />
          </label>
        </div>
      </section>
      )}

      {currentSubTab === 'printers' && (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-xl font-semibold">Registered Printers</h2>
          <button
            disabled={!canEdit}
            onClick={() => {
              setEditingPrinter(null);
              setShowAddPrinter(true);
              setPrinterDraft({ name: '', role: 'kitchen', serial_number: '', is_default: false });
            }}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
          >
            + Add Printer
          </button>
        </div>
        <div className="grid gap-3">
          {printers.map((p) => (
            <div key={p.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">
                    {p.name}
                    {p.is_default && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700">Default</span>}
                  </p>
                  <p className="text-sm text-gray-600">Role: <span className="font-medium text-gray-800">{p.role}</span></p>
                  <p className="text-sm text-gray-600">Serial: {p.serial_number || 'Not set'} • Provider: {p.provider || 'Not set'}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2.5 py-1 font-medium ${p.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 font-medium ${printerStateBadgeClass[onlineStatusByPrinterId[p.id] || 'unknown']}`}>
                      {statusLoadingByPrinterId[p.id] ? 'Checking…' : (onlineStatusByPrinterId[p.id] || 'unknown').replace(/^./, (char) => char.toUpperCase())}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={!canEdit} onClick={() => queueTestPrint(p.id)} className="px-2.5 py-1.5 border rounded-lg text-sm disabled:opacity-60">Test Print</button>
                  <button disabled={!canEdit || statusLoadingByPrinterId[p.id]} onClick={() => checkOnlineStatus(p.id)} className="px-2.5 py-1.5 border rounded-lg text-sm disabled:opacity-60">{statusLoadingByPrinterId[p.id] ? 'Checking…' : 'Check Status'}</button>
                  <button
                    disabled={!canEdit}
                    onClick={() => {
                      setEditingPrinter(p);
                      setPrinterDraft({ name: p.name, role: p.role, serial_number: p.serial_number || '', is_default: p.is_default });
                      setShowAddPrinter(true);
                    }}
                    className="px-2.5 py-1.5 border rounded-lg text-sm disabled:opacity-60"
                  >
                    Edit
                  </button>
                  <button
                    disabled={!canEdit}
                    onClick={async () => {
                      const { error } = await supabase.from('printers').update({ enabled: !p.enabled }).eq('id', p.id).eq('restaurant_id', restaurantId);
                      if (error) return onToast(error.message);
                      onToast(`Printer ${p.enabled ? 'disabled' : 'enabled'}.`);
                      await loadData();
                    }}
                    className="px-2.5 py-1.5 border rounded-lg text-sm disabled:opacity-60"
                  >
                    {p.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {printers.length === 0 && <p className="text-sm text-gray-600">No printers yet.</p>}
        </div>
      </section>
      )}

      {isTicketTab && (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{activeTicketType === 'KOT' ? 'Kitchen Tickets' : 'Receipts'}</h2>
            <p className="text-sm text-gray-500">
              {activeTicketType === 'KOT' ? 'Configure kitchen ticket behavior and layout.' : 'Configure customer receipt behavior and layout.'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div className="space-y-4">
            {ruleDraft ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex justify-between border rounded-lg p-3 text-sm">
                    <span>Enabled</span>
                    <input disabled={!canEdit} type="checkbox" checked={ruleDraft.enabled} onChange={(e) => setRuleDraft({ ...ruleDraft, enabled: e.target.checked })} />
                  </label>
                  <label className="border rounded-lg p-3 text-sm">
                    <span className="block mb-1">Trigger Event</span>
                    <select disabled={!canEdit} className="w-full border rounded p-2" value={draftTriggerValue} onChange={(e) => setRuleDraft({ ...ruleDraft, trigger_event: e.target.value })}>
                      {triggerOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                      {!triggerOptions.some((option) => option.value === draftTriggerValue) && (
                        <option value={draftTriggerValue}>Custom ({draftTriggerValue})</option>
                      )}
                    </select>
                  </label>
                  <label className="border rounded-lg p-3 text-sm">
                    <span className="block mb-1">Copies</span>
                    <input disabled={!canEdit} type="number" min={1} className="w-full border rounded p-2" value={ruleDraft.copies || 1} onChange={(e) => setRuleDraft({ ...ruleDraft, copies: Number(e.target.value) || 1 })} />
                  </label>
                  {activeTicketType === 'KOT' && (
                    <label className="border rounded-lg p-3 text-sm">
                      <span className="block mb-1">Item Grouping</span>
                      <input disabled={!canEdit} className="w-full border rounded p-2" value={ruleDraft.item_grouping || ''} onChange={(e) => setRuleDraft({ ...ruleDraft, item_grouping: e.target.value })} />
                    </label>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium">Printer Assignment</p>
                  {printers.length === 0 ? (
                    <p className="text-xs text-gray-600">Add a printer to assign this ticket.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {printers.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                          <input disabled={!canEdit} type="checkbox" checked={rulePrinterDraftIds.includes(p.id)} onChange={(e) => setRulePrinterDraftIds((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium">{editorTicketType} Content Settings</p>
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    {(activeTicketType === 'KOT'
                      ? [
                          ['print_order_time', 'Print order time'],
                          ['print_item_notes', 'Print item notes'],
                          ['print_phone', 'Print phone'],
                          ['print_address', 'Print address'],
                          ['highlight_age_restricted', 'Highlight age restricted'],
                          ['divider_lines', 'Divider lines'],
                        ]
                      : [
                          ['print_logo', 'Print logo'],
                          ['print_restaurant_details', 'Print restaurant details'],
                          ['show_vat_breakdown', 'Show VAT breakdown'],
                        ]).map(([key, label]) => (
                      <label key={key} className="flex justify-between border rounded p-2">
                        <span>{label}</span>
                        <input disabled={!canEdit} type="checkbox" checked={Boolean((ruleDraft as any)[key])} onChange={(e) => setRuleDraft({ ...(ruleDraft as any), [key]: e.target.checked })} />
                      </label>
                    ))}

                    <div className="rounded border border-dashed p-2 text-xs text-gray-600 md:col-span-2">
                      <p>Order number: Always shown • Add-ons: Always shown • End of order footer: Always shown.</p>
                      <p>
                        {activeTicketType === 'KOT'
                          ? 'Order type, customer name, scheduled marker and payment status are always shown when available. Dietary markers are hidden by design.'
                          : 'Payment method and payment status are always shown when available.'}
                      </p>
                    </div>

                    {activeTicketType === 'Invoice' && (
                      <label className="border rounded p-2 md:col-span-2">
                        <span className="block mb-1">Custom receipt message</span>
                        <textarea disabled={!canEdit} className="w-full border rounded p-2" rows={3} value={ruleDraft.custom_message || ''} onChange={(e) => setRuleDraft({ ...ruleDraft, custom_message: e.target.value })} />
                      </label>
                    )}

                  </div>
                </div>

                <div className="flex justify-end">
                  <button disabled={!canEdit} onClick={saveRule} className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60">Save {editorTicketType} Rule</button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No {activeTicketType} rule found yet.</p>
            )}
          </div>

          <aside className="relative space-y-3 self-start justify-self-center w-full max-w-[440px] xl:sticky xl:top-24">
            <div className="mx-auto w-full max-w-[440px] overflow-hidden rounded-[28px] border border-stone-300 bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
              <div className="mx-auto rounded-[18px] border border-stone-300 bg-[#fffdfa] p-3 shadow-inner">
                <div className="mx-auto w-full max-w-[384px] overflow-hidden rounded-[14px] border border-stone-300 bg-white p-2">
                  <img src={previewSvgDataUrl} alt={`${previewTicketType} ticket preview`} className="block h-auto w-full" />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">Preview renders the canonical 80mm ticket document directly with the same layout source used by print output.</p>
          </aside>
        </div>
      </section>
      )}

      {currentSubTab === 'alerts' && (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Voice Alerts</h2>
          <button onClick={saveSettings} disabled={!canEdit} className="px-3 py-2 border rounded-lg text-sm disabled:opacity-60">Save Voice Settings</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <label className="border rounded-lg p-3">
            <span className="block mb-1">Default Voice Message</span>
            <input disabled={!canEdit} className="w-full border rounded p-2" value={settings.voice_message || ''} onChange={(e) => setSettings((s) => ({ ...s, voice_message: e.target.value }))} />
          </label>
          <label className="border rounded-lg p-3">
            <span className="block mb-1">Voice Repeat Count</span>
            <input disabled={!canEdit} type="number" min={1} className="w-full border rounded p-2" value={settings.voice_repeat_count || 1} onChange={(e) => setSettings((s) => ({ ...s, voice_repeat_count: Number(e.target.value) || 1 }))} />
          </label>
          <label className="border rounded-lg p-3">
            <span className="block mb-1">Voice Reminder Delay (seconds)</span>
            <input disabled={!canEdit} type="number" className="w-full border rounded p-2" value={settings.voice_reminder_delay_seconds || 0} onChange={(e) => setSettings((s) => ({ ...s, voice_reminder_delay_seconds: Number(e.target.value) || 0 }))} />
          </label>
          <label className="border rounded-lg p-3 md:col-span-2 lg:col-span-3">
            <span className="block mb-1">Reminder Message</span>
            <input disabled={!canEdit} className="w-full border rounded p-2" value={settings.voice_reminder_message || ''} onChange={(e) => setSettings((s) => ({ ...s, voice_reminder_message: e.target.value }))} />
          </label>
        </div>
      </section>
      )}

      {currentSubTab === 'diagnostics' && (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-xl font-semibold">Troubleshooting</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Time</th>
                <th className="py-2 text-left">Ticket Type</th>
                <th className="py-2 text-left">Printer</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Attempts</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b">
                  <td className="py-2">{new Date(j.created_at).toLocaleString()}</td>
                  <td>{j.ticket_type || '-'}</td>
                  <td>{j.printer_id ? printerById[j.printer_id]?.name || 'Unknown' : '-'}</td>
                  <td>{j.status || '-'}</td>
                  <td>{j.attempts ?? 0}</td>
                  <td>
                    <div className="flex gap-2">
                      <button disabled={!canEdit} onClick={() => queueJob('retry', j)} className="px-2 py-1 border rounded disabled:opacity-60">Retry</button>
                      <button disabled={!canEdit} onClick={() => queueJob('manual_reprint', j)} className="px-2 py-1 border rounded disabled:opacity-60">Reprint</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
      {showAddPrinter && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddPrinter(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{editingPrinter ? 'Edit Printer' : 'Add Printer'}</h3>
            <input
              placeholder="Printer Name"
              className="w-full border rounded p-2"
              value={printerDraft.name}
              onChange={(e) => setPrinterDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <select
              className="w-full border rounded p-2"
              value={printerDraft.role}
              onChange={(e) => setPrinterDraft((d) => ({ ...d, role: e.target.value }))}
            >
              {printerRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              placeholder="Serial Number"
              className="w-full border rounded p-2"
              value={printerDraft.serial_number}
              onChange={(e) => setPrinterDraft((d) => ({ ...d, serial_number: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={printerDraft.is_default}
                onChange={(e) => setPrinterDraft((d) => ({ ...d, is_default: e.target.checked }))}
              />
              Set as Default Printer
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddPrinter(false)} className="px-3 py-2 border rounded">
                Cancel
              </button>
              <button
                disabled={!canEdit || !printerDraft.name.trim()}
                onClick={savePrinter}
                className="px-3 py-2 bg-teal-600 text-white rounded disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
