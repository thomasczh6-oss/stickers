import { fmt, type Job } from "@stickers/shared";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { success } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { C, F } from "@/lib/theme";

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { m } = useI18n();
  const j = m.job;
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { job } = await (await api()).getJob(id);
        if (stop) return;
        setJob(job);
        setError(undefined);
        if (job.status === "succeeded" && job.packId) {
          success();
          return router.replace({ pathname: "/pack/[id]", params: { id: job.packId } });
        }
        if (job.status === "failed") return;
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      timer = setTimeout(poll, 2000);
    };
    void poll();
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(t);
    };
  }, [id]);

  if (job?.status === "failed") {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 64 }}>😵‍💫</Text>
        <Text style={s.title}>{j.failedTitle}</Text>
        <Text style={s.body}>{job.error ?? j.failedBody}</Text>
        <Text style={s.body}>{j.failedHint}</Text>
        <Pressable style={s.button} onPress={() => router.replace("/create")}>
          <Text style={s.buttonText}>{j.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  const total = job?.progress.total ?? 8;
  const done = job?.progress.done ?? 0;
  const stickers = Math.max(0, total - 2);
  const drawn = Math.min(stickers, Math.max(0, done - 1));
  const pct = done / Math.max(1, total);
  const stage = !job || job.status === "queued" ? 0 : done === 0 ? 1 : done < total - 1 ? 2 : 3;
  const stages = [
    { key: "start", label: job?.status === "queued" ? j.waiting : j.starting, state: stage > 0 ? "done" : "now" },
    { key: "design", label: j.designing, state: stage > 1 ? "done" : stage === 1 ? "now" : "todo" },
    { key: "animate", label: stage >= 2 ? fmt(j.animatingCount, { done: drawn, total: stickers }) : j.animating, state: stage > 2 ? "done" : stage === 2 ? "now" : "todo" },
    { key: "pack", label: j.packing, state: stage === 3 ? "now" : "todo" },
  ];

  return (
    <View style={s.page}>
      <View style={s.art}>
        <Image source={require("@/assets/images/splash-icon.png")} style={s.artImg} contentFit="contain" />
      </View>
      <Text style={s.title}>{j.title}</Text>
      <Text style={s.body}>{m.app.job.body}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.max(4, Math.round(pct * 100))}%` }]} />
      </View>
      <View style={s.stages}>
        {stages.map((st) => (
          <View key={st.key} style={s.stage}>
            <View style={[s.dot, st.state === "done" && s.dotDone, st.state === "now" && s.dotNow]}>
              {st.state === "done" ? <Text style={s.check}>✓</Text> : st.state === "now" ? <ActivityIndicator size="small" color={C.brand} style={{ transform: [{ scale: 0.6 }] }} /> : null}
            </View>
            <Text style={[s.stageText, st.state === "todo" && { color: C.muted }, st.state === "now" && { fontFamily: F.semibold }]}>{st.label}</Text>
          </View>
        ))}
      </View>
      <View style={s.tip}>
        <Text style={s.tipText}>
          <Text style={{ fontFamily: F.semibold, color: C.ink }}>{j.tipLabel} </Text>
          {j.tips[tick % j.tips.length]}
        </Text>
      </View>
      {error && <Text style={s.error}>{j.retrying}</Text>}
      <Pressable onPress={() => router.replace("/")} style={{ alignSelf: "center" }}>
        <Text style={s.link}>{m.app.job.backHome}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 24, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  art: { alignSelf: "center", width: 160, height: 160, borderRadius: 40, backgroundColor: C.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  artImg: { width: 128, height: 128 },
  title: { fontFamily: F.display, fontSize: 28, color: C.ink, letterSpacing: -0.5, textAlign: "center" },
  body: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginTop: 6, textAlign: "center", lineHeight: 21 },
  track: { height: 10, borderRadius: 99, backgroundColor: C.line, marginTop: 24, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.brand, borderRadius: 99 },
  stages: { marginTop: 24, gap: 14 },
  stage: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  dotDone: { backgroundColor: C.brand, borderColor: C.brand },
  dotNow: { borderColor: C.brand },
  check: { color: "#fff", fontSize: 12, fontFamily: F.bold },
  stageText: { fontFamily: F.regular, fontSize: 15, color: C.ink },
  tip: { marginTop: 28, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14 },
  tipText: { fontFamily: F.regular, fontSize: 14, color: C.muted, lineHeight: 20 },
  error: { fontFamily: F.regular, color: C.danger, marginTop: 12, textAlign: "center" },
  link: { fontFamily: F.semibold, color: C.ink, marginTop: 24, textDecorationLine: "underline" },
  button: { backgroundColor: C.ink, borderRadius: 99, paddingVertical: 15, paddingHorizontal: 32, marginTop: 20 },
  buttonText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
});
