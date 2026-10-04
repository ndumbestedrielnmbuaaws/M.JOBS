const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const listEl = $("list");

let settings = { url: "http://localhost:3000", token: "" };
let applications = [];

function say(text, tone = "") {
  statusEl.textContent = text;
  statusEl.className = tone;
}

async function api(path, init = {}) {
  const res = await fetch(new URL(path, settings.url), {
    ...init,
    headers: { Authorization: `Bearer ${settings.token}`, ...(init.headers || {}) },
  });
  if (res.status === 401) throw new Error("Wrong token. Copy WORKER_TOKEN from the app's .env.");
  if (res.status === 503) throw new Error("Set WORKER_TOKEN in the app's .env and restart it.");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `The app returned ${res.status}.`);
  }
  return res;
}

/** The content script is missing on tabs that were open before the extension was installed. */
async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab.");
  if (!/^https?:/.test(tab.url || "")) throw new Error("Open the job application page first.");

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

function describe(result) {
  const parts = [];
  if (result.filled.length) parts.push(`Filled: ${result.filled.join(", ")}.`);
  else parts.push("Nothing to fill on this page.");
  if (result.skipped.length) parts.push(`Missing from your profile: ${result.skipped.join(", ")}.`);
  if (result.questions.length) parts.push(`Answer these yourself: ${result.questions.slice(0, 4).join("; ")}.`);
  return parts.join(" ");
}

async function fill(app, button) {
  button.disabled = true;
  say("Filling…");
  try {
    const result = await sendToTab({ type: "AUTOFILL", data: app });
    if (!result || !result.ok) throw new Error((result && result.error) || "The page didn't respond.");
    say(describe(result), result.filled.length ? "good" : "");
  } catch (err) {
    say(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function attachCv(app, button) {
  button.disabled = true;
  say("Fetching your CV…");
  try {
    const res = await api(`/api/extension/applications/${app.id}/cv`);
    const buffer = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

    const result = await sendToTab({
      type: "ATTACH_CV",
      file: {
        base64: btoa(binary),
        fileName: app.cvFileName || "CV.pdf",
        mimeType: res.headers.get("content-type") || "application/pdf",
      },
    });
    if (!result || !result.ok) throw new Error((result && result.error) || "The page didn't respond.");
    say(result.attached ? "CV attached. Check it looks right." : result.reason, result.attached ? "good" : "error");
  } catch (err) {
    say(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function markApplied(app, button) {
  button.disabled = true;
  try {
    await api(`/api/extension/applications/${app.id}/applied`, { method: "POST" });
    say(`Marked "${app.job.title}" as applied.`, "good");
    await load();
  } catch (err) {
    say(err.message, "error");
    button.disabled = false;
  }
}

function render() {
  listEl.replaceChildren();
  for (const app of applications) {
    const li = document.createElement("li");

    const title = document.createElement("h2");
    title.textContent = app.job.title;
    const where = document.createElement("p");
    where.textContent = [app.job.company, app.job.location].filter(Boolean).join(", ");

    const row = document.createElement("div");
    row.className = "row";

    const add = (label, handler, className = "") => {
      const button = document.createElement("button");
      button.textContent = label;
      button.className = className;
      button.type = "button";
      button.addEventListener("click", () => handler(app, button));
      row.appendChild(button);
      return button;
    };

    add("Fill this page", fill, "primary");
    if (app.hasCv) add("Attach CV", attachCv);
    add("Copy letter", async (a, button) => {
      await navigator.clipboard.writeText(a.coverLetter || "");
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy letter"), 1500);
    });
    add("Open job", () => chrome.tabs.create({ url: app.job.url }));
    add("I applied", markApplied);

    li.append(title, where, row);
    listEl.appendChild(li);
  }
}

async function load() {
  if (!settings.token) {
    say("Add your app address and worker token in Settings.");
    $("settings").hidden = false;
    return;
  }
  say("Loading approved applications…");
  try {
    applications = await (await api("/api/extension/applications")).json();
    render();
    say(
      applications.length
        ? `${applications.length} approved ${applications.length === 1 ? "application" : "applications"}.`
        : "Nothing approved yet. Approve one in the app's queue.",
    );
  } catch (err) {
    say(err.message, "error");
  }
}

$("settings-toggle").addEventListener("click", () => {
  $("settings").hidden = !$("settings").hidden;
});

$("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  settings = { url: $("url").value.trim() || "http://localhost:3000", token: $("token").value.trim() };
  await chrome.storage.local.set(settings);
  $("settings").hidden = true;
  await load();
});

(async () => {
  settings = { ...settings, ...(await chrome.storage.local.get(["url", "token"])) };
  $("url").value = settings.url;
  $("token").value = settings.token;
  await load();
})();
