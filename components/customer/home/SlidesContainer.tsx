import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SlidesSection from '@/components/SlidesSection';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { supabase } from '@/lib/supabaseClient';
import type { SlideConfig } from '@/components/SlideModal';

export interface SlideRow {
  id?: string;
  restaurant_id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  media_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  visible_from?: string | null;
  visible_until?: string | null;
  is_active?: boolean;
  sort_order?: number;
  config_json?: any;
}

export default function SlidesContainer() {
  const router = useRouter();
  const restaurantId = resolveRestaurantId(router, null);
  const [slides, setSlides] = useState<SlideRow[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('restaurant_slides')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .or('visible_from.is.null,visible_from.lte.now()')
      .or('visible_until.is.null,visible_until.gte.now()')
      .neq('type', 'hero')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data }) => setSlides(data || []));
  }, [restaurantId]);

  if (!slides.length) return null;

  return (
    <div className="snap-y snap-mandatory" style={{ scrollSnapType: 'y mandatory' }}>
      {slides.map((s) => {
        const cfg: SlideConfig = coerceConfig(s.config_json);
        return <SlidesSection key={s.id} slide={s} cfg={cfg} setCfg={() => {}} />;
      })}
    </div>
  );
}

function coerceConfig(raw: any): SlideConfig {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  if (!cfg.background) cfg.background = { kind: 'color', value: '#111', overlay: false };
  if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
  return cfg as SlideConfig;
}
