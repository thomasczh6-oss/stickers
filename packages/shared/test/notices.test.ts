import assert from "node:assert/strict";
import { test } from "node:test";
import { createNoticeStore, getMessages, noticeStatus, noticeTitle, timeAgo, type GenerationNotice, type NotificationsResponse } from "../src/index";

const base: GenerationNotice = {
  id: "job_1",
  status: "running",
  progress: { done: 3, total: 8 },
  style: "cartoon",
  kind: "animated",
  stickerCount: 6,
  fromPhoto: false,
  read: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("titles, status lines and times read well", () => {
  const en = getMessages("en");
  const zh = getMessages("zh");
  assert.equal(noticeTitle(en, { ...base, prompt: "a corgi" }), "a corgi");
  assert.equal(noticeTitle(en, { ...base, name: "Doggo", prompt: "a corgi" }), "Doggo");
  assert.equal(noticeTitle(zh, { ...base, fromPhoto: true }), "照片生成的贴纸包");
  assert.ok(noticeTitle(en, { ...base, prompt: "x".repeat(80) }).endsWith("…"));
  assert.equal(noticeStatus(en, base), "Making · 3 of 8");
  assert.equal(noticeStatus(zh, { ...base, status: "failed" }), "生成失败");
  const now = Date.parse(base.createdAt);
  assert.equal(timeAgo(en, base.createdAt, now + 20_000), "just now");
  assert.equal(timeAgo(en, base.createdAt, now + 5 * 60_000), "5 min ago");
  assert.equal(timeAgo(zh, base.createdAt, now + 3 * 3600_000), "3 小时前");
  assert.equal(timeAgo(en, base.createdAt, now + 3 * 86400_000), "3 d ago");
});

test("store reports a pack that finishes while open, and marks read optimistically", async () => {
  let server: NotificationsResponse = { notifications: [base], unread: 0, active: 1 };
  const read: (string[] | undefined)[] = [];
  const store = createNoticeStore({
    load: async () => server,
    markRead: async (ids) => {
      read.push(ids);
      server = { ...server, unread: 0, notifications: server.notifications.map((n) => ({ ...n, read: true })) };
    },
    clear: async () => undefined,
    activeMs: 10_000,
    idleMs: 10_000,
  });
  const finished: string[] = [];
  store.onFinish((n) => finished.push(n.id));
  await store.refresh();
  assert.equal(store.getState().data?.active, 1);

  server = { notifications: [{ ...base, status: "succeeded", read: false, packId: "pk_1" }], unread: 1, active: 0 };
  await store.refresh();
  assert.deepEqual(finished, ["job_1"]);
  await store.refresh();
  assert.deepEqual(finished, ["job_1"], "reported once");

  let seen = -1;
  const off = store.subscribe(() => {
    if (seen === -1) seen = store.getState().data!.unread;
  });
  await store.markRead();
  off();
  assert.equal(seen, 0, "unread drops before the server answers");
  assert.deepEqual(read, [undefined]);
  store.stop();
});
