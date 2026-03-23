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

export type TicketTextAlign = 'left' | 'center';
export type TicketDocumentNode =
  | { type: 'text'; text: string; align?: TicketTextAlign; emphasis?: 'normal' | 'strong'; variant?: 'default' | 'restaurantName' | 'orderNumber' | 'orderType' | 'footer' | 'category' | 'noteLabel' | 'noteText' | 'addon' | 'total' | 'meta' | 'customMessage' }
  | { type: 'blank' }
  | { type: 'divider' };

export interface TicketDocument {
  width: '58mm' | '80mm';
  nodes: TicketDocumentNode[];
  feedLines: number;
}

const getLine = (width: '58mm' | '80mm') => '─'.repeat(width === '80mm' ? 48 : 32);
const getMaxLineLength = (width: '58mm' | '80mm') => (width === '80mm' ? 48 : 32);
const getFeedLines = (width: '58mm' | '80mm', source?: string | null) => {
  if (source === 'test') return width === '80mm' ? 8 : 6;
  return width === '80mm' ? 4 : 3;
};

const fmtDate = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : '-');
const fmtMoney = (value: number | null | undefined) => `£${((value || 0) / 100).toFixed(2)}`;
const trimLine = (text: string, width: '58mm' | '80mm') => {
  const max = getMaxLineLength(width);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
};
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
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('hex');
  const bytes = new TextEncoder().encode(value);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};
const utf8Bytes = (value: string) => (typeof Buffer !== 'undefined' ? Buffer.from(value, 'utf8') : new TextEncoder().encode(value));
const addressText = (address: any) => [address?.address_line_1, address?.address_line_2, address?.postcode].filter(Boolean).join(', ');
const toDisplayOrderType = (payload: any) => {
  if (payload?.dine_in_table_number) return `TABLE ${payload.dine_in_table_number}`;
  return String(payload?.order_type || 'ORDER').replace(/_/g, ' ').trim().toUpperCase();
};

function buildTestEscPosHex(job: PrintJobLike, width: '58mm' | '80mm') {
  const payload = job.payload_json || {};
  const lines = [
    centerText('*** ORDERFAST TEST ***', width),
    centerText(String(payload.restaurant_name || 'Restaurant'), width),
    centerText(`Printer: ${payload.printer_name || 'Printer'}`, width),
    centerText('Printer connection successful', width),
  ];

  const text = `${lines.join('\n')}\n${'\n'.repeat(getFeedLines(width, 'test'))}`;
  const initCommand = [0x1b, 0x40];
  const cutCommand = [0x1d, 0x56, 0x00];
  const bytes = new Uint8Array([...initCommand, ...utf8Bytes(text), ...cutCommand]);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { text, hex };
}

const pushTextNode = (nodes: TicketDocumentNode[], text: string, width: '58mm' | '80mm', options?: Omit<Extract<TicketDocumentNode, { type: 'text' }>, 'type' | 'text'>) => {
  nodes.push({ type: 'text', text: trimLine(text, width), ...options });
};

const pushWrappedTextNodes = (nodes: TicketDocumentNode[], text: string, width: '58mm' | '80mm', options?: { prefix?: string; align?: TicketTextAlign; emphasis?: 'normal' | 'strong'; variant?: Extract<TicketDocumentNode, { type: 'text' }>['variant'] }) => {
  const prefix = options?.prefix || '';
  const max = getMaxLineLength(width);
  const contentWidth = Math.max(8, max - prefix.length);
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return;
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= contentWidth) current = next;
    else if (current) {
      pushTextNode(nodes, `${prefix}${current}`, width, { align: options?.align, emphasis: options?.emphasis, variant: options?.variant });
      current = word;
    } else {
      pushTextNode(nodes, `${prefix}${word}`, width, { align: options?.align, emphasis: options?.emphasis, variant: options?.variant });
    }
  });
  if (current) pushTextNode(nodes, `${prefix}${current}`, width, { align: options?.align, emphasis: options?.emphasis, variant: options?.variant });
};

const pushNoteBlock = (nodes: TicketDocumentNode[], text: string, width: '58mm' | '80mm') => {
  const note = String(text || '').trim();
  if (!note) return;
  pushTextNode(nodes, 'NOTE', width, { emphasis: 'strong', variant: 'noteLabel' });
  pushWrappedTextNodes(nodes, note, width, { prefix: '› ', variant: 'noteText' });
};

