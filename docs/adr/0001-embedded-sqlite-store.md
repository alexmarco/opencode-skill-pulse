# Embedded SQLite (bun:sqlite) as the usage store

The reference plugin appends JSONL records to a flat file, but the event history grows and the queries we need (aggregations, filters by skill/project/session) make a flat file awkward to manage. We store skill use events in an embedded SQLite database at `~/.config/opencode/skill-usage.db` using `bun:sqlite`, which is built into the Bun runtime the plugin runs in — no external dependency needed.
