/** Joins class names, dropping falsy ones. Too small to warrant `clsx`. */
export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
