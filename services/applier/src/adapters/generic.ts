import { GENERIC_CONFIRMATION, fillByLabels, pageSays } from "../form.js";
import type { Adapter } from "./types.js";

/** Employer career pages the ATS adapters don't recognise. Fills by label and never submits. */
export const generic: Adapter = {
  name: "generic",
  matches: () => true,
  async open(page, url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return page;
  },
  fill: (root, task, files) => fillByLabels(root, task, files),
  submitButton: () => null,
  isConfirmation: (page) => pageSays(page, GENERIC_CONFIRMATION),
};
