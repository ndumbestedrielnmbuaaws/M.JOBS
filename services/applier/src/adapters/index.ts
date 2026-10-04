import type { ApplyTask } from "../types.js";
import { ashby } from "./ashby.js";
import { generic } from "./generic.js";
import { greenhouse } from "./greenhouse.js";
import { lever } from "./lever.js";
import type { Adapter } from "./types.js";

const ATS: Adapter[] = [greenhouse, lever, ashby];

// Job boards are never automated: their terms prohibit it and accounts get restricted.
const JOB_BOARDS =
  /(^|\.)(linkedin\.com|indeed\.[a-z.]+|seek\.com\.au|seek\.co\.nz|totaljobs\.com|glassdoor\.[a-z.]+|ziprecruiter\.[a-z.]+|monster\.[a-z.]+|reed\.co\.uk|cv-library\.co\.uk|jobsite\.co\.uk|google\.com)$/i;

const parse = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
};

export type Target = { url: string; adapter: Adapter } | { manual: string };

export function chooseTarget(task: ApplyTask): Target {
  const options = task.job.applyOptions;
  const urls = [task.job.url, ...options.filter((o) => o.isDirect).map((o) => o.url), ...options.map((o) => o.url)]
    .map(parse)
    .filter((u): u is URL => !!u);

  // 1. A known applicant tracking system anywhere in the apply links
  for (const u of urls) {
    const adapter = ATS.find((a) => a.matches(u));
    if (adapter) return { url: u.toString(), adapter };
  }

  // 2. The employer's own site
  const direct = [
    ...(task.job.applyIsDirect ? [parse(task.job.url)] : []),
    ...options.filter((o) => o.isDirect).map((o) => parse(o.url)),
  ].find((u): u is URL => !!u && !JOB_BOARDS.test(u.hostname));
  if (direct) return { url: direct.toString(), adapter: generic };

  const boards = [...new Set(options.map((o) => o.publisher))].slice(0, 3).join(", ");
  return { manual: `Only listed on job boards${boards ? ` (${boards})` : ""}. Apply there yourself.` };
}
