import React from "react";
import { mergeClassNames } from "./inputShared";

export interface InputToggleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "checked" | "defaultChecked"> {
  label?: React.ReactNode;
  labelClassName?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const InputToggle = React.forwardRef<HTMLInputElement, InputToggleProps>(
  ({ label, labelClassName, className, checked, onChange, disabled, ...props }, ref) => (
    <label
      className={mergeClassNames(
        "flex items-center justify-between gap-3 text-sm text-neutral-600",
        labelClassName,
      )}
    >
      {typeof label === "string" ? <span>{label}</span> : label}
      <span className="relative inline-flex h-5 w-10 items-center">
        <input
          {...props}
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={mergeClassNames(
            "h-5 w-10 rounded-full border border-neutral-300 bg-neutral-200 transition-colors peer-disabled:opacity-50",
            className,
          )}
        />
        <span className="absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-white peer-disabled:opacity-50" />
      </span>
    </label>
  ),
);

InputToggle.displayName = "InputToggle";
