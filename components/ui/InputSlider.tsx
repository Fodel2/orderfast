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

export const InputSlider = React.forwardRef<HTMLInputElement, InputSliderProps>(
  ({ label, labelClassName, className, ...props }, ref) => {
    const input = (
      <input
        {...props}
        ref={ref}
        type="range"
        className={mergeClassNames("w-full", className)}
      />
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputSlider.displayName = "InputSlider";
