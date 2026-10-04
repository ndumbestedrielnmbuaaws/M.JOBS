import { GENERIC_CONFIRMATION, fillByLabels, fillFirst, pageSays, uploadFirst } from "../form.js";
import type { Adapter } from "./types.js";

export const lever: Adapter = {
  name: "lever",

  matches: (url) => /(^|\.)jobs(\.eu)?\.lever\.co$/.test(url.hostname),

  async open(page, url) {
    const u = new URL(url);
    if (!/\/apply\/?$/.test(u.pathname)) u.pathname = `${u.pathname.replace(/\/$/, "")}/apply`;
    await page.goto(u.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator("form#application-form, form[action*='apply']").first().waitFor({ timeout: 15_000 }).catch(() => {});
    return page;
  },

  async fill(root, task, files) {
    const c = task.candidate;
    const filled: string[] = [];
    // Lever uploads the CV first and may parse it into fields, so do that before typing
    if (await uploadFirst([root.locator("input[name='resume'][type=file]")], files.cv)) {
      filled.push("CV");
      await root.waitForTimeout(2_500);
    }
    if (await fillFirst([root.locator("input[name='name']")], c.fullName)) filled.push("full name");
    if (await fillFirst([root.locator("input[name='email']")], c.email)) filled.push("email");
    if (await fillFirst([root.locator("input[name='phone']")], c.phone)) filled.push("phone");
    if (await fillFirst([root.locator("input[name='org']")], c.currentCompany)) filled.push("current company");
    if (await fillFirst([root.locator("input[name='urls[LinkedIn]']")], c.linkedinUrl)) filled.push("LinkedIn");
    if (await fillFirst([root.locator("input[name='urls[Portfolio]']"), root.locator("input[name='urls[GitHub]']"), root.locator("input[name='urls[Other]']")], c.websiteUrl))
      filled.push("website");
    if (await fillFirst([root.locator("textarea[name='comments']")], task.coverLetter)) filled.push("cover letter");
    // Label pass fills anything the exact selectors missed; skip the CV if it is already attached
    return [...filled, ...(await fillByLabels(root, task, filled.includes("CV") ? { ...files, cv: null } : files))];
  },

  submitButton: (root) => root.locator("#btn-submit, button[type=submit]").filter({ hasText: /submit/i }),

  isConfirmation: async (page) => /\/thanks\/?$/.test(new URL(page.url()).pathname) || pageSays(page, GENERIC_CONFIRMATION),
};
