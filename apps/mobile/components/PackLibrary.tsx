import { fmt, PACK_FILTERS, PACK_SORTS, STYLES, styleName, type PackFilter, type PackSort, type StickerPack, type StyleId } from "@stickers/shared";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/env";
import { success, tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F, shadow } from "@/lib/theme";

const PAGE = 24;

type Query = { q: string; filter: PackFilter; style?: StyleId; sort: PackSort };
type Toast = { text: string; undo?: () => void };
type Sheet = { kind: "pack"; pack: StickerPack } | { kind: "sort" } | { kind: "style" } | { kind: "rename"; pack: StickerPack };

/**
 * My packs as a two-column grid that scales to hundreds of packs: search, filters,
 * sorting, favorites, paging as you scroll, long-press to select several, and
 * per-pack actions (add to WhatsApp, share, rename, duplicate, delete with undo).
 * `header` renders above the controls and scrolls with the list.
 */
export function PackLibrary({ header, onError }: { header?: ReactElement; onError?: (message: string | undefined) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { locale, m } = useI18n();
  const l = m.library;
  const t = m.app.home;

  const [query, setQuery] = useState<Query>({ q: "", filter: "all", sort: "newest" });
  const [search, setSearch] = useState("");
  const [packs, setPacks] = useState<StickerPack[]>();
  const [counts, setCounts] = useState<Record<PackFilter, number>>();
  const [cursor, setCursor] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>();
  const [sheet, setSheet] = useState<Sheet>();
  const [toast, setToast] = useState<Toast>();
  const requestId = useRef(0);
  const loaded = useRef(PAGE);

  const load = useCallback(
    async (q: Query, size = PAGE) => {
      const id = ++requestId.current;
      try {
        const r = await (await api()).listMyPacks({ ...q, limit: Math.min(Math.max(size, PAGE), 60) });
        if (id !== requestId.current) return;
        setPacks(r.packs);
        setCounts(r.counts);
        setCursor(r.nextCursor);
        loaded.current = r.packs.length;
        setError(undefined);
        onError?.(undefined);
      } catch (e) {
        if (id !== requestId.current) return;
        setError((e as Error).message);
        onError?.((e as Error).message);
      }
    },
    [onError],
  );

  // Search a moment after the last key.
  useEffect(() => {
    const id = setTimeout(() => setQuery((q) => (q.q === search.trim() ? q : { ...q, q: search.trim() })), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    void load(query);
  }, [query, load]);

  // Coming back from a pack or a new job: refresh what is already on screen.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void load(query, loaded.current);
    }, [load, query]),
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const r = await (await api()).listMyPacks({ ...query, limit: PAGE, cursor });
      if (id !== requestId.current) return;
      setPacks((prev) => {
        const have = new Set(prev?.map((p) => p.id));
        const next = [...(prev ?? []), ...r.packs.filter((p) => !have.has(p.id))];
        loaded.current = next.length;
        return next;
      });
      setCursor(r.nextCursor);
      setCounts(r.counts);
    } catch (e) {
      fail(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const fail = (e: unknown) => setToast({ text: fmt(l.actionError, { error: (e as Error).message }) });
  const reload = () => void load(query, loaded.current);
  const selecting = selected !== undefined;

  async function remove(ids: string[]) {
    const gone = packs?.filter((p) => ids.includes(p.id)) ?? [];
    setPacks((prev) => prev?.filter((p) => !ids.includes(p.id)));
    setCounts(
      (c) =>
        c && {
          all: c.all - gone.length,
          favorites: c.favorites - gone.filter((p) => p.favorite).length,
          animated: c.animated - gone.filter((p) => p.animated).length,
          static: c.static - gone.filter((p) => !p.animated).length,
        },
    );
    setSelected(undefined);
    try {
      const client = await api();
      if (ids.length === 1) await client.deletePack(ids[0]!);
      else await client.bulkPacks(ids, "delete");
      success();
      setToast({
        text: ids.length === 1 ? l.deleted : fmt(l.deletedCount, { n: ids.length }),
        undo: async () => {
          setToast(undefined);
          try {
            if (ids.length === 1) await client.restorePack(ids[0]!);
            else await client.bulkPacks(ids, "restore");
          } catch (e) {
            fail(e);
          }
          reload();
        },
      });
    } catch (e) {
      fail(e);
      reload();
    }
  }

  async function setFavorite(ids: string[], favorite: boolean) {
    tap();
    const changed = packs?.filter((p) => ids.includes(p.id) && Boolean(p.favorite) !== favorite).length ?? 0;
    setPacks((prev) => {
      const next = prev?.map((p) => (ids.includes(p.id) ? { ...p, favorite } : p));
      return query.filter === "favorites" && !favorite ? next?.filter((p) => !ids.includes(p.id)) : next;
    });
    setCounts((c) => c && { ...c, favorites: Math.max(0, c.favorites + (favorite ? changed : -changed)) });
    try {
      const client = await api();
      if (ids.length === 1) await client.updatePack(ids[0]!, { favorite });
      else {
        await client.bulkPacks(ids, favorite ? "favorite" : "unfavorite");
        setSelected(undefined);
      }
    } catch (e) {
      fail(e);
      reload();
    }
  }

  async function duplicate(p: StickerPack) {
    try {
      await (await api()).duplicatePack(p.id, fmt(l.copyName, { name: p.name }).slice(0, 40));
      success();
      setToast({ text: l.duplicated });
      void load(query, loaded.current + 1);
    } catch (e) {
      fail(e);
    }
  }

  async function rename(p: StickerPack, name: string) {
    setSheet(undefined);
    const clean = name.trim();
    if (!clean || clean === p.name) return;
    setPacks((prev) => prev?.map((x) => (x.id === p.id ? { ...x, name: clean } : x)));
    try {
      await (await api()).updatePack(p.id, { name: clean });
    } catch (e) {
      fail(e);
      reload();
    }
  }

  async function share(p: StickerPack) {
    const url = `${SITE_URL}/p/${p.id}`;
    const message = fmt(m.app.pack.shareMessage, { name: p.name });
    await Share.share(Platform.OS === "ios" ? { url, message } : { message: `${message}: ${url}` }).catch(() => undefined);
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedPacks = useMemo(() => packs?.filter((p) => selected?.has(p.id)) ?? [], [packs, selected]);
  const allStarred = selectedPacks.length > 0 && selectedPacks.every((p) => p.favorite);
  const nothingAtAll = counts?.all === 0 && !query.q && !query.style;
  const filtered = !!query.q || !!query.style || query.filter !== "all";
  // Two columns on phones, more on tablets.
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  // Fixed card width so a lone card in the last row stays the same size as the others.
  const cardWidth = Math.floor((width - 32 - 12 * (columns - 1)) / columns);
  // Thumbnails get a size in points: on Android a "50%" width with aspectRatio inside a
  // wrapping row lays out 0 high, so the previews never showed. 30 = card border + padding + grid padding.
  const thumbSize = Math.max(Math.floor((cardWidth - 30) / 2), 1);
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });

  const controls = !nothingAtAll && (
    <View style={s.controls}>
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={l.search}
          placeholderTextColor={C.muted}
          style={s.search}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
        {PACK_FILTERS.map((f) => {
          const on = query.filter === f;
          return (
            <Pressable key={f} onPress={() => (tap(), setQuery((q) => ({ ...q, filter: f })))} style={[s.chip, on && s.chipOn]} accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && s.chipTextOn]}>
                {f === "favorites" ? "★ " : ""}
                {l.filters[f]}
              </Text>
              {counts && <Text style={[s.chipCount, on && s.chipCountOn]}>{counts[f]}</Text>}
            </Pressable>
          );
        })}
        <Pressable onPress={() => setSheet({ kind: "style" })} style={[s.chip, !!query.style && s.chipOn]}>
          <Text style={[s.chipText, !!query.style && s.chipTextOn]}>{query.style ? styleName(m, query.style) : l.allStyles} ▾</Text>
        </Pressable>
        <Pressable onPress={() => setSheet({ kind: "sort" })} style={s.chip}>
          <Text style={s.chipText}>{l.sorts[query.sort]} ▾</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        key={columns}
        data={packs ?? []}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={s.row}
        contentContainerStyle={[s.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + (selecting ? 110 : 32) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.6}
        onEndReached={() => void loadMore()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.muted}
            onRefresh={async () => {
              setRefreshing(true);
              await load(query, loaded.current);
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View>
            {header}
            <View style={s.sectionRow}>
              <Text style={s.section}>{t.myPacks}</Text>
              {!!counts?.all && <Text style={s.count}>{counts.all}</Text>}
              {!nothingAtAll && !!packs?.length && (
                <Pressable
                  style={s.selectBtn}
                  hitSlop={8}
                  onPress={() => {
                    tap();
                    setSelected(selecting ? undefined : new Set());
                  }}
                >
                  <Text style={s.selectText}>{selecting ? l.cancel : l.select}</Text>
                </Pressable>
              )}
            </View>
            {error && (
              <Pressable onPress={() => router.push("/settings")}>
                <Text style={s.error}>{t.serverError}</Text>
              </Pressable>
            )}
            {controls}
            {!packs && !error && <ActivityIndicator style={{ marginVertical: 32 }} color={C.brand} />}
            {nothingAtAll && (
              <View style={s.empty}>
                <Image source={require("@/assets/images/styles/cartoon.png")} style={s.emptyImg} />
                <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
                <Text style={s.emptyBody}>{t.emptyBody}</Text>
              </View>
            )}
            {packs?.length === 0 && !nothingAtAll && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{query.filter === "favorites" && !query.q ? l.noFavorites : l.noResults}</Text>
                <Text style={[s.emptyBody, { textAlign: "center" }]}>{query.filter === "favorites" && !query.q ? l.noFavoritesBody : l.noResultsBody}</Text>
                {filtered && (
                  <Pressable
                    style={s.clearBtn}
                    onPress={() => {
                      setSearch("");
                      setQuery((q) => ({ ...q, q: "", filter: "all", style: undefined }));
                    }}
                  >
                    <Text style={s.clearText}>{l.clear}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 16 }} color={C.muted} /> : undefined}
        renderItem={({ item }) => {
          const isSel = !!selected?.has(item.id);
          return (
            <Pressable
              style={({ pressed }) => [s.card, { width: cardWidth }, isSel && s.cardSel, pressed && s.pressed]}
              onPress={() => (selecting ? (tap(), toggle(item.id)) : router.push({ pathname: "/pack/[id]", params: { id: item.id } }))}
              onLongPress={() => {
                tap();
                setSelected((s) => new Set([...(s ?? []), item.id]));
              }}
              delayLongPress={300}
              accessibilityState={selecting ? { selected: isSel } : undefined}
            >
              <View style={[s.thumbs, { minHeight: thumbSize * 2 + 12 }, isSel && { backgroundColor: C.brandSoft }]}>
                {item.stickers.slice(0, 4).map((st) => (
                  <Image key={st.id} source={st.url} style={{ width: thumbSize, height: thumbSize }} contentFit="contain" recyclingKey={st.id} />
                ))}
              </View>
              {selecting ? (
                <View style={[s.check, isSel && s.checkOn]}>{isSel && <Text style={s.checkMark}>✓</Text>}</View>
              ) : (
                <Pressable
                  hitSlop={8}
                  onPress={() => void setFavorite([item.id], !item.favorite)}
                  style={s.star}
                  accessibilityLabel={item.favorite ? l.unfavorite : l.favorite}
                >
                  <Text style={[s.starText, item.favorite && { color: C.sun }]}>{item.favorite ? "★" : "☆"}</Text>
                </Pressable>
              )}
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {fmt(m.pack.stickers, { n: item.stickers.length })} · {date(item.createdAt)}
                  </Text>
                </View>
                {!selecting && (
                  <Pressable hitSlop={10} onPress={() => (tap(), setSheet({ kind: "pack", pack: item }))} accessibilityLabel={l.more}>
                    <Text style={s.more}>⋯</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {selecting && (
        <View style={[s.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.bulkTop}>
            <Text style={s.bulkCount}>{fmt(l.selected, { n: selected.size })}</Text>
            <Pressable hitSlop={8} onPress={() => setSelected(selected.size === packs?.length ? new Set() : new Set(packs?.map((p) => p.id)))}>
              <Text style={s.bulkLink}>{l.selectAll}</Text>
            </Pressable>
          </View>
          <View style={s.bulkActions}>
            <Pressable disabled={!selected.size} style={[s.bulkBtn, !selected.size && s.dim]} onPress={() => void setFavorite([...selected], !allStarred)}>
              <Text style={s.bulkBtnText}>
                {allStarred ? "☆ " : "★ "}
                {allStarred ? l.unfavorite : l.favorite}
              </Text>
            </Pressable>
            <Pressable disabled={!selected.size} style={[s.bulkBtn, s.bulkDelete, !selected.size && s.dim]} onPress={() => void remove([...selected])}>
              <Text style={[s.bulkBtnText, { color: "#fff" }]}>{selected.size ? fmt(l.deleteCount, { n: selected.size }) : l.delete}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {toast && (
        <View style={[s.toastWrap, { bottom: insets.bottom + (selecting ? 130 : 24) }]} pointerEvents="box-none">
          <View style={s.toast}>
            <Text style={s.toastText}>{toast.text}</Text>
            {toast.undo && (
              <Pressable onPress={toast.undo} style={s.undo} hitSlop={6}>
                <Text style={s.undoText}>{l.undo}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <BottomSheet visible={!!sheet && sheet.kind !== "rename"} onClose={() => setSheet(undefined)}>
        {sheet?.kind === "pack" && (
          <>
            <Text style={s.sheetTitle} numberOfLines={1}>
              {sheet.pack.name}
            </Text>
            <SheetItem
              label={m.pack.addToWhatsApp}
              onPress={() => {
                setSheet(undefined);
                router.push({ pathname: "/pack/[id]", params: { id: sheet.pack.id, add: "1" } });
              }}
            />
            <SheetItem label={m.app.pack.share} onPress={() => (setSheet(undefined), void share(sheet.pack))} />
            <SheetItem label={sheet.pack.favorite ? l.unfavorite : l.favorite} onPress={() => (setSheet(undefined), void setFavorite([sheet.pack.id], !sheet.pack.favorite))} />
            <SheetItem label={l.rename} onPress={() => setSheet({ kind: "rename", pack: sheet.pack })} />
            <SheetItem label={l.duplicate} onPress={() => (setSheet(undefined), void duplicate(sheet.pack))} />
            <SheetItem label={l.select} onPress={() => (setSheet(undefined), setSelected(new Set([sheet.pack.id])))} />
            <SheetItem label={l.delete} danger onPress={() => (setSheet(undefined), void remove([sheet.pack.id]))} />
          </>
        )}
        {sheet?.kind === "sort" && (
          <>
            <Text style={s.sheetTitle}>{l.sort}</Text>
            {PACK_SORTS.map((o) => (
              <SheetItem key={o} label={l.sorts[o]} checked={query.sort === o} onPress={() => (setSheet(undefined), setQuery((q) => ({ ...q, sort: o })))} />
            ))}
          </>
        )}
        {sheet?.kind === "style" && (
          <ScrollView style={{ maxHeight: 420 }}>
            <SheetItem label={l.allStyles} checked={!query.style} onPress={() => (setSheet(undefined), setQuery((q) => ({ ...q, style: undefined })))} />
            {STYLES.map((o) => (
              <SheetItem key={o.id} label={styleName(m, o.id)} checked={query.style === o.id} onPress={() => (setSheet(undefined), setQuery((q) => ({ ...q, style: o.id })))} />
            ))}
          </ScrollView>
        )}
      </BottomSheet>

      {sheet?.kind === "rename" && <RenameDialog pack={sheet.pack} onClose={() => setSheet(undefined)} onSave={(name) => void rename(sheet.pack, name)} />}
    </View>
  );
}

function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => undefined}>
          <View style={s.grabber} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetItem({ label, onPress, danger, checked }: { label: string; onPress: () => void; danger?: boolean; checked?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.sheetItem, pressed && { backgroundColor: C.bg }]}>
      <Text style={[s.sheetItemText, danger && { color: C.danger }, checked && { fontFamily: F.semibold }]}>{label}</Text>
      {checked && <Text style={s.sheetCheck}>✓</Text>}
    </Pressable>
  );
}

function RenameDialog({ pack, onClose, onSave }: { pack: StickerPack; onClose: () => void; onSave: (name: string) => void }) {
  const { m } = useI18n();
  const l = m.library;
  const [name, setName] = useState(pack.name);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={[s.backdrop, { justifyContent: "center", padding: 24 }]} onPress={onClose}>
          <Pressable style={s.dialog} onPress={() => undefined}>
            <Text style={s.dialogTitle}>{l.renameTitle}</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              maxLength={40}
              selectTextOnFocus
              style={s.input}
              returnKeyType="done"
              onSubmitEditing={() => onSave(name)}
            />
            <View style={s.dialogRow}>
              <Pressable onPress={onClose} style={s.dialogBtn}>
                <Text style={s.dialogCancel}>{l.cancel}</Text>
              </Pressable>
              <Pressable onPress={() => onSave(name)} disabled={!name.trim()} style={[s.dialogBtn, s.dialogSave, !name.trim() && s.dim]}>
                <Text style={s.dialogSaveText}>{l.save}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 12 },
  row: { gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  section: { fontFamily: F.display, fontSize: 24, color: C.ink, letterSpacing: -0.4 },
  count: { fontFamily: F.semibold, fontSize: 13, color: C.muted, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  selectBtn: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  selectText: { fontFamily: F.semibold, fontSize: 13, color: C.ink },
  controls: { gap: 10, marginBottom: 4 },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 14 },
  searchIcon: { fontSize: 18, color: C.muted, marginRight: 6 },
  search: { flex: 1, fontFamily: F.regular, fontSize: 15, color: C.ink, paddingVertical: 11 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  chipTextOn: { color: "#fff" },
  chipCount: { fontFamily: F.medium, fontSize: 12, color: C.muted },
  chipCountOn: { color: "rgba(255,255,255,0.7)" },
  card: { backgroundColor: C.card, borderRadius: 22, padding: 8, borderWidth: 1, borderColor: C.line },
  cardSel: { borderColor: C.brand, borderWidth: 2, padding: 7 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  thumbs: { flexDirection: "row", flexWrap: "wrap", backgroundColor: C.bg, borderRadius: 16, padding: 6 },
  star: { position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  starText: { fontSize: 17, color: C.muted, marginTop: -1 },
  check: { position: "absolute", top: 12, left: 12, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: C.brand, borderColor: C.brand },
  checkMark: { color: "#fff", fontFamily: F.bold, fontSize: 13 },
  cardRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  cardTitle: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  cardMeta: { fontFamily: F.regular, color: C.muted, fontSize: 12, marginTop: 1 },
  more: { fontSize: 20, color: C.muted, paddingLeft: 6 },
  empty: { alignItems: "center", backgroundColor: C.card, borderRadius: 28, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", padding: 28, marginTop: 8 },
  emptyImg: { width: 96, height: 96 },
  emptyTitle: { fontFamily: F.displayBold, fontSize: 20, color: C.ink, marginTop: 8 },
  emptyBody: { fontFamily: F.regular, color: C.muted, marginTop: 4 },
  clearBtn: { marginTop: 16, borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
  clearText: { fontFamily: F.semibold, color: C.ink },
  error: { fontFamily: F.regular, color: C.danger, marginVertical: 8 },
  bulkBar: { position: "absolute", left: 12, right: 12, bottom: 0, backgroundColor: C.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 14, ...shadow },
  bulkTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bulkCount: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  bulkLink: { fontFamily: F.medium, color: "rgba(255,255,255,0.75)", fontSize: 14 },
  bulkActions: { flexDirection: "row", gap: 10 },
  bulkBtn: { flex: 1, borderRadius: 99, paddingVertical: 13, alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  bulkDelete: { backgroundColor: C.pop },
  bulkBtnText: { fontFamily: F.semibold, color: "#fff", fontSize: 14 },
  dim: { opacity: 0.4 },
  toastWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16 },
  toast: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.ink, borderRadius: 99, paddingVertical: 10, paddingLeft: 18, paddingRight: 10, minHeight: 44, ...shadow },
  toastText: { fontFamily: F.medium, color: "#fff", fontSize: 14 },
  undo: { backgroundColor: C.sun, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  undoText: { fontFamily: F.semibold, color: C.ink, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(22,18,29,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 6 },
  sheetTitle: { fontFamily: F.displayBold, fontSize: 18, color: C.ink, paddingHorizontal: 16, paddingVertical: 10 },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 15, borderRadius: 14 },
  sheetItemText: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink },
  sheetCheck: { color: C.brand, fontFamily: F.bold, fontSize: 16 },
  dialog: { backgroundColor: C.card, borderRadius: 28, padding: 22 },
  dialogTitle: { fontFamily: F.displayBold, fontSize: 22, color: C.ink },
  input: { marginTop: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.regular, fontSize: 16, color: C.ink },
  dialogRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  dialogBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 99 },
  dialogCancel: { fontFamily: F.semibold, color: C.muted, fontSize: 15 },
  dialogSave: { backgroundColor: C.ink },
  dialogSaveText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
});