function getGroupedItems(payload: any, rule: PrintRuleLike) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (rule.item_grouping && rule.item_grouping !== 'none') {
    return items.slice().sort((a: any, b: any) => String(a?.category || '').localeCompare(String(b?.category || '')));
  }
  return items;
}

function pushHeader(nodes: TicketDocumentNode[], payload: any, width: '58mm' | '80mm') {
  const orderNumber = payload.order_number ?? String(payload.order_id || '').slice(0, 8);
  const orderType = toDisplayOrderType(payload);
  if (payload.restaurant_name) pushTextNode(nodes, String(payload.restaurant_name), width, { align: 'center', emphasis: 'strong', variant: 'restaurantName' });
  pushTextNode(nodes, `#${orderNumber}`, width, { align: 'center', emphasis: 'strong', variant: 'orderNumber' });
  pushTextNode(nodes, orderType, width, { align: 'center', emphasis: 'strong', variant: 'orderType' });
}

function pushKotMeta(nodes: TicketDocumentNode[], payload: any, width: '58mm' | '80mm', rule: PrintRuleLike) {
  if (payload.customer_name) pushTextNode(nodes, String(payload.customer_name), width, { variant: 'meta' });
  if (rule.print_order_time !== false) pushTextNode(nodes, fmtDate(payload.created_at), width, { variant: 'meta' });
  if (rule.print_phone && payload.customer_phone) pushTextNode(nodes, String(payload.customer_phone), width, { variant: 'meta' });
  if (rule.print_address && payload.delivery_address) {
    const address = addressText(payload.delivery_address);
    if (address) pushWrappedTextNodes(nodes, address, width, { variant: 'meta' });
  }
}

function pushInvoiceMeta(nodes: TicketDocumentNode[], payload: any, width: '58mm' | '80mm', rule: PrintRuleLike) {
  if (rule.print_restaurant_details && payload.restaurant_phone) pushTextNode(nodes, String(payload.restaurant_phone), width, { align: 'center', variant: 'meta' });
  if (rule.print_order_time !== false) pushTextNode(nodes, fmtDate(payload.created_at), width, { variant: 'meta' });
  if (payload.customer_name) pushTextNode(nodes, String(payload.customer_name), width, { variant: 'meta' });
  if (rule.print_phone && payload.customer_phone) pushTextNode(nodes, String(payload.customer_phone), width, { variant: 'meta' });
  if (rule.print_address && payload.delivery_address) {
    const address = addressText(payload.delivery_address);
    if (address) pushWrappedTextNodes(nodes, address, width, { variant: 'meta' });
  }
}

function pushItems(nodes: TicketDocumentNode[], payload: any, width: '58mm' | '80mm', rule: PrintRuleLike, includePrices: boolean) {
  const items = getGroupedItems(payload, rule);
  let lastCategory = '';
  items.forEach((item: any, index: number) => {
    const category = String(item?.category || '').trim();
    const shouldShowCategory = Boolean(category && rule.item_grouping && rule.item_grouping !== 'none' && category !== lastCategory);
    if (shouldShowCategory) {
      if (index > 0) nodes.push({ type: 'blank' });
      pushTextNode(nodes, category.toUpperCase(), width, { emphasis: 'strong', variant: 'category' });
      lastCategory = category;
    }

    const itemLabel = `${Number(item.quantity || 0)}x ${item.name || 'Item'}`;
    pushTextNode(nodes, includePrices ? padColumns(itemLabel, fmtMoney(Number(item.price || 0) * Number(item.quantity || 0)), width) : itemLabel, width, { variant: 'default' });

    const addons = Array.isArray(item.addons) ? item.addons : [];
    addons.forEach((addon: any) => {
      const addonLabel = `  + ${Number(addon.quantity || 0)}x ${addon.name || 'Addon'}`;
      pushTextNode(nodes, includePrices ? padColumns(addonLabel, fmtMoney(Number(addon.price || 0) * Number(addon.quantity || 0)), width) : addonLabel, width, { variant: 'addon' });
    });

    if (rule.highlight_age_restricted !== false && item.age_restricted) {
      pushTextNode(nodes, '  ! 18+ ID CHECK', width, { emphasis: 'strong', variant: 'meta' });
    }
  });
}

