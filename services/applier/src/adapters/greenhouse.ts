import type { Page } from "playwright";
import { GENERIC_CONFIRMATION, fillByLabels, fillFirst, pageSays, splitName, uploadFirst, type Root } from "../form.js";
import type { Adapter } from "./types.js";

const HOSTS = /(^|\.)(boards|job-boards)(\.eu)?\.greenhouse\.io$/;

export const greenhouse: Adapter = {
  name: "greenhouse",

  // Also matches careers pages that embed Greenhouse, which carry a gh_jid parameter
  matches: (url) => HOSTS.test(url.hostname) || url.searchParams.has("gh_jid"),

  async open(page, url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const embed = page.locator("iframe#grnhse_iframe");
    if (await embed.count()) {
      await embed.scrollIntoViewIfNeeded().catch(() => {});
      const frame = await (await embed.elementHandle())?.contentFrame();
      if (frame) {
        await frame.waitForLoadState("domcontentloaded");
        return frame;
      }
    }
    // Some boards hide the form behind an Apply button
    const form = page.locator("#application-form, #application_form, form[action*='applications']");
    if (!(await form.first().isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /^apply/i }).first().click({ timeout: 5_000 }).catch(() => {});
    }
    await form.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    return page;
  },

  async fill(root: Root, task, files) {
    const c = task.candidate;
    const { first, last } = splitName(c.fullName);
    const filled: string[] = [];
    if (await fillFirst([root.locator("#first_name")], first)) filled.push("first name");
    if (await fillFirst([root.locator("#last_name")], last)) filled.push("last name");
    if (await fillFirst([root.locator("#email")], c.email)) filled.push("email");
    if (await fillFirst([root.locator("#phone")], c.phone)) filled.push("phone");

    if (await uploadFirst([root.locator("input#resume[type=file]"), root.locator("#resume_fieldset input[type=file]")], files.cv))
      filled.push("CV");

    // Older boards: paste box behind an "Enter manually" button. Newer boards: file upload.
    const pasteButton = root.locator("#cover_letter_fieldset button[data-source='paste']");
    if (await pasteButton.count()) await pasteButton.click().catch(() => {});
    const letterDone =
      (await fillFirst([root.locator("textarea#cover_letter_text"), root.locator("textarea#cover_letter")], task.coverLetter)) ||
      (await uploadFirst([root.locator("input#cover_letter[type=file]"), root.locator("#cover_letter_fieldset input[type=file]")], files.coverLetter));
    if (letterDone) filled.push("cover letter");

    // Label pass fills anything the exact selectors missed; skip the CV if it is already attached
    return [...filled, ...(await fillByLabels(root, task, filled.includes("CV") ? { ...files, cv: null } : files))];
  },

  submitButton: (root) =>
    root.locator("button[type=submit], input[type=submit]").filter({ hasText: /submit/i }).or(root.locator("#submit_app")),

  isConfirmation: async (page: Page) =>
    /\/confirmation/.test(page.url()) || pageSays(page, GENERIC_CONFIRMATION),
};
