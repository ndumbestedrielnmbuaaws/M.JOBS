import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import type { Config } from "./config.js";

/**
 * A persistent profile keeps cookies between runs, so you stay signed in to any ATS accounts
 * you log into yourself in this window.
 */
export async function launchBrowser(cfg: Config): Promise<BrowserContext> {
  try {
    return await chromium.launchPersistentContext(path.resolve(cfg.APPLIER_PROFILE_DIR), {
      headless: cfg.APPLIER_HEADLESS,
      viewport: cfg.APPLIER_HEADLESS ? { width: 1280, height: 900 } : null,
      acceptDownloads: false,
    });
  } catch (err) {
    if (err instanceof Error && /Executable doesn't exist/.test(err.message))
      throw new Error("Chromium isn't installed. Run: npm run setup");
    throw err;
  }
}
