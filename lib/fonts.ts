import { useMemo } from "react";

import {
  DEFAULT_TEXT_FONT_FAMILY,
  FONT_FAMILY_SELECT_OPTIONS,
  getFontPreviewStack,
} from "@/lib/slideFonts";

export type AppFont = {
  id: string;
  label: string;
  cssFamily: string;
  googleCss: string;
  weights?: number[];
};

const buildGoogleCssUrl = (family: string, weights: number[]) => {
  if (!family) return "";
  const familyToken = family.trim().replace(/\s+/g, "+");
  const uniqueWeights = Array.from(new Set(weights));
  const weightParam = uniqueWeights.length
    ? `:wght@${uniqueWeights.sort((a, b) => a - b).join(";")}`
    : "";
  return `https://fonts.googleapis.com/css2?family=${familyToken}${weightParam}&display=swap`;
};

const resolveCssFamily = (id: string) => getFontPreviewStack(id);

export const APP_FONTS: AppFont[] = FONT_FAMILY_SELECT_OPTIONS.map((option) => ({
  id: option.value,
  label: option.label,
  cssFamily: resolveCssFamily(option.value),
  googleCss:
    option.googleId && option.googleId.trim().length > 0
      ? buildGoogleCssUrl(option.googleId, option.weights)
      : "",
  weights: option.weights,
}));

const LOADING_FONTS = new Map<string, Promise<void>>();

export const ensureFontLoaded = (font: AppFont): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!font.googleCss) {
    return Promise.resolve();
  }

  const cacheKey = font.id;
  const existing = document.getElementById(`gf-${cacheKey}`) as HTMLLinkElement | null;
  if (existing) {
    const status = existing.dataset.status;
    if (status === "loaded" || status === "error") {
      return Promise.resolve();
    }
    if (LOADING_FONTS.has(cacheKey)) {
      return LOADING_FONTS.get(cacheKey)!;
    }
    return new Promise<void>((resolve) => {
      const finish = () => resolve();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", finish, { once: true });
    });
  }

  if (LOADING_FONTS.has(cacheKey)) {
    return LOADING_FONTS.get(cacheKey)!;
  }

  const link = document.createElement("link");
  link.id = `gf-${cacheKey}`;
  link.rel = "stylesheet";
  link.href = font.googleCss;
  link.dataset.status = "loading";

  const promise = new Promise<void>((resolve) => {
    const finalize = (status: "loaded" | "error") => {
      link.dataset.status = status;
      LOADING_FONTS.delete(cacheKey);
      resolve();
    };
    link.addEventListener("load", () => finalize("loaded"), { once: true });
    link.addEventListener("error", () => finalize("error"), { once: true });
  });

  LOADING_FONTS.set(cacheKey, promise);
  document.head.appendChild(link);
  return promise;
};

export const useFontSearch = (fonts: AppFont[], query: string) =>
  useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return fonts;
    return fonts.filter((font) => {
      const haystack = `${font.label} ${font.id}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [fonts, query]);

export const getFontStackFromId = (id: string | undefined): string =>
  getFontPreviewStack(id ?? DEFAULT_TEXT_FONT_FAMILY);
