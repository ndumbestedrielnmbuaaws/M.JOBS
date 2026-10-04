/*
 * Runs on the page you have open. It only fills fields and highlights what it filled:
 * it never clicks Next, Submit or Apply, and it never navigates.
 */

const FILLED_MARK = "data-applier-filled";

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function textOf(node) {
  if (!node) return "";
  return node.innerText || node.textContent || "";
}

function labelText(el) {
  const byLabel = el.labels && el.labels[0] ? textOf(el.labels[0]) : "";
  const ids = (el.getAttribute("aria-labelledby") || "").split(" ").filter(Boolean);
  const byRef = ids.map((id) => textOf(document.getElementById(id))).join(" ");
  const text = byLabel || el.getAttribute("aria-label") || byRef || el.placeholder || el.name || el.id || "";
  return text.replace(/\s+/g, " ").trim();
}

/*
 * LinkedIn, Indeed and Totaljobs render controlled React inputs: assigning .value directly
 * is discarded on the next render. Calling the native setter and firing input/change makes
 * the framework record the value the way typing does.
 */
function setValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  el.setAttribute(FILLED_MARK, "true");
}

function ensureStyles() {
  if (document.getElementById("applier-style")) return;
  const style = document.createElement("style");
  style.id = "applier-style";
  style.textContent = `[${FILLED_MARK}]{outline:2px solid #1f6b55 !important;outline-offset:2px !important;}`;
  document.head.appendChild(style);
}

const RULES = [
  { name: "first name", re: /first\s*name|given\s*name|forename/i, key: "firstName" },
  { name: "last name", re: /last\s*name|surname|family\s*name/i, key: "lastName" },
  { name: "full name", re: /^\s*(full\s*|legal\s*)?name\s*\*?\s*$/i, key: "fullName" },
  { name: "email", re: /e-?mail/i, key: "email" },
  { name: "phone", re: /phone|mobile|telephone/i, key: "phone" },
  { name: "LinkedIn", re: /linkedin/i, key: "linkedinUrl" },
  { name: "website", re: /website|portfolio|github|personal\s*site/i, key: "websiteUrl" },
  { name: "location", re: /city|town|location|address/i, key: "location" },
  { name: "current title", re: /current\s*(job\s*)?title|current\s*role|job\s*title/i, key: "currentTitle" },
];

function fillForm(data) {
  ensureStyles();
  const candidate = data.candidate;
  const parts = (candidate.fullName || "").trim().split(/\s+/).filter(Boolean);
  const values = {
    ...candidate,
    firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || null,
    lastName: parts.length > 1 ? parts[parts.length - 1] : null,
  };

  const filled = [];
  const skipped = [];

  for (const el of document.querySelectorAll("input, textarea")) {
    const type = (el.type || "").toLowerCase();
    if (["hidden", "file", "checkbox", "radio", "submit", "button", "password"].includes(type)) continue;
    if (el.disabled || el.readOnly || !isVisible(el)) continue;
    if (String(el.value || "").trim()) continue; // never overwrite what you typed

    const label = labelText(el);
    if (!label) continue;

    if (el.tagName === "TEXTAREA" && /cover\s*letter|message|why|additional\s*information/i.test(label)) {
      if (data.coverLetter) {
        setValue(el, data.coverLetter);
        filled.push("cover letter");
      }
      continue;
    }

    const rule = RULES.find((r) => r.re.test(label));
    if (!rule) continue;
    const value = values[rule.key];
    if (value) {
      setValue(el, value);
      filled.push(rule.name);
    } else {
      skipped.push(rule.name);
    }
  }

  const questions = [];
  for (const el of document.querySelectorAll("select, input[type=radio], input[type=checkbox]")) {
    if (!isVisible(el)) continue;
    const label = labelText(el) || labelText(el.closest("fieldset") || el);
    // Screening questions are yours to answer: the extension only lists them
    if (label && !questions.includes(label) && questions.length < 12) questions.push(label);
  }

  const first = document.querySelector(`[${FILLED_MARK}]`);
  if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });

  return { filled: [...new Set(filled)], skipped: [...new Set(skipped)], questions };
}

function attachCv(file) {
  const inputs = [...document.querySelectorAll("input[type=file]")].filter(
    (el) => !el.disabled && (!el.accept || /pdf|word|document|\*/i.test(el.accept)),
  );
  if (inputs.length === 0) return { attached: false, reason: "No file input on this page." };

  const blob = new Blob([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], { type: file.mimeType });
  const dt = new DataTransfer();
  dt.items.add(new File([blob], file.fileName, { type: file.mimeType }));
  const input = inputs[0];
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));

  // Some uploaders ignore programmatic file drops, so report what actually stuck
  return input.files.length === 1
    ? { attached: true }
    : { attached: false, reason: "The site rejected the file. Attach it with its own upload button." };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg.type === "AUTOFILL") sendResponse({ ok: true, ...fillForm(msg.data) });
    else if (msg.type === "ATTACH_CV") sendResponse({ ok: true, ...attachCv(msg.file) });
    else if (msg.type === "PING") sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: String((err && err.message) || err) });
  }
  return true;
});
