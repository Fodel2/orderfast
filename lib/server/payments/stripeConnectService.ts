import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type Stripe from 'stripe';
import {
  deriveStripeConnectionStatus,
  deriveStripeReadiness,
  deriveTerminalPaymentReadiness,
  type StripeConnectionSnapshot,
  type TerminalPaymentReadiness,
  type TerminalReadinessStatus,
} from '@/lib/payments/stripeConnect';
import { supaServer } from '@/lib/supaServer';
import { getStripeClient } from './stripeClient';

class StripeConnectConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConnectConfigError';
  }
}

const logOnboardingInfo = (step: string, payload: Record<string, unknown>) => {
  console.info('[stripe][onboarding-link]', { step, ...payload });
};

const logOnboardingError = (step: string, payload: Record<string, unknown>) => {
  console.error('[stripe][onboarding-link]', { step, ...payload });
};

type RestaurantStripeRow = {
  restaurant_id: string;
  stripe_connected_account_id: string | null;
  onboarding_status: StripeConnectionSnapshot['onboarding_status'] | null;
  stripe_onboarding_status: StripeConnectionSnapshot['onboarding_status'] | null;
  charges_enabled: boolean | null;
  stripe_charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  stripe_details_submitted: boolean | null;
  card_payments_capability: string | null;
  stripe_card_payments_capability: string | null;
  transfers_capability: string | null;
  stripe_transfers_capability: string | null;
  requirements_currently_due: unknown;
  stripe_requirements_currently_due: unknown;
  requirements_eventually_due: unknown;
  stripe_requirements_eventually_due: unknown;
  requirements_past_due: unknown;
  stripe_requirements_past_due: unknown;
  requirements_pending_verification: unknown;
  stripe_requirements_pending_verification: unknown;
  disabled_reason: string | null;
  stripe_disabled_reason: string | null;
  terminal_location_id: string | null;
  stripe_terminal_location_id: string | null;
  stripe_terminal_location_display_name: string | null;
  terminal_readiness_status: TerminalReadinessStatus | null;
  terminal_readiness_reason: string | null;
  onboarding_completed_at: string | null;
  stripe_onboarding_completed_at: string | null;
  last_synced_at: string | null;
  stripe_last_synced_at: string | null;
  terminal_last_checked_at: string | null;
  terminal_last_synced_at: string | null;
};

type RestaurantAddress = {
  name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county_state: string | null;
  postcode: string | null;
  country_code: string | null;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];


const pickFirst = <T>(...values: Array<T | null | undefined>): T | null => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
};


export const resolveRestaurantIdFromSession = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
  const supabaseAuth = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session?.user?.id) return null;

  const { data: membership } = await supaServer
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!membership?.restaurant_id) return null;
  return String(membership.restaurant_id);
};

export const readRestaurantStripeRow = async (restaurantId: string): Promise<RestaurantStripeRow | null> => {
  const { data, error } = await supaServer
    .from('restaurant_stripe_connect_accounts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as RestaurantStripeRow | null) ?? null;
};

const readRestaurantAddress = async (restaurantId: string): Promise<RestaurantAddress | null> => {
  const { data, error } = await supaServer
    .from('restaurants')
    .select('name,address_line_1,address_line_2,city,county_state,postcode,country_code')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as RestaurantAddress | null) ?? null;
};

