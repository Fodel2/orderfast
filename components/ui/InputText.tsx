import React from "react";
import {
  INPUT_BASE_CLASS,
  mergeClassNames,
  wrapWithLabel,
} from "./inputShared";

export interface InputTextProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  labelClassName?: string;
}

export const InputText = React.forwardRef<HTMLInputElement, InputTextProps>(
  ({ label, labelClassName, className, type = "text", ...props }, ref) => {
    const input = (
      <input
        {...props}
        ref={ref}
        type={type}
        className={mergeClassNames(INPUT_BASE_CLASS, className)}
      />
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputText.displayName = "InputText";
