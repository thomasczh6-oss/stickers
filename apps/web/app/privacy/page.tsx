import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy" };

// Plain-language draft written for launch in the US and EU. Have it reviewed before release.
export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="November 10, 2026">
      <p>
        Stickers AI turns a photo or a short description into a sticker pack. We collect as little as we can to do that, and we
        don’t sell your data.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Photos you upload.</strong> Used once, to draw your character, then deleted as soon as your pack is made.
        </li>
        <li>
          <strong>Descriptions and choices</strong> (style, reactions, pack name), so we can make and show your pack.
        </li>
        <li>
          <strong>The stickers we make for you</strong>, stored so you can open, share and add your pack.
        </li>
        <li>
          <strong>A random device ID</strong> kept in your browser or app, so “My packs” works without an account. We don’t ask for
          your name, email or phone number.
        </li>
        <li>
          <strong>Messages you send us</strong> through Help or Send feedback, and your email address if you choose to give it, so
          we can answer.
        </li>
        <li>
          <strong>How many packs you made today</strong>, counted per device ID, to apply the daily free allowance.
        </li>
        <li>
          <strong>Basic technical logs</strong> (such as IP address and errors), kept briefly to keep the service secure and working.
        </li>
      </ul>
      <h2>How we use it</h2>
      <p>
        Only to make, store and deliver your stickers, to prevent abuse, and to fix problems. We don’t use your photos for
        advertising or to identify you.
      </p>
      <h2>Who helps us</h2>
      <p>
        Your photo or description is sent to our AI image provider, which draws the stickers; the app and website tell you this
        before your first pack. We also use a cloud provider to store and serve your packs. Both process data on our
        behalf, under contract, and only for this purpose. Your data may be processed outside your country, with appropriate
        safeguards such as Standard Contractual Clauses.
      </p>
      <h2>Deleting your data</h2>
      <p>
        In the app, open Settings and tap <strong>Delete all my data</strong>. On the web, use the{" "}
        <a href="/delete-data">Delete your data</a> page. Your packs, stickers, descriptions and messages are deleted right away;
        photos are already deleted once each pack is made. Technical logs are removed within 30 days.
      </p>
      <h2>Your rights</h2>
      <p>
        Wherever you live, you can ask us to access or delete your packs and data. If you’re in the EU, UK or a US state with a
        privacy law, you also have the rights that law gives you, including the right to complain to your data protection
        authority. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your pack link and we’ll help within 30
        days.
      </p>
      <h2>Children</h2>
      <p>Stickers AI is not meant for children under 13 (16 in the EU). Please don’t upload photos of other people without their permission.</p>
      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above and, for important changes, tell you in the app.</p>
    </LegalPage>
  );
}
