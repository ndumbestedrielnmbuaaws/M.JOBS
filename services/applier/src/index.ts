import type { BrowserContext } from "playwright";
import { AppClient } from "./api.js";
import { launchBrowser } from "./browser.js";
import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { runTask } from "./run.js";
import type { ApplyTask } from "./types.js";

const cfg = loadConfig();
const client = new AppClient(cfg);
const once = process.argv.includes("--once");

let stopping = false;
let current: ApplyTask | null = null;
let context: BrowserContext | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getContext() {
  if (!context) {
    context = await launchBrowser(cfg);
    // Closing the browser window shouldn't kill the service: relaunch on the next task
    context.on("close", () => (context = null));
  }
  return context;
}

async function shutdown(signal: string) {
  if (stopping) process.exit(1);
  stopping = true;
  log.info(`${signal} received, stopping`);
  if (current) {
    await client
      .report(current.id, { outcome: "failed", channel: "applier", message: "The applier stopped before finishing." })
      .catch(() => {});
  }
  await context?.close().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

log.info(
  `Applier ${cfg.WORKER_ID} started against ${cfg.APP_URL} ` +
    `(${cfg.APPLIER_AUTO_SUBMIT ? "auto-submit when complete" : "review mode: you submit"})`,
);

let idleLogged = false;
while (!stopping) {
  let task: ApplyTask | null;
  try {
    task = await client.claim();
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    if (once) process.exit(1);
    await sleep(cfg.APPLIER_POLL_SECONDS * 1000);
    continue;
  }

  if (!task) {
    if (once) {
      log.info("No approved applications waiting.");
      break;
    }
    if (!idleLogged) log.info(`Queue empty, checking every ${cfg.APPLIER_POLL_SECONDS}s`);
    idleLogged = true;
    await sleep(cfg.APPLIER_POLL_SECONDS * 1000);
    continue;
  }

  idleLogged = false;
  current = task;
  log.info(`${task.id}: claimed (attempt ${task.attempt})`);

  let result;
  try {
    result = await runTask(task, { cfg, getContext, client });
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    log.error(`${task.id}: ${msg}`);
    result = { outcome: "failed" as const, channel: "applier", message: `The applier hit an error: ${msg.slice(0, 300)}` };
  }

  try {
    await client.report(task.id, result);
    log.info(`${task.id}: ${result.outcome} (${result.channel})`);
  } catch (err) {
    log.error(`${task.id}: couldn't report result: ${err instanceof Error ? err.message : err}`);
  }
  current = null;
  if (once) break;
}

await (context as BrowserContext | null)?.close().catch(() => {});
