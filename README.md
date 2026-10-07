**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

# omo-dori-mode-experimental

Dori mode turns one coding-agent session into an always-on messenger agent. You talk to a single bot on Telegram or Discord. The Dori hands each job to its own agent session in a herdr tab, keeps track of every session it started, and only closes one after the work is actually done: the PR merged, the issue closed, the version published.

It ships as a skill (`skills/dori-mode/SKILL.md` plus references) and a small bun + TypeScript CLI called `dori`. Experimental: expect rough edges.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/sisyphuslabs/omo-dori-mode-experimental/main/install.sh | bash
```

This clones the repo to `~/.dori/src`, links the skill into `~/.agents/skills/dori-mode`, puts `dori` on your PATH with `bun link`, and copies an example config to `~/.dori/config.json`. Set `SKILLS_DIR` if your agent loads skills from somewhere else.

Then open your agent inside herdr and say "Dori mode".

## Requirements

- [bun](https://bun.sh) 1.3 or newer, and git
- [herdr](https://herdr.dev), the terminal multiplexer the lanes run in
- a coding agent that loads skills (built for [OmO](https://github.com/code-yeongyu/oh-my-openagent); the agent command is configurable)
- `gh` (the GitHub CLI) for checking merged PRs and closed issues; `npm` for published versions
- [agent-messenger](https://github.com/agent-messenger/agent-messenger) for the bot itself

macOS gets the full host guard. On Linux, load and disk work, and memory and swap read as unknown.

## Naming your Dori

The first thing a Dori does is ask you what it should be called. "Dori" is fine. So is a name that ends in Dori, like ShipDori or WorkDori, which helps when you run more than one. It uses that name for the bot, for how it signs off, and for the mode, so next time "ShipDori mode" is all you have to say.

## Configuration

Everything lives in `~/.dori/config.json`, and every field is optional. The ones you will want to set:

| Field | What it is |
|---|---|
| `leadPane` | your Dori's own herdr pane (`herdr pane current`). Lanes report here. |
| `laneWorkspace` | the herdr workspace new lane tabs open in |
| `defaultCwd` | where lanes start, and the repo whose worktrees they own |
| `agentCommand` | how to start an agent, as an argv list with `{model}` and `{prompt}` |
| `hooks.threadReply`, `hooks.threadDone` | your messenger CLI, as argv lists with `{thread}` and `{text}`, so lanes can post progress and be marked done |

The rest (timings, thresholds, heavy-slot count) has sensible defaults. The full table is in [`references/scripts.md`](skills/dori-mode/references/scripts.md). `DORI_CONFIG`, `DORI_STATE_DIR` and `DORI_LEAD_PANE` override the file.

## The session registry

Every lane gets one JSON file under `~/.dori/state/lanes/`. It maps the messenger thread to the herdr pane, the pane to the agent's own session id, and records a status: `working`, `done-claimed`, `verified-done`, `not-done` or `closed`. Each change is kept in a history.

`dori sync` compares that against the panes that are actually running and tells you what drifted: a pane that went away, a session id that changed, a lane with no way to prove it's finished. It never deletes anything. Add `--write` and it saves the session ids it found.

## The 5-minute done flow

A lane says it's finished:

```sh
dori claim-done fix-login --evidence "merged acme/app#412 (a1b2c3d)"
```

The Dori sees `LANE_DONE_CLAIMED`, and the lane is told it closes in five minutes. You can push back in that window:

```sh
dori object-done fix-login --reason "the changelog entry is missing"
```

The reason goes straight to the lane, which keeps working and claims again later. If nobody objects, `dori watch` closes the lane once the window is up. Before it does, it reads every `Done =` signal live again, and it refuses if a worktree still has commits that never reached a remote or uncommitted tracked changes. Either one turns the claim back into not-done, with the reason. Restarting the watcher doesn't reset the clock.

## Commands

| Command | What it does |
|---|---|
| `dori launch <key> ...` | write the lane footer into the brief, open a tab, start the agent, check for startup errors |
| `dori adopt <key> --pane ID ...` | register a lane that's already running |
| `dori sync [--write]` | registry against live panes, plus drift |
| `dori claim-done` / `object-done` / `close` | the done flow |
| `dori watch` | the auto-close watcher; run it as a persistent monitor |
| `dori freshness [--loop MIN]` | nudge lanes that went quiet, then post their last report to their thread |
| `dori dead-panes [--loop MIN]` | report agent panes that stopped |
| `dori guard [--loop MIN]` | alert on load, memory, disk and pane count |
| `dori heavy <label> -- <cmd>` | run a build or test suite only when a slot is free and load is low |

Text sent to a pane always goes as one argument, never through a shell string, and the CLI checks that Enter actually landed.

## Tests

There's no CI. Run the tests locally:

```sh
cd skills/dori-mode/scripts
bun install
bun test           # behaviour tests against fake herdr, git and gh
bunx tsc --noEmit  # typecheck
```

The tests never touch a real pane, repo or GitHub.

## License

MIT
