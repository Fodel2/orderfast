import React from "react";
import {
  INPUT_BASE_CLASS,
  mergeClassNames,
  wrapWithLabel,
} from "./inputShared";

export interface InputSelectOption {
  value: string | number;
  label: React.ReactNode;
}

export interface InputSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  labelClassName?: string;
  options?: InputSelectOption[];
}

export const InputSelect = React.forwardRef<HTMLSelectElement, InputSelectProps>(
  (
    { label, labelClassName, className, options = [], children, ...props },
    ref,
  ) => {
    const input = (
      <select
        {...props}
        ref={ref}
        className={mergeClassNames(INPUT_BASE_CLASS, className)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputSelect.displayName = "InputSelect";
