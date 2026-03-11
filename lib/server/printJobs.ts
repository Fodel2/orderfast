import crypto from 'crypto';
import { supaServer } from '@/lib/supaServer';

type TicketType = 'kot' | 'invoice';
export type PrintJobSource = 'auto' | 'manual_print' | 'manual_reprint' | 'retry' | 'test';
type TriggerEvent = 'order_placed' | 'payment_succeeded' | 'order_accepted' | 'scheduled_prep_window';

export interface CreatePrintJobsInput {
  restaurantId: string;
  orderId: string;
  ticketType: TicketType;
  source: PrintJobSource;
  triggerEvent?: TriggerEvent;
  dedupeToken?: string;
}

interface OrderSnapshot {
  order_id: string;
  order_number: number | null;
  created_at: string | null;
  accepted_at: string | null;
  order_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: unknown;
  items: Array<{
    order_item_id: string;
    item_id: string | null;
    name: string;
    quantity: number;
    notes: string | null;
    addons: Array<{
      order_addon_id: string;
      option_id: string | null;
      name: string;
      quantity: number;
    }>;
    age_restricted: boolean;
  }>;
  total: number;
  age_restricted_items: Array<{ item_id: string | null; name: string }>;
}

const toDbTicketType = (ticketType: TicketType) => (ticketType === 'kot' ? 'KOT' : 'Invoice');

const hashDedupe = (parts: string[]) => crypto.createHash('sha256').update(parts.join('|')).digest('hex');

async function buildOrderSnapshot(orderId: string): Promise<OrderSnapshot | null> {
  const { data: order, error } = await supaServer
    .from('orders')
    .select(
      `id,short_order_number,created_at,accepted_at,order_type,customer_name,phone_number,delivery_address,total_price,
      order_items(id,item_id,name,quantity,notes,order_addons(id,option_id,name,quantity))`
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    console.error('[PRINT JOB] failed to load order snapshot order', { orderId, error });
    return null;
  }

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const itemIds = orderItems.map((item: any) => item.item_id).filter(Boolean);

  const ageRestrictedByItemId = new Map<string, boolean>();
  if (itemIds.length > 0) {
    const { data: menuItems } = await supaServer.from('menu_items').select('id,is_18_plus').in('id', itemIds);
    (menuItems || []).forEach((item: any) => {
      ageRestrictedByItemId.set(String(item.id), Boolean(item.is_18_plus));
    });
  }

  const items = orderItems.map((item: any) => {
    const addons = Array.isArray(item.order_addons) ? item.order_addons : [];
    const ageRestricted = item.item_id ? Boolean(ageRestrictedByItemId.get(String(item.item_id))) : false;
    return {
      order_item_id: item.id,
      item_id: item.item_id ?? null,
      name: item.name,
      quantity: Number(item.quantity || 0),
      notes: item.notes ?? null,
      addons: addons.map((addon: any) => ({
        order_addon_id: addon.id,
        option_id: addon.option_id ?? null,
        name: addon.name,
        quantity: Number(addon.quantity || 0),
      })),
      age_restricted: ageRestricted,
    };
  });

  const ageRestrictedItems = items
    .filter((item) => item.age_restricted)
    .map((item) => ({ item_id: item.item_id ?? null, name: item.name }));

  return {
    order_id: order.id,
    order_number: order.short_order_number ?? null,
    created_at: order.created_at ?? null,
    accepted_at: order.accepted_at ?? null,
    order_type: order.order_type ?? null,
    customer_name: order.customer_name ?? null,
    customer_phone: order.phone_number ?? null,
    delivery_address: order.delivery_address ?? null,
    items,
    total: Number(order.total_price || 0),
    age_restricted_items: ageRestrictedItems,
  };
}

export async function createPrintJobs(input: CreatePrintJobsInput): Promise<{ created: number; skipped: boolean; reason?: string }> {
  const dbTicketType = toDbTicketType(input.ticketType);

  const [{ data: settings }, { data: rule }] = await Promise.all([
    supaServer.from('printer_settings').select('printing_enabled,voice_alert_enabled,voice_message').eq('restaurant_id', input.restaurantId).maybeSingle(),
    supaServer
      .from('print_rules')
      .select('id,enabled,copies,trigger_event,ticket_type')
      .eq('restaurant_id', input.restaurantId)
      .eq('ticket_type', dbTicketType)
      .maybeSingle(),
  ]);

  if (input.source === 'auto' && settings && settings.printing_enabled === false) {
    return { created: 0, skipped: true, reason: 'printing_disabled' };
  }

  if (!rule) {
    return { created: 0, skipped: true, reason: 'missing_rule' };
  }

  if (input.source === 'auto') {
    if (!rule.enabled) {
      return { created: 0, skipped: true, reason: 'rule_disabled' };
    }
    if (input.triggerEvent && rule.trigger_event !== input.triggerEvent) {
      return { created: 0, skipped: true, reason: 'trigger_mismatch' };
    }
  }

  const { data: assignedRows } = await supaServer
    .from('print_rule_printers')
    .select('printer_id,printers!inner(id,restaurant_id,provider,serial_number,enabled,is_default)')
    .eq('print_rule_id', rule.id);

  let targetPrinters = (assignedRows || [])
    .map((row: any) => row.printers)
    .filter((printer: any) => printer && printer.restaurant_id === input.restaurantId && printer.enabled !== false);

  if (targetPrinters.length === 0) {
    const { data: defaultPrinter } = await supaServer
      .from('printers')
      .select('id,restaurant_id,provider,serial_number,enabled,is_default')
      .eq('restaurant_id', input.restaurantId)
      .eq('enabled', true)
      .eq('is_default', true)
      .maybeSingle();
    if (defaultPrinter) {
      targetPrinters = [defaultPrinter];
    }
  }

  if (targetPrinters.length === 0) {
    return { created: 0, skipped: true, reason: 'no_target_printers' };
  }

  const snapshot = await buildOrderSnapshot(input.orderId);
  if (!snapshot) {
    return { created: 0, skipped: true, reason: 'order_not_found' };
  }

  const copies = Math.max(1, Number(rule.copies || 1));
  const rows: any[] = [];
  const dedupeSeed = input.dedupeToken || (input.source === 'auto' ? input.triggerEvent || 'auto' : `${Date.now()}`);

  targetPrinters.forEach((printer: any) => {
    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      rows.push({
        restaurant_id: input.restaurantId,
        order_id: input.orderId,
        print_rule_id: rule.id,
        printer_id: printer.id,
        ticket_type: dbTicketType,
        provider: printer.provider ?? null,
        serial_number: printer.serial_number ?? null,
        source: input.source,
        status: 'pending',
        attempts: 0,
        payload_json: snapshot,
        voice_enabled: Boolean(settings?.voice_alert_enabled),
        voice_message: settings?.voice_message ?? null,
        dedupe_key: hashDedupe([
          input.restaurantId,
          input.orderId,
          dbTicketType,
          input.source,
          String(printer.id),
          String(copyIndex + 1),
          dedupeSeed,
        ]),
      });
    }
  });

  const { data: inserted, error } = await supaServer
    .from('print_jobs')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id,printer_id');

  if (error) {
    console.error('[PRINT JOB] failed to insert print jobs', { input, error });
    throw error;
  }

  (inserted || []).forEach((job) => {
    console.log('[PRINT JOB CREATED]', {
      restaurant_id: input.restaurantId,
      order_id: input.orderId,
      ticket_type: dbTicketType,
      printer_id: job.printer_id,
      source: input.source,
    });
  });

  return { created: inserted?.length || 0, skipped: false };
}
