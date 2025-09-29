import React, { useMemo } from "react";
import { getAspectRatio, type AspectRatio } from "./ImageBlock";

type GalleryItem = { url: string; alt?: string };
type GalleryLayout = "grid" | "carousel";

type GalleryBlockProps = {
  items: GalleryItem[];
  layout?: GalleryLayout;
  radius?: number;
  shadow?: boolean;
  aspectRatio?: AspectRatio;
  className?: string;
};

const GalleryImage: React.FC<{ item: GalleryItem; aspectValue?: string }> = ({
  item,
  aspectValue,
}) => {
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

  return <img src={item.url} alt={item.alt || ""} style={style} />;
};

const GalleryBlock: React.FC<GalleryBlockProps> = ({
  items,
  layout = "grid",
  radius = 0,
  shadow = false,
  aspectRatio = "original",
  className,
}) => {
  const aspectValue = useMemo(() => getAspectRatio(aspectRatio), [aspectRatio]);

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
        <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto">
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
                <GalleryImage item={item} aspectValue={aspectValue} />
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
            <GalleryImage item={item} aspectValue={aspectValue} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default GalleryBlock;
export type { GalleryItem, GalleryBlockProps, GalleryLayout };
