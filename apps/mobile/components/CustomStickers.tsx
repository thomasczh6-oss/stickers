import { CREATE_LIMITS, fmt, type CustomSticker, type StickerPlan } from "@stickers/shared";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { tap } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

const COUNTS = [4, 6, 8, 12];

/**
 * "Make it yours": the user describes their persona and stickers, the server writes one
 * sticker per idea, and the user can tweak every caption and pose before making the pack.
 * The description and count live in the create screen, so a retry after a failed job keeps them.
 */
export function CustomStickers({
  plan,
  onPlan,
  description,
  onDescription,
  count,
  onCount,
  kind,
  hasPhoto,
  characterHint,
}: {
  plan?: StickerPlan;
  onPlan: (plan: StickerPlan | undefined) => void;
  description: string;
  onDescription: (text: string) => void;
  count: number;
  onCount: (n: number) => void;
  kind: "animated" | "static";
  hasPhoto: boolean;
  characterHint?: string;
}) {
  const { m } = useI18n();
  const t = m.custom;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function makePlan() {
    tap();
    setError(undefined);
    setBusy(true);
    try {
      const hint = characterHint?.trim();
      const full = hint ? `Character: ${hint}\n${description.trim()}` : description.trim();
      const { plan } = await (await api()).planPack({ description: full.slice(0, CREATE_LIMITS.DESCRIPTION_MAX), count, kind, hasPhoto });
      onPlan(plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<CustomSticker>) =>
    plan && onPlan({ ...plan, stickers: plan.stickers.map((st, j) => (j === i ? { ...st, ...patch } : st)) });
  const remove = (i: number) => plan && onPlan({ ...plan, stickers: plan.stickers.filter((_, j) => j !== i) });

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        style={s.input}
        value={description}
        onChangeText={onDescription}
        placeholder={t.describePlaceholder}
        placeholderTextColor={C.muted}
        multiline
        maxLength={CREATE_LIMITS.DESCRIPTION_MAX - 200}
      />
      <View style={s.wrap}>
        {t.ideas.slice(0, 3).map((idea) => (
          <Pressable key={idea} onPress={() => onDescription(idea)} style={s.idea}>
            <Text style={s.ideaText}>{idea}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.row}>
        <Text style={s.label}>{t.countLabel}</Text>
        {COUNTS.map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              tap();
              onCount(n);
            }}
            style={[s.count, count === n && s.countOn]}
          >
            <Text style={[s.countText, count === n && s.countTextOn]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={[s.planButton, (busy || description.trim().length < 3) && { opacity: 0.4 }]} disabled={busy || description.trim().length < 3} onPress={makePlan}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.planButtonText}>{plan ? t.rewrite : t.write}</Text>}
      </Pressable>
      {error && <Text style={s.error}>{error}</Text>}

      {plan && (
        <View style={{ gap: 10, marginTop: 6 }}>
          <Text style={s.label}>{t.character}</Text>
          <TextInput
            style={[s.input, { minHeight: 64 }]}
            value={plan.character}
            onChangeText={(character) => onPlan({ ...plan, character })}
            multiline
            maxLength={CREATE_LIMITS.PROMPT_MAX}
          />
          <Text style={s.label}>{t.yourStickers}</Text>
          {plan.stickers.map((st, i) => (
            <View key={i} style={s.card}>
              <View style={s.row}>
                <Text style={{ fontSize: 20 }}>{st.emojis?.[0] ?? "😀"}</Text>
                <TextInput
                  style={s.caption}
                  value={st.caption ?? ""}
                  onChangeText={(caption) => update(i, { caption })}
                  placeholder={t.noCaption}
                  accessibilityLabel={fmt(t.captionLabel, { n: i + 1 })}
                  placeholderTextColor={C.muted}
                  maxLength={CREATE_LIMITS.CAPTION_MAX}
                />
                <Pressable
                  onPress={() => remove(i)}
                  disabled={plan.stickers.length <= CREATE_LIMITS.MIN_ACTIONS}
                  hitSlop={8}
                  accessibilityLabel={fmt(t.removeLabel, { n: i + 1 })}
                  style={{ opacity: plan.stickers.length <= CREATE_LIMITS.MIN_ACTIONS ? 0.3 : 1 }}
                >
                  <Text style={s.remove}>×</Text>
                </Pressable>
              </View>
              <TextInput
                style={s.pose}
                value={st.pose}
                onChangeText={(pose) => update(i, { pose, motion: undefined })}
                placeholder={t.posePlaceholder}
                accessibilityLabel={fmt(t.poseLabel, { n: i + 1 })}
                placeholderTextColor={C.muted}
                multiline
                maxLength={CREATE_LIMITS.POSE_MAX}
              />
            </View>
          ))}
          {plan.stickers.length < CREATE_LIMITS.MAX_ACTIONS && (
            <Pressable onPress={() => onPlan({ ...plan, stickers: [...plan.stickers, { pose: "", caption: "" }] })} style={s.idea}>
              <Text style={s.ideaText}>{t.add}</Text>
            </Pressable>
          )}
          <Text style={s.hint}>{t.captionHint}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 96, backgroundColor: C.bg, borderRadius: 16, padding: 14, fontSize: 15, fontFamily: F.regular, color: C.ink, borderWidth: 1, borderColor: C.line, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  idea: { alignSelf: "flex-start", borderWidth: 1, borderColor: C.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  ideaText: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: F.semibold, fontSize: 14, color: C.ink, marginRight: 4 },
  count: { minWidth: 40, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  countOn: { backgroundColor: C.ink, borderColor: C.ink },
  countText: { fontFamily: F.semibold, fontSize: 14, color: C.ink },
  countTextOn: { color: "#fff" },
  planButton: { backgroundColor: C.brand, borderRadius: 99, paddingVertical: 13, alignItems: "center" },
  planButtonText: { fontFamily: F.semibold, color: "#fff", fontSize: 15 },
  error: { fontFamily: F.regular, color: C.danger },
  card: { backgroundColor: C.bg, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 10, gap: 8 },
  caption: { flex: 1, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 8, fontFamily: F.semibold, fontSize: 15, color: C.ink },
  remove: { fontSize: 22, color: C.muted, paddingHorizontal: 6 },
  pose: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 10, fontFamily: F.regular, fontSize: 14, color: C.ink, textAlignVertical: "top" },
  hint: { fontFamily: F.regular, color: C.muted, fontSize: 12 },
});
