import { ACTION_CATEGORIES, actionCategoryName, ACTIONS, actionName, PACK_THEMES, packThemeName, CREATE_LIMITS, DEFAULT_ACTIONS, fmt, parseCreatePackRequest, STYLE_GROUPS, STYLES, styleGroupName, styleName, type ActionId, type StyleId } from "@stickers/shared";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

type Photo = { uri: string; base64: string };
type Source = "photo" | "describe";

const STYLE_IMAGES: Record<StyleId, number> = {
  cartoon: require("@/assets/images/styles/cartoon.png"),
  "3d": require("@/assets/images/styles/3d.png"),
  anime: require("@/assets/images/styles/anime.png"),
  pixel: require("@/assets/images/styles/pixel.png"),
  clay: require("@/assets/images/styles/clay.png"),
  photo: require("@/assets/images/styles/photo.png"),
  caricature: require("@/assets/images/styles/caricature.png"),
  painted: require("@/assets/images/styles/painted.png"),
  retro: require("@/assets/images/styles/retro.png"),
  doodle: require("@/assets/images/styles/doodle.png"),
  watercolor: require("@/assets/images/styles/watercolor.png"),
  comic: require("@/assets/images/styles/comic.png"),
  sketch: require("@/assets/images/styles/sketch.png"),
  emoji: require("@/assets/images/styles/emoji.png"),
  plush: require("@/assets/images/styles/plush.png"),
  toy: require("@/assets/images/styles/toy.png"),
  papercut: require("@/assets/images/styles/papercut.png"),
};

/** Square crop from the picker, then at most 1024px as JPEG to keep the upload small. */
async function pickPhoto(): Promise<Photo | undefined> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return undefined;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1024 || asset.height > 1024) ctx.resize(asset.width >= asset.height ? { width: 1024 } : { height: 1024 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.88, base64: true });
  return saved.base64 ? { uri: saved.uri, base64: saved.base64 } : undefined;
}