export const toSnapshot = (row: RestaurantStripeRow | null): StripeConnectionSnapshot => ({
  stripe_connected_account_id: row?.stripe_connected_account_id ?? null,
  onboarding_status: pickFirst(row?.stripe_onboarding_status, row?.onboarding_status) ?? 'not_connected',
  charges_enabled: !!pickFirst(row?.stripe_charges_enabled, row?.charges_enabled),
  payouts_enabled: !!pickFirst(row?.stripe_payouts_enabled, row?.payouts_enabled),
  details_submitted: !!pickFirst(row?.stripe_details_submitted, row?.details_submitted),
  card_payments_capability: pickFirst(row?.stripe_card_payments_capability, row?.card_payments_capability),
  transfers_capability: pickFirst(row?.stripe_transfers_capability, row?.transfers_capability),
  requirements_currently_due: toStringArray(pickFirst(row?.stripe_requirements_currently_due, row?.requirements_currently_due)),
  requirements_eventually_due: toStringArray(
    pickFirst(row?.stripe_requirements_eventually_due, row?.requirements_eventually_due)
  ),
  requirements_past_due: toStringArray(pickFirst(row?.stripe_requirements_past_due, row?.requirements_past_due)),
  requirements_pending_verification: toStringArray(
    pickFirst(row?.stripe_requirements_pending_verification, row?.requirements_pending_verification)
  ),
  disabled_reason: pickFirst(row?.stripe_disabled_reason, row?.disabled_reason),
  terminal_location_id: row?.terminal_location_id ?? null,
  stripe_terminal_location_id: row?.stripe_terminal_location_id ?? row?.terminal_location_id ?? null,
  stripe_terminal_location_display_name: row?.stripe_terminal_location_display_name ?? null,
  terminal_readiness_status: row?.terminal_readiness_status ?? 'terminal_not_configured',
  terminal_readiness_reason: row?.terminal_readiness_reason ?? null,
  onboarding_completed_at: pickFirst(row?.stripe_onboarding_completed_at, row?.onboarding_completed_at),
  last_synced_at: pickFirst(row?.stripe_last_synced_at, row?.last_synced_at),
  terminal_last_checked_at: row?.terminal_last_checked_at ?? null,
  terminal_last_synced_at: row?.terminal_last_synced_at ?? null,
});

const terminalReadyFromAccount = (account: Stripe.Account) => {
  const cardPaymentsCapability = account.capabilities?.card_payments;
  if (cardPaymentsCapability === 'active' && account.charges_enabled && account.payouts_enabled) {
    return {
      status: 'tap_to_pay_ready' as TerminalReadinessStatus,
      reason: 'Stripe and Terminal setup are ready for Tap to Pay.',
    };
  }

  if (cardPaymentsCapability === 'pending') {
    return {
      status: 'terminal_pending' as TerminalReadinessStatus,
      reason: 'Stripe is still enabling card processing for Terminal payments.',
    };
  }

  if (account.requirements?.disabled_reason) {
    return {
      status: 'temporarily_unavailable' as TerminalReadinessStatus,
      reason: 'Stripe has temporarily limited this account for Terminal payments.',
    };
  }

  return {
    status: 'terminal_pending' as TerminalReadinessStatus,
    reason: 'Terminal readiness is still being prepared by Stripe.',
  };
};

