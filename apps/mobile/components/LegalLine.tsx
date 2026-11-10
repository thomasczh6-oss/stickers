import { parts } from "@stickers/shared";
import { StyleSheet, Text, type TextStyle } from "react-native";
import { useI18n } from "@/lib/i18n";
import { openSitePage } from "@/lib/links";
import { C, F } from "@/lib/theme";

/** "By continuing you agree to our Terms and Privacy Policy", with both names as links. */
export function LegalLine({ template, style }: { template: string; style?: TextStyle }) {
  const { m } = useI18n();
  return (
    <Text style={[s.text, style]}>
      {parts(template).map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <Text key={i} style={s.link} onPress={() => openSitePage(p.key === "terms" ? "/terms" : "/privacy")}>
            {p.key === "terms" ? m.legal.terms : m.legal.privacy}
          </Text>
        ),
      )}
    </Text>
  );
}

const s = StyleSheet.create({
  text: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.muted, textAlign: "center" },
  link: { fontFamily: F.semibold, color: C.ink, textDecorationLine: "underline" },
});
