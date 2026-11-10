import { fmt, noticeStatus, noticeTitle, styleName, timeAgo, type GenerationNotice } from "@stickers/shared";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { openNotice, useNotices } from "@/lib/notifications";
import { C, F } from "@/lib/theme";

/** Message center: packs being made, made and failed, newest first. */
export default function NotificationsScreen() {
  const { m } = useI18n();
  const t = m.notifications;
  const { store, data, error, loading } = useNotices();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const items = data?.notifications ?? [];
  const hasFinished = items.some((n) => n.status === "succeeded" || n.status === "failed");

  useEffect(() => {
    void store?.refresh();
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, [store]);

  const open = (n: GenerationNotice) => {
    tap();
    if (!n.read) void store?.markRead([n.id]);
    openNotice(n);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            (data?.unread ?? 0) > 0 ? (
              <Pressable onPress={() => void store?.markRead()} hitSlop={10}>
                <Text style={s.headerAction}>{t.markAllRead}</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={items.length ? s.list : s.emptyWrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await store?.refresh();
              setRefreshing(false);
            }}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <Row n={item} now={now} onOpen={() => open(item)} onRemove={() => void store?.clear([item.id])} />}
        ListEmptyComponent={
          loading && !data ? (
            <ActivityIndicator color={C.brand} />
          ) : error && !data ? (
            <Text style={s.error}>{t.loadError}</Text>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Text style={{ fontSize: 30 }}>🔔</Text>
              </View>
              <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
              <Text style={s.emptyBody}>{t.emptyBody}</Text>
              <Pressable style={s.cta} onPress={() => router.replace("/create")}>
                <Text style={s.ctaText}>{m.app.home.create}</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          hasFinished ? (
            <Pressable onPress={() => void store?.clear()} style={s.clear} hitSlop={8}>
              <Text style={s.clearText}>{t.clear}</Text>
            </Pressable>
          ) : undefined
        }
      />
    </>
  );
}

function Row({ n, now, onOpen, onRemove }: { n: GenerationNotice; now: number; onOpen: () => void; onRemove: () => void }) {
  const { m } = useI18n();
  const t = m.notifications;
  const active = n.status === "queued" || n.status === "running";
  const pct = n.progress.done / Math.max(1, n.progress.total);
  const color = n.status === "failed" ? C.danger : n.status === "succeeded" ? "#047857" : C.brand;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [s.row, !n.read && s.rowUnread, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {n.status === "succeeded" && n.previewUrl ? (
        <Image source={{ uri: n.previewUrl }} style={s.thumb} contentFit="contain" />
      ) : n.status === "failed" ? (
        <View style={[s.thumb, { backgroundColor: "#fff1f2" }]}>
          <Text style={{ fontSize: 26 }}>😵‍💫</Text>
        </View>
      ) : (
        <View style={[s.thumb, { backgroundColor: C.brandSoft }]}>
          <ActivityIndicator color={C.brand} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.titleLine}>
          <Text style={s.title} numberOfLines={1}>
            {noticeTitle(m, n)}
          </Text>
          <Text style={s.time}>{timeAgo(m, n.updatedAt, now)}</Text>
          {!n.read && <View style={s.dot} />}
        </View>
        <Text style={[s.status, { color }]}>
          {n.status === "succeeded" ? "✓ " : n.status === "failed" ? "! " : ""}
          {noticeStatus(m, n)}
        </Text>
        {n.status === "running" ? (
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(6, Math.round(pct * 100))}%` }]} />
          </View>
        ) : active ? null : n.status === "failed" && n.error ? (
          <Text style={s.meta} numberOfLines={2}>
            {n.error}
          </Text>
        ) : (
          <Text style={s.meta}>
            {styleName(m, n.style)} · {fmt(m.pack.stickers, { n: n.stickerCount })}
          </Text>
        )}
      </View>
      {!active && (
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t.remove} style={s.remove}>
          <Text style={s.removeText}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  headerAction: { fontFamily: F.semibold, color: C.brand, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 12 },
  rowUnread: { backgroundColor: "#f6f2ff", borderColor: "#ddd2ff" },
  thumb: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.ink },
  time: { fontFamily: F.regular, fontSize: 12, color: C.muted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.pop },
  status: { fontFamily: F.medium, fontSize: 14, marginTop: 2 },
  meta: { fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 3 },
  track: { height: 6, borderRadius: 99, backgroundColor: C.line, marginTop: 7, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.brand, borderRadius: 99 },
  remove: { paddingHorizontal: 4 },
  removeText: { color: C.muted, fontSize: 14 },
  clear: { alignSelf: "center", marginTop: 20 },
  clearText: { fontFamily: F.semibold, color: C.muted, fontSize: 14 },
  error: { fontFamily: F.regular, color: C.danger, textAlign: "center" },
  empty: { alignItems: "center" },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: F.display, fontSize: 22, color: C.ink, marginTop: 16 },
  emptyBody: { fontFamily: F.regular, fontSize: 15, color: C.muted, textAlign: "center", marginTop: 6, lineHeight: 21, maxWidth: 300 },
  cta: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 14, paddingHorizontal: 28, marginTop: 20 },
  ctaText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
});
