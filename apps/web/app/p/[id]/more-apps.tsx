import type { StickerPack } from "@stickers/shared";

const GUIDES: { app: string; how: string }[] = [
  { app: "iMessage, Messenger, Instagram", how: "These apps don’t take sticker packs from other apps. Tap any sticker on this page to send it as a GIF." },
  { app: "Signal", how: "Download the pack, then in Signal Desktop choose File › Create/Upload Sticker Pack and drop in the files from the apng folder (png for still packs)." },
  { app: "Discord", how: "Download the pack, then Server Settings › Stickers › Upload Sticker." },
  { app: "LINE", how: "LINE only takes stickers through LINE Creators Market, after a review. Download the pack and upload the png files at creator.line.me." },
];

/** Telegram gets a real sticker set through our bot; everything else gets files. */
export function MoreApps({ pack }: { pack: StickerPack }) {
  const ex = pack.exports;
  if (!ex) return null;
  return (
    <div className="mt-6 rounded-[28px] border border-line bg-card p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Other apps</h2>
      {ex.telegramUrl && (
        <a href={ex.telegramUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#2aabee] px-6 py-3.5 font-semibold text-white">
          Add to Telegram
        </a>
      )}
      <a href={ex.zipUrl} download className="mt-3 flex w-full items-center justify-center rounded-full border border-line px-6 py-3.5 font-semibold transition hover:border-ink/30">
        Download all stickers (ZIP)
      </a>
      <dl className="mt-5 grid gap-3 text-sm">
        {ex.telegramUrl && (
          <div>
            <dt className="font-semibold">Telegram</dt>
            <dd className="text-muted">Opens our Telegram bot. Press Start and it sends you the pack, ready to add.</dd>
          </div>
        )}
        {GUIDES.map((g) => (
          <div key={g.app}>
            <dt className="font-semibold">{g.app}</dt>
            <dd className="text-muted">{g.how}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
