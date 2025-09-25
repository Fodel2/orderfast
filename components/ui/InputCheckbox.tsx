import React from "react";
import { mergeClassNames } from "./inputShared";

export interface InputCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  labelClassName?: string;
}

export const InputCheckbox = React.forwardRef<
  HTMLInputElement,
  InputCheckboxProps
>(({ label, labelClassName, className, ...props }, ref) => {
  const checkbox = (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      className={mergeClassNames("h-4 w-4", className)}
    />
  );

  if (!label) {
    return checkbox;
  }

  return (
    <label
      className={mergeClassNames(
        "flex items-center gap-2 text-sm text-neutral-600",
        labelClassName,
      )}
    >
      {checkbox}
      {typeof label === "string" ? <span>{label}</span> : label}
    </label>
  );
});

InputCheckbox.displayName = "InputCheckbox";
