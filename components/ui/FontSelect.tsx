import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { inspectorColors, inspectorLayout } from "../../src/components/inspector/layout";
import { tokens } from "../../src/ui/tokens";
import { APP_FONTS, AppFont, ensureFontLoaded, useFontSearch } from "@/lib/fonts";

const ITEM_HEIGHT = inspectorLayout.controlHeight + tokens.spacing.xs;
const VISIBLE_BUFFER = 4;

const sanitizeDomId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
const SELECT_ICON_SIZE = tokens.spacing.sm * 1.5;
const SELECT_PADDING_RIGHT = tokens.spacing.sm + SELECT_ICON_SIZE;
const FONT_SELECT_ICON_COLOR = `var(--font-select-icon, ${tokens.colors.neutral[500]})`;
const FONT_SELECT_ICON_DISABLED_COLOR = `var(--font-select-icon-disabled, ${tokens.colors.neutral[400]})`;
const FONT_SELECT_ICON_ACTIVE_COLOR = `var(--font-select-icon-active, ${tokens.colors.accent})`;
const FONT_SELECT_BORDER_HOVER = `var(--font-select-border-hover, ${tokens.colors.neutral[400]})`;
const FONT_SELECT_FOCUS_RING = `var(--font-select-focus-ring, ${tokens.colors.focusRing})`;
const FONT_SELECT_PANEL_DIVIDER = `var(--font-select-panel-divider, ${tokens.colors.borderLight})`;

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

  const { controlHeight, radius, borderWidth } = inspectorLayout;

  return (
    <div className="font-select-root">
      <button
        ref={triggerRef}
        type="button"
        className="font-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span className="font-select-label" style={{ fontFamily: triggerFontStack }}>
          {triggerLabel}
        </span>
        <span className="font-select-icon" aria-hidden="true">
          <svg width={SELECT_ICON_SIZE} height={SELECT_ICON_SIZE} viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div
          ref={panelRef}
          className="font-select-panel"
          role="presentation"
          onKeyDown={handlePanelKeyDown}
        >
          <div className="font-select-search">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search fonts"
              className="font-select-search-input"
            />
          </div>
          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={filteredFonts[activeIndex] ? sanitizeDomId(filteredFonts[activeIndex].id) : undefined}
            className="font-select-list"
          >
            {filteredFonts.length === 0 ? (
              <li className="font-select-empty">No fonts found</li>
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
                    className={`font-select-option${isActive ? " is-active" : ""}${
                      isSelected ? " is-selected" : ""
                    }`}
                    style={{ fontFamily: font.cssFamily }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectFont(font)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className="font-select-option-label">{font.label}</span>
                    {isSelected ? (
                      <span className="font-select-option-selected">Selected</span>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
      <style jsx>{`
        .font-select-root {
          position: relative;
          width: 100%;
          text-align: left;
        }

        .font-select-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          height: ${controlHeight}px;
          padding: 0 ${SELECT_PADDING_RIGHT}px 0 ${tokens.spacing.sm}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          background-color: ${inspectorColors.background};
          color: ${inspectorColors.text};
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1.2;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
        }

        .font-select-trigger:hover {
          border-color: ${FONT_SELECT_BORDER_HOVER};
        }

        .font-select-trigger:focus-visible {
          outline: ${tokens.border.thick}px solid ${FONT_SELECT_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${FONT_SELECT_FOCUS_RING};
        }

        .font-select-trigger[aria-expanded='true'] {
          border-color: ${FONT_SELECT_FOCUS_RING};
          box-shadow: 0 0 0 1px ${FONT_SELECT_FOCUS_RING};
        }

        .font-select-trigger:disabled {
          cursor: not-allowed;
          opacity: ${tokens.opacity[50]};
        }

        .font-select-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .font-select-icon {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: ${SELECT_ICON_SIZE}px;
          height: ${SELECT_ICON_SIZE}px;
          margin-left: ${tokens.spacing.xs}px;
          color: ${FONT_SELECT_ICON_COLOR};
          pointer-events: none;
          transition: color 0.18s ease;
        }

        .font-select-trigger:hover .font-select-icon,
        .font-select-trigger:focus-visible .font-select-icon,
        .font-select-trigger[aria-expanded='true'] .font-select-icon {
          color: ${FONT_SELECT_ICON_ACTIVE_COLOR};
        }

        .font-select-trigger:disabled .font-select-icon {
          color: ${FONT_SELECT_ICON_DISABLED_COLOR};
        }

        .font-select-panel {
          position: absolute;
          top: calc(100% + ${tokens.spacing.xs}px);
          left: 0;
          z-index: 30;
          width: 100%;
          border-radius: ${tokens.radius.md}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          background-color: ${inspectorColors.background};
          box-shadow: ${tokens.shadow.md};
          overflow: hidden;
        }

        .font-select-search {
          border-bottom: ${borderWidth}px solid ${FONT_SELECT_PANEL_DIVIDER};
          padding: ${tokens.spacing.sm}px;
          background-color: ${inspectorColors.background};
        }

        .font-select-search-input {
          width: 100%;
          border-radius: ${tokens.radius.sm}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
          font-size: 0.8125rem;
          color: ${inspectorColors.text};
          background-color: ${inspectorColors.background};
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .font-select-search-input::placeholder {
          color: ${inspectorColors.labelMuted};
        }

        .font-select-search-input:hover {
          border-color: ${FONT_SELECT_BORDER_HOVER};
        }

        .font-select-search-input:focus-visible {
          outline: ${tokens.border.thick}px solid ${FONT_SELECT_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${FONT_SELECT_FOCUS_RING};
        }

        .font-select-list {
          max-height: 16rem;
          overflow-y: auto;
          padding: ${tokens.spacing.xs}px 0;
          margin: 0;
          list-style: none;
        }

        .font-select-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          column-gap: ${tokens.spacing.xs}px;
          padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: ${inspectorColors.label};
          cursor: pointer;
          transition: background-color 0.18s ease, color 0.18s ease;
        }

        .font-select-option:hover {
          background-color: ${inspectorColors.surfaceHover};
        }

        .font-select-option.is-active {
          background-color: ${inspectorColors.surfaceActive};
        }

        .font-select-option.is-selected {
          color: ${inspectorColors.text};
        }

        .font-select-option-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .font-select-option-selected {
          flex-shrink: 0;
          margin-left: ${tokens.spacing.xs}px;
          font-size: 0.6875rem;
          color: ${tokens.colors.textSubtle};
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .font-select-empty {
          padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
          font-size: 0.8125rem;
          color: ${tokens.colors.textSubtle};
        }
      `}</style>
    </div>
  );
};

export default FontSelect;
