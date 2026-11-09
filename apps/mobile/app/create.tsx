import { ACTIONS, CREATE_LIMITS, DEFAULT_ACTIONS, parseCreatePackRequest, STYLES, type ActionId, type StyleId } from "@stickers/shared";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";

type Photo = { uri: string; base64: string };

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
  const [photo, setPhoto] = useState<Photo>();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<StyleId>("cartoon");
  const [actions, setActions] = useState<ActionId[]>(DEFAULT_ACTIONS);
  const [animated, setAnimated] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (id: ActionId) =>
    setActions((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : cur.length < CREATE_LIMITS.MAX_ACTIONS ? [...cur, id] : cur));

  async function submit() {
    setError(undefined);
    const parsed = parseCreatePackRequest({
      prompt: prompt.trim() || undefined,
      photo: photo && { base64: photo.base64, mimeType: "image/jpeg" },
      style,
      kind: animated ? "animated" : "static",
      actions,
      captions,
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
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View style={s.row}>
        <Pressable
          style={s.photo}
          onPress={async () => {
            try {
              setPhoto(await pickPhoto());
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {photo ? <Image source={photo.uri} style={StyleSheet.absoluteFill} /> : <Text style={s.photoText}>Add a photo{"\n"}(optional)</Text>}
        </Pressable>
        <TextInput
          style={s.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder={photo ? "Anything to add? e.g. a superhero cape" : "Describe your character, e.g. a chubby corgi in a red bandana"}
          placeholderTextColor={C.muted}
          multiline
          maxLength={CREATE_LIMITS.PROMPT_MAX}
        />
      </View>

      <Text style={s.label}>Style</Text>
      <View style={s.wrap}>
        {STYLES.map((st) => (
          <Pressable key={st.id} onPress={() => setStyle(st.id)} style={[s.chip, style === st.id && s.chipOn]}>
            <Text style={[s.chipText, style === st.id && s.chipTextOn]}>{st.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>
        Reactions <Text style={s.muted}>({actions.length}, pick 3 to 12)</Text>
      </Text>
      <View style={s.wrap}>
        {ACTIONS.map((a) => {
          const on = actions.includes(a.id);
          return (
            <Pressable key={a.id} onPress={() => toggle(a.id)} style={[s.action, on && s.actionOn]}>
              <Text style={s.emoji}>{a.emojis[0]}</Text>
              <Text style={s.actionText}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Animated</Text>
        <Switch value={animated} onValueChange={setAnimated} trackColor={{ true: C.brand }} />
      </View>
      <View style={s.switchRow}>
        <Text style={s.switchLabel}>Captions (LOL, OMG…)</Text>
        <Switch value={captions} onValueChange={setCaptions} trackColor={{ true: C.brand }} />
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Make {actions.length} stickers</Text>}
      </Pressable>
      <Text style={s.note}>Takes about a minute. Your photo is only used to draw your character and is deleted right after.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: "row", gap: 12 },
  photo: { width: 110, height: 110, borderRadius: 22, backgroundColor: C.soft, borderWidth: 2, borderColor: C.line, borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoText: { color: C.muted, textAlign: "center", fontWeight: "600" },
  input: { flex: 1, minHeight: 110, backgroundColor: C.card, borderRadius: 18, padding: 14, fontSize: 15, color: C.ink, borderWidth: 1, borderColor: C.line, textAlignVertical: "top" },
  label: { fontSize: 15, fontWeight: "800", color: C.ink, marginTop: 24, marginBottom: 10 },
  muted: { color: C.muted, fontWeight: "400" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontWeight: "700", color: C.ink },
  chipTextOn: { color: "#fff" },
  action: { width: "31.5%", flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  actionOn: { borderColor: C.brand, backgroundColor: C.soft },
  emoji: { fontSize: 20 },
  actionText: { fontWeight: "700", color: C.ink, flexShrink: 1 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  switchLabel: { fontSize: 15, fontWeight: "700", color: C.ink },
  error: { color: C.danger, marginTop: 16 },
  button: { backgroundColor: C.brand, borderRadius: 99, paddingVertical: 17, alignItems: "center", marginTop: 28 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  note: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 10 },
});
