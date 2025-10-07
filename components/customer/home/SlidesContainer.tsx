import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SlidesSection from '@/components/SlidesSection';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { supabase } from '@/lib/supabaseClient';
import type { SlideCfg } from '@/components/SlideModal';
import { tokens } from '../../../src/ui/tokens';

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
        const cfg: SlideCfg = coerceConfig(s.config_json, s);
        return <SlidesSection key={s.id} slide={s} cfg={cfg} />;
      })}
    </div>
  );
}

function coerceConfig(raw: any, slide: SlideRow): SlideCfg {
  const source = raw && typeof raw === 'object' ? raw : {};
  const background = source.background?.type ? source.background : normalizeLegacyBackground(source.background);
  const blocks = Array.isArray(source.blocks) ? source.blocks : Array.isArray(slide.config_json?.blocks) ? slide.config_json.blocks : [];
  return {
    background: background ?? { type: 'color', color: tokens.colors.surfaceInverse },
    blocks,
  } as SlideCfg;
}

function normalizeLegacyBackground(raw: any) {
  if (!raw)
    return {
      type: 'color',
      color: tokens.colors.surfaceInverse,
      overlay: { color: tokens.colors.overlay.strong, opacity: tokens.opacity[25] },
    };
  if (raw.type === 'color' || raw.type === 'image' || raw.type === 'video') return raw;
  if (raw.kind === 'image' || raw.kind === 'video') {
    return {
      type: raw.kind,
      url: raw.value,
      overlay: raw.overlay
        ? {
            color: raw.overlayColor || tokens.colors.overlay.strong,
            opacity: raw.overlayOpacity ?? tokens.opacity[25],
          }
        : undefined,
    };
  }
  return { type: 'color', color: raw.value || tokens.colors.surfaceInverse };
}