export function buildTicketDocument(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}): TicketDocument {
  const width = options.width || '80mm';
  const payload = job.payload_json || {};
  const nodes: TicketDocumentNode[] = [];
  const shouldShowDividers = rule.divider_lines !== false;

  if (job.source === 'test') {
    [
      String(payload.restaurant_name || 'Restaurant'),
      String(payload.printer_name || 'Printer'),
      fmtDate(payload.created_at || new Date().toISOString()),
      'Printer test successful',
    ].forEach((text, index) => {
      pushTextNode(nodes, index === 0 ? '*** PRINTER TEST ***' : text, width, { align: 'center', variant: index === 0 ? 'footer' : 'default', emphasis: 'strong' });
    });
    return { width, nodes, feedLines: getFeedLines(width, 'test') };
  }

  pushHeader(nodes, payload, width);
  if (payload.customer_notes) {
    nodes.push({ type: 'blank' });
    pushNoteBlock(nodes, String(payload.customer_notes), width);
  }
  if (nodes.length) nodes.push({ type: 'blank' });

  if (job.ticket_type === 'Invoice') pushInvoiceMeta(nodes, payload, width, rule);
  else pushKotMeta(nodes, payload, width, rule);

  if (shouldShowDividers) nodes.push({ type: 'divider' });
  pushItems(nodes, payload, width, rule, job.ticket_type === 'Invoice');
  if (shouldShowDividers) nodes.push({ type: 'divider' });

  if (job.ticket_type === 'Invoice') {
    const subtotal = Number(payload.subtotal || 0);
    const deliveryFee = Number(payload.delivery_fee || 0);
    const discountAmount = Number(payload.discount_amount || 0);
    if (subtotal > 0) pushTextNode(nodes, padColumns('Subtotal', fmtMoney(subtotal), width), width, { variant: 'default' });
    if (deliveryFee > 0) pushTextNode(nodes, padColumns('Delivery', fmtMoney(deliveryFee), width), width, { variant: 'default' });
    if (discountAmount > 0) pushTextNode(nodes, padColumns('Discount', `-${fmtMoney(discountAmount)}`, width), width, { variant: 'default' });
    if (rule.show_vat_breakdown && typeof payload.vat_amount === 'number') pushTextNode(nodes, padColumns('VAT', fmtMoney(payload.vat_amount), width), width, { variant: 'default' });
    pushTextNode(nodes, padColumns('TOTAL', fmtMoney(Number(payload.total || 0)), width), width, { emphasis: 'strong', variant: 'total' });
    if (rule.custom_message) {
      nodes.push({ type: 'blank' });
      pushWrappedTextNodes(nodes, String(rule.custom_message), width, { variant: 'customMessage' });
    }
    pushTextNode(nodes, 'Thank you for your order', width, { align: 'center', emphasis: 'strong', variant: 'footer' });
  } else {
    pushTextNode(nodes, 'END OF ORDER', width, { align: 'center', emphasis: 'strong', variant: 'footer' });
  }

  return { width, nodes, feedLines: getFeedLines(width, job.source) };
}

export function renderTicketDocumentText(document: TicketDocument) {
  const dividerText = getLine(document.width);
  const lines = document.nodes.map((node) => {
    if (node.type === 'blank') return '';
    if (node.type === 'divider') return dividerText;
    return node.align === 'center' ? centerText(node.text, document.width) : trimLine(node.text, document.width);
  });
  lines.push(...Array.from({ length: document.feedLines }, () => ''));
  return lines.join('\n');
}

export function buildPrintableTicketText(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  return renderTicketDocumentText(buildTicketDocument(job, rule, options));
}

export function buildTicketText(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  return buildPrintableTicketText(job, rule, options);
}

export function buildSunmiPrintHexContent(job: PrintJobLike, rule: PrintRuleLike = {}, options: TicketBuildOptions = {}) {
  const width = options.width || '80mm';
  if (job.source === 'test') return buildTestEscPosHex(job, width);
  const text = buildPrintableTicketText(job, rule, options);
  return { text, hex: toHex(text) };
}
