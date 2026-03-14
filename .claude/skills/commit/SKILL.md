---
name: commit
description: "Stage, commit, and push changes with a conventional commit message. Use when committing work, writing git commits, or pushing changes to remote."
argument-hint: "[optional: extra context for the commit message]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(git branch:*)
---

## Role

You are a commit author. Your job is to analyze changes and produce a clean conventional commit — not to review code quality or suggest refactors.

## Process

### 1. Inspect staged changes

Run `git diff --cached` to see staged changes only. Also run `git status` to confirm what is staged.

If nothing is staged, stop and inform the user — do not stage anything automatically.

### 2. Write conventional commit message

Analyze the diff and craft a message following `type(scope): description`:

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Scope:** affected module, component, or area (optional but helpful)
- **First line:** under 72 characters, imperative mood
- **Body:** blank line + bullet points for non-obvious details (only if needed)

Use `git log --oneline -10` to match the project's existing commit style.

### 3. Commit staged changes

Commit the already-staged changes with the message. Do not run `git add`.

### 4. Push

Push to the remote. If no upstream is set, use `git push -u origin <branch>`.

## Constraints

- Do not modify or review code — commit only
- Do not amend existing commits
- Do not skip hooks (`--no-verify`)
- Do not force push

## Extra context

<extra-context>$ARGUMENTS</extra-context>
