import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center py-24 text-center">
      <img src="/styles/3d.webp" alt="" width={140} height={140} className="size-36" />
      <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.02em]">Nothing here</h1>
      <p className="mt-3 text-muted">This page or pack doesn’t exist, or its link was mistyped.</p>
      <Link href="/" className="mt-8 rounded-full bg-ink px-6 py-3.5 font-semibold text-white">
        Back home
      </Link>
    </div>
  );
}
