import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { requestPrintJobCreation } from '@/lib/print-jobs/request';
import { buildTicketText, type PrintRuleLike, type TicketType } from '@/lib/server/printContentBuilder';

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
type PreviewWidth = '58mm' | '80mm';

export default function PrinterSettingsTab({
  restaurantId,
  canEdit,
  onToast,
}: {
  restaurantId: string;
  canEdit: boolean;
  onToast: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PrinterSettings>(defaultSettings);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [rules, setRules] = useState<PrintRule[]>([]);
  const [rulePrinterMap, setRulePrinterMap] = useState<Record<string, string[]>>({});
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [editingRule, setEditingRule] = useState<PrintRule | null>(null);
  const [printerDraft, setPrinterDraft] = useState({
    name: '',
    role: 'kitchen',
    serial_number: '',
    is_default: false,
  });
  const [ruleDraft, setRuleDraft] = useState<PrintRule | null>(null);
  const [rulePrinterDraftIds, setRulePrinterDraftIds] = useState<string[]>([]);
  const [onlineStatusByPrinterId, setOnlineStatusByPrinterId] = useState<Record<string, string>>({});
  const [previewTicketType, setPreviewTicketType] = useState<PreviewTicketType>('KOT');
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>('58mm');

  const printerById = useMemo(
    () => printers.reduce<Record<string, Printer>>((acc, p) => ((acc[p.id] = p), acc), {}),
    [printers]
  );

  const loadData = async () => {
    setLoading(true);
    const [settingsRes, printersRes, rulesRes, jobsRes] = await Promise.all([
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
    ]);

    if (settingsRes.data) setSettings({ ...defaultSettings, ...(settingsRes.data as any) });
    if (printersRes.data) setPrinters(printersRes.data as any);

    if (rulesRes.data) {
      const list = rulesRes.data as PrintRule[];
      setRules(
        [...list].sort(
          (a, b) => ['KOT', 'Invoice'].indexOf(a.ticket_type) - ['KOT', 'Invoice'].indexOf(b.ticket_type)
        )
      );
      if (list.length) {
        const { data } = await supabase
          .from('print_rule_printers')
          .select('print_rule_id,printer_id')
          .in('print_rule_id', list.map((r) => r.id));
        const next: Record<string, string[]> = {};
        (data || []).forEach((row: any) => {
          if (!next[row.print_rule_id]) next[row.print_rule_id] = [];
          next[row.print_rule_id].push(row.printer_id);
        });
        setRulePrinterMap(next);
      }
    }

    if (jobsRes.data) setJobs(jobsRes.data as any);
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantId) loadData();
  }, [restaurantId]);

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
    } catch (error: any) {
      onToast(`Could not create print job: ${error?.message || 'Unknown error'}`);
    }
  };

  const checkOnlineStatus = async (printerId: string) => {
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
      const rawStatus =
        payload?.status?.online ?? payload?.status?.status ?? payload?.raw?.data ?? payload?.raw ?? 'online';
      setOnlineStatusByPrinterId((prev) => ({
        ...prev,
        [printerId]: typeof rawStatus === 'string' ? rawStatus : JSON.stringify(rawStatus),
      }));
      onToast('Printer status checked.');
    } catch (error: any) {
      setOnlineStatusByPrinterId((prev) => ({ ...prev, [printerId]: 'offline/unknown' }));
      onToast(`Could not check printer status: ${error?.message || 'Unknown error'}`);
    }
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
    } catch (error: any) {
      onToast(`Could not create test print: ${error?.message || 'Unknown error'}`);
    }
  };

  const saveRule = async () => {
    if (!canEdit || !ruleDraft) return;
    const { error } = await supabase
      .from('print_rules')
      .update(ruleDraft)
      .eq('id', ruleDraft.id)
      .eq('restaurant_id', restaurantId);
    if (error) return onToast(`Could not save rule: ${error.message}`);

    const { error: deleteError } = await supabase
      .from('print_rule_printers')
      .delete()
      .eq('print_rule_id', ruleDraft.id);
    if (deleteError) return onToast(`Could not update assigned printers: ${deleteError.message}`);

    if (rulePrinterDraftIds.length) {
      const { error: insertError } = await supabase
        .from('print_rule_printers')
        .insert(rulePrinterDraftIds.map((printer_id) => ({ print_rule_id: ruleDraft.id, printer_id })));
      if (insertError) return onToast(`Could not update assigned printers: ${insertError.message}`);
    }

    setEditingRule(null);
    setRuleDraft(null);
    onToast('Print rule saved.');
    await loadData();
  };

  const previewRule = useMemo(() => {
    const baseRule = rules.find((rule) => rule.ticket_type === previewTicketType);
    const editingSameRule = editingRule?.ticket_type === previewTicketType && ruleDraft;
    return { ...defaultPreviewRule, ...(baseRule || {}), ...(editingSameRule ? ruleDraft : {}) } as PrintRuleLike;
  }, [rules, editingRule, ruleDraft, previewTicketType]);

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
      delivery_address: {
        address_line_1: '12 Market Street',
        address_line_2: 'Flat 3B',
        postcode: 'E1 6AN',
      },
      payment_status: 'paid',
      payment_method: 'card',
      restaurant_name: 'Orderfast Demo Kitchen',
      restaurant_phone: '+44 20 7946 0000',
      vat_amount: 185,
      total: 2480,
      qr_placeholder: true,
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
    []
  );

  const previewText = useMemo(
    () =>
      buildTicketText(
        {
          id: 'preview-print-job',
          ticket_type: previewTicketType as TicketType,
          source: 'manual_print',
          payload_json: previewPayload,
        },
        previewRule,
        { width: previewWidth }
      ),
    [previewPayload, previewRule, previewTicketType, previewWidth]
  );

  if (loading) return <div className="bg-white p-6 rounded-lg shadow">Loading printer settings...</div>;

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          You can view these settings, but only RP-level users can make changes.
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Printing Status</h2>
          <button
            onClick={saveSettings}
            disabled={!canEdit}
            className="px-3 py-2 bg-teal-600 text-white rounded disabled:opacity-60"
          >
            Save
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="flex justify-between border p-3 rounded">
            <span>Printing Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.printing_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, printing_enabled: e.target.checked }))}
            />
          </label>
          <label className="flex justify-between border p-3 rounded">
            <span>Voice Alerts Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.voice_alert_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, voice_alert_enabled: e.target.checked }))}
            />
          </label>
          <label className="border p-3 rounded md:col-span-2">
            <span className="block mb-1">Default Voice Message</span>
            <input
              disabled={!canEdit}
              className="w-full border rounded p-2"
              value={settings.voice_message || ''}
              onChange={(e) => setSettings((s) => ({ ...s, voice_message: e.target.value }))}
            />
          </label>
          <label className="flex justify-between border p-3 rounded">
            <span>Voice Reminder Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.voice_reminder_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, voice_reminder_enabled: e.target.checked }))}
            />
          </label>
          <label className="border p-3 rounded">
            <span className="block mb-1">Voice Reminder Delay</span>
            <input
              disabled={!canEdit}
              type="number"
              className="w-full border rounded p-2"
              value={settings.voice_reminder_delay_seconds || 0}
              onChange={(e) =>
                setSettings((s) => ({ ...s, voice_reminder_delay_seconds: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Registered Printers</h2>
          <button
            disabled={!canEdit}
            onClick={() => {
              setEditingPrinter(null);
              setShowAddPrinter(true);
              setPrinterDraft({ name: '', role: 'kitchen', serial_number: '', is_default: false });
            }}
            className="px-3 py-2 bg-teal-600 text-white rounded disabled:opacity-60"
          >
            + Add Printer
          </button>
        </div>
        {printers.map((p) => (
          <div key={p.id} className="border rounded p-3 flex flex-col md:flex-row md:justify-between gap-2">
            <div>
              <p className="font-semibold">
                {p.name}
                {p.is_default && (
                  <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">Default</span>
                )}
              </p>
              <p className="text-sm text-gray-600">
                Role: {p.role} • Provider: {p.provider || 'Not set'} • Serial: {p.serial_number || 'Not set'} •{' '}
                {p.enabled ? 'Enabled' : 'Disabled'} • Online: {onlineStatusByPrinterId[p.id] || 'Unknown'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                disabled={!canEdit}
                onClick={() => queueTestPrint(p.id)}
                className="px-2 py-1 border rounded disabled:opacity-60"
              >
                Test Print
              </button>
              <button
                disabled={!canEdit}
                onClick={() => checkOnlineStatus(p.id)}
                className="px-2 py-1 border rounded disabled:opacity-60"
              >
                Check Status
              </button>
              <button
                disabled={!canEdit}
                onClick={() => {
                  setEditingPrinter(p);
                  setPrinterDraft({
                    name: p.name,
                    role: p.role,
                    serial_number: p.serial_number || '',
                    is_default: p.is_default,
                  });
                  setShowAddPrinter(true);
                }}
                className="px-2 py-1 border rounded disabled:opacity-60"
              >
                Edit
              </button>
              <button
                disabled={!canEdit}
                onClick={async () => {
                  const { error } = await supabase
                    .from('printers')
                    .update({ enabled: !p.enabled })
                    .eq('id', p.id)
                    .eq('restaurant_id', restaurantId);
                  if (error) return onToast(error.message);
                  await loadData();
                }}
                className="px-2 py-1 border rounded disabled:opacity-60"
              >
                {p.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
        {printers.length === 0 && <p className="text-sm text-gray-600">No printers yet.</p>}
      </section>

      <section className="bg-white p-6 rounded-lg shadow space-y-3">
        <h2 className="text-xl font-semibold">Ticket Printing Rules</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Ticket Type</th>
                <th className="py-2 text-left">Enabled</th>
                <th className="py-2 text-left">Trigger Event</th>
                <th className="py-2 text-left">Copies</th>
                <th className="py-2 text-left">Assigned Printers</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => {
                    setEditingRule(r);
                    setRuleDraft(r);
                    setRulePrinterDraftIds(rulePrinterMap[r.id] || []);
                  }}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                >
                  <td className="py-2">{r.ticket_type}</td>
                  <td>{r.enabled ? 'On' : 'Off'}</td>
                  <td>{r.trigger_event || '-'}</td>
                  <td>{r.copies || 1}</td>
                  <td>
                    {(rulePrinterMap[r.id] || []).map((id) => printerById[id]?.name || 'Unknown').join(', ') ||
                      'No printers assigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold">Ticket Preview</h2>

        <div className="flex flex-wrap items-center gap-2">
          {(['KOT', 'Invoice'] as PreviewTicketType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setPreviewTicketType(type)}
              className={`px-3 py-1.5 rounded border text-sm font-medium ${
                previewTicketType === type
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {type} Preview
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-500">Width</span>
            {(['58mm', '80mm'] as PreviewWidth[]).map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => setPreviewWidth(width)}
                className={`px-2.5 py-1 rounded border ${
                  previewWidth === width
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {width}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center md:justify-start">
          <div
            className={`rounded-lg border border-gray-300 bg-[#faf9f6] p-4 shadow-inner overflow-auto w-full ${
              previewWidth === '58mm' ? 'max-w-[24rem]' : 'max-w-[34rem]'
            }`}
          >
            <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap break-words text-gray-900">
              {previewText}
            </pre>
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Preview based on current settings. Final printer output may vary slightly by printer model.
        </p>
      </section>

      <section className="bg-white p-6 rounded-lg shadow space-y-3">
        <h2 className="text-xl font-semibold">Voice Alerts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <label className="flex justify-between border rounded p-3">
            <span>Voice Alerts Enabled</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.voice_alert_enabled}
              onChange={(e) => setSettings((s) => ({ ...s, voice_alert_enabled: e.target.checked }))}
            />
          </label>
          <label className="flex justify-between border rounded p-3">
            <span>Require Print for Voice</span>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={settings.require_print_for_voice}
              onChange={(e) => setSettings((s) => ({ ...s, require_print_for_voice: e.target.checked }))}
            />
          </label>
          <label className="border rounded p-3">
            <span className="block mb-1">Voice Repeat Count</span>
            <input
              disabled={!canEdit}
              type="number"
              min={1}
              className="w-full border rounded p-2"
              value={settings.voice_repeat_count || 1}
              onChange={(e) =>
                setSettings((s) => ({ ...s, voice_repeat_count: Number(e.target.value) || 1 }))
              }
            />
          </label>
          <label className="border rounded p-3">
            <span className="block mb-1">Reminder Message</span>
            <input
              disabled={!canEdit}
              className="w-full border rounded p-2"
              value={settings.voice_reminder_message || ''}
              onChange={(e) => setSettings((s) => ({ ...s, voice_reminder_message: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow space-y-3">
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
                      <button
                        disabled={!canEdit}
                        onClick={() => queueJob('retry', j)}
                        className="px-2 py-1 border rounded disabled:opacity-60"
                      >
                        Retry
                      </button>
                      <button
                        disabled={!canEdit}
                        onClick={() => queueJob('manual_reprint', j)}
                        className="px-2 py-1 border rounded disabled:opacity-60"
                      >
                        Reprint
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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

      {editingRule && ruleDraft && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setEditingRule(null);
            setRuleDraft(null);
          }}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Edit {editingRule.ticket_type} Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <label className="flex justify-between border rounded p-2">
                <span>Enabled</span>
                <input
                  disabled={!canEdit}
                  type="checkbox"
                  checked={ruleDraft.enabled}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, enabled: e.target.checked })}
                />
              </label>
              <label className="border rounded p-2">
                <span className="block mb-1">Trigger Event</span>
                <input
                  disabled={!canEdit}
                  className="w-full border rounded p-2"
                  value={ruleDraft.trigger_event || ''}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, trigger_event: e.target.value })}
                />
              </label>
              <label className="border rounded p-2">
                <span className="block mb-1">Copies</span>
                <input
                  disabled={!canEdit}
                  type="number"
                  min={1}
                  className="w-full border rounded p-2"
                  value={ruleDraft.copies || 1}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, copies: Number(e.target.value) || 1 })}
                />
              </label>
              <label className="border rounded p-2">
                <span className="block mb-1">Item Grouping</span>
                <input
                  disabled={!canEdit}
                  className="w-full border rounded p-2"
                  value={ruleDraft.item_grouping || ''}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, item_grouping: e.target.value })}
                />
              </label>

              {[
                ['print_order_time', 'Print Order Time'],
                ['print_item_notes', 'Print Item Notes'],
                ['print_phone', 'Print Phone'],
                ['print_address', 'Print Address'],
                ['highlight_age_restricted', 'Highlight Age Restricted'],
                ['divider_lines', 'Divider Lines'],
                ['print_logo', 'Print Logo'],
                ['print_restaurant_details', 'Print Restaurant Details'],
                ['show_vat_breakdown', 'Show VAT Breakdown'],
              ].map(([key, label]) => (
                <label key={key} className="flex justify-between border rounded p-2">
                  <span>{label}</span>
                  <input
                    disabled={!canEdit}
                    type="checkbox"
                    checked={Boolean((ruleDraft as any)[key])}
                    onChange={(e) => setRuleDraft({ ...(ruleDraft as any), [key]: e.target.checked })}
                  />
                </label>
              ))}

              <label className="border rounded p-2 md:col-span-2">
                <span className="block mb-1">Custom Message</span>
                <textarea
                  disabled={!canEdit}
                  className="w-full border rounded p-2"
                  rows={3}
                  value={ruleDraft.custom_message || ''}
                  onChange={(e) => setRuleDraft({ ...ruleDraft, custom_message: e.target.value })}
                />
              </label>
            </div>

            <div>
              <p className="font-medium mb-2">Assigned Printers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {printers.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 border rounded p-2 text-sm">
                    <input
                      disabled={!canEdit}
                      type="checkbox"
                      checked={rulePrinterDraftIds.includes(p.id)}
                      onChange={(e) =>
                        setRulePrinterDraftIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingRule(null);
                  setRuleDraft(null);
                }}
                className="px-3 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                disabled={!canEdit}
                onClick={saveRule}
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
