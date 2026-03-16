export type TicketType = 'KOT' | 'Invoice';

export interface PrintRuleLike {
  print_order_time?: boolean;
  print_phone?: boolean;
  print_address?: boolean;
  print_item_notes?: boolean;
  divider_lines?: boolean;
  print_restaurant_details?: boolean;
  show_vat_breakdown?: boolean;
  custom_message?: string | null;
  highlight_age_restricted?: boolean;
  item_grouping?: string | null;
  print_logo?: boolean;
}

export interface PrintJobLike {
  id: string;
  ticket_type: TicketType;
  source?: string | null;
  payload_json: any;
}

export interface TicketBuildOptions {
  width?: '58mm' | '80mm';
}

const getLine = (width: '58mm' | '80mm') => '-'.repeat(width === '80mm' ? 48 : 32);
const getMaxLineLength = (width: '58mm' | '80mm') => (width === '80mm' ? 48 : 32);

const fmtDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '-');
const fmtMoney = (value: number | null | undefined) => `£${((value || 0) / 100).toFixed(2)}`;

const toHex = (value: string) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('hex');
  }
  const bytes = new TextEncoder().encode(value);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const utf8Bytes = (value: string) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8');
  }
  return new TextEncoder().encode(value);
};

function buildTestEscPosHex(job: PrintJobLike) {
  const payload = job.payload_json || {};
  const lines = [
    '*** ORDERFAST TEST ***',
    `Printer: ${payload.printer_name || 'Printer'}`,
    `Restaurant: ${payload.restaurant_name || 'Restaurant'}`,
    'Printer connection successful',
    '',
    '',
  ];

  const text = `${lines.join('\n')}\n`;
  const initCommand = [0x1b, 0x40];
  const cutCommand = [0x1d, 0x56, 0x00];

  const bytes = new Uint8Array([...initCommand, ...utf8Bytes(text), ...cutCommand]);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { text, hex };
}

const trimLine = (text: string, width: '58mm' | '80mm') => {
  const max = getMaxLineLength(width);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
};

const addressText = (address: any) =>
  [address?.address_line_1, address?.address_line_2, address?.postcode].filter(Boolean).join(', ');

function getGroupedItems(payload: any, rule: PrintRuleLike) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (rule.item_grouping && rule.item_grouping !== 'none') {
    return items
      .slice()
      .sort((a: any, b: any) => String(a?.category || '').localeCompare(String(b?.category || '')));
  }
  return items;
}

function buildKotContent(job: PrintJobLike, rule: PrintRuleLike, width: '58mm' | '80mm') {
  const payload = job.payload_json || {};
  const line = getLine(width);
  const lines: string[] = [];

  lines.push(trimLine('*** KITCHEN ORDER TICKET ***', width));
  lines.push(trimLine(`ORDER #${payload.order_number ?? String(payload.order_id || job.id).slice(0, 8)}`, width));
  lines.push(trimLine(`Type: ${(payload.order_type || 'unknown').toUpperCase()}`, width));

  if (payload.customer_name) lines.push(trimLine(`Customer: ${payload.customer_name}`, width));
  if (payload.scheduled_for) lines.push(trimLine('*** SCHEDULED ORDER ***', width));
  if (rule.print_order_time !== false) lines.push(trimLine(`Time: ${fmtDate(payload.created_at)}`, width));
  if (payload.payment_status) lines.push(trimLine(`Payment: ${payload.payment_status}`, width));
  if (rule.print_phone && payload.customer_phone) lines.push(trimLine(`Phone: ${payload.customer_phone}`, width));
  if (rule.print_address && payload.delivery_address) {
    const address = addressText(payload.delivery_address);
    if (address) lines.push(trimLine(`Address: ${address}`, width));
  }

  lines.push('');
  if (rule.divider_lines) lines.push(line);

  const items = getGroupedItems(payload, rule);
  let lastCategory = '';
  items.forEach((item: any) => {
    const category = String(item?.category || '').trim();
    if (category && rule.item_grouping && rule.item_grouping !== 'none' && category !== lastCategory) {
      lines.push(trimLine(`[${category.toUpperCase()}]`, width));
      lastCategory = category;
    }

    lines.push(trimLine(`${Number(item.quantity || 0)}x ${item.name || 'Item'}`, width));

    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => lines.push(trimLine(`  + ${Number(addon.quantity || 0)}x ${addon.name || 'Addon'}`, width)));

    if (rule.print_item_notes !== false && item.notes) {
      lines.push(trimLine(`  !! NOTE: ${item.notes}`, width));
    }

    if (rule.highlight_age_restricted !== false && item.age_restricted) {
      lines.push(trimLine('  [AGE-RESTRICTED]', width));
    }

    if (rule.divider_lines) lines.push(line);
  });

  lines.push('END OF ORDER');
  lines.push('');
  return lines.join('\n');
}

