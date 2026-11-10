import { createNoticeStore, fmt, noticeTitle, type GenerationNotice, type NoticeState, type NoticeStore } from "@stickers/shared";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "./api";
import { success, tap } from "./haptics";
import { useI18n } from "./i18n";
import { C, F, shadow } from "./theme";

const StoreContext = createContext<NoticeStore | undefined>(undefined);

/** Opens what a notice is about: the finished pack, or the progress / failure screen. */
export function openNotice(n: GenerationNotice) {
  if (n.status === "succeeded" && n.packId) router.push({ pathname: "/pack/[id]", params: { id: n.packId } });
  else router.push({ pathname: "/job/[id]", params: { id: n.id } });
}

/** Runs the message center for the whole app and drops a banner when a pack finishes on another screen. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() =>
    createNoticeStore({
      load: async () => (await api()).listNotifications(),
      markRead: async (ids) => (await api()).markNotificationsRead(ids),
      clear: async (ids) => (await api()).clearNotifications(ids),
    }),
  );
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [banner, setBanner] = useState<GenerationNotice>();

  useEffect(() => {
    store.start();
    // Poll only while the app is open; catch up as soon as it comes back.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") store.start();
      else store.stop();
    });
    let hide: ReturnType<typeof setTimeout> | undefined;
    const off = store.onFinish((n) => {
      // The progress screen moves on to the pack (or shows the error) by itself.
      if (pathRef.current === `/job/${n.id}`) return;
      if (n.status === "succeeded") success();
      setBanner(n);
      if (hide) clearTimeout(hide);
      hide = setTimeout(() => setBanner(undefined), 7000);
    });
    return () => {
      off();
      sub.remove();
      store.stop();
      if (hide) clearTimeout(hide);
    };
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      {children}
      {banner && <Banner n={banner} onClose={() => setBanner(undefined)} />}
    </StoreContext.Provider>
  );
}

export function useNoticeStore(): NoticeStore | undefined {
  return useContext(StoreContext);
}

const EMPTY: NoticeState = { loading: true };
const noState = () => EMPTY;
const noSubscribe = () => () => undefined;
export function useNotices() {
  const store = useNoticeStore();
  const state = useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getState ?? noState, noState);
  return { store, ...state };
}

/** Round bell for a header: unread count badge, violet ring while a pack is being made. */
export function NotificationBell() {
  const { m } = useI18n();
  const { data } = useNotices();
  const unread = data?.unread ?? 0;
  const active = (data?.active ?? 0) > 0;
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push("/notifications");
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={unread ? `${m.notifications.open}, ${fmt(m.notifications.newCount, { n: unread })}` : m.notifications.open}
      style={({ pressed }) => [s.bell, active && s.bellActive, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.bellIcon}>🔔</Text>
      {unread > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Banner({ n, onClose }: { n: GenerationNotice; onClose: () => void }) {
  const { m } = useI18n();
  const t = m.notifications;
  const store = useNoticeStore();
  const insets = useSafeAreaInsets();
  const ok = n.status === "succeeded";
  const open = () => {
    void store?.markRead([n.id]);
    onClose();
    openNotice(n);
  };
  return (
    <View pointerEvents="box-none" style={[s.bannerWrap, { top: insets.top + 8 }]}>
      <Pressable onPress={open} style={s.banner} accessibilityRole="button">
        {ok && n.previewUrl ? (
          <Image source={{ uri: n.previewUrl }} style={s.bannerThumb} contentFit="contain" />
        ) : (
          <View style={s.bannerThumb}>
            <Text style={{ fontSize: 22 }}>{ok ? "🎉" : "😵‍💫"}</Text>
          </View>
        )}
        <Text style={s.bannerText} numberOfLines={2}>
          {fmt(ok ? t.toastReady : t.toastFailed, { name: noticeTitle(m, n) })}
        </Text>
        <View style={s.bannerButton}>
          <Text style={s.bannerButtonText}>{t.toastOpen}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t.remove} style={s.bannerClose}>
          <Text style={s.bannerCloseText}>✕</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bell: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  bellActive: { borderColor: C.brand, borderWidth: 2 },
  bellIcon: { fontSize: 16 },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.pop,
    borderWidth: 2,
    borderColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: F.bold, fontSize: 10, color: "#fff", lineHeight: 12 },
  bannerWrap: { position: "absolute", left: 12, right: 12, alignItems: "center" },
  banner: { width: "100%", maxWidth: 480, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.ink, borderRadius: 20, padding: 10, ...shadow },
  bannerThumb: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  bannerText: { flex: 1, fontFamily: F.semibold, fontSize: 14, color: "#fff", lineHeight: 19 },
  bannerButton: { backgroundColor: C.sun, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  bannerButtonText: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  bannerClose: { paddingHorizontal: 4 },
  bannerCloseText: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
});
