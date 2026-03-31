import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import type Stripe from 'stripe';
import { supaServer } from '@/lib/supaServer';
import { deriveStripeConnectionStatus, deriveStripeReadiness, type StripeConnectionSnapshot } from '@/lib/payments/stripeConnect';
import { getStripeClient } from './stripeClient';

type RestaurantStripeRow = {
  restaurant_id: string;
  stripe_connected_account_id: string | null;
  onboarding_status: StripeConnectionSnapshot['onboarding_status'];
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_currently_due: unknown;
  requirements_pending_verification: unknown;
  disabled_reason: string | null;
  terminal_location_id: string | null;
  onboarding_completed_at: string | null;
  last_synced_at: string | null;
};

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

export const resolveRestaurantIdFromSession = async (req: NextApiRequest, res: NextApiResponse): Promise<string | null> => {
  const supabaseAuth = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session?.user?.id) {
    return null;
  }

  const { data: membership } = await supaServer
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!membership?.restaurant_id) {
    return null;
  }

  return String(membership.restaurant_id);
};

export const readRestaurantStripeRow = async (restaurantId: string): Promise<RestaurantStripeRow | null> => {
  const { data, error } = await supaServer
    .from('restaurant_stripe_connect_accounts')
    .select(
      'restaurant_id,stripe_connected_account_id,onboarding_status,charges_enabled,payouts_enabled,details_submitted,requirements_currently_due,requirements_pending_verification,disabled_reason,terminal_location_id,onboarding_completed_at,last_synced_at'
    )
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as RestaurantStripeRow | null) ?? null;
};

export const toSnapshot = (row: RestaurantStripeRow | null): StripeConnectionSnapshot => ({
  stripe_connected_account_id: row?.stripe_connected_account_id ?? null,
  onboarding_status: row?.onboarding_status ?? 'not_connected',
  charges_enabled: !!row?.charges_enabled,
  payouts_enabled: !!row?.payouts_enabled,
  details_submitted: !!row?.details_submitted,
  requirements_currently_due: toStringArray(row?.requirements_currently_due),
  requirements_pending_verification: toStringArray(row?.requirements_pending_verification),
  disabled_reason: row?.disabled_reason ?? null,
  terminal_location_id: row?.terminal_location_id ?? null,
  onboarding_completed_at: row?.onboarding_completed_at ?? null,
  last_synced_at: row?.last_synced_at ?? null,
});

const upsertFromStripeAccount = async (restaurantId: string, account: Stripe.Account) => {
  const requirementsCurrentlyDue = Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due : [];
  const requirementsPending = Array.isArray(account.requirements?.pending_verification)
    ? account.requirements.pending_verification
    : [];

  const snapshot: StripeConnectionSnapshot = {
    stripe_connected_account_id: account.id,
    onboarding_status: 'setup_incomplete',
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    details_submitted: !!account.details_submitted,
    requirements_currently_due: requirementsCurrentlyDue,
    requirements_pending_verification: requirementsPending,
    disabled_reason: account.requirements?.disabled_reason || null,
    terminal_location_id: null,
    onboarding_completed_at: null,
    last_synced_at: new Date().toISOString(),
  };

  const nextStatus = deriveStripeConnectionStatus(snapshot);

  const payload = {
    restaurant_id: restaurantId,
    stripe_connected_account_id: account.id,
    onboarding_status: nextStatus,
    charges_enabled: snapshot.charges_enabled,
    payouts_enabled: snapshot.payouts_enabled,
    details_submitted: snapshot.details_submitted,
    requirements_currently_due: snapshot.requirements_currently_due,
    requirements_pending_verification: snapshot.requirements_pending_verification,
    disabled_reason: snapshot.disabled_reason,
    last_synced_at: snapshot.last_synced_at,
    onboarding_completed_at: nextStatus === 'connected' ? new Date().toISOString() : null,
  };

  const { error } = await supaServer.from('restaurant_stripe_connect_accounts').upsert(payload, {
    onConflict: 'restaurant_id',
  });

  if (error) throw error;
  return payload;
};

export const getOrCreateConnectedAccount = async (restaurantId: string) => {
  const existingRow = await readRestaurantStripeRow(restaurantId);
  if (existingRow?.stripe_connected_account_id) {
    return existingRow.stripe_connected_account_id;
  }

  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: 'express',
    metadata: {
      restaurant_id: restaurantId,
      platform: 'orderfast',
    },
  });

  await upsertFromStripeAccount(restaurantId, account);
  return account.id;
};

const getReturnUrl = () => process.env.STRIPE_CONNECT_RETURN_URL || 'http://localhost:3000/dashboard/settings/payments?tab=stripe';

const getRefreshUrl = () => process.env.STRIPE_CONNECT_REFRESH_URL || getReturnUrl();

export const createRestaurantOnboardingLink = async (restaurantId: string) => {
  const stripe = getStripeClient();
  const accountId = await getOrCreateConnectedAccount(restaurantId);
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    return_url: getReturnUrl(),
    refresh_url: getRefreshUrl(),
  });

  return { accountId, url: accountLink.url, expiresAt: accountLink.expires_at };
};

export const createRestaurantAccountSession = async (restaurantId: string) => {
  const stripe = getStripeClient();
  const accountId = await getOrCreateConnectedAccount(restaurantId);
  const session = await stripe.accountSessions.create({
    account: accountId,
    components: {
      account_management: { enabled: true },
      notification_banner: { enabled: true },
    },
  });
  return { accountId, clientSecret: session.client_secret, expiresAt: session.expires_at };
};

export const syncStripeConnection = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  if (!row?.stripe_connected_account_id) {
    const snapshot = toSnapshot(row);
    const readiness = deriveStripeReadiness(snapshot);
    return { snapshot, readiness };
  }

  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(row.stripe_connected_account_id);
  await upsertFromStripeAccount(restaurantId, account);
  const nextRow = await readRestaurantStripeRow(restaurantId);
  const snapshot = toSnapshot(nextRow);
  const readiness = deriveStripeReadiness(snapshot);
  return { snapshot, readiness };
};

export const getStripeConnectionStatus = async (restaurantId: string) => {
  const row = await readRestaurantStripeRow(restaurantId);
  const snapshot = toSnapshot(row);
  const readiness = deriveStripeReadiness(snapshot);
  return { snapshot, readiness };
};
