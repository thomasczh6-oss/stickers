import type { Job } from "@stickers/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { job } = await (await api()).getJob(id);
        if (stop) return;
        setJob(job);
        if (job.status === "succeeded" && job.packId) return router.replace({ pathname: "/pack/[id]", params: { id: job.packId } });
        if (job.status === "failed") return;
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (job?.status === "failed") {
    return (
      <View style={s.page}>
        <Text style={s.big}>😵</Text>
        <Text style={s.title}>That one didn’t work</Text>
        <Text style={s.body}>{job.error}</Text>
        <Pressable style={s.button} onPress={() => router.replace("/create")}>
          <Text style={s.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const pct = job ? job.progress.done / Math.max(1, job.progress.total) : 0;
  const step = job?.progress.step;
  const label =
    job?.status === "queued"
      ? "Waiting in line…"
      : step === "character"
        ? "Designing your character"
        : step === "packaging"
          ? "Packing it up for WhatsApp"
          : job?.status === "running"
            ? `Drawing sticker ${Math.max(1, job.progress.done)} of ${job.progress.total - 2}`
            : "Starting…";

  return (
    <View style={s.page}>
      <Text style={s.big}>🎨</Text>
      <Text style={s.title}>Making your stickers</Text>
      <Text style={s.body}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.max(4, Math.round(pct * 100))}%` }]} />
      </View>
      <Text style={s.note}>About a minute. You can leave; the pack will be under My packs.</Text>
      {error && <Text style={s.error}>{error}</Text>}
      <Pressable onPress={() => router.replace("/")}>
        <Text style={s.link}>Back to my packs</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  big: { fontSize: 72 },
  title: { fontSize: 24, fontWeight: "900", color: C.ink, marginTop: 12 },
  body: { fontSize: 15, color: C.muted, marginTop: 6, textAlign: "center" },
  track: { width: "100%", height: 12, borderRadius: 99, backgroundColor: C.line, marginTop: 28, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: C.brand, borderRadius: 99 },
  note: { fontSize: 12, color: C.muted, marginTop: 16, textAlign: "center" },
  error: { color: C.danger, marginTop: 12 },
  link: { color: C.brand, fontWeight: "700", marginTop: 28 },
  button: { backgroundColor: C.brand, borderRadius: 99, paddingVertical: 14, paddingHorizontal: 28, marginTop: 24 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
