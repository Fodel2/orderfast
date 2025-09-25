import React from "react";
import {
  mergeClassNames,
  wrapWithLabel,
} from "./inputShared";

export interface InputSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  labelClassName?: string;
}

const SLIDER_BASE_CLASS =
  "w-full h-2 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-neutral-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border-0 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-neutral-200 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-progress]:bg-emerald-500";

export const InputSlider = React.forwardRef<HTMLInputElement, InputSliderProps>(
  ({ label, labelClassName, className, ...props }, ref) => {
    const input = (
      <input
        {...props}
        ref={ref}
        type="range"
        className={mergeClassNames(SLIDER_BASE_CLASS, className)}
      />
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputSlider.displayName = "InputSlider";
