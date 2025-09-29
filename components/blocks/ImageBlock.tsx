import React from "react";

type AspectRatio = "original" | "square" | "4:3" | "16:9";

type ImageBlockProps = {
  url: string;
  alt?: string;
  fit?: "cover" | "contain";
  focalX?: number;
  focalY?: number;
  radius?: number;
  shadow?: boolean;
  aspectRatio?: AspectRatio;
  className?: string;
};

const ASPECT_RATIO_VALUE: Record<Exclude<AspectRatio, "original">, string> = {
  square: "1 / 1",
  "4:3": "4 / 3",
  "16:9": "16 / 9",
};

const getAspectRatio = (aspectRatio?: AspectRatio): string | undefined => {
  if (!aspectRatio || aspectRatio === "original") {
    return undefined;
  }
  return ASPECT_RATIO_VALUE[aspectRatio];
};

const ImageBlock: React.FC<ImageBlockProps> = ({
  url,
  alt = "",
  fit = "cover",
  focalX = 0.5,
  focalY = 0.5,
  radius = 0,
  shadow = false,
  aspectRatio = "original",
  className,
}) => {
  const aspectValue = getAspectRatio(aspectRatio);
  const wrapperClasses = [
    "flex",
    "w-full",
    "items-center",
    "justify-center",
    "overflow-hidden",
    "rounded",
  ];
  if (shadow) wrapperClasses.push("shadow-lg");
  if (className) wrapperClasses.push(className);

  const wrapperStyle: React.CSSProperties = { borderRadius: radius };
  if (aspectValue) {
    wrapperStyle.aspectRatio = aspectValue;
    wrapperStyle.height = "auto";
  }

  if (!url) {
    wrapperClasses.push("bg-neutral-200");
    return (
      <div className={wrapperClasses.join(" ")} style={wrapperStyle} aria-hidden>
        <span className="text-xs text-neutral-500">No image</span>
      </div>
    );
  }

  const imageStyle: React.CSSProperties = {
    objectFit: fit,
    objectPosition: `${focalX * 100}% ${focalY * 100}%`,
    borderRadius: radius,
    width: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    height: aspectValue ? "auto" : "100%",
  };
  if (aspectValue) {
    imageStyle.aspectRatio = aspectValue;
  }

  return (
    <div className={wrapperClasses.join(" ")} style={wrapperStyle}>
      <img src={url} alt={alt} style={imageStyle} />
    </div>
  );
};

export default ImageBlock;
export { getAspectRatio };
export type { AspectRatio, ImageBlockProps };
