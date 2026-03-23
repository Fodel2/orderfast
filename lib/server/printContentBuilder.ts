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

const getLine = (width: '58mm' | '80mm') => '─'.repeat(width === '80mm' ? 48 : 32);
const getMaxLineLength = (width: '58mm' | '80mm') => (width === '80mm' ? 48 : 32);
const getFeedLines = (width: '58mm' | '80mm') => (width === '80mm' ? 4 : 3);

const fmtDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '-');
const fmtMoney = (value: number | null | undefined) => `£${((value || 0) / 100).toFixed(2)}`;
const centerText = (text: string, width: '58mm' | '80mm') => {
  const trimmed = trimLine(text, width);
  const max = getMaxLineLength(width);
  const leftPad = Math.max(0, Math.floor((max - trimmed.length) / 2));
  return `${' '.repeat(leftPad)}${trimmed}`;
};
const padColumns = (left: string, right: string, width: '58mm' | '80mm') => {
  const max = getMaxLineLength(width);
  const safeRight = trimLine(right, width);
  if (!safeRight) return trimLine(left, width);
  if (safeRight.length >= max - 1) return `${trimLine(left, width)}\n${safeRight}`;
  const leftWidth = max - safeRight.length - 1;
  const safeLeft = left.length > leftWidth ? `${left.slice(0, Math.max(0, leftWidth - 1))}…` : left;
  return `${safeLeft.padEnd(leftWidth, ' ')} ${safeRight}`;
};

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

function pushFeedSpace(lines: string[], width: '58mm' | '80mm') {
  for (let index = 0; index < getFeedLines(width); index += 1) {
    lines.push('');
  }
}

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
  const orderNumber = payload.order_number ?? String(payload.order_id || job.id).slice(0, 8);

  lines.push(centerText('KITCHEN ORDER TICKET', width));
  lines.push(centerText(`ORDER #${orderNumber}`, width));
  if (payload.scheduled_for) lines.push(centerText('SCHEDULED ORDER', width));
  lines.push(line);
  lines.push(padColumns('ORDER TYPE', String(payload.order_type || 'unknown').toUpperCase(), width));
  if (payload.customer_name) lines.push(padColumns('CUSTOMER', String(payload.customer_name), width));
  if (rule.print_order_time !== false) lines.push(padColumns('PLACED', fmtDate(payload.created_at), width));
  if (payload.payment_status) lines.push(padColumns('PAYMENT', String(payload.payment_status).toUpperCase(), width));
  if (rule.print_phone && payload.customer_phone) lines.push(trimLine(`PHONE  ${payload.customer_phone}`, width));
  if (rule.print_address && payload.delivery_address) {
    const address = addressText(payload.delivery_address);
    if (address) lines.push(trimLine(`ADDRESS ${address}`, width));
  }

  lines.push('');

  const items = getGroupedItems(payload, rule);
  let lastCategory = '';
  items.forEach((item: any, index: number) => {
    const category = String(item?.category || '').trim();
    if (category && rule.item_grouping && rule.item_grouping !== 'none' && category !== lastCategory) {
      if (index > 0) lines.push('');
      lines.push(line);
      lines.push(centerText(category.toUpperCase(), width));
      lines.push(line);
      lastCategory = category;
    } else if (index > 0 && !rule.divider_lines) {
      lines.push('');
    }

    lines.push(trimLine(`${Number(item.quantity || 0)}x ${item.name || 'Item'}`, width));

    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => lines.push(trimLine(`  + ${Number(addon.quantity || 0)}x ${addon.name || 'Addon'}`, width)));

    if (rule.print_item_notes !== false && item.notes) {
      lines.push(trimLine(`  NOTE  ${item.notes}`, width));
    }

    if (rule.highlight_age_restricted !== false && item.age_restricted) {
      lines.push(trimLine('  AGE CHECK REQUIRED', width));
    }

    if (rule.divider_lines) {
      lines.push('');
      lines.push(line);
    }
  });

  lines.push(centerText('END OF ORDER', width));
  pushFeedSpace(lines, width);
  return lines.join('\n');
}

function buildInvoiceContent(job: PrintJobLike, rule: PrintRuleLike, width: '58mm' | '80mm') {
  const payload = job.payload_json || {};
  const line = getLine(width);
  const lines: string[] = [];
  const orderNumber = payload.order_number ?? String(payload.order_id || job.id).slice(0, 8);

  lines.push(centerText('CUSTOMER RECEIPT', width));
  if (rule.print_logo) lines.push(centerText('[LOGO PLACEHOLDER]', width));
  if (rule.print_restaurant_details && payload.restaurant_name) {
    lines.push(centerText(String(payload.restaurant_name), width));
    if (payload.restaurant_phone) lines.push(centerText(String(payload.restaurant_phone), width));
  }
  lines.push(line);
  lines.push(padColumns('ORDER', `#${orderNumber}`, width));
  lines.push(padColumns('DATE', fmtDate(payload.created_at), width));
  if (payload.payment_status) lines.push(padColumns('PAYMENT', String(payload.payment_status).toUpperCase(), width));
  if (payload.payment_method) lines.push(padColumns('METHOD', String(payload.payment_method).toUpperCase(), width));
  lines.push(line);

  const items = getGroupedItems(payload, rule);
  items.forEach((item: any, index: number) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    if (index > 0) lines.push('');
    lines.push(padColumns(`${qty}x ${item.name || 'Item'}`, fmtMoney(price * qty), width));

    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => {
      const aq = Number(addon.quantity || 0);
      const ap = Number(addon.price || 0);
      lines.push(padColumns(`  + ${aq}x ${addon.name || 'Addon'}`, fmtMoney(ap * aq), width));
    });

    if (rule.print_item_notes !== false && item.notes) {
      lines.push(trimLine(`  NOTE  ${item.notes}`, width));
    }
  });

  lines.push('');
  lines.push(line);
  if (rule.show_vat_breakdown && typeof payload.vat_amount === 'number') {
    lines.push(padColumns('VAT', fmtMoney(payload.vat_amount), width));
  }
  lines.push(padColumns('TOTAL', fmtMoney(Number(payload.total || 0)), width));
  lines.push(line);
  if (rule.custom_message) {
    lines.push('');
    lines.push(centerText(String(rule.custom_message), width));
  }
  if (payload.qr_placeholder) {
    lines.push('');
    lines.push(centerText('[QR / PROMO PLACEHOLDER]', width));
  }
  lines.push('');
  lines.push(centerText('Thank you for your order', width));
  pushFeedSpace(lines, width);

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
