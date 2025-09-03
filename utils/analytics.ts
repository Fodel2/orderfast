import { supabase } from './supabaseClient';

export async function trackSlideEvent(event: 'slide_impression' | 'slide_cta_click', payload: Record<string, any>) {
  try {
    await supabase.from('analytics_events').insert({ event, payload });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('analytics event failed', e);
  }
}
