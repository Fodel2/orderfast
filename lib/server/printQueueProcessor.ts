import crypto from 'crypto';
import { supaServer } from '@/lib/supaServer';
import { buildSunmiPrintHexContent } from '@/lib/server/printContentBuilder';
import { checkSunmiPrinterOnlineStatus, postSunmi, sendSunmiVoice } from '@/lib/server/sunmiClient';

const RETRY_SECONDS = [10, 30, 60];
const LEASE_SECONDS = 25;

type QueueJob = {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  print_rule_id: string | null;
  printer_id: string;
  ticket_type: 'KOT' | 'Invoice';
  provider: string | null;
  serial_number: string | null;
  source: string | null;
  status: string | null;
  attempts: number | null;
  payload_json: any;
  voice_enabled: boolean | null;
  voice_message: string | null;
  scheduled_retry_at: string | null;
};

type PrinterSettings = {
  voice_repeat_count?: number;
  voice_reminder_enabled?: boolean;
  voice_reminder_message?: string | null;
};

const nowIso = () => new Date().toISOString();
const addSecondsIso = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

function makeTradeNo(jobId: string) {
  const compact = jobId.replace(/-/g, '');
  if (compact.length >= 28) return `pj${compact.slice(0, 30)}`.slice(0, 32);
  const digest = crypto.createHash('sha1').update(jobId).digest('hex').slice(0, 8);
  return `pj${compact}${digest}`.slice(0, 32);
}

async function logAttempt(params: {
  printJobId: string;
  attemptNumber: number;
  status: string;
  errorMessage?: string | null;
  providerResponse?: any;
}) {
  await supaServer.from('print_job_attempts').insert({
    print_job_id: params.printJobId,
    attempt_number: params.attemptNumber,
    status: params.status,
    error_message: params.errorMessage ?? null,
    provider_response: params.providerResponse ?? null,
  });
}

async function claimPendingJobs(batchSize: number, restaurantId?: string): Promise<QueueJob[]> {
  let query = supaServer
    .from('print_jobs')
    .select('id,restaurant_id,order_id,print_rule_id,printer_id,ticket_type,provider,serial_number,source,status,attempts,payload_json,voice_enabled,voice_message,scheduled_retry_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize * 4);

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }

  const { data: candidates, error } = await query;
  if (error || !candidates) return [];

  const due = candidates.filter((job: any) => !job.scheduled_retry_at || new Date(job.scheduled_retry_at).getTime() <= Date.now());
  const claimed: QueueJob[] = [];

  for (const job of due) {
    if (claimed.length >= batchSize) break;
    const leaseUntil = addSecondsIso(LEASE_SECONDS);
    const lockQ = supaServer
      .from('print_jobs')
      .update({ scheduled_retry_at: leaseUntil })
      .eq('id', job.id)
      .eq('status', 'pending')
      .or(`scheduled_retry_at.is.null,scheduled_retry_at.lte.${nowIso()}`)
      .select('id,restaurant_id,order_id,print_rule_id,printer_id,ticket_type,provider,serial_number,source,status,attempts,payload_json,voice_enabled,voice_message,scheduled_retry_at')
      .maybeSingle();

    const { data: locked } = await lockQ;
    if (locked) claimed.push(locked as QueueJob);
  }

  return claimed;
}

function scheduleDispatch(jobs: QueueJob[]) {
  const restaurantInFlight = new Map<string, number>();
  const printerInFlight = new Set<string>();
  const out: QueueJob[] = [];

  for (const job of jobs) {
    if (out.length >= 5) break;
    const rCount = restaurantInFlight.get(job.restaurant_id) || 0;
    if (rCount >= 2) continue;
    if (printerInFlight.has(job.printer_id)) continue;

    restaurantInFlight.set(job.restaurant_id, rCount + 1);
    printerInFlight.add(job.printer_id);
    out.push(job);
  }

  return out;
}

