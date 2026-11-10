import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS, actionName, fmt, getMessages, LOCALES, matchLocale, parseAcceptLanguage, parseCreatePackRequest, STYLES, styleName } from "../src/index";

test("matches browser and phone languages to a supported locale", () => {
  assert.equal(matchLocale(["pt-BR", "en-US"]), "pt");
  assert.equal(matchLocale(["zh-Hant-TW"]), "zh");
  assert.equal(matchLocale(["nl-NL", "de-DE"]), "de");
  assert.equal(matchLocale(["nl", undefined, null]), "en");
  assert.equal(matchLocale(["ja_JP"]), "ja");
});

test("reads Accept-Language by preference", () => {
  assert.deepEqual(parseAcceptLanguage("fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"), ["fr-CH", "fr", "en", "de"]);
  assert.deepEqual(parseAcceptLanguage("en;q=0.2,ko"), ["ko", "en"]);
  assert.deepEqual(parseAcceptLanguage(undefined), []);
});

test("fmt fills placeholders and leaves unknown ones", () => {
  assert.equal(fmt("Make {n} stickers", { n: 6 }), "Make 6 stickers");
  assert.equal(fmt("{a} {b}", { a: "x" }), "x {b}");
});

/** Every string path of an object, with arrays flattened by index. */
function leaves(o: unknown, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof o === "string") out.set(path, o);
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) for (const [p, s] of leaves(v, path ? `${path}.${k}` : k)) out.set(p, s);
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("every language has every string, with the same placeholders", () => {
  const en = leaves(getMessages("en"));
  for (const locale of LOCALES) {
    const other = leaves(getMessages(locale));
    for (const [path, text] of en) {
      const t = other.get(path);
      assert.ok(t !== undefined && (t.length > 0 || text.length === 0 || path.startsWith("web.home.hero")), `${locale}: missing ${path}`);
      assert.equal(placeholders(t), placeholders(text), `${locale}: placeholders differ in ${path}`);
    }
    for (const s of STYLES) assert.ok(getMessages(locale).styles[s.id], `${locale}: style ${s.id}`);
  }
});

test("reaction labels fit on a sticker in every language", () => {
  // Same budget as the caption renderer: CJK characters count double, 20 units at most.
  const units = (s: string) => [...s].reduce((n, ch) => n + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);
  for (const locale of LOCALES) {
    for (const a of ACTIONS) {
      const label = actionName(getMessages(locale), a.id);
      assert.ok(units(label) <= 16, `${locale}: ${a.id} caption "${label}" is too long`);
    }
  }
});

test("names fall back to English for styles and actions not translated yet", () => {
  const m = getMessages("de");
  assert.equal(styleName(m, "watercolor"), "watercolor");
  assert.equal(styleName(m, "clay"), "Knete");
  assert.equal(actionName(m, "wave"), "Hallo!");
});

test("create request keeps a known locale and drops an unknown one", () => {
  const base = { prompt: "a corgi", style: "cartoon", kind: "animated", actions: ["wave", "laugh", "love"] };
  const ok = parseCreatePackRequest({ ...base, locale: "fr" });
  assert.ok(ok.ok && ok.value.locale === "fr");
  const unknown = parseCreatePackRequest({ ...base, locale: "xx" });
  assert.ok(unknown.ok && unknown.value.locale === undefined);
});

test("the mobile app config declares the same languages", async () => {
  const { readFile } = await import("node:fs/promises");
  const config = await readFile(new URL("../../../apps/mobile/app.config.ts", import.meta.url), "utf8");
  const list = config.match(/const LOCALES = (\[[^\]]*\])/)?.[1];
  assert.ok(list, "LOCALES not found in app.config.ts");
  assert.deepEqual(JSON.parse(list), [...LOCALES]);
});
