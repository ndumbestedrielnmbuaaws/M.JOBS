import type { Frame, Locator, Page } from "playwright";
import type { ApplyTask, UploadFiles } from "./types.js";

/** A form can live on the page or inside an iframe (e.g. Greenhouse embedded on a careers site). */
export type Root = Page | Frame;

/** Fills the first visible, editable, empty match. Leaves fields you or the browser already filled. */
export async function fillFirst(locators: Locator[], value: string | null | undefined): Promise<boolean> {
  if (!value) return false;
  for (const loc of locators) {
    const el = loc.first();
    try {
      if (!(await el.count()) || !(await el.isVisible()) || !(await el.isEditable())) continue;
      if ((await el.inputValue()).trim()) return true;
      await el.fill(value);
      return true;
    } catch {
      // Detached or not a text field: try the next candidate
    }
  }
  return false;
}

/** File inputs are often hidden behind styled buttons, so visibility isn't required. */
export async function uploadFirst(locators: Locator[], file: string | null): Promise<boolean> {
  if (!file) return false;
  for (const loc of locators) {
    const el = loc.first();
    try {
      if (!(await el.count())) continue;
      await el.setInputFiles(file);
      return true;
    } catch {
      // Not a file input or detached
    }
  }
  return false;
}

export function splitName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/**
 * Label-based filling that works on most forms. ATS adapters run their exact selectors first
 * and then this, which only touches fields that are still empty.
 */
export async function fillByLabels(root: Root, task: ApplyTask, files: UploadFiles): Promise<string[]> {
  const c = task.candidate;
  const { first, last } = splitName(c.fullName);
  const filled: string[] = [];
  const mark = (ok: boolean, name: string) => ok && filled.push(name);

  const text = (re: RegExp) => [
    root.getByLabel(re, { exact: false }).and(root.locator("input:not([type=file]):not([type=checkbox]):not([type=radio]), textarea")),
    root.getByPlaceholder(re),
  ];

  mark(await fillFirst(text(/first\s*name|given\s*name|forename/i), first), "first name");
  mark(await fillFirst(text(/last\s*name|surname|family\s*name/i), last), "last name");
  mark(await fillFirst(text(/^\s*(full\s*|legal\s*)?name\s*\*?\s*$/i), c.fullName), "full name");
  mark(await fillFirst(text(/e-?mail/i), c.email), "email");
  mark(await fillFirst(text(/phone|mobile|telephone/i), c.phone), "phone");
  mark(await fillFirst(text(/linkedin/i), c.linkedinUrl), "LinkedIn");
  mark(await fillFirst(text(/website|portfolio|github|personal\s*site/i), c.websiteUrl), "website");
  mark(await fillFirst(text(/current\s*(company|employer)/i), c.currentCompany), "current company");
  mark(await fillFirst(text(/current\s*(job\s*)?title|current\s*role/i), c.currentTitle), "current title");
  mark(await fillFirst([root.getByLabel(/cover\s*letter/i).and(root.locator("textarea"))], task.coverLetter), "cover letter");

  mark(
    await uploadFirst(
      [root.getByLabel(/resume|résumé|\bcv\b/i).and(root.locator("input[type=file]")), root.locator("input[type=file]")],
      files.cv,
    ),
    "CV",
  );
  return filled;
}

// Plain strings: tsx adds helper calls to compiled functions that don't exist inside the page.
const FIND_MISSING = `(() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const labelOf = (el) => {
    const byFor = el.labels && el.labels[0] && el.labels[0].innerText;
    const byAria = el.getAttribute("aria-label");
    const ids = (el.getAttribute("aria-labelledby") || "").split(" ").filter(Boolean);
    const byRef = ids.map((id) => { const n = document.getElementById(id); return n ? n.innerText : ""; }).join(" ");
    const legend = el.closest("fieldset") && el.closest("fieldset").querySelector("legend");
    return (byFor || byAria || byRef || (legend && legend.innerText) || el.getAttribute("placeholder") || el.name || "Unlabelled field")
      .replace(/\\s+/g, " ").replace(/\\*$/, "").trim().slice(0, 80);
  };
  document.querySelectorAll("[data-applier-missing]").forEach((el) => el.removeAttribute("data-applier-missing"));
  const out = new Set();
  const fields = document.querySelectorAll('input[required], textarea[required], select[required], input[aria-required="true"], textarea[aria-required="true"], select[aria-required="true"]');
  for (const el of fields) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button") continue;
    if (type === "checkbox" || type === "radio") {
      const group = el.name ? document.querySelectorAll('input[name="' + CSS.escape(el.name) + '"]') : [el];
      if (Array.from(group).some((g) => g.checked)) continue;
    } else if (type === "file") {
      if (el.files && el.files.length) continue;
    } else {
      if (String(el.value || "").trim() || !visible(el)) continue;
    }
    const target = type === "file" ? (el.closest("label, fieldset, div") || el) : el;
    target.setAttribute("data-applier-missing", "true");
    out.add(labelOf(el));
  }
  return Array.from(out);
})()`;

/** Required fields that are still empty. Also tags them so highlightMissing can outline them. */
export async function findMissingRequired(root: Root): Promise<string[]> {
  try {
    return (await root.evaluate(FIND_MISSING)) as string[];
  } catch {
    return [];
  }
}

export async function highlightMissing(root: Root) {
  await root
    .addStyleTag({
      content: "[data-applier-missing]{outline:3px solid #d97706 !important;outline-offset:3px !important;}",
    })
    .catch(() => {});
}

/** Interactive CAPTCHAs (reCAPTCHA checkbox, hCaptcha, Turnstile). Invisible reCAPTCHA v3 is ignored. */
export function hasCaptcha(page: Page): boolean {
  return page.frames().some((f) => {
    const url = f.url();
    if (/recaptcha\/(api2|enterprise)\/anchor/.test(url)) return !/size=invisible/.test(url);
    return /hcaptcha\.com\/captcha|challenges\.cloudflare\.com/.test(url);
  });
}

const BODY_TEXT = `document.body ? document.body.innerText.slice(0, 6000) : ""`;

/** True when any frame shows text matching the pattern. */
export async function pageSays(page: Page, pattern: RegExp): Promise<boolean> {
  for (const frame of page.frames()) {
    try {
      if (pattern.test((await frame.evaluate(BODY_TEXT)) as string)) return true;
    } catch {
      // Frame navigated away mid-check
    }
  }
  return false;
}

export const GENERIC_CONFIRMATION =
  /thank(s| you) for (applying|your application)|application (has been |was )?(successfully )?(submitted|received)|we('ve| have) received your application/i;
