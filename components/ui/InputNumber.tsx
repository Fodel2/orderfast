import React from "react";
import {
  INPUT_BASE_CLASS,
  mergeClassNames,
  wrapWithLabel,
} from "./inputShared";

export interface InputNumberProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  labelClassName?: string;
}

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  ({ label, labelClassName, className, ...props }, ref) => {
    const input = (
      <input
        {...props}
        ref={ref}
        type="number"
        className={mergeClassNames(INPUT_BASE_CLASS, className)}
      />
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputNumber.displayName = "InputNumber";
