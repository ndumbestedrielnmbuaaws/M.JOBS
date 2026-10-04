import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "./config.js";
import { ApplyTaskSchema, type ApplyTask, type TaskResult } from "./types.js";

export class AppClient {
  constructor(private cfg: Config) {}

  private async request(pathname: string, init: RequestInit = {}) {
    const res = await fetch(new URL(pathname, this.cfg.APP_URL), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.WORKER_TOKEN}`,
        "X-Worker-Id": this.cfg.WORKER_ID,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(30_000),
    }).catch((err: unknown) => {
      throw new Error(`Can't reach the app at ${this.cfg.APP_URL}. Is it running? (${err instanceof Error ? err.message : err})`);
    });
    if (res.status === 401) throw new Error("The app rejected WORKER_TOKEN. Check both .env files match.");
    if (res.status === 503) throw new Error("The app has no WORKER_TOKEN set, so the applier is disabled.");
    return res;
  }

  /** Claims the next approved application, or returns null when the queue is empty. */
  async claim(): Promise<ApplyTask | null> {
    const res = await this.request("/api/worker/claim", { method: "POST" });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Claim failed with ${res.status}`);
    return ApplyTaskSchema.parse(await res.json());
  }

  async downloadCv(task: ApplyTask, dir: string): Promise<string | null> {
    if (!task.cv) return null;
    const res = await this.request(`/api/worker/applications/${task.id}/cv`);
    if (!res.ok) throw new Error(`CV download failed with ${res.status}`);
    // Keep the original file name: employers see it
    const safe = task.cv.fileName.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "CV.pdf";
    const file = path.join(dir, safe);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    return file;
  }

  async report(id: string, result: TaskResult) {
    const res = await this.request(`/api/worker/applications/${id}/result`, {
      method: "POST",
      body: JSON.stringify(result),
    });
    if (!res.ok) throw new Error(`Reporting result failed with ${res.status}`);
  }
}
