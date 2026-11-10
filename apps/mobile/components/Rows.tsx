import { Pressable, StyleSheet, Text, View } from "react-native";
import { tap } from "@/lib/haptics";
import { C, F } from "@/lib/theme";

/** A titled group of rows, like the grouped lists in iOS Settings. */
export function Group({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: string }) {
  return (
    <View style={s.group}>
      {title && <Text style={s.title}>{title}</Text>}
      <View style={s.card}>{children}</View>
      {footer && <Text style={s.footer}>{footer}</Text>}
    </View>
  );
}

export function Row({ label, value, onPress, first, danger, chevron = !!onPress }: { label: string; value?: string; onPress?: () => void; first?: boolean; danger?: boolean; chevron?: boolean }) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [s.row, !first && s.border, pressed && { backgroundColor: C.bg }]}
    >
      <Text style={[s.label, danger && { color: C.danger }]}>{label}</Text>
      {value !== undefined && <Text style={s.value}>{value}</Text>}
      {chevron && <Text style={s.chev}>›</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  group: { marginBottom: 26 },
  title: { fontFamily: F.semibold, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  footer: { fontFamily: F.regular, fontSize: 13, color: C.muted, marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  label: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.ink },
  value: { fontFamily: F.regular, fontSize: 15, color: C.muted },
  chev: { fontSize: 22, color: C.muted, marginTop: -2 },
});
