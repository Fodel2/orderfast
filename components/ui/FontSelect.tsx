import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

import { APP_FONTS, AppFont, ensureFontLoaded, useFontSearch } from "@/lib/fonts";

const ITEM_HEIGHT = 36;
const VISIBLE_BUFFER = 4;

const sanitizeDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

const systemFallback = '"Inter", "Helvetica Neue", Arial, sans-serif';

const toFontStack = (value: string): string => {
  if (!value) return systemFallback;
  if (value.includes(",")) {
    return value;
  }
  return `"${value}", ${systemFallback}`;
};

type FontSelectProps = {
  value: string;
  onChange: (value: string) => void;
  fonts?: AppFont[];
  placeholder?: string;
};

const useVisibleFontLoader = (
  open: boolean,
  containerRef: React.RefObject<HTMLUListElement>,
  filteredFonts: AppFont[],
) => {
  const loadVisible = useCallback(
    (startIndex: number) => {
      if (!open) return;
      const container = containerRef.current;
      if (!container) return;
      const height = container.getBoundingClientRect().height || 0;
      const visibleCount = Math.max(
        Math.ceil(height / ITEM_HEIGHT) + VISIBLE_BUFFER,
        VISIBLE_BUFFER * 2,
      );
      const slice = filteredFonts.slice(startIndex, startIndex + visibleCount);
      slice.forEach((font) => {
        if (font.googleCss) {
          void ensureFontLoaded(font);
        }
      });
    },
    [containerRef, filteredFonts, open],
  );

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    loadVisible(0);
    container.scrollTop = 0;
    const handleScroll = () => {
      const startIndex = Math.floor(container.scrollTop / ITEM_HEIGHT);
      loadVisible(startIndex);
    };
    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, loadVisible, open]);
};

const matchFontValue = (font: AppFont, value: string) => {
  const normalizedValue = value.trim().toLowerCase();
  return (
    font.id.toLowerCase() === normalizedValue ||
    font.cssFamily.trim().toLowerCase() === normalizedValue ||
    font.label.trim().toLowerCase() === normalizedValue
  );
};

const getInitialFonts = (fonts?: AppFont[]) => fonts ?? APP_FONTS;

const FontSelect: React.FC<FontSelectProps> = ({
  value,
  onChange,
  fonts: providedFonts,
  placeholder = "Select font",
}) => {
  const fonts = useMemo(() => getInitialFonts(providedFonts), [providedFonts]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredFonts = useFontSearch(fonts, query);
  useVisibleFontLoader(open, listRef, filteredFonts);

  const selectedFont = useMemo(
    () => fonts.find((font) => matchFontValue(font, value)) ?? null,
    [fonts, value],
  );

  useEffect(() => {
    if (selectedFont) {
      void ensureFontLoaded(selectedFont);
    }
  }, [selectedFont]);

  useEffect(() => {
    if (!open) return;
    const searchEl = searchInputRef.current;
    if (!searchEl) return;
    const id = window.requestAnimationFrame(() => {
      searchEl.focus();
      searchEl.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const currentIndex = filteredFonts.findIndex((font) =>
      selectedFont ? matchFontValue(font, selectedFont.id) : matchFontValue(font, value),
    );
    setActiveIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [filteredFonts, open, selectedFont, value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const activeFont = filteredFonts[activeIndex];
    if (activeFont) {
      const domId = sanitizeDomId(activeFont.id);
      const option = optionRefs.current[domId];
      option?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, filteredFonts, open]);

  const listboxId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const selectFont = useCallback(
    (font: AppFont) => {
      onChange(font.id);
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filteredFonts.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const font = filteredFonts[activeIndex];
      if (font) {
        selectFont(font);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      searchInputRef.current?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const triggerLabel = selectedFont?.label ?? value ?? placeholder;
  const triggerFontStack = selectedFont
    ? selectedFont.cssFamily
    : value
      ? toFontStack(value)
      : systemFallback;

  return (
    <div className="relative w-full text-left">
      <button
        ref={triggerRef}
        type="button"
        className="flex w-full items-center justify-between rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition focus:outline-none focus:ring-2 focus:ring-neutral-400/40"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span className="truncate" style={{ fontFamily: triggerFontStack }}>
          {triggerLabel}
        </span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 text-neutral-400" aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute z-30 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg"
          role="presentation"
          onKeyDown={handlePanelKeyDown}
        >
          <div className="border-b border-neutral-100 px-2 py-2">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search fonts"
              className="w-full rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
          </div>
          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={filteredFonts[activeIndex] ? sanitizeDomId(filteredFonts[activeIndex].id) : undefined}
            className="font-select-panel max-h-64 overflow-y-auto py-1"
          >
            {filteredFonts.length === 0 ? (
              <li className="px-3 py-2 text-xs text-neutral-400">No fonts found</li>
            ) : (
              filteredFonts.map((font, index) => {
                const domId = sanitizeDomId(font.id);
                const isSelected = selectedFont ? matchFontValue(selectedFont, font.id) : false;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={font.id}
                    id={domId}
                    ref={(node) => {
                      optionRefs.current[domId] = node;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition ${
                      isActive ? "bg-neutral-100" : "hover:bg-neutral-50"
                    } ${isSelected ? "text-neutral-900" : "text-neutral-600"}`}
                    style={{ fontFamily: font.cssFamily }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectFont(font)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="truncate">{font.label}</span>
                    {isSelected ? <span className="ml-2 text-[10px] text-neutral-400">Selected</span> : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FontSelect;
