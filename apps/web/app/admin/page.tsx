import type { Metadata } from "next";
import { ModerationQueue } from "./moderation-queue";

export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

/** Internal page for moderators. Needs the server's ADMIN_TOKEN. English only. */
export default function AdminPage() {
  return (
    <div lang="en" className="pt-10 pb-6">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em]">Discover moderation</h1>
      <p className="mt-2 text-muted">Reported, hidden and waiting packs. Approve puts a pack back; Remove takes it down; Ban removes every pack from that creator and stops them publishing.</p>
      <ModerationQueue />
    </div>
  );
}