const upsertFromStripeAccount = async (restaurantId: string, account: Stripe.Account) => {
  const existing = await readRestaurantStripeRow(restaurantId);
  const requirementsCurrentlyDue = Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due : [];
  const requirementsEventuallyDue = Array.isArray(account.requirements?.eventually_due)
    ? account.requirements.eventually_due
    : [];
  const requirementsPastDue = Array.isArray(account.requirements?.past_due) ? account.requirements.past_due : [];
  const requirementsPending = Array.isArray(account.requirements?.pending_verification)
    ? account.requirements.pending_verification
    : [];

  const snapshot: StripeConnectionSnapshot = {
    stripe_connected_account_id: account.id,
    onboarding_status: 'setup_incomplete',
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    details_submitted: !!account.details_submitted,
    card_payments_capability: account.capabilities?.card_payments ?? null,
    transfers_capability: account.capabilities?.transfers ?? null,
    requirements_currently_due: requirementsCurrentlyDue,
    requirements_eventually_due: requirementsEventuallyDue,
    requirements_past_due: requirementsPastDue,
    requirements_pending_verification: requirementsPending,
    disabled_reason: account.requirements?.disabled_reason || null,
    terminal_location_id: existing?.terminal_location_id ?? null,
    stripe_terminal_location_id: existing?.stripe_terminal_location_id ?? existing?.terminal_location_id ?? null,
    stripe_terminal_location_display_name: existing?.stripe_terminal_location_display_name ?? null,
    terminal_readiness_status: existing?.terminal_readiness_status ?? 'terminal_not_configured',
    terminal_readiness_reason: existing?.terminal_readiness_reason ?? null,
    onboarding_completed_at: null,
    last_synced_at: new Date().toISOString(),
    terminal_last_checked_at: existing?.terminal_last_checked_at ?? null,
    terminal_last_synced_at: existing?.terminal_last_synced_at ?? null,
  };

  const nextStatus = deriveStripeConnectionStatus(snapshot);
  const terminalCheck = terminalReadyFromAccount(account);

  const readinessStatus: TerminalReadinessStatus = !snapshot.stripe_connected_account_id
    ? 'not_connected'
    : nextStatus === 'setup_incomplete' || nextStatus === 'under_review'
      ? 'stripe_setup_incomplete'
      : nextStatus === 'restricted'
        ? 'temporarily_unavailable'
        : snapshot.stripe_terminal_location_id
          ? terminalCheck.status
          : 'terminal_not_configured';

  const readinessReason =
    readinessStatus === 'not_connected'
      ? 'Connect Stripe to begin Tap to Pay setup.'
      : readinessStatus === 'stripe_setup_incomplete'
        ? 'Finish Stripe setup before Tap to Pay can be enabled.'
        : readinessStatus === 'temporarily_unavailable'
          ? terminalCheck.reason
          : readinessStatus === 'terminal_not_configured'
            ? 'Set up Tap to Pay readiness to create a terminal location for this restaurant.'
            : terminalCheck.reason;

  const payload = {
    restaurant_id: restaurantId,
    stripe_connected_account_id: account.id,
    onboarding_status: nextStatus,
    stripe_onboarding_status: nextStatus,
    charges_enabled: snapshot.charges_enabled,
    stripe_charges_enabled: snapshot.charges_enabled,
    payouts_enabled: snapshot.payouts_enabled,
    stripe_payouts_enabled: snapshot.payouts_enabled,
    details_submitted: snapshot.details_submitted,
    stripe_details_submitted: snapshot.details_submitted,
    card_payments_capability: snapshot.card_payments_capability,
    stripe_card_payments_capability: snapshot.card_payments_capability,
    transfers_capability: snapshot.transfers_capability,
    stripe_transfers_capability: snapshot.transfers_capability,
    requirements_currently_due: snapshot.requirements_currently_due,
    stripe_requirements_currently_due: snapshot.requirements_currently_due,
    requirements_eventually_due: snapshot.requirements_eventually_due,
    stripe_requirements_eventually_due: snapshot.requirements_eventually_due,
    requirements_past_due: snapshot.requirements_past_due,
    stripe_requirements_past_due: snapshot.requirements_past_due,
    requirements_pending_verification: snapshot.requirements_pending_verification,
    stripe_requirements_pending_verification: snapshot.requirements_pending_verification,
    disabled_reason: snapshot.disabled_reason,
    stripe_disabled_reason: snapshot.disabled_reason,
    terminal_location_id: snapshot.terminal_location_id,
    stripe_terminal_location_id: snapshot.stripe_terminal_location_id,
    stripe_terminal_location_display_name: snapshot.stripe_terminal_location_display_name,
    terminal_readiness_status: readinessStatus,
    terminal_readiness_reason: readinessReason,
    terminal_last_checked_at: new Date().toISOString(),
    last_synced_at: snapshot.last_synced_at,
    stripe_last_synced_at: snapshot.last_synced_at,
    onboarding_completed_at: nextStatus === 'connected' ? new Date().toISOString() : null,
    stripe_onboarding_completed_at: nextStatus === 'connected' ? new Date().toISOString() : null,
  };

  const { error } = await supaServer.from('restaurant_stripe_connect_accounts').upsert(payload, {
    onConflict: 'restaurant_id',
  });

  if (error) throw error;
  return payload;
};

export const getOrCreateConnectedAccount = async (restaurantId: string) => {
  logOnboardingInfo('connected_account.lookup.start', { restaurantId });
  const existingRow = await readRestaurantStripeRow(restaurantId);
  logOnboardingInfo('connected_account.lookup.result', {
    restaurantId,
    hasRow: !!existingRow,
    hasConnectedAccountId: !!existingRow?.stripe_connected_account_id,
  });
  if (existingRow?.stripe_connected_account_id) {
    logOnboardingInfo('connected_account.ensure_capabilities.start', {
      restaurantId,
      accountId: existingRow.stripe_connected_account_id,
    });
    await ensureRestaurantCapabilities(existingRow.stripe_connected_account_id);
    logOnboardingInfo('connected_account.ensure_capabilities.success', {
      restaurantId,
      accountId: existingRow.stripe_connected_account_id,
    });
    return existingRow.stripe_connected_account_id;
  }

  const stripe = getStripeClient();
  logOnboardingInfo('connected_account.create.start', { restaurantId });
  const account = await stripe.accounts.create({
    type: 'express',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: {
      restaurant_id: restaurantId,
      platform: 'orderfast',
    },
  });

  logOnboardingInfo('connected_account.create.success', {
    restaurantId,
    accountId: account.id,
  });
  await upsertStripeAccountBaseline(restaurantId, account);
  return account.id;
};

