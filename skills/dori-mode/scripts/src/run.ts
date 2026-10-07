export type Ran = { readonly code: number; readonly out: string; readonly err: string };
export type Runner = (argv: readonly string[], opts?: { readonly cwd?: string }) => Promise<Ran>;

export const run: Runner = async (argv, opts = {}) => {
  const p = Bun.spawn([...argv], { stdout: "pipe", stderr: "pipe", ...(opts.cwd ? { cwd: opts.cwd } : {}) });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, out: out.trim(), err: err.trim() };
};

export type Clock = { readonly now: () => number; readonly sleep: (ms: number) => Promise<void> };
export const realClock: Clock = { now: () => Date.now(), sleep: (ms) => Bun.sleep(ms) };

export const iso = (clock: Clock): string => new Date(clock.now()).toISOString();
