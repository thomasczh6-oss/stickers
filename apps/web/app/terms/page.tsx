import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Terms" };

// Plain-language draft written for launch in the US and EU. Have it reviewed before release.
export default function Terms() {
  return (
    <LegalPage title="Terms" updated="November 9, 2026">
      <p>By using Stickers AI you agree to these terms. They’re short, so please read them.</p>
      <h2>Your content</h2>
      <ul>
        <li>Only upload photos you have the right to use. If someone else is in the photo, get their permission first.</li>
        <li>You keep the rights to your photos. You can use the stickers we make for you for personal, non-commercial purposes.</li>
        <li>Don’t use Stickers AI to make content that is hateful, sexual, harassing, illegal, or that impersonates someone.</li>
      </ul>
      <h2>AI-generated images</h2>
      <p>
        Stickers are drawn by an AI model. Results vary and may not look exactly like you or your pet. Every pack is labeled as made
        with Stickers AI.
      </p>
      <h2>WhatsApp</h2>
      <p>Stickers AI is independent and is not affiliated with, endorsed by or sponsored by WhatsApp or Meta.</p>
      <h2>The service</h2>
      <p>
        We work hard to keep Stickers AI running, but it’s provided “as is”. We may change or stop features, and we may remove
        content or block use that breaks these terms. To the extent the law allows, we aren’t liable for indirect losses. Nothing
        here limits rights you have under consumer law where you live.
      </p>
      <h2>Contact</h2>
      <p>
        Questions or a problem with a pack? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
