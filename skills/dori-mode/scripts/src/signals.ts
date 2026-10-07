import type { Runner } from "./run.ts";

export type Check = { readonly signal: string; readonly ok: boolean; readonly detail: string };

const ghRef = (s: string): { readonly repo: string; readonly n: string } | null => {
  const m = /([\w.-]+\/[\w.-]+)(?:#|\/(?:pull|issues)\/)(\d+)/.exec(s);
  return m?.[1] && m[2] ? { repo: m[1], n: m[2] } : null;
};

export const UNREADABLE = "unreadable signal: use 'merged <owner/repo>#N', 'closed <owner/repo>#N' or 'published <pkg>@<version>'";

export const checkSignal = async (signal: string, run: Runner): Promise<Check> => {
  const s = signal.trim();
  const ref = ghRef(s);
  if (/^merged\b/i.test(s) && ref) {
    const r = await run(["gh", "pr", "view", ref.n, "--repo", ref.repo, "--json", "state,mergeCommit"]);
    const j = r.code === 0 ? (JSON.parse(r.out) as { state?: string; mergeCommit?: { oid?: string } | null }) : {};
    const sha = j.mergeCommit?.oid ?? "";
    return { signal: s, ok: j.state === "MERGED" && sha.length > 0, detail: j.state ? `${j.state} ${sha.slice(0, 10)}`.trim() : r.err || "no answer" };
  }
  if (/^closed\b/i.test(s) && ref) {
    const r = await run(["gh", "issue", "view", ref.n, "--repo", ref.repo, "--json", "state"]);
    const j = r.code === 0 ? (JSON.parse(r.out) as { state?: string }) : {};
    return { signal: s, ok: j.state === "CLOSED", detail: j.state ?? (r.err || "no answer") };
  }
  const pub = /^published\s+(\S+)@(\S+)/i.exec(s);
  if (pub?.[1] && pub[2]) {
    const r = await run(["npm", "view", `${pub[1]}@${pub[2]}`, "version", "--json"]);
    const ok = r.code === 0 && r.out.replace(/"/g, "").trim() === pub[2];
    return { signal: s, ok, detail: ok ? `registry has ${pub[1]}@${pub[2]}` : r.err || r.out || "not published" };
  }
  return { signal: s, ok: false, detail: UNREADABLE };
};

export const splitDone = (done: string): string[] => done.replace(/^Done\s*=\s*/i, "").split(/\s*;\s*/).filter(Boolean);

export const checkDone = async (done: string, run: Runner): Promise<Check[]> => {
  const parts = splitDone(done);
  if (!parts.length) return [{ signal: done, ok: false, detail: "empty Done line" }];
  return Promise.all(parts.map((p) => checkSignal(p, run)));
};