function buildInvoiceContent(job: PrintJobLike, rule: PrintRuleLike, width: '58mm' | '80mm') {
  const payload = job.payload_json || {};
  const line = getLine(width);
  const lines: string[] = [];

  lines.push(trimLine('*** ORDER RECEIPT ***', width));
  if (rule.print_logo) {
    lines.push(trimLine('[LOGO PLACEHOLDER]', width));
  }
  if (rule.print_restaurant_details && payload.restaurant_name) {
    lines.push(trimLine(payload.restaurant_name, width));
    if (payload.restaurant_phone) lines.push(trimLine(payload.restaurant_phone, width));
  }

  lines.push(trimLine(`Order #${payload.order_number ?? String(payload.order_id || job.id).slice(0, 8)}`, width));
  lines.push(trimLine(`Date: ${fmtDate(payload.created_at)}`, width));
  if (payload.payment_status) lines.push(trimLine(`Payment: ${payload.payment_status}`, width));
  if (payload.payment_method) lines.push(trimLine(`Method: ${payload.payment_method}`, width));
  lines.push(line);

  const items = getGroupedItems(payload, rule);
  items.forEach((item: any) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    lines.push(trimLine(`${qty}x ${item.name || 'Item'} ${fmtMoney(price * qty)}`, width));

    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => {
      const aq = Number(addon.quantity || 0);
      const ap = Number(addon.price || 0);
      lines.push(trimLine(`  + ${aq}x ${addon.name || 'Addon'} ${fmtMoney(ap * aq)}`, width));
    });
  });

  lines.push(line);
  if (rule.show_vat_breakdown && typeof payload.vat_amount === 'number') {
    lines.push(trimLine(`VAT: ${fmtMoney(payload.vat_amount)}`, width));
  }
  lines.push(trimLine(`TOTAL: ${fmtMoney(Number(payload.total || 0))}`, width));
  if (rule.custom_message) lines.push(trimLine(rule.custom_message, width));
  if (payload.qr_placeholder) lines.push(trimLine('[QR / PROMO PLACEHOLDER]', width));
  lines.push('Thank you.');
  lines.push('');

  return lines.join('\n');
}

export function buildTicketText(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  const width = options.width || '58mm';

  if (job.source === 'test') {
    const p = job.payload_json || {};
    return [
      '*** PRINTER TEST ***',
      p.restaurant_name || 'Restaurant',
      p.printer_name || 'Printer',
      fmtDate(p.created_at || new Date().toISOString()),
      'Printer test successful',
      '',
    ]
      .map((l) => trimLine(String(l), width))
      .join('\n');
  }

  return job.ticket_type === 'Invoice'
    ? buildInvoiceContent(job, rule, width)
    : buildKotContent(job, rule, width);
}

export function buildSunmiPrintHexContent(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  if (job.source === 'test') {
    return buildTestEscPosHex(job);
  }

  const text = buildTicketText(job, rule, options);
  return {
    text,
    hex: toHex(text),
  };
}
