import assert from "node:assert/strict";
import { test } from "node:test";
import { captionUnits, parseCreatePackRequest, parsePlanRequest, sanitizePlan, toPackIdentifier, validatePackMeta, validateStickerFile, WA } from "../src/index";

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

test("custom stickers replace preset actions", () => {
  const stickers = [
    { pose: "throwing a right hook", motion: "punching again and again", caption: "KO!", emojis: ["🥊", "abc", "💥"] },
    { pose: "raising the belt", caption: "Champ" },
    { pose: "  dodging  a punch ", wholeBody: true },
  ];
  const r = parseCreatePackRequest({ prompt: "chibi boxer", style: "cartoon", kind: "animated", stickers });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.stickers?.length, 3);
    assert.deepEqual(r.value.stickers?.[0]?.emojis, ["🥊", "💥"], "non-emoji strings are dropped");
    assert.equal(r.value.stickers?.[2]?.pose, "dodging a punch");
    assert.equal(r.value.stickers?.[2]?.wholeBody, true);
    assert.deepEqual(r.value.actions, []);
  }
  const bad = parseCreatePackRequest({ prompt: "x", style: "cartoon", kind: "animated", stickers: [{ pose: "a" }, { pose: "" }, { pose: "c", caption: "x".repeat(30) }] });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.errors.length, 2);
  assert.equal(parseCreatePackRequest({ prompt: "x", style: "cartoon", kind: "animated", stickers: [{ pose: "a" }] }).ok, false);
});

test("plan requests and planner output are cleaned", () => {
  assert.equal(parsePlanRequest({ description: "" }).ok, false);
  const r = parsePlanRequest({ description: "boxer", count: 4 });
  assert.deepEqual(r.ok && r.value, { description: "boxer", count: 4, kind: "animated", hasPhoto: false });
  const plan = sanitizePlan(
    {
      character: "a chibi boxer with red gloves",
      packName: "Boxer",
      stickers: [
        { pose: "jab", caption: "Float like a butterfly sting" },
        { pose: "" },
        { pose: "victory", caption: "Champ", emojis: ["🏆"] },
        { pose: "guard up" },
        { pose: "extra" },
      ],
    },
    3,
  );
  assert.ok(plan);
  assert.equal(plan.stickers.length, 3);
  assert.equal(plan.stickers[0]!.caption, "Float like a");
  assert.equal(sanitizePlan({ character: "x", stickers: [{ pose: "a" }] }, 6), undefined);
});

test("CJK captions count double", () => {
  assert.equal(captionUnits("KO!"), 3);
  assert.equal(captionUnits("我最强"), 6);
  assert.equal(captionUnits("화이팅!"), 7);
  const ok = parseCreatePackRequest({ prompt: "x", style: "cartoon", kind: "static", stickers: [{ pose: "a", caption: "頑張って" }, { pose: "b", caption: "一二三四五六七八九十" }, { pose: "c" }] });
  assert.equal(ok.ok, true);
  const long = parseCreatePackRequest({ prompt: "x", style: "cartoon", kind: "static", stickers: [{ pose: "a", caption: "一二三四五六七八九十一" }, { pose: "b" }, { pose: "c" }] });
  assert.equal(long.ok, false);
  const plan = sanitizePlan({ character: "x", stickers: [{ pose: "a", caption: "今天也要元气满满地加油哦" }, { pose: "b" }, { pose: "c" }] }, 3);
  assert.equal(plan?.stickers[0]?.caption, "今天也要元气满满地加");
});
