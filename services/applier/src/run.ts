import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { AppClient } from "./api.js";
import { chooseTarget } from "./adapters/index.js";
import type { Adapter } from "./adapters/types.js";
import type { Config } from "./config.js";
import { findMissingRequired, hasCaptcha, highlightMissing } from "./form.js";
import { writeCoverLetter } from "./letter.js";
import { log } from "./log.js";
import type { ApplyTask, TaskResult, UploadFiles } from "./types.js";

type Deps = { cfg: Config; getContext: () => Promise<BrowserContext>; client: AppClient | null };

/** Waits until the form is submitted, the tab is closed, or time runs out. */
async function waitForOutcome(page: Page, adapter: Adapter, minutes: number) {
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    if (page.isClosed()) return "closed" as const;
    if (await adapter.isConfirmation(page).catch(() => false)) return "submitted" as const;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return "timeout" as const;
}

export async function runTask(task: ApplyTask, { cfg, getContext, client }: Deps): Promise<TaskResult> {
  const target = chooseTarget(task);
  if ("manual" in target) return { outcome: "needs_manual", channel: "manual", message: target.manual };

  const channel = target.adapter.name;
  if (!task.candidate.fullName || !task.candidate.email)
    return { outcome: "failed", channel, message: "Add your full name and email to your profile, then approve again." };

  const workDir = path.resolve(cfg.APPLIER_ARTIFACTS_DIR, task.id);
  const uploadDir = path.join(workDir, "uploads");
  await mkdir(uploadDir, { recursive: true });

  let page: Page | null = null;
  try {
    const files: UploadFiles = {
      cv: client ? await client.downloadCv(task, uploadDir) : null,
      coverLetter: await writeCoverLetter(task, uploadDir),
    };

    // The browser only starts once there is a form to fill
    page = await (await getContext()).newPage();
    log.info(`${task.id}: opening ${channel} form for "${task.job.title}"`);
    const root = await target.adapter.open(page, target.url);
    const filled = [...new Set(await target.adapter.fill(root, task, files))];

    if (filled.length === 0)
      return { outcome: "needs_manual", channel: "manual", message: "No application form found on the employer's page. Apply there yourself." };

    const missing = await findMissingRequired(root);
    const captcha = hasCaptcha(page);
    await page.screenshot({ path: path.join(workDir, "filled.png"), fullPage: true }).catch(() => {});
    log.info(`${task.id}: filled ${filled.length} fields; ${missing.length} required still empty${captcha ? "; CAPTCHA present" : ""}`);

    const submit = target.adapter.submitButton(root);
    if (cfg.APPLIER_AUTO_SUBMIT && submit && missing.length === 0 && !captcha) {
      await submit.first().click({ timeout: 10_000 });
      const outcome = await waitForOutcome(page, target.adapter, 1);
      if (outcome === "submitted") {
        await page.screenshot({ path: path.join(workDir, "confirmation.png") }).catch(() => {});
        return { outcome, channel, message: `Submitted automatically through ${channel}.` };
      }
      if (cfg.APPLIER_HEADLESS)
        return { outcome: "failed", channel, message: "Clicked submit but no confirmation appeared. Check the listing and apply manually if needed." };
      log.warn(`${task.id}: no confirmation after submit, leaving the form open for you`);
    } else if (cfg.APPLIER_HEADLESS) {
      const why = captcha ? "a CAPTCHA" : missing.length ? `required fields: ${missing.slice(0, 5).join(", ")}` : "a form this adapter won't submit";
      return { outcome: "failed", channel, message: `Needs a person: ${why}.` };
    }

    // Review mode: you check the form in the browser window and click submit yourself
    await highlightMissing(root);
    await page.bringToFront();
    log.info(
      `${task.id}: waiting up to ${cfg.APPLIER_REVIEW_MINUTES} min for you to submit in the browser` +
        (missing.length ? ` (outlined fields: ${missing.slice(0, 6).join(", ")})` : ""),
    );

    const outcome = await waitForOutcome(page, target.adapter, cfg.APPLIER_REVIEW_MINUTES);
    if (outcome === "submitted") {
      await page.screenshot({ path: path.join(workDir, "confirmation.png") }).catch(() => {});
      return { outcome, channel, message: `You submitted it through ${channel}.` };
    }
    if (outcome === "closed")
      return { outcome: "failed", channel, message: "The form was closed before it was submitted." };
    return { outcome: "timeout", channel, message: `Not submitted within ${cfg.APPLIER_REVIEW_MINUTES} minutes.` };
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    // Don't leave copies of the CV on disk; screenshots stay for your records
    await rm(uploadDir, { recursive: true, force: true }).catch(() => {});
  }
}
