import { parts } from "@stickers/shared";
import Link from "next/link";
import type { Messages } from "@stickers/shared";

/** A sentence with {terms} and {privacy} rendered as links to those pages. */
export function LegalLine({ m, template, className = "" }: { m: Messages; template: string; className?: string }) {
  return (
    <p className={className}>
      {parts(template).map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <Link key={i} href={p.key === "terms" ? "/terms" : "/privacy"} className="font-semibold text-ink underline underline-offset-4">
            {p.key === "terms" ? m.legal.terms : m.legal.privacy}
          </Link>
        ),
      )}
    </p>
  );
}
