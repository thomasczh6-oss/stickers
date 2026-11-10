"use client";

import { useEffect, useState } from "react";

/** Phones: a floating "Use this style" button until the remix panel itself scrolls into view. */
export function RemixJump({ label }: { label: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const panel = document.getElementById("remix");
    if (!panel) return;
    const io = new IntersectionObserver(([e]) => setHidden(!!e?.isIntersecting), { threshold: 0.1 });
    io.observe(panel);
    return () => io.disconnect();
  }, []);
  return (
    <a
      href="#remix"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      className={`fixed inset-x-4 bottom-4 z-20 rounded-full bg-ink py-4 text-center font-semibold text-white shadow-[0_16px_40px_-16px_rgba(22,18,29,0.6)] transition lg:hidden ${hidden ? "pointer-events-none translate-y-24 opacity-0" : ""}`}
    >
      {label}
    </a>
  );
}
