import { GENERIC_CONFIRMATION, fillByLabels, pageSays, uploadFirst } from "../form.js";
import type { Adapter } from "./types.js";

export const ashby: Adapter = {
  name: "ashby",

  matches: (url) => url.hostname === "jobs.ashbyhq.com",

  async open(page, url) {
    const u = new URL(url);
    if (!/\/application\/?$/.test(u.pathname)) u.pathname = `${u.pathname.replace(/\/$/, "")}/application`;
    await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    // Ashby renders the form client-side
    await page.locator("input[type=email], input[name*='email' i]").first().waitFor({ timeout: 20_000 }).catch(() => {});
    return page;
  },

  async fill(root, task, files) {
    const filled: string[] = [];
    // Ashby's CV upload can autofill fields, so upload first and give it a moment
    const cvInputs = [
      root.getByLabel(/resume|résumé|\bcv\b/i).and(root.locator("input[type=file]")),
      root.locator("input[type=file]"),
    ];
    if (await uploadFirst(cvInputs, files.cv)) {
      filled.push("CV");
      await root.waitForTimeout(3_000);
    }
    return [...filled, ...(await fillByLabels(root, task, { ...files, cv: null }))];
  },

  submitButton: (root) => root.getByRole("button", { name: /submit application/i }),

  isConfirmation: (page) => pageSays(page, GENERIC_CONFIRMATION),
};
