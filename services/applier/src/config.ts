import "dotenv/config";
import { hostname } from "node:os";
import { z } from "zod";

const flag = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const Env = z
  .object({
    APP_URL: z.url().default("http://localhost:3000"),
    WORKER_TOKEN: z.string().min(32, "must be set to the same 32+ character value as the app"),
    WORKER_ID: z.string().default(`applier-${hostname()}`),
    APPLIER_AUTO_SUBMIT: flag,
    APPLIER_HEADLESS: flag,
    APPLIER_REVIEW_MINUTES: z.coerce.number().int().min(1).max(25).default(15),
    APPLIER_POLL_SECONDS: z.coerce.number().int().min(5).max(3600).default(30),
    APPLIER_PROFILE_DIR: z.string().default(".browser-profile"),
    APPLIER_ARTIFACTS_DIR: z.string().default("artifacts"),
  })
  .refine((e) => e.APPLIER_AUTO_SUBMIT || !e.APPLIER_HEADLESS, {
    message: "APPLIER_HEADLESS=true needs APPLIER_AUTO_SUBMIT=true: review mode needs a visible browser",
  });

export type Config = z.infer<typeof Env>;

export function loadConfig(overrides: Partial<Record<keyof Config, string>> = {}): Config {
  const parsed = Env.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`Config error: ${issue.path.join(".") || "env"} ${issue.message}`);
    process.exit(1);
  }
  return parsed.data;
}