const ensureRestaurantCapabilities = async (connectedAccountId: string) => {
  const stripe = getStripeClient();
  await stripe.accounts.update(connectedAccountId, {
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
};

const DEFAULT_CONNECT_RETURN_URL = 'http://localhost:3000/dashboard/settings/payments?tab=stripe';

const isAllowedConnectUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return false;
    return true;
  } catch {
    return false;
  }
};

const resolveConnectUrl = (
  envValue: string | undefined,
  envName: 'STRIPE_CONNECT_RETURN_URL' | 'STRIPE_CONNECT_REFRESH_URL',
  fallback: string
) => {
  const candidate = (envValue || fallback).trim();
  if (!isAllowedConnectUrl(candidate)) {
    throw new StripeConnectConfigError(
      `${envName} must be an absolute http(s) URL. http:// is only allowed for localhost. Received: ${candidate || '(empty)'}`
    );
  }
  return candidate;
};

const resolveConnectUrls = () => {
  const returnUrl = resolveConnectUrl(
    process.env.STRIPE_CONNECT_RETURN_URL,
    'STRIPE_CONNECT_RETURN_URL',
    DEFAULT_CONNECT_RETURN_URL
  );
  const refreshUrl = resolveConnectUrl(process.env.STRIPE_CONNECT_REFRESH_URL, 'STRIPE_CONNECT_REFRESH_URL', returnUrl);
  return { returnUrl, refreshUrl };
};

const upsertTerminalMapping = async (
  restaurantId: string,
  values: {
    stripeTerminalLocationId: string | null;
    stripeTerminalLocationDisplayName: string | null;
    terminalReadinessStatus: TerminalReadinessStatus;
    terminalReadinessReason: string;
  }
) => {
  const { error } = await supaServer.from('restaurant_stripe_connect_accounts').upsert(
    {
      restaurant_id: restaurantId,
      stripe_terminal_location_id: values.stripeTerminalLocationId,
      terminal_location_id: values.stripeTerminalLocationId,
      stripe_terminal_location_display_name: values.stripeTerminalLocationDisplayName,
      terminal_readiness_status: values.terminalReadinessStatus,
      terminal_readiness_reason: values.terminalReadinessReason,
      terminal_last_checked_at: new Date().toISOString(),
      terminal_last_synced_at: values.stripeTerminalLocationId ? new Date().toISOString() : null,
    },
    { onConflict: 'restaurant_id' }
  );

  if (error) throw error;
};

const mapRestaurantAddressToStripe = (restaurant: RestaurantAddress | null) => {
  if (!restaurant) return null;

  const line1 = String(restaurant.address_line_1 || '').trim();
  const city = String(restaurant.city || '').trim();
  const postalCode = String(restaurant.postcode || '').trim();
  const country = String(restaurant.country_code || 'US').trim().toUpperCase();

  if (!line1 || !city || !postalCode || !country || country.length !== 2) {
    return null;
  }

  return {
    line1,
    line2: String(restaurant.address_line_2 || '').trim() || undefined,
    city,
    state: String(restaurant.county_state || '').trim() || undefined,
    postal_code: postalCode,
    country,
  };
};

