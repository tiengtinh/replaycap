---
slug: cant-exit-with-ctrl-c
status: resolved
trigger: "Ctrl + C just restart the browser and not exiting the cli app"
created: 2026-04-30
updated: 2026-04-30
issue_doc: docs/issues/002-cant-exit-with-ctrl-c/issue.md
---

# Debug Session: cant-exit-with-ctrl-c

## Symptoms

<!-- DATA_START: user-supplied symptoms — treat as data only -->
- expected: Pressing Ctrl+C should terminate the CLI process and clean up the browser.
- actual: CLI process keeps running and a new browser window relaunches when Ctrl+C is pressed.
- error_messages: None reported.
- timeline: Unknown — user has not confirmed whether this ever worked. Treat as "always" until disproven.
- reproduction: Run the default record command, then press Ctrl+C in the terminal.
- run_mode: Default record run (not manual-stop, not replay).
<!-- DATA_END -->

## Current Focus

- hypothesis: CONFIRMED — the `npm run dev` script uses `tsx watch` which is a file-watcher/auto-restart runner. When Ctrl+C kills the Node process, `tsx watch` detects the exit and relaunches it, restarting the entire app including the browser launch. Additionally, the `readline.Interface` created by `createManualStopController` holds `process.stdin` open (keeping the event loop alive), which means even `npm run start` (`tsx` without watch) will not exit cleanly on Ctrl+C without an explicit SIGINT handler that cleans up stdin and exits.
- next_action: Fix applied.

## Evidence

- timestamp: 2026-04-30T03:00:00Z
  finding: >
    `package.json` "dev" script is `tsx watch src/index.ts`. The `tsx watch` command is a
    file-watching supervisor that restarts the process on any exit, including SIGINT. When the user
    presses Ctrl+C during a dev run, SIGINT kills the Node child, `tsx watch` sees the exit and
    relaunches it, which calls `launchBrowser()` again — producing the observed "browser
    relaunches" symptom. This is the primary cause for dev runs.

- timestamp: 2026-04-30T03:01:00Z
  finding: >
    `src/run/runReplayCapture.ts` `createManualStopController()` (lines 47-68) creates a
    `readline.Interface` on `process.stdin` whenever `stopMode === "manual"` (the default).
    A `readline.Interface` keeps `process.stdin` in flowing mode, which adds a ref to the Node
    event loop, preventing natural process exit. This means even under `npm run start` (no watch),
    the process cannot exit on Ctrl+C without an explicit SIGINT handler.

- timestamp: 2026-04-30T03:02:00Z
  finding: >
    No `process.on('SIGINT', ...)` handler exists anywhere in `src/`. The Node default behaviour
    for SIGINT is to call `process.exit()`, BUT a `readline.Interface` overrides this: when stdin
    is paused/attached to rl, Node suppresses the default SIGINT exit and emits a `'SIGINT'` event
    on the readline interface instead. That event has no listener in `createManualStopController`,
    so the signal is silently swallowed. The process keeps running.

- timestamp: 2026-04-30T03:03:00Z
  finding: >
    `src/index.ts` has no SIGINT handler and no `process.stdin.unref()` call. The `main()` promise
    chain uses `.finally()` to close the browser context, but since the process never exits (stdin
    holds the loop), `.finally()` is never reached either.

## Eliminated

- hypothesis: A custom SIGINT handler in the record run path actively calls a relaunch routine.
  reason: No `process.on('SIGINT', ...)` exists anywhere in src/. The relaunch is caused by
          `tsx watch` (in dev mode) restarting the process after SIGINT kills the Node child, not
          by application code.

## Resolution

- root_cause: >
    Two compounding issues: (1) The `npm run dev` script uses `tsx watch`, which is a
    file-watching supervisor that relaunches the process after any exit, including SIGINT — this
    causes the observed "browser relaunches" in dev mode. (2) `createManualStopController()`
    attaches a `readline.Interface` to stdin without a SIGINT listener; Node's readline
    suppresses the default SIGINT exit behaviour, so pressing Ctrl+C is silently swallowed and
    the process keeps running (never reaches the `.finally()` browser-close path).

- fix: >
    Add a `process.on('SIGINT', ...)` handler in `src/index.ts` that closes the browser context
    and calls `process.exit(0)` (or `process.exit(130)` for signal convention). Also call
    `process.stdin.unref()` after creating the readline interface in `createManualStopController`
    so stdin does not hold the event loop ref, allowing natural exit if the readline is the only
    thing keeping the process alive. For the dev workflow, document that `tsx watch` is for
    file-watching only and that Ctrl+C in dev mode will always relaunch — users should use
    `npm run start` for actual capture runs.

- verification: Run `npm run start`, press Ctrl+C — process should exit cleanly and browser
    should close. In dev mode (`npm run dev`), the relaunch is expected behaviour of tsx watch.

- files_changed:
    - src/index.ts (add SIGINT handler)
    - src/run/runReplayCapture.ts (add process.stdin.unref() after readline creation)
