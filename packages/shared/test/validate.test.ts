import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCreatePackRequest, toPackIdentifier, validatePackMeta, validateStickerFile, WA } from "../src/index";

test("accepts a minimal prompt request", () => {
  const r = parseCreatePackRequest({ prompt: "a corgi", style: "cartoon", kind: "animated", actions: ["wave", "laugh", "love"] });
  assert.equal(r.ok, true);
});

test("rejects missing prompt and photo, too few actions, bad style", () => {
  const r = parseCreatePackRequest({ style: "oil", kind: "animated", actions: ["wave"] });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.some((e) => e.includes("prompt, a photo")));
    assert.ok(r.errors.some((e) => e.includes("style")));
    assert.ok(r.errors.some((e) => e.includes("3 to 12")));
  }
});

test("dedupes repeated actions before counting", () => {
  const r = parseCreatePackRequest({ prompt: "x", style: "3d", kind: "static", actions: ["wave", "wave", "wave"] });
  assert.equal(r.ok, false);
});

test("pack identifier keeps only allowed characters", () => {
  assert.equal(toPackIdentifier("my pack/✨1"), "my pack__1");
  assert.equal(toPackIdentifier(""), "pack");
});

test("sticker file rules", () => {
  assert.deepEqual(validateStickerFile({ width: 512, height: 512, bytes: 1000, frameDelaysMs: [100, 100] }, true), []);
  assert.equal(validateStickerFile({ width: 512, height: 512, bytes: WA.ANIMATED_MAX_BYTES + 1, frameDelaysMs: [100, 100] }, true).length, 1);
  assert.equal(validateStickerFile({ width: 512, height: 512, bytes: 1000, frameDelaysMs: [5, 100] }, true).length, 1);
  assert.equal(validateStickerFile({ width: 512, height: 512, bytes: 1000, frameDelaysMs: [6000, 6000] }, true).length, 1);
  assert.equal(validateStickerFile({ width: 500, height: 512, bytes: 1000, frameDelaysMs: [] }, false).length, 1);
});

test("pack meta needs 3 stickers with emoji", () => {
  const sticker = { id: "s", index: 0, fileName: "01.webp", url: "", bytes: 10, emojis: ["😀"], accessibilityText: "hi" };
  const base = { identifier: "abc", name: "My pack", publisher: "me", animated: true };
  assert.equal(validatePackMeta({ ...base, stickers: [sticker, sticker] }).length, 1);
  assert.deepEqual(validatePackMeta({ ...base, stickers: [sticker, sticker, sticker] }), []);
  assert.equal(validatePackMeta({ ...base, stickers: [sticker, sticker, { ...sticker, emojis: [] }] }).length, 1);
});

test("checks feedback messages", async () => {
  const { parseFeedbackRequest } = await import("../src/index");
  assert.equal(parseFeedbackRequest({ kind: "bug", message: "it broke" }).ok, true);
  assert.equal(parseFeedbackRequest({ kind: "bug", message: "x" }).ok, false);
  assert.equal(parseFeedbackRequest({ kind: "spam", message: "hello there" }).ok, false);
  assert.equal(parseFeedbackRequest({ kind: "idea", message: "hello there", email: "nope" }).ok, false);
  const ok = parseFeedbackRequest({ kind: "idea", message: "  more styles  ", email: "a@b.co", platform: "ios", locale: "xx" });
  assert.ok(ok.ok && ok.value.message === "more styles" && ok.value.locale === undefined && ok.value.platform === "ios");
});