const upsertStripeAccountBaseline = async (restaurantId: string, account: Stripe.Account) => {
  logOnboardingInfo('connected_account.persist_baseline.start', {
    restaurantId,
    accountId: account.id,
  });
  try {
    const payload = {
      restaurant_id: restaurantId,
      stripe_connected_account_id: account.id,
      onboarding_status: 'setup_incomplete' as StripeConnectionSnapshot['onboarding_status'],
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await supaServer.from('restaurant_stripe_connect_accounts').upsert(payload, {
      onConflict: 'restaurant_id',
    });

    if (error) {
      logOnboardingError('connected_account.persist_baseline.error', {
        restaurantId,
        accountId: account.id,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }

    logOnboardingInfo('connected_account.persist_baseline.success', {
      restaurantId,
      accountId: account.id,
    });
  } catch (error: any) {
    logOnboardingError('connected_account.persist_baseline.exception', {
      restaurantId,
      accountId: account.id,
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
};

export const createRestaurantOnboardingLink = async (restaurantId: string) => {
  logOnboardingInfo('route.create_onboarding_link.start', { restaurantId });
  const { returnUrl, refreshUrl } = resolveConnectUrls();
  logOnboardingInfo('route.create_onboarding_link.urls_resolved', {
    restaurantId,
    returnUrlOrigin: new URL(returnUrl).origin,
    refreshUrlOrigin: new URL(refreshUrl).origin,
  });
  const stripe = getStripeClient();
  const accountId = await getOrCreateConnectedAccount(restaurantId);
  logOnboardingInfo('route.create_onboarding_link.account_ready', { restaurantId, accountId });
  await ensureRestaurantCapabilities(accountId);
  logOnboardingInfo('route.create_onboarding_link.account_capabilities_ensured', { restaurantId, accountId });
  logOnboardingInfo('route.create_onboarding_link.account_link_create.start', { restaurantId, accountId });
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      collection_options: {
        fields: 'eventually_due',
        future_requirements: 'include',
      },
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    logOnboardingInfo('route.create_onboarding_link.account_link_create.success', {
      restaurantId,
      accountId,
      expiresAt: accountLink.expires_at,
    });
    return { accountId, url: accountLink.url, expiresAt: accountLink.expires_at };
  } catch (error: any) {
    logOnboardingError('route.create_onboarding_link.account_link_create.error', {
      restaurantId,
      accountId,
      message: error?.message,
      type: error?.type,
      code: error?.code,
      param: error?.param,
      statusCode: error?.statusCode,
      requestId: error?.requestId,
      stack: error?.stack,
    });
    throw error;
  }
};

export const isStripeConnectConfigError = (error: unknown): error is StripeConnectConfigError =>
  error instanceof StripeConnectConfigError;

export const createRestaurantAccountSession = async (restaurantId: string) => {
  const stripe = getStripeClient();
  const accountId = await getOrCreateConnectedAccount(restaurantId);
  await ensureRestaurantCapabilities(accountId);
  const session = await stripe.accountSessions.create({
    account: accountId,
    components: {
      account_management: { enabled: true },
      notification_banner: { enabled: true },
    },
  });
  return { accountId, clientSecret: session.client_secret, expiresAt: session.expires_at };
};

export const ensureRestaurantTerminalLocation = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  if (!row?.stripe_connected_account_id) {
    await upsertTerminalMapping(restaurantId, {
      stripeTerminalLocationId: null,
      stripeTerminalLocationDisplayName: null,
      terminalReadinessStatus: 'not_connected',
      terminalReadinessReason: 'Connect Stripe before setting up Tap to Pay readiness.',
    });
    return;
  }

  const onboardingStatus = pickFirst(row.stripe_onboarding_status, row.onboarding_status) ?? 'not_connected';
  if (onboardingStatus !== 'connected') {
    await upsertTerminalMapping(restaurantId, {
      stripeTerminalLocationId: row.stripe_terminal_location_id ?? row.terminal_location_id ?? null,
      stripeTerminalLocationDisplayName: row.stripe_terminal_location_display_name ?? null,
      terminalReadinessStatus: 'stripe_setup_incomplete',
      terminalReadinessReason: 'Finish Stripe setup before Tap to Pay readiness can be configured.',
    });
    return;
  }

  const existingLocationId = row.stripe_terminal_location_id ?? row.terminal_location_id;
  const stripe = getStripeClient();
  const accountId = row.stripe_connected_account_id;
  const account = await stripe.accounts.retrieve(accountId);
  const terminalCheck = terminalReadyFromAccount(account);

  if (existingLocationId) {
    await upsertTerminalMapping(restaurantId, {
      stripeTerminalLocationId: existingLocationId,
      stripeTerminalLocationDisplayName: row.stripe_terminal_location_display_name ?? null,
      terminalReadinessStatus: terminalCheck.status,
      terminalReadinessReason: terminalCheck.reason,
    });
    return;
  }

  const restaurant = await readRestaurantAddress(restaurantId);
  const stripeAddress = mapRestaurantAddressToStripe(restaurant);
  if (!stripeAddress) {
    await upsertTerminalMapping(restaurantId, {
      stripeTerminalLocationId: null,
      stripeTerminalLocationDisplayName: null,
      terminalReadinessStatus: 'terminal_pending',
      terminalReadinessReason: 'Add your restaurant address details to finish Tap to Pay preparation.',
    });
    return;
  }

  const listed = await stripe.terminal.locations.list({ limit: 100 }, { stripeAccount: accountId });
  const existing = listed.data.find((location) => location.metadata?.restaurant_id === restaurantId) || listed.data[0] || null;

  const location =
    existing ||
    (await stripe.terminal.locations.create(
      {
        display_name: (restaurant?.name || 'Restaurant').slice(0, 100),
        address: stripeAddress,
        metadata: {
          restaurant_id: restaurantId,
        },
      },
      { stripeAccount: accountId }
    ));

  await upsertTerminalMapping(restaurantId, {
    stripeTerminalLocationId: location.id,
    stripeTerminalLocationDisplayName: location.display_name || restaurant?.name || 'Restaurant',
    terminalReadinessStatus: terminalCheck.status,
    terminalReadinessReason:
      terminalCheck.status === 'tap_to_pay_ready'
        ? 'Terminal location configured. This restaurant is ready for kiosk Tap to Pay checkout.'
        : terminalCheck.reason,
  });
};

const resolveTerminalReadiness = (snapshot: StripeConnectionSnapshot): TerminalPaymentReadiness =>
  deriveTerminalPaymentReadiness(snapshot);

export const syncStripeConnection = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  if (!row?.stripe_connected_account_id) {
    const snapshot = toSnapshot(row);
    return {
      snapshot,
      readiness: deriveStripeReadiness(snapshot),
      paymentReadiness: resolveTerminalReadiness(snapshot),
    };
  }

  const stripe = getStripeClient();
  await ensureRestaurantCapabilities(row.stripe_connected_account_id);
  const account = await stripe.accounts.retrieve(row.stripe_connected_account_id);
  await upsertFromStripeAccount(restaurantId, account);
  const nextRow = await readRestaurantStripeRow(restaurantId);
  const snapshot = toSnapshot(nextRow);

  return {
    snapshot,
    readiness: deriveStripeReadiness(snapshot),
    paymentReadiness: resolveTerminalReadiness(snapshot),
  };
};

export const syncPaymentReadiness = async (restaurantId: string, ensureTerminalLocation = false) => {
  const synced = await syncStripeConnection(restaurantId);
  if (ensureTerminalLocation) {
    await ensureRestaurantTerminalLocation(restaurantId);
    return getStripeConnectionStatus(restaurantId);
  }
  return synced;
};

export const getStripeConnectionStatus = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  const snapshot = toSnapshot(row);
  const readiness = deriveStripeReadiness(snapshot);
  const paymentReadiness = resolveTerminalReadiness(snapshot);
  return { snapshot, readiness, paymentReadiness };
};

export const getStripeDebugTruth = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  if (!row?.stripe_connected_account_id) {
    return {
      restaurant_id: restaurantId,
      stripe_connected_account_id: null,
      charges_enabled: false,
      payouts_enabled: false,
      capabilities: null,
      requirements: null,
      details_submitted: false,
    };
  }

  const stripe = getStripeClient();
  await ensureRestaurantCapabilities(row.stripe_connected_account_id);
  const account = await stripe.accounts.retrieve(row.stripe_connected_account_id);

  return {
    restaurant_id: restaurantId,
    stripe_connected_account_id: account.id,
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    capabilities: account.capabilities ?? null,
    requirements: {
      currently_due: Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due : [],
      eventually_due: Array.isArray(account.requirements?.eventually_due) ? account.requirements.eventually_due : [],
      past_due: Array.isArray(account.requirements?.past_due) ? account.requirements.past_due : [],
      pending_verification: Array.isArray(account.requirements?.pending_verification)
        ? account.requirements.pending_verification
        : [],
      disabled_reason: account.requirements?.disabled_reason ?? null,
    },
    details_submitted: !!account.details_submitted,
  };
};
