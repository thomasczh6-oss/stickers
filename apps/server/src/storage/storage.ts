import fs from "node:fs/promises";
import path from "node:path";
import type { StickerPack } from "@stickers/shared";
import type { Config } from "../config";

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Public URL clients download the file from. */
  url(key: string): string;
}

function safeKey(key: string): string {
  const normalized = path.posix.normalize(key).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("/../")) throw new Error(`bad storage key: ${key}`);
  return normalized;
}

/** Files on local disk, served by the API under /files/. For development. */
export class LocalStorage implements Storage {
  constructor(
    private readonly dir: string,
    private readonly publicBaseUrl: string,
  ) {}

  pathFor(key: string) {
    return path.join(this.dir, safeKey(key));
  }

  async put(key: string, body: Buffer) {
    const p = this.pathFor(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  get(key: string) {
    return fs.readFile(this.pathFor(key));
  }

  async delete(key: string) {
    await fs.rm(this.pathFor(key), { force: true });
  }

  url(key: string) {
    return `${this.publicBaseUrl}/files/${safeKey(key)}`;
  }
}

/** Any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO) behind a public CDN URL. */
export class S3Storage implements Storage {
  private clientPromise;

  constructor(private readonly cfg: Extract<Config["storage"], { kind: "s3" }>) {
    this.clientPromise = import("@aws-sdk/client-s3").then(
      (m) =>
        new m.S3Client({
          region: cfg.region,
          endpoint: cfg.endpoint,
          forcePathStyle: Boolean(cfg.endpoint),
          credentials: cfg.accessKeyId && cfg.secretAccessKey ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
        }),
    );
  }

  async put(key: string, body: Buffer, contentType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    await client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: safeKey(key),
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    const res = await client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key) }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    await client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key) }));
  }

  url(key: string) {
    return `${this.cfg.publicBaseUrl.replace(/\/$/, "")}/${safeKey(key)}`;
  }
}

export function createStorage(cfg: Config): Storage {
  return cfg.storage.kind === "s3" ? new S3Storage(cfg.storage) : new LocalStorage(cfg.storage.dir, cfg.publicBaseUrl);
}

/** Storage keys of a pack's files, read from their URLs (".../packs/<id>/01.webp" → "packs/<id>/01.webp"). */
export function packFileKeys(pack: StickerPack): string[] {
  return [pack.trayIconUrl, ...pack.stickers.map((s) => s.url)]
    .map((url) => /\/(packs\/[^?#]+)/.exec(url)?.[1])
    .filter((k): k is string => !!k)
    .map(decodeURIComponent);
}
