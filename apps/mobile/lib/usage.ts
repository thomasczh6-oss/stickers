import { fmt, type Messages, type Usage } from "@stickers/shared";

/** One line for the free allowance, e.g. "2 of 2 free packs left today". */
export function usageLine(m: Messages, u: Usage): string {
  if (u.plan === "pro" || u.limit <= 0) return m.usage.unlimited;
  return u.remaining > 0 ? fmt(m.usage.left, { n: u.remaining, max: u.limit }) : m.usage.none;
}
