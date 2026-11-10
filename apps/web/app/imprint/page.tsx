import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Imprint" };

/**
 * Provider details (Impressum), required for sites offered commercially in Germany and Austria (DDG § 5).
 * Fill the IMPRINT_* variables before launch; missing ones show as "to be added".
 */
export default function Imprint() {
  const v = (name: string) => process.env[name] || "(to be added)";
  return (
    <LegalPage title="Imprint" updated="November 10, 2026">
      <h2>Provider</h2>
      <p>
        {v("IMPRINT_COMPANY")}
        <br />
        {v("IMPRINT_ADDRESS")}
      </p>
      <p>
        Represented by: {v("IMPRINT_REPRESENTATIVE")}
        <br />
        Company register: {v("IMPRINT_REGISTER")}
        <br />
        VAT ID: {v("IMPRINT_VAT_ID")}
      </p>
      <h2>Contact</h2>
      <p>
        Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <h2>Online dispute resolution</h2>
      <p>
        We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration board.
      </p>
    </LegalPage>
  );
}
