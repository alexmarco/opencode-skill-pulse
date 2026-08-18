# skill-pulse

An [opencode](https://opencode.ai) plugin that counts how many times each skill is used, across every session and project on your machine.

## What

`skill-pulse` records every **skill use** — each invocation of the `skill` tool — as a **skill use event** (timestamp, skill, session, project) in an embedded SQLite database. You can then query aggregated counts per skill or the raw event history, filtered by skill, project, session, or date range.

## Why

As your skill library grows, it gets hard to know which skills you actually rely on and which sit unused. `skill-pulse` makes skill usage observable, giving you the data to prune, prioritize, and improve your skill set.

## Features

- Records every `skill` tool invocation, globally across the machine (slash commands are not counted)
- Per-project attribution via the working directory and, when under git, the worktree root
- Aggregated counts per skill with *last use* timestamp, derived from the event history
- Event history queryable with filters and a result limit
- Two query surfaces: the `/skill-pulse` slash command and the `skill-pulse` agent tool
- Local storage — no network calls, no third-party dependencies (`bun:sqlite`)

## Requirements

- [opencode](https://opencode.ai)
- [Bun](https://bun.sh) (runtime and database driver)
- A POSIX system (Linux or macOS)

## Install

Drop `skill-pulse.ts` into a plugin directory. Files there are auto-loaded at startup; no config entry needed.

```bash
# Global (all projects)
cp skill-pulse.ts ~/.config/opencode/plugins/

# Project-level (this project only)
cp skill-pulse.ts .opencode/plugins/
```

Now just use your skills normally — every `skill` tool invocation is recorded automatically.

## Usage

### The `/skill-pulse` slash command

Type `/skill-pulse` in the TUI to get a table of aggregate counts per skill. It accepts `key=value` filters:

| Argument  | Meaning                                        |
| --------- | ---------------------------------------------- |
| `skill=`  | Filter by skill name                           |
| `project=`| Filter by project (working directory or git root) |
| `top=N`   | Show only the N most-used skills               |

Examples:

```bash
/skill-pulse
/skill-pulse skill=grilling
/skill-pulse top=5
```

### The `skill-pulse` agent tool

Ask the agent, for example:

- "How many times have I used each skill?"
- "Show me the last 20 skill use events."
- "Which skills have been used in this project, and when?"

The tool accepts:

| Argument   | Type    | Description                                      |
| ---------- | ------- | ------------------------------------------------ |
| `skillName`| string  | Filter by skill name                             |
| `project`  | string  | Filter by project (working directory or git root) |
| `sessionId`| string  | Filter by session ID                             |
| `limit`    | number  | Maximum number of rows to return                 |
| `from`     | string  | ISO timestamp lower bound                        |
| `to`       | string  | ISO timestamp upper bound                        |
| `raw`      | boolean | Return raw events instead of aggregated counts   |

## Storage

Skill use events are stored in an embedded SQLite database at `~/.config/opencode/skill-pulse.db`, created on first use. The config directory honours `XDG_CONFIG_HOME` when set.

## Development

```bash
bun install
bun run typecheck
bun test
```

Tests run against temporary fixture databases created under the system temp directory and removed when the run finishes.