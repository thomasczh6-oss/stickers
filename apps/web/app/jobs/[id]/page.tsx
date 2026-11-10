"use client";

import { fmt, type Job } from "@stickers/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n";
import { api } from "@/lib/api";
import samples from "@/public/samples/index.json";

const PREVIEW = samples.flatMap((p) => p.stickers.map((f) => `/samples/${p.slug}/${f}`));

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
        const { job } = await api().getJob(id);
        if (stop) return;
        setJob(job);
        setError(undefined);
        if (job.status === "succeeded" && job.packId) return router.replace(`/p/${job.packId}`);
        if (job.status === "failed") return;
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
      timer = setTimeout(poll, 2000);
    };
    void poll();
    const t = setInterval(() => setTick((n) => n + 1), 3500);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearInterval(t);
    };
  }, [id, router]);

  if (job?.status === "failed") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <div className="text-6xl">😵‍💫</div>
        <h1 className="mt-5 font-display text-3xl font-extrabold">{j.failedTitle}</h1>
        <p className="mt-3 text-muted">{job.error ?? j.failedBody}</p>
        <p className="mt-2 text-sm text-muted">{j.failedHint}</p>
        <Link href="/create" className="mt-8 inline-block rounded-full bg-ink px-7 py-3.5 font-semibold text-white">
          {j.tryAgain}
        </Link>
      </div>
    );
  }

  const total = job?.progress.total ?? 8;
  const done = job?.progress.done ?? 0;
  const stickers = Math.max(0, total - 2);
  const drawn = Math.min(stickers, Math.max(0, done - 1));
  const pct = Math.round((done / Math.max(1, total)) * 100);
  const stage = !job || job.status === "queued" ? 0 : done === 0 ? 1 : done < total - 1 ? 2 : 3;

  const stages = [
    { key: "start", label: job?.status === "queued" ? j.waiting : j.starting, state: stage > 0 ? "done" : "now" },
    { key: "design", label: j.designing, state: stage > 1 ? "done" : stage === 1 ? "now" : "todo" },
    { key: "animate", label: stage >= 2 ? fmt(j.animatingCount, { done: drawn, total: stickers }) : j.animating, state: stage > 2 ? "done" : stage === 2 ? "now" : "todo" },
    { key: "pack", label: j.packing, state: stage === 3 ? "now" : "todo" },
  ] as const;

  return (
    <div className="mx-auto grid max-w-4xl items-center gap-12 py-16 md:grid-cols-[1fr_1fr] md:py-24">
      <div className="relative mx-auto aspect-square w-full max-w-[340px]">
        <div className="absolute inset-0 rounded-[40px] bg-brand-soft" />
        {PREVIEW.length > 0 && (
          <img
            key={tick}
            src={PREVIEW[tick % PREVIEW.length]}
            alt=""
            width={300}
            height={300}
            className="relative mx-auto size-full p-10"
          />
        )}
        <div className="absolute inset-x-0 bottom-5 mx-auto w-fit rounded-full bg-card px-4 py-2 text-sm font-semibold shadow">{m.web.job.whileYouWait}</div>
      </div>

      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em]">{j.title}</h1>
        <p className="mt-3 text-muted">{m.web.job.body}</p>
        <div className="mt-8 h-2.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <ol className="mt-8 grid gap-4">
          {stages.map((s) => (
            <li key={s.key} className={`flex items-center gap-3 ${s.state === "todo" ? "text-muted/60" : ""}`}>
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                  s.state === "done" ? "bg-brand text-white" : s.state === "now" ? "border-2 border-brand" : "border-2 border-line"
                }`}
              >
                {s.state === "done" ? "✓" : s.state === "now" ? <span className="size-2 animate-pulse rounded-full bg-brand" /> : null}
              </span>
              <span className={s.state === "now" ? "font-semibold" : ""}>{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 rounded-2xl border border-line bg-card p-4 text-sm text-muted">
          <span className="font-semibold text-ink">{j.tipLabel}</span> {j.tips[Math.floor(tick / 2) % j.tips.length]}
        </p>
        {error && <p className="mt-4 text-sm text-rose-700">
            {j.retrying} ({error})
          </p>}
      </div>
    </div>
  );
}
