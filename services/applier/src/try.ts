/**
 * Test the form filling on one URL without touching the queue. Never submits.
 *   npm run try -- <application url> [--cv ./my-cv.pdf]
 */
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chooseTarget } from "./adapters/index.js";
import { launchBrowser } from "./browser.js";
import { findMissingRequired, hasCaptcha, highlightMissing } from "./form.js";
import { loadConfig } from "./config.js";
import type { ApplyTask } from "./types.js";

const url = process.argv[2];
const cvArg = process.argv.indexOf("--cv");
if (!url || url.startsWith("--")) {
  console.log("Usage: npm run try -- <application url> [--cv ./my-cv.pdf]");
  process.exit(1);
}

const cfg = loadConfig({
  WORKER_TOKEN: process.env.WORKER_TOKEN || "x".repeat(32),
  APPLIER_AUTO_SUBMIT: "false",
  APPLIER_HEADLESS: "false",
});

const task: ApplyTask = {
  id: "try",
  attempt: 1,
  subject: "Test application",
  coverLetter: "This is a test cover letter.\n\nIt was filled by the applier's try command.",
  cv: null,
  job: { title: "Test", company: "Test", url, applyIsDirect: true, applyOptions: [] },
  candidate: {
    fullName: "Test Candidate",
    email: "test.candidate@example.com",
    phone: "+44 20 7946 0000",
    linkedinUrl: "https://www.linkedin.com/in/example",
    websiteUrl: "https://example.com",
    location: "London",
    currentTitle: "DevOps Engineer",
    currentCompany: "Example Ltd",
  },
};

const target = chooseTarget(task);
if ("manual" in target) {
  console.log(target.manual);
  process.exit(0);
}

const dir = await mkdtemp(path.join(tmpdir(), "applier-try-"));
let cv: string | null = null;
if (cvArg > 0 && process.argv[cvArg + 1]) {
  cv = path.join(dir, path.basename(process.argv[cvArg + 1]));
  await copyFile(process.argv[cvArg + 1], cv);
}

const context = await launchBrowser(cfg);
const page = await context.newPage();
console.log(`Adapter: ${target.adapter.name}`);
const root = await target.adapter.open(page, target.url);
const filled = await target.adapter.fill(root, task, { cv, coverLetter: null });
const missing = await findMissingRequired(root);
await highlightMissing(root);

console.log(`Filled: ${[...new Set(filled)].join(", ") || "nothing"}`);
console.log(`Required and still empty: ${missing.join(", ") || "none"}`);
console.log(`Interactive CAPTCHA: ${hasCaptcha(page) ? "yes" : "no"}`);
console.log("Nothing will be submitted. Close the browser window when you're done.");

await new Promise<void>((resolve) => context.on("close", () => resolve()));
await rm(dir, { recursive: true, force: true });
