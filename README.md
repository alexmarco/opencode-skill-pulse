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

Add `skill-pulse` to the `plugin` array of your project or global `opencode.json` and restart opencode. It installs the plugin from git and resolves its dependencies automatically:

```json
{
  "plugin": ["opencode-skill-pulse@git+https://github.com/alexmarco/opencode-skill-pulse.git"]
}
```

opencode downloads the plugin into its cache on startup — no manual copying or package install needed.

### Install from a local clone

If you have the repository checked out already, point opencode at the cloned directory instead so you get the files in place:

```json
{
  "plugin": ["/path/to/opencode-skill-pulse"]
}
```

Run `bun install` in the repository clone first. This relies on the `main` field of the package, which points at `skill-pulse.ts`.

### Manual copy (no clone, no git)

`skill-pulse` is a single-file plugin living in `skill-pulse.ts`. opencode auto-loads every `*.ts` and `*.js` file found in a plugin directory at startup. Because the plugin imports the `@opencode-ai/plugin` package, you must make that package resolvable from where the file lives.

Global (all projects):

```bash
mkdir -p ~/.config/opencode/plugins
cp skill-pulse.ts ~/.config/opencode/plugins/
cd ~/.config/opencode
bun add @opencode-ai/plugin
```

Project-level (this project only):

```bash
mkdir -p .opencode/plugins
cp skill-pulse.ts .opencode/plugins/
cd .opencode
bun add @opencode-ai/plugin
```

### Verify

Restart opencode, then type `/skill-pulse`. If the plugin loaded, you get a table of aggregate counts per skill ("No skills have been used yet." on the first run). From then on, every `skill` tool invocation is recorded automatically.

### Uninstall

Remove the file (or the `plugin` entry) and restart opencode. Recorded data in `skill-pulse.db` is left untouched; delete the database file to start from scratch.

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

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

```bash
bun install
bun run typecheck
bun test
```

Tests run against temporary fixture databases created under the system temp directory and removed when the run finishes.

## License

MIT — see [LICENSE](LICENSE).