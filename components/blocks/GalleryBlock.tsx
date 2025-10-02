import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAspectRatio, type AspectRatio } from "./ImageBlock";
import {
  DEFAULT_GALLERY_CONFIG,
  MAX_GALLERY_AUTOPLAY_INTERVAL,
  MIN_GALLERY_AUTOPLAY_INTERVAL,
} from "../SlidesManager";

type GalleryItem = { url: string; alt?: string };
type GalleryLayout = "grid" | "carousel";

type GalleryBlockProps = {
  items: GalleryItem[];
  layout?: GalleryLayout;
  radius?: number;
  shadow?: boolean;
  aspectRatio?: AspectRatio;
  className?: string;
  disablePointerGuards?: boolean;
  onImageDragStart?: (event: React.DragEvent<HTMLImageElement>) => void;
  autoplay?: boolean;
  interval?: number;
};

const GalleryImage: React.FC<{
  item: GalleryItem;
  aspectValue?: string;
  disablePointerGuards?: boolean;
  onImageDragStart?: (event: React.DragEvent<HTMLImageElement>) => void;
}> = ({ item, aspectValue, disablePointerGuards, onImageDragStart }) => {
  const style: React.CSSProperties = {
    objectFit: "cover",
    width: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    height: aspectValue ? "auto" : "100%",
  };
  if (aspectValue) {
    style.aspectRatio = aspectValue;
  }

  const pointerGuardProps: React.ImgHTMLAttributes<HTMLImageElement> = disablePointerGuards
    ? {
        className: "block-pointer-target select-none",
        draggable: false,
        onDragStart: (event) => {
          event.preventDefault();
          onImageDragStart?.(event);
        },
      }
    : {};

  return <img src={item.url} alt={item.alt || ""} style={style} {...pointerGuardProps} />;
};

const GalleryBlock: React.FC<GalleryBlockProps> = ({
  items,
  layout = "grid",
  radius = 0,
  shadow = false,
  aspectRatio = "original",
  className,
  disablePointerGuards = false,
  onImageDragStart,
  autoplay = false,
  interval,
}) => {
  const aspectValue = useMemo(() => getAspectRatio(aspectRatio), [aspectRatio]);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleImageDragStart = useCallback(
    (event: React.DragEvent<HTMLImageElement>) => {
      onImageDragStart?.(event);
    },
    [onImageDragStart],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [layout, items.length]);

  useEffect(() => {
    if (layout !== "carousel") return;
    const container = scrollRef.current;
    if (!container) return;
    const width = container.clientWidth;
    container.scrollTo({ left: width * activeIndex, behavior: "smooth" });
  }, [activeIndex, layout]);

  useEffect(() => {
    if (layout !== "carousel") return;
    if (!autoplay) return;
    if (items.length <= 1) return;
    const seconds = Number.isFinite(interval)
      ? (interval as number)
      : DEFAULT_GALLERY_CONFIG.interval;
    const clampedSeconds = Math.min(
      MAX_GALLERY_AUTOPLAY_INTERVAL,
      Math.max(MIN_GALLERY_AUTOPLAY_INTERVAL, seconds),
    );
    const intervalMs = Math.max(1, Math.round(clampedSeconds * 1000));
    const id = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= items.length ? 0 : next;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoplay, interval, layout, items.length]);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(items.length > 0 ? Math.max(0, items.length - 1) : 0);
    }
  }, [activeIndex, items.length]);

  const wrapperClasses = ["flex", "h-full", "w-full", "overflow-hidden"];
  if (shadow) wrapperClasses.push("shadow-lg");
  if (className) wrapperClasses.push(className);

  const wrapperStyle: React.CSSProperties = { borderRadius: radius };

  if (!items || items.length === 0) {
    return (
      <div className={wrapperClasses.join(" ")} style={wrapperStyle}>
        <div className="flex w-full items-center justify-center text-xs text-neutral-500">
          No images
        </div>
      </div>
    );
  }

  if (layout === "carousel") {
    return (
      <div className={wrapperClasses.join(" ")} style={wrapperStyle}>
        <div
          ref={scrollRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollBehavior: "smooth" }}
        >
          {items.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="flex h-full w-full flex-none snap-center items-center justify-center"
              style={{ minWidth: "100%" }}
            >
              <div
                className="flex h-full w-full items-center justify-center overflow-hidden"
                style={
                  aspectValue
                    ? { aspectRatio: aspectValue, height: "auto", width: "100%" }
                    : undefined
                }
              >
                <GalleryImage
                  item={item}
                  aspectValue={aspectValue}
                  disablePointerGuards={disablePointerGuards}
                  onImageDragStart={handleImageDragStart}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns = Math.min(items.length, 3) || 1;

  return (
    <div className={wrapperClasses.join(" ")} style={wrapperStyle}>
      <div
        className="grid h-full w-full gap-2"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: aspectValue ? "auto" : "1fr",
        }}
      >
        {items.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="flex h-full w-full items-center justify-center overflow-hidden"
            style={
              aspectValue
                ? { aspectRatio: aspectValue, height: "auto", width: "100%" }
                : undefined
            }
          >
            <GalleryImage
              item={item}
              aspectValue={aspectValue}
              disablePointerGuards={disablePointerGuards}
              onImageDragStart={onImageDragStart}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default GalleryBlock;
export type { GalleryItem, GalleryBlockProps, GalleryLayout };
