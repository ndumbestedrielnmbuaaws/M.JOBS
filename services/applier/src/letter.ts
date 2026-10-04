import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { ApplyTask } from "./types.js";

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** Renders the approved cover letter to PDF for forms that want a file. Falls back to .txt. */
export async function writeCoverLetter(task: ApplyTask, dir: string): Promise<string | null> {
  if (!task.coverLetter?.trim()) return null;
  const base = `Cover letter - ${(task.candidate.fullName ?? "Candidate").replace(/[^\w .-]/g, "")}`;

  const html = `<!doctype html><meta charset="utf-8"><style>
    body{font:11pt/1.5 Georgia,serif;color:#111;margin:0}
    p{margin:0 0 10pt}
  </style>${task.coverLetter
    .split(/\n{2,}/)
    .map((para) => `<p>${escape(para).replace(/\n/g, "<br>")}</p>`)
    .join("")}`;

  // page.pdf() only works in headless Chromium, so use a short-lived separate browser
  const browser = await chromium.launch({ headless: true }).catch(() => null);
  if (browser) {
    try {
      const page = await browser.newPage();
      await page.setContent(html);
      const file = path.join(dir, `${base}.pdf`);
      await page.pdf({ path: file, format: "A4", margin: { top: "22mm", bottom: "22mm", left: "22mm", right: "22mm" } });
      return file;
    } catch {
      // fall through to text
    } finally {
      await browser.close();
    }
  }
  const file = path.join(dir, `${base}.txt`);
  await writeFile(file, task.coverLetter);
  return file;
}