export default function Create() {
  const insets = useSafeAreaInsets();
  const { locale, m } = useI18n();
  const c = m.create;
  const a = m.app.create;
  const [source, setSource] = useState<Source>("photo");
  const [photo, setPhoto] = useState<Photo>();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleId>("cartoon");
  const [actions, setActions] = useState<ActionId[]>(DEFAULT_ACTIONS);
  const [animated, setAnimated] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (id: ActionId) => {
    tap();
    setActions((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : cur.length < CREATE_LIMITS.MAX_ACTIONS ? [...cur, id] : cur));
  };

  const usePhoto = source === "photo" && photo;
  const ready = (!!usePhoto || prompt.trim().length > 0) && actions.length >= CREATE_LIMITS.MIN_ACTIONS;

  async function submit() {
    tap();
    setError(undefined);
    const parsed = parseCreatePackRequest({
      prompt: prompt.trim() || undefined,
      photo: usePhoto ? { base64: photo.base64, mimeType: "image/jpeg" } : undefined,
      style,
      kind: animated ? "animated" : "static",
      actions,
      captions,
      locale,
    });
    if (!parsed.ok) return setError(parsed.errors.join(". "));
    setBusy(true);
    try {
      const { job } = await (await api()).createPack(parsed.value);
      router.replace({ pathname: "/job/[id]", params: { id: job.id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <Section n={1} title={c.who}>
          <View style={s.segment}>
            {(["photo", "describe"] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  tap();
                  setSource(k);
                }}
                style={[s.segmentItem, source === k && s.segmentOn]}
              >
                <Text style={[s.segmentText, source === k && s.segmentTextOn]}>{k === "photo" ? a.tabPhoto : a.tabDescribe}</Text>
              </Pressable>
            ))}
          </View>

          {source === "photo" ? (
            <View style={s.photoRow}>
              <Pressable
                style={s.photo}
                onPress={async () => {
                  tap();
                  try {
                    const p = await pickPhoto();
                    if (p) setPhoto(p);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {photo ? (
                  <Image source={photo.uri} style={StyleSheet.absoluteFill} />
                ) : (
                  <>
                    <Text style={s.photoPlus}>+</Text>
                    <Text style={s.photoText}>{a.choosePhoto}</Text>
                  </>
                )}
              </Pressable>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={s.hint}>{a.photoHint}</Text>
                <TextInput
                  style={s.inputSmall}
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder={a.detailPlaceholder}
                  placeholderTextColor={C.muted}
                  maxLength={CREATE_LIMITS.PROMPT_MAX}
                />
              </View>
            </View>
          ) : (
            <>
              <TextInput
                style={s.input}
                value={prompt}
                onChangeText={setPrompt}
                placeholder={a.describePlaceholder}
                placeholderTextColor={C.muted}
                multiline
                maxLength={CREATE_LIMITS.PROMPT_MAX}
              />
              <View style={s.wrap}>
                {m.ideas.slice(0, 3).map((idea) => (
                  <Pressable key={idea} onPress={() => setPrompt(idea)} style={s.idea}>
                    <Text style={s.ideaText}>{idea}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Section>

        <Section n={2} title={c.style}>
          {STYLE_GROUPS.map((g) => (
            <View key={g.id}>
              <Text style={s.styleGroup}>{styleGroupName(m, g.id)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.styles} style={s.stylesScroll}>
                {STYLES.filter((st) => st.group === g.id).map((st) => {
                  const on = style === st.id;
                  return (
                    <Pressable
                      key={st.id}
                      onPress={() => {
                        tap();
                        setStyle(st.id);
                      }}
                      style={[s.styleCard, on && s.styleCardOn]}
                    >
                      <Image source={STYLE_IMAGES[st.id]} style={s.styleImg} contentFit="contain" />
                      <Text style={s.styleLabel}>{styleName(m, st.id)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </Section>

        <Section n={3} title={c.reactionsShort} aside={fmt(c.reactionsCount, { n: actions.length, max: CREATE_LIMITS.MAX_ACTIONS })}>
          <Text style={s.styleGroup}>{c.themes}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themes} style={s.stylesScroll}>
            {PACK_THEMES.map((t) => {
              const on = t.actions.length === actions.length && t.actions.every((id) => actions.includes(id));
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    tap();
                    setActions([...t.actions]);
                  }}
                  style={[s.theme, on && s.themeOn]}
                >
                  <Text style={s.themeEmojis}>{t.actions.slice(0, 4).map((id) => ACTIONS.find((x) => x.id === id)?.emojis[0]).join(" ")}</Text>
                  <Text style={s.themeLabel}>{packThemeName(m, t.id)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {ACTION_CATEGORIES.map((cat) => (
            <View key={cat.id}>
              <Text style={s.styleGroup}>{actionCategoryName(m, cat.id)}</Text>
              <View style={[s.wrap, { marginBottom: 12 }]}>
                {ACTIONS.filter((act) => act.category === cat.id).map((act) => {
                  const on = actions.includes(act.id);
                  return (
                    <Pressable key={act.id} onPress={() => toggle(act.id)} style={[s.chip, on && s.chipOn]}>
                      <Text style={s.emoji}>{act.emojis[0]}</Text>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{actionName(m, act.id)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Section>

        <Section n={4} title={c.finishing}>
          <View style={s.toggle}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>{c.animated}</Text>
              <Text style={s.toggleBody}>{c.animatedBody}</Text>
            </View>
            <Switch value={animated} onValueChange={setAnimated} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
          </View>
          <View style={[s.toggle, { borderTopWidth: 1, borderColor: C.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>{c.captions}</Text>
              <Text style={s.toggleBody}>{fmt(c.captionsBody, { a: actionName(m, "laugh"), b: actionName(m, "shock") })}</Text>
            </View>
            <Switch value={captions} onValueChange={setCaptions} trackColor={{ true: C.brand, false: C.line }} thumbColor="#fff" />
          </View>
        </Section>

        {error && <Text style={s.error}>{error}</Text>}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={({ pressed }) => [s.button, (!ready || busy) && s.buttonOff, pressed && { opacity: 0.85 }]} disabled={busy || !ready} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>{fmt(c.make, { n: actions.length })}</Text>}
        </Pressable>
        <Text style={s.note}>{ready ? a.takesMinute : source === "photo" ? a.needPhoto : c.needDescription}</Text>
      </View>
    </View>
  );
}

function Section({ n, title, aside, children }: { n: number; title: string; aside?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.num}>
          <Text style={s.numText}>{n}</Text>
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
        {aside && <Text style={s.aside}>{aside}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  section: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 18 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.sun, alignItems: "center", justifyContent: "center" },
  numText: { fontFamily: F.bold, fontSize: 12, color: C.ink },
  sectionTitle: { flex: 1, fontFamily: F.displayBold, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  aside: { fontFamily: F.medium, fontSize: 13, color: C.muted },
  segment: { flexDirection: "row", backgroundColor: C.bg, borderRadius: 99, padding: 4, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 99, alignItems: "center" },
  segmentOn: { backgroundColor: C.ink },
  segmentText: { fontFamily: F.semibold, color: C.muted, fontSize: 14 },
  segmentTextOn: { color: "#fff" },
  photoRow: { flexDirection: "row", gap: 14 },
  photo: { width: 112, height: 112, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.line, borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPlus: { fontFamily: F.regular, fontSize: 30, color: C.ink, lineHeight: 34 },
  photoText: { fontFamily: F.semibold, color: C.ink, fontSize: 13 },
  hint: { fontFamily: F.regular, color: C.muted, fontSize: 13, lineHeight: 18 },
  inputSmall: { backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: F.regular, color: C.ink, borderWidth: 1, borderColor: C.line },
  input: { minHeight: 96, backgroundColor: C.bg, borderRadius: 16, padding: 14, fontSize: 15, fontFamily: F.regular, color: C.ink, borderWidth: 1, borderColor: C.line, textAlignVertical: "top" },
  idea: { borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
  ideaText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  styleGroup: { fontFamily: F.semibold, fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 8 },
  stylesScroll: { marginHorizontal: -18, marginBottom: 10 },
  styles: { paddingHorizontal: 18, gap: 10 },
  styleCard: { width: 104, borderRadius: 18, borderWidth: 2, borderColor: "transparent", padding: 4 },
  styleCardOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  styleImg: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: C.bg },
  styleLabel: { fontFamily: F.semibold, fontSize: 13, color: C.ink, marginTop: 6, marginLeft: 4, marginBottom: 2 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themes: { gap: 8, paddingRight: 8 },
  theme: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: C.card, borderWidth: 2, borderColor: C.line },
  themeOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  themeEmojis: { fontSize: 16 },
  themeLabel: { fontFamily: F.semibold, fontSize: 13, color: C.ink, marginTop: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10, paddingRight: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  emoji: { fontSize: 17 },
  chipText: { fontFamily: F.semibold, color: C.ink, fontSize: 14 },
  chipTextOn: { color: "#fff" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  toggleTitle: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  toggleBody: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  error: { fontFamily: F.regular, color: C.danger, textAlign: "center", marginTop: 4 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.line },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 17, alignItems: "center" },
  buttonOff: { opacity: 0.35 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  note: { fontFamily: F.regular, color: C.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
