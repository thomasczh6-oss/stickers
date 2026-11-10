import assert from "node:assert/strict";
import { test } from "node:test";
import { getDiscoverMessages, LOCALES, parsePublishRequest, parseRemixRequest, parseReportRequest, REPORT_REASONS } from "../src/index";

function leaves(o: unknown, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof o === "string") out.set(path, o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) for (const [p, s] of leaves(v, path ? `${path}.${k}` : k)) out.set(p, s);
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("Discover text exists in every language with the same placeholders", () => {
  const en = leaves(getDiscoverMessages("en"));
  for (const locale of LOCALES) {
    const other = leaves(getDiscoverMessages(locale));
    for (const [path, text] of en) {
      const t = other.get(path);
      assert.ok(t, `${locale}: missing discover.${path}`);
      assert.equal(placeholders(t), placeholders(text), `${locale}: placeholders differ in discover.${path}`);
    }
    for (const r of REPORT_REASONS) assert.ok(getDiscoverMessages(locale).reasons[r], `${locale}: reason ${r}`);
  }
});

test("publish, report and remix requests are checked", () => {
  assert.equal(parsePublishRequest({ agree: false }).ok, false);
  assert.deepEqual(parsePublishRequest({ agree: true, title: "  Coffee   moods " }), { ok: true, value: { title: "Coffee moods", agree: true } });
  assert.equal(parsePublishRequest({ agree: true, title: "x".repeat(41) }).ok, false);
  assert.equal(parseReportRequest({ reason: "spam", note: "  " }).ok, true);
  assert.equal(parseReportRequest({ reason: "meh" }).ok, false);
  assert.equal(parseRemixRequest({}).ok, false);
  const r = parseRemixRequest({ prompt: "a fox", style: "pixel", actions: ["cry"] });
  assert.ok(r.ok);
  assert.deepEqual(r.value, { prompt: "a fox" }, "recipe fields are dropped");
});