async function dispatchOne(job: QueueJob) {
  const currentAttempts = Number(job.attempts || 0);
  const attemptNumber = currentAttempts + 1;

  const finishFailure = async (message: string, providerResponse?: any) => {
    const exhausted = attemptNumber > RETRY_SECONDS.length;
    const nextRetryAt = exhausted ? null : addSecondsIso(RETRY_SECONDS[attemptNumber - 1]);

    await supaServer
      .from('print_jobs')
      .update({
        attempts: attemptNumber,
        status: exhausted ? 'failed' : 'pending',
        error_message: message,
        failed_at: exhausted ? nowIso() : null,
        scheduled_retry_at: nextRetryAt,
      })
      .eq('id', job.id)
      .eq('status', 'pending');

    await supaServer
      .from('printers')
      .update({
        last_failure_at: nowIso(),
        last_error_message: message,
      })
      .eq('id', job.printer_id)
      .eq('restaurant_id', job.restaurant_id);

    await logAttempt({
      printJobId: job.id,
      attemptNumber,
      status: exhausted ? 'failed' : 'retry_scheduled',
      errorMessage: message,
      providerResponse,
    });
  };

  if (job.provider !== 'sunmi_cloud') {
    await finishFailure(`Unsupported provider: ${job.provider || 'missing'}`);
    return { ok: false, reason: 'unsupported_provider' };
  }

  if (!job.serial_number) {
    await finishFailure('Missing printer serial number');
    return { ok: false, reason: 'missing_sn' };
  }

  const { data: printer } = await supaServer
    .from('printers')
    .select('id,name,restaurant_id,enabled,serial_number')
    .eq('id', job.printer_id)
    .eq('restaurant_id', job.restaurant_id)
    .maybeSingle();

  if (!printer || !printer.enabled) {
    await finishFailure('Printer not found or disabled');
    return { ok: false, reason: 'invalid_printer' };
  }

  const { data: rule } = await supaServer
    .from('print_rules')
    .select('print_order_time,print_phone,print_address,print_item_notes,divider_lines,print_restaurant_details,show_vat_breakdown,custom_message')
    .eq('id', job.print_rule_id || '')
    .maybeSingle();

  const tradeNo = makeTradeNo(job.id);
  const content = buildSunmiPrintHexContent(
    {
      id: job.id,
      ticket_type: job.ticket_type,
      source: job.source,
      payload_json: {
        ...(job.payload_json || {}),
        provider_trade_no: tradeNo,
        printer_name: printer.name,
      },
    },
    rule || {}
  );

  const { data: settings } = await supaServer
    .from('printer_settings')
    .select('voice_repeat_count,voice_reminder_enabled,voice_reminder_message')
    .eq('restaurant_id', job.restaurant_id)
    .maybeSingle();

  const cycle = Math.min(3, Math.max(1, Number((settings as PrinterSettings | null)?.voice_repeat_count || 1)));
  const response = await postSunmi('/v2/printer/open/open/device/pushContent', {
    trade_no: tradeNo,
    sn: job.serial_number,
    order_type: 1,
    content: content.hex,
    count: 1,
    media_text: job.voice_enabled && job.voice_message ? job.voice_message : undefined,
    cycle: job.voice_enabled && job.voice_message ? cycle : undefined,
  });

  if (!response.ok) {
    await finishFailure(response.error || 'SUNMI pushContent failed', response.raw);
    return { ok: false, reason: response.error || 'sunmi_error' };
  }

  await supaServer
    .from('print_jobs')
    .update({
      status: 'sent',
      sent_at: nowIso(),
      error_message: null,
      scheduled_retry_at: null,
      payload_json: {
        ...(job.payload_json || {}),
        provider_trade_no: tradeNo,
      },
    })
    .eq('id', job.id)
    .eq('status', 'pending');

  await supaServer
    .from('printers')
    .update({
      last_success_at: nowIso(),
      last_error_message: null,
    })
    .eq('id', job.printer_id)
    .eq('restaurant_id', job.restaurant_id);

  await logAttempt({
    printJobId: job.id,
    attemptNumber,
    status: 'sent',
    providerResponse: {
      trade_no: tradeNo,
      result: response.raw,
    },
  });

  return { ok: true };
}

export async function processPrintQueue(options?: { batchSize?: number; restaurantId?: string }) {
  const batchSize = Math.max(1, Math.min(20, Number(options?.batchSize || 10)));
  const claimed = await claimPendingJobs(batchSize, options?.restaurantId);
  const scheduled = scheduleDispatch(claimed);

  const results = await Promise.allSettled(scheduled.map((job) => dispatchOne(job)));
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;

  return {
    claimed: claimed.length,
    processed: scheduled.length,
    sent,
    failed: scheduled.length - sent,
  };
}

export async function sendRestaurantVoiceReminder(params: {
  restaurantId: string;
  message?: string;
  cycle?: number;
}) {
  const { data: settings } = await supaServer
    .from('printer_settings')
    .select('voice_reminder_enabled,voice_reminder_message,voice_repeat_count')
    .eq('restaurant_id', params.restaurantId)
    .maybeSingle();

  const reminderEnabled = Boolean(settings?.voice_reminder_enabled);
  if (!reminderEnabled) {
    return { sent: 0, skipped: true, reason: 'voice_reminder_disabled' };
  }

  const { data: printers } = await supaServer
    .from('printers')
    .select('id,serial_number,provider,enabled')
    .eq('restaurant_id', params.restaurantId)
    .eq('enabled', true)
    .eq('provider', 'sunmi_cloud');

  const targets = (printers || []).filter((p: any) => p.serial_number);
  let sent = 0;

  for (const printer of targets) {
    const voice = await sendSunmiVoice({
      serialNumber: printer.serial_number,
      message: params.message || settings?.voice_reminder_message || 'Please check the printer.',
      cycle: Math.min(3, Math.max(1, Number(params.cycle || settings?.voice_repeat_count || 1))),
      interval: 2,
      expireIn: 300,
    });

    if (voice.ok) sent += 1;
  }

  return { sent, skipped: false };
}

export async function getPrinterOnlineStatus(printerId: string, restaurantId: string) {
  const { data: printer } = await supaServer
    .from('printers')
    .select('id,serial_number,provider,restaurant_id')
    .eq('id', printerId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!printer) {
    return { ok: false, error: 'Printer not found' };
  }
  if (printer.provider !== 'sunmi_cloud') {
    return { ok: false, error: 'Only sunmi_cloud provider is supported for online checks' };
  }
  if (!printer.serial_number) {
    return { ok: false, error: 'Printer serial number missing' };
  }

  const online = await checkSunmiPrinterOnlineStatus(printer.serial_number);
  return online.ok
    ? { ok: true, status: online.data, raw: online.raw }
    : { ok: false, error: online.error || 'Online check failed', raw: online.raw };
}
