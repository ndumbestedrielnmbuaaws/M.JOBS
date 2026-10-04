"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import CVUploader, { type UploadResult } from "./CVUploader";
import { COUNTRIES, SPONSORSHIP_LABEL } from "@/lib/constants";
import type { Education, Experience, Language, ProfileUpdate } from "@/lib/schemas";

type CvSummary = { id: string; fileName: string; isPrimary: boolean; createdAt: string };

type Props = {
  profileId: string;
  initial: ProfileUpdate;
  cvs: CvSummary[];
};

type SaveState = { state: "idle" } | { state: "saving" } | { state: "saved" } | { state: "error"; message: string };

const emptyExperience = (): Experience => ({
  role: "", company: "", location: null, startDate: null, endDate: null, isCurrent: false, highlights: [],
});
const emptyEducation = (): Education => ({ institution: "", qualification: null, field: null, endYear: null });
const emptyLanguage = (): Language => ({ language: "", level: null });

const orNull = (s: string) => (s.trim() ? s : null);
const splitLines = (s: string) => s.split("\n");
const cleanList = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);

export default function ProfileEditor({ profileId, initial, cvs }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileUpdate>(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [dirty, setDirty] = useState(false);
  const [filledFromCv, setFilledFromCv] = useState(false);
  const [save, setSave] = useState<SaveState>({ state: "idle" });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof ProfileUpdate>(key: K, value: ProfileUpdate[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    if (save.state !== "saving") setSave({ state: "idle" });
  }

  function updateItem<K extends "experience" | "education" | "languages">(
    key: K, index: number, patch: Partial<ProfileUpdate[K][number]>,
  ) {
    update(key, form[key].map((item, i) => (i === index ? { ...item, ...patch } : item)) as ProfileUpdate[K]);
  }

  function removeItem<K extends "experience" | "education" | "languages" | "workAuth">(key: K, index: number) {
    update(key, form[key].filter((_, i) => i !== index) as ProfileUpdate[K]);
  }

  function applyParsed({ parsed }: UploadResult) {
    // The CV replaces CV-derived fields; work authorisation stays as you set it
    setForm((f) => ({
      ...f,
      fullName: parsed.fullName ?? f.fullName,
      email: parsed.email ?? f.email,
      phone: parsed.phone ?? f.phone,
      headline: parsed.headline ?? f.headline,
      location: parsed.location ?? f.location,
      summary: parsed.summary ?? f.summary,
      skills: parsed.skills,
      certifications: parsed.certifications,
      experience: parsed.experience,
      education: parsed.education,
      languages: parsed.languages,
    }));
    setSkillsText(parsed.skills.join(", "));
    setFilledFromCv(true);
    setDirty(true);
    router.refresh(); // Updates the CV list
  }

  async function onSave() {
    setSave({ state: "saving" });
    const payload: ProfileUpdate = {
      ...form,
      skills: cleanList(skillsText.split(/[,\n]/)),
      certifications: cleanList(form.certifications),
      experience: form.experience
        .filter((e) => e.role.trim() || e.company.trim())
        .map((e) => ({ ...e, endDate: e.isCurrent ? null : e.endDate, highlights: cleanList(e.highlights) })),
      education: form.education.filter((e) => e.institution.trim()),
      languages: form.languages.filter((l) => l.language.trim()),
    };

    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Your profile couldn't be saved.");
      }
      setForm(payload);
      setDirty(false);
      setFilledFromCv(false);
      setSave({ state: "saved" });
      router.refresh();
    } catch (err) {
      setSave({ state: "error", message: err instanceof Error ? err.message : "Save failed." });
    }
  }

  const usedCountries = new Set(form.workAuth.map((w) => w.countryCode));
  const nextCountry = COUNTRIES.find((c) => !usedCountries.has(c.code));

  return (
    <div className="space-y-10 pb-24">
      <section aria-labelledby="cv-heading">
        <h2 id="cv-heading" className="section-title">Your CV</h2>
        <p className="mb-4 text-sm text-muted">
          Uploading fills in the profile below. Nothing is used for matching until you save.
        </p>
        <CVUploader profileId={profileId} onParsed={applyParsed} />
        {cvs.length > 0 && (
          <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
            {cvs.map((cv) => (
              <li key={cv.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{cv.fileName}</span>
                <span className="shrink-0 text-muted">
                  {cv.isPrimary ? "Used for applications, " : ""}
                  {new Date(cv.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="auth-heading">
        <h2 id="auth-heading" className="section-title">Where you can work</h2>
        <p className="mb-4 text-sm text-muted">
          Used to flag jobs that won&apos;t sponsor and to decide whether cover letters mention a visa.
        </p>
        <div className="space-y-2">
          {form.workAuth.map((w, i) => (
            <div key={w.countryCode} className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Country"
                className="input w-52"
                value={w.countryCode}
                onChange={(e) =>
                  update("workAuth", form.workAuth.map((x, j) => (j === i ? { ...x, countryCode: e.target.value } : x)))
                }
              >
                {COUNTRIES.filter((c) => c.code === w.countryCode || !usedCountries.has(c.code)).map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <select
                aria-label={`Work status in ${w.countryCode}`}
                className="input w-72"
                value={w.sponsorship}
                onChange={(e) =>
                  update("workAuth", form.workAuth.map((x, j) =>
                    j === i ? { ...x, sponsorship: e.target.value as typeof x.sponsorship } : x))
                }
              >
                {Object.entries(SPONSORSHIP_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button type="button" className="btn btn-quiet text-muted" onClick={() => removeItem("workAuth", i)}>
                Remove
              </button>
            </div>
          ))}
          {nextCountry && (
            <button
              type="button"
              className="btn"
              onClick={() => update("workAuth", [...form.workAuth, { countryCode: nextCountry.code, sponsorship: "REQUIRED" }])}
            >
              Add country
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="basics-heading" className="space-y-4">
        <div>
          <h2 id="basics-heading" className="section-title">Profile</h2>
          {filledFromCv && (
            <p className="mt-1 rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">
              Filled in from your CV. Check it for mistakes; the AI only uses what you save.
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Full name" value={form.fullName} onChange={(v) => update("fullName", orNull(v))} />
          <Text label="Headline" placeholder="e.g. AWS Cloud / DevOps Engineer" value={form.headline} onChange={(v) => update("headline", orNull(v))} />
          <Text label="Location" value={form.location} onChange={(v) => update("location", orNull(v))} />
          <Text label="Email" value={form.email} onChange={(v) => update("email", orNull(v))} />
          <Text label="Phone" value={form.phone} onChange={(v) => update("phone", orNull(v))} />
          <Text label="LinkedIn URL" placeholder="https://www.linkedin.com/in/…" value={form.linkedinUrl} onChange={(v) => update("linkedinUrl", orNull(v))} />
          <Text label="Website or GitHub" placeholder="https://…" value={form.websiteUrl} onChange={(v) => update("websiteUrl", orNull(v))} />
        </div>
        <p className="text-xs text-muted">Contact details fill application forms. They are never sent to the AI.</p>
        <div>
          <label className="label" htmlFor="summary">Summary</label>
          <textarea id="summary" rows={4} className="input" value={form.summary ?? ""} onChange={(e) => update("summary", orNull(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="skills">Skills, separated by commas</label>
          <textarea
            id="skills" rows={3} className="input"
            value={skillsText}
            onChange={(e) => { setSkillsText(e.target.value); setDirty(true); }}
          />
        </div>
      </section>

      <section aria-labelledby="exp-heading">
        <h2 id="exp-heading" className="section-title mb-4">Experience</h2>
        <ol className="space-y-4">
          {form.experience.map((exp, i) => (
            <li key={i} className="panel space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Text label="Role" value={exp.role} onChange={(v) => updateItem("experience", i, { role: v })} />
                <Text label="Company" value={exp.company} onChange={(v) => updateItem("experience", i, { company: v })} />
                <Text label="Location" value={exp.location} onChange={(v) => updateItem("experience", i, { location: orNull(v) })} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`start-${i}`}>Start</label>
                    <input id={`start-${i}`} type="month" className="input" value={exp.startDate ?? ""}
                      onChange={(e) => updateItem("experience", i, { startDate: orNull(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`end-${i}`}>End</label>
                    <input id={`end-${i}`} type="month" className="input" disabled={exp.isCurrent} value={exp.isCurrent ? "" : exp.endDate ?? ""}
                      onChange={(e) => updateItem("experience", i, { endDate: orNull(e.target.value) })} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={exp.isCurrent} onChange={(e) => updateItem("experience", i, { isCurrent: e.target.checked })} />
                I work here now
              </label>
              <div>
                <label className="label" htmlFor={`hl-${i}`}>Highlights, one per line</label>
                <textarea id={`hl-${i}`} rows={4} className="input" value={exp.highlights.join("\n")}
                  onChange={(e) => updateItem("experience", i, { highlights: splitLines(e.target.value) })} />
              </div>
              <button type="button" className="btn btn-quiet text-muted" onClick={() => removeItem("experience", i)}>
                Remove this role
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn mt-3" onClick={() => update("experience", [...form.experience, emptyExperience()])}>
          Add role
        </button>
      </section>

      <section aria-labelledby="edu-heading">
        <h2 id="edu-heading" className="section-title mb-4">Education</h2>
        <div className="space-y-3">
          {form.education.map((ed, i) => (
            <div key={i} className="grid items-end gap-3 sm:grid-cols-[2fr_1.5fr_1.5fr_6rem_auto]">
              <Text label="Institution" value={ed.institution} onChange={(v) => updateItem("education", i, { institution: v })} />
              <Text label="Qualification" value={ed.qualification} onChange={(v) => updateItem("education", i, { qualification: orNull(v) })} />
              <Text label="Field" value={ed.field} onChange={(v) => updateItem("education", i, { field: orNull(v) })} />
              <div>
                <label className="label" htmlFor={`year-${i}`}>Year</label>
                <input id={`year-${i}`} type="number" min={1950} max={2100} className="input" value={ed.endYear ?? ""}
                  onChange={(e) => updateItem("education", i, { endYear: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <button type="button" className="btn btn-quiet text-muted" onClick={() => removeItem("education", i)}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn mt-3" onClick={() => update("education", [...form.education, emptyEducation()])}>
          Add education
        </button>
      </section>

      <section aria-labelledby="extra-heading" className="grid gap-8 sm:grid-cols-2">
        <div>
          <h2 id="extra-heading" className="section-title mb-4">Certifications</h2>
          <label className="label" htmlFor="certs">One per line</label>
          <textarea id="certs" rows={5} className="input" value={form.certifications.join("\n")}
            onChange={(e) => update("certifications", splitLines(e.target.value))} />
        </div>
        <div>
          <h2 className="section-title mb-4">Languages</h2>
          <div className="space-y-2">
            {form.languages.map((l, i) => (
              <div key={i} className="flex items-end gap-2">
                <Text label="Language" value={l.language} onChange={(v) => updateItem("languages", i, { language: v })} />
                <Text label="Level" placeholder="e.g. C1, native" value={l.level} onChange={(v) => updateItem("languages", i, { level: orNull(v) })} />
                <button type="button" className="btn btn-quiet text-muted" aria-label={`Remove ${l.language || "language"}`} onClick={() => removeItem("languages", i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn mt-3" onClick={() => update("languages", [...form.languages, emptyLanguage()])}>
            Add language
          </button>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-panel/95 backdrop-blur md:left-[230px]">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-4 px-5 py-3 md:px-10">
          <p role="status" aria-live="polite" className="text-sm">
            {save.state === "saved" && <span className="text-spruce">Profile saved</span>}
            {save.state === "error" && <span className="text-brick">{save.message}</span>}
            {save.state === "idle" && dirty && <span className="text-muted">Unsaved changes</span>}
          </p>
          <button type="button" className="btn btn-primary" disabled={!dirty || save.state === "saving"} onClick={onSave}>
            {save.state === "saving" ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Text({
  label, value, onChange, placeholder,
}: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

