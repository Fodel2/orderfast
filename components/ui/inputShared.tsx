import React from "react";

export const INPUT_BASE_CLASS = "w-full border rounded px-2 py-1 text-sm";
export const LABEL_BASE_CLASS =
  "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export function mergeClassNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function wrapWithLabel(
  label: React.ReactNode | undefined,
  input: React.ReactElement,
  labelClassName?: string,
) {
  if (!label) {
    return input;
  }

  return (
    <label className={mergeClassNames(LABEL_BASE_CLASS, labelClassName)}>
      {typeof label === "string" ? <span>{label}</span> : label}
      {input}
    </label>
  );
}
