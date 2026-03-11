import crypto from 'crypto';

const SUNMI_BASE_URL = 'https://openapi.sunmi.com';

export interface SunmiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  raw?: any;
}

function getSunmiConfig() {
  const appId = process.env.SUNMI_APP_ID;
  const appKey = process.env.SUNMI_APP_KEY;
  if (!appId || !appKey) {
    throw new Error('Missing SUNMI_APP_ID or SUNMI_APP_KEY');
  }
  return { appId, appKey };
}

function generateNonce() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function postSunmi<T = any>(path: string, body: Record<string, unknown>): Promise<SunmiResponse<T>> {
  const { appId, appKey } = getSunmiConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = generateNonce();
  const rawBody = JSON.stringify(body);
  const payloadToSign = `${rawBody}${appId}${timestamp}${nonce}`;
  const sign = crypto.createHmac('sha256', appKey).update(payloadToSign).digest('hex');

  const response = await fetch(`${SUNMI_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Sunmi-Appid': appId,
      'Sunmi-Nonce': nonce,
      'Sunmi-Timestamp': timestamp,
      'Sunmi-Sign': sign,
      Source: 'openapi',
    },
    body: rawBody,
  });

  let parsed: any = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  const apiSuccess = response.ok && (parsed?.code === 1 || parsed?.success === true || parsed?.msg === 'success');

  if (!apiSuccess) {
    return {
      ok: false,
      status: response.status,
      error: parsed?.msg || parsed?.message || `HTTP ${response.status}`,
      raw: parsed,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: (parsed?.data ?? parsed) as T,
    raw: parsed,
  };
}

export async function checkSunmiPrinterOnlineStatus(serialNumber: string) {
  return postSunmi('/v2/printer/open/open/device/onlineStatus', { sn: serialNumber });
}

export async function sendSunmiVoice(params: {
  serialNumber: string;
  message: string;
  cycle?: number;
  interval?: number;
  expireIn?: number;
}) {
  return postSunmi('/v2/printer/open/open/device/pushVoice', {
    sn: params.serialNumber,
    content: params.message,
    expire_in: params.expireIn ?? 300,
    cycle: params.cycle ?? 1,
    interval: params.interval ?? 2,
  });
}
