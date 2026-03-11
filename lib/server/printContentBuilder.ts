type TicketType = 'KOT' | 'Invoice';

interface PrintRuleLike {
  print_order_time?: boolean;
  print_phone?: boolean;
  print_address?: boolean;
  print_item_notes?: boolean;
  divider_lines?: boolean;
  print_restaurant_details?: boolean;
  show_vat_breakdown?: boolean;
  custom_message?: string | null;
}

interface PrintJobLike {
  id: string;
  ticket_type: TicketType;
  source?: string | null;
  payload_json: any;
}

const line = '-'.repeat(32);

const hexEncode = (value: string) => Buffer.from(value, 'utf8').toString('hex');

const fmtDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '-');
const fmtMoney = (value: number | null | undefined) => `£${((value || 0) / 100).toFixed(2)}`;

function buildKotContent(job: PrintJobLike, rule: PrintRuleLike) {
  const p = job.payload_json || {};
  const items = Array.isArray(p.items) ? p.items : [];
  const header: string[] = [];

  header.push('*** KITCHEN ORDER TICKET ***');
  header.push(`ORDER #${p.order_number ?? String(p.order_id || job.id).slice(0, 8)}`);
  header.push(`Type: ${(p.order_type || 'unknown').toUpperCase()}`);

  if (p.customer_name) header.push(`Customer: ${p.customer_name}`);
  if (p.scheduled_for) header.push('*** SCHEDULED ORDER ***');
  if (rule.print_order_time !== false) header.push(`Time: ${fmtDate(p.created_at)}`);
  if (p.payment_status) header.push(`Payment: ${p.payment_status}`);
  if (rule.print_phone && p.customer_phone) header.push(`Phone: ${p.customer_phone}`);
  if (rule.print_address && p.delivery_address) {
    const a = p.delivery_address;
    const address = [a?.address_line_1, a?.address_line_2, a?.postcode].filter(Boolean).join(', ');
    if (address) header.push(`Address: ${address}`);
  }

  const body: string[] = [];
  body.push(rule.divider_lines ? line : '');
  items.forEach((item: any) => {
    body.push(`${item.quantity || 0}x ${item.name || 'Item'}`);
    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => body.push(`  + ${addon.quantity || 0}x ${addon.name || 'Addon'}`));
    if (rule.print_item_notes !== false && item.notes) {
      body.push(`  !! NOTE: ${item.notes}`);
    }
    if (item.age_restricted) {
      body.push('  [AGE-RESTRICTED]');
    }
    if (rule.divider_lines) body.push(line);
  });

  return [...header, '', ...body.filter(Boolean), 'END OF ORDER', ''].join('\n');
}

function buildInvoiceContent(job: PrintJobLike, rule: PrintRuleLike) {
  const p = job.payload_json || {};
  const items = Array.isArray(p.items) ? p.items : [];
  const lines: string[] = [];

  lines.push('*** ORDER RECEIPT ***');
  if (rule.print_restaurant_details && p.restaurant_name) {
    lines.push(p.restaurant_name);
  }
  lines.push(`Order #${p.order_number ?? String(p.order_id || job.id).slice(0, 8)}`);
  lines.push(`Date: ${fmtDate(p.created_at)}`);
  if (p.payment_status) lines.push(`Payment: ${p.payment_status}`);
  lines.push(line);

  items.forEach((item: any) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    lines.push(`${qty}x ${item.name || 'Item'} ${fmtMoney(price * qty)}`);
    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => {
      const aq = Number(addon.quantity || 0);
      const ap = Number(addon.price || 0);
      lines.push(`  + ${aq}x ${addon.name || 'Addon'} ${fmtMoney(ap * aq)}`);
    });
  });

  lines.push(line);
  lines.push(`TOTAL: ${fmtMoney(Number(p.total || 0))}`);
  if (rule.custom_message) lines.push(rule.custom_message);
  lines.push('Thank you.');
  lines.push('');

  return lines.join('\n');
}

export function buildSunmiPrintHexContent(job: PrintJobLike, rule: PrintRuleLike = {}) {
  const text =
    job.source === 'test'
      ? `*** PRINTER TEST ***\n${job.payload_json?.restaurant_name || 'Restaurant'}\n${job.payload_json?.printer_name || 'Printer'}\n${new Date().toLocaleString()}\nPrinter test successful\n`
      : job.ticket_type === 'Invoice'
      ? buildInvoiceContent(job, rule)
      : buildKotContent(job, rule);

  return {
    text,
    hex: hexEncode(text),
  };
}
