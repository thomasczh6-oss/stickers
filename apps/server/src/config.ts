import path from "node:path";

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = env(name);
  const n = v === undefined ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type ProviderName = "gateway" | "mock";

export interface Config {
  port: number;
  /** Public URL of this server, used to build file URLs when files are stored on local disk. */
  publicBaseUrl: string;
  /** Postgres URL. When unset, an embedded Postgres (PGlite) stores data under dataDir. */
  databaseUrl?: string;
  dataDir: string;
  storage:
    | { kind: "local"; dir: string }
    | { kind: "s3"; bucket: string; region: string; endpoint?: string; publicBaseUrl: string; accessKeyId?: string; secretAccessKey?: string };
  provider: ProviderName;
  gateway: {
    /** Gateway root without /v1, e.g. https://ai-gateway.deepthink.works */
    baseUrl: string;
    apiKey?: string;
    imageModel: string;
    /** Chat model that turns a user's description into a sticker plan. */
    textModel: string;
    quality: "low" | "medium" | "high" | "auto";
    timeoutMs: number;
  };
  worker: { enabled: boolean; jobConcurrency: number; stickerConcurrency: number; pollMs: number };
  /** Max sticker plans a single device may ask for per hour. */
  maxPlansPerDevicePerHour: number;
  /** Max jobs a single device may have queued or running at once. */
  maxActiveJobsPerDevice: number;
  corsOrigins: string[];
  publisherName: string;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = path.resolve(env("DATA_DIR", "./data")!);
  const port = int("PORT", 8787);
  // Same variable names as the team's other gateway projects (mvbuddy); AI_GATEWAY_* and IMAGE_API_KEY also accepted.
  const apiKey = env("GATEWAY_API_KEY", env("AI_GATEWAY_API_KEY", env("IMAGE_API_KEY")));
  const authInjected = env("GATEWAY_AUTH_INJECTED") === "1";
  const providerEnv = env("IMAGE_PROVIDER");
  const provider: ProviderName =
    providerEnv === "gateway" || providerEnv === "mock" ? providerEnv : apiKey || authInjected ? "gateway" : "mock";

  const bucket = env("S3_BUCKET");
  const storage: Config["storage"] = bucket
    ? {
        kind: "s3",
        bucket,
        region: env("S3_REGION", "auto")!,
        endpoint: env("S3_ENDPOINT"),
        publicBaseUrl: env("S3_PUBLIC_BASE_URL", "")!,
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
      }
    : { kind: "local", dir: path.join(dataDir, "files") };

  const quality = env("IMAGE_QUALITY", "medium");
  return {
    port,
    publicBaseUrl: env("PUBLIC_BASE_URL", `http://localhost:${port}`)!.replace(/\/$/, ""),
    databaseUrl: env("DATABASE_URL"),
    dataDir,
    storage,
    provider,
    gateway: {
      baseUrl: env("GATEWAY_BASE_URL", env("AI_GATEWAY_BASE_URL", "https://ai-gateway.deepthink.works"))!
        .replace(/\/+$/, "")
        .replace(/\/v1$/, ""),
      apiKey,
      imageModel: env("IMAGE_MODEL", "gpt-image-2.6-flare")!,
      textModel: env("TEXT_MODEL", "gpt-5.4-mini")!,
      quality: quality === "low" || quality === "high" || quality === "auto" ? quality : "medium",
      timeoutMs: int("GATEWAY_TIMEOUT_MS", 240_000),
    },
    worker: {
      enabled: env("RUN_WORKER", "true") !== "false",
      jobConcurrency: int("WORKER_JOB_CONCURRENCY", 2),
      stickerConcurrency: int("WORKER_STICKER_CONCURRENCY", 3),
      pollMs: int("WORKER_POLL_MS", 1000),
    },
    maxPlansPerDevicePerHour: int("MAX_PLANS_PER_DEVICE_PER_HOUR", 30),
    maxActiveJobsPerDevice: int("MAX_ACTIVE_JOBS_PER_DEVICE", 2),
    corsOrigins: (env("CORS_ORIGINS", "http://localhost:3000") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    publisherName: env("PUBLISHER_NAME", "Stickers AI")!,
    ...overrides,
  };
}
