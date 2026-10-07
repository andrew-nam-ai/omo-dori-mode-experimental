# Sessions (lanes)

A lane is one agent session doing one job in its own herdr tab. You launch it, track it in the registry, answer it when it is stuck, and close it when its work is proven done.

## Launching

```sh
dori launch fix-login --title "Fix the login redirect loop" \
  --brief ~/briefs/fix-login.md --done "merged acme/app#412; closed acme/app#398" \
  --thread "telegram:<chat>/<topic>" --model anthropic/claude-opus-5-5
```

`launch` checks the key and the `Done =` line, appends a footer to the brief, opens a tab in `laneWorkspace`, starts the agent, and after 20 seconds reads the pane for startup errors (missing module, no API key, rate limit, quota). On `STARTUP_ERROR`, relaunch on another model.

Write the brief like a careful prompt:

- open with the keywords you would type yourself (for example `ulw set goal and work`);
- where the code is and what has been learned so far;
- the ideal end state, from the point of view of whoever uses the result;
- what not to touch;
- how and when to report.

**Why the `Done =` line has to be checkable:** the watcher closes lanes on its own. It can only read back `merged <owner/repo>#N`, `closed <owner/repo>#N` and `published <pkg>@<version>`, so `launch` and `adopt` refuse anything else. Work that can't be checked by a script (a QA pass, a design review) stays in the lane's own plan, and you judge it yourself before the claim.

## The registry

One JSON file per lane under `<stateDir>/lanes/`, written atomically (temp file + rename), so two writers never leave a half-written file. Each lane records:

| Field | Meaning |
|---|---|
| `thread` | where its updates go, as `platform:thread` (or `none`) |
| `pane`, `tab` | its herdr location |
| `session` | the agent's own session id, so a closed job can be reopened later |
| `status` | `working`, `done-claimed`, `verified-done`, `not-done`, `closed` |
| `claim`, `objection`, `history` | what was claimed, what was objected, every status change |

`dori sync` compares the registry with live panes and prints drift (a pane that is gone, a session id that changed, an empty `Done =` line). It never deletes anything. With `--write` it stores the session ids it found.

How the session id is found for a pane, in order:

1. the agent process's `--session <id>` argument;
2. `PI_SESSION_ID` in the environment of one of its child processes;
3. the session file whose timestamp falls within three minutes after the agent process started.

The id from step 1 is the session the agent was launched with. If someone switches sessions inside the agent, only steps 2 and 3 notice.

When the owner writes in a closed lane's thread, reopen its recorded session in a new tab, set its monitors again, and keep replying there.

## Messaging a session

Before you type into a pane:

1. check it runs a live agent (`herdr pane process-info --pane <id>`), not a shell, a stopped agent or a startup screen;
2. read it (`herdr pane read <id> --source recent-unwrapped --lines 40`) and confirm the input line is empty and no approval or question prompt is open;
3. send once, as one argument (the scripts' `sendVerified` does this);
4. read the pane again: if your text is still on the input line, press Enter again, then re-check.

Exit code 0 and echoed input are not proof the agent got the message. A reply from the session, or its record of handling the message, is.

## Watching

- Sessions that turn blocked or ask a question: answer them or bring them to the owner.
- Sessions that report a bug: reproduce it before it counts, then give it its own thread.
- `dori dead-panes` reports agent panes that stopped; restart the session in place (`<agent> --session <id>`) unless its work is finished.
