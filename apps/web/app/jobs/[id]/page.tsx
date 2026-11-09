"use client";

import type { Job } from "@stickers/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const STEP_TEXT: Record<string, string> = {
  character: "Designing your character",
  packaging: "Packing it up for WhatsApp",
};

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { job } = await api().getJob(id);
        if (stop) return;
        setJob(job);
        if (job.status === "succeeded" && job.packId) return router.replace(`/p/${job.packId}`);
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
  }, [id, router]);

  const pct = job ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100) : 0;
  const step = job?.progress.step;
  const label =
    job?.status === "queued"
      ? "Waiting in line…"
      : step && STEP_TEXT[step]
        ? STEP_TEXT[step]
        : job?.status === "running"
          ? `Drawing sticker ${Math.max(1, job.progress.done)} of ${job.progress.total - 2}`
          : "Starting…";

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      {job?.status === "failed" ? (
        <>
          <div className="text-6xl">😵</div>
          <h1 className="mt-4 text-2xl font-black">That one didn’t work</h1>
          <p className="mt-2 text-violet-950/70">{job.error}</p>
          <Link href="/#create" className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-bold text-white">
            Try again
          </Link>
        </>
      ) : (
        <>
          <div className="mx-auto size-24 animate-bounce text-7xl">🎨</div>
          <h1 className="mt-6 text-2xl font-black">Making your stickers</h1>
          <p className="mt-2 text-violet-950/70">{label}</p>
          <div className="mt-8 h-3 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <p className="mt-6 text-xs text-violet-900/50">This usually takes about a minute. You can leave this page; your pack will be under My packs.</p>
          {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
        </>
      )}
    </div>
  );
}
