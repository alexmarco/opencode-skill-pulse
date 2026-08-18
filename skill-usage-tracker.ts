import type { Part } from "@opencode-ai/sdk"
import type { PluginModule } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export type SkillUseEvent = {
  timestamp: string
  skillName: string
  sessionId: string
  directory: string
  gitRoot: string | null
}

export type AggregatedSkill = {
  skillName: string
  count: number
  lastUse: string
}

export type UsageFilters = {
  skillName?: string
  project?: string
  sessionId?: string
  limit?: number
  from?: string
  to?: string
}

type EventRow = {
  timestamp: string
  skill_name: string
  session_id: string
  directory: string
  git_root: string | null
}

type AggregateRow = {
  skill_name: string
  count: number
  last_use: string
}

export function createStore(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      session_id TEXT NOT NULL,
      directory TEXT NOT NULL,
      git_root TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_skill_usage_skill_name ON skill_usage_events(skill_name);
    CREATE INDEX IF NOT EXISTS idx_skill_usage_timestamp ON skill_usage_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_skill_usage_git_root ON skill_usage_events(git_root);
  `)

  const insert = db.prepare(
    `INSERT INTO skill_usage_events (timestamp, skill_name, session_id, directory, git_root)
     VALUES (?, ?, ?, ?, ?)`,
  )

  function buildQuery(filters: UsageFilters, select: string, tail: string) {
    const where: string[] = []
    const params: (string | number)[] = []
    if (filters.skillName) {
      where.push("skill_name = ?")
      params.push(filters.skillName)
    }
    if (filters.sessionId) {
      where.push("session_id = ?")
      params.push(filters.sessionId)
    }
    if (filters.project) {
      where.push("(directory LIKE ? OR git_root LIKE ?)")
      params.push(`%${filters.project}%`, `%${filters.project}%`)
    }
    if (filters.from) {
      where.push("timestamp >= ?")
      params.push(filters.from)
    }
    if (filters.to) {
      where.push("timestamp <= ?")
      params.push(filters.to)
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
    let sql = `${select} FROM skill_usage_events ${clause} ${tail}`
    if (filters.limit) {
      sql += " LIMIT ?"
      params.push(filters.limit)
    }
    return { sql, params }
  }

  return {
    recordEvent(event: SkillUseEvent) {
      insert.run(event.timestamp, event.skillName, event.sessionId, event.directory, event.gitRoot)
    },

    aggregateBySkill(filters: UsageFilters = {}): AggregatedSkill[] {
      const { sql, params } = buildQuery(
        filters,
        "SELECT skill_name, COUNT(*) AS count, MAX(timestamp) AS last_use",
        "GROUP BY skill_name ORDER BY count DESC, last_use DESC",
      )
      return (db.query(sql).all(...params) as AggregateRow[]).map((row) => ({
        skillName: row.skill_name,
        count: row.count,
        lastUse: row.last_use,
      }))
    },

    queryEvents(filters: UsageFilters = {}): SkillUseEvent[] {
      const { sql, params } = buildQuery(
        filters,
        "SELECT timestamp, skill_name, session_id, directory, git_root",
        "ORDER BY timestamp DESC",
      )
      return (db.query(sql).all(...params) as EventRow[]).map((row) => ({
        timestamp: row.timestamp,
        skillName: row.skill_name,
        sessionId: row.session_id,
        directory: row.directory,
        gitRoot: row.git_root,
      }))
    },
  }
}

function skillUsageDbPath() {
  const configDir = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(configDir, "opencode", "skill-usage.db")
}

function openStore() {
  const dbPath = skillUsageDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })
  return createStore(new Database(dbPath))
}

function parseCommandArgs(raw: string): UsageFilters {
  const filters: UsageFilters = {}
  for (const token of raw.trim().split(/\s+/)) {
    const [key, value] = token.split("=")
    if (!key || value === undefined) continue
    if (key === "skill") filters.skillName = value
    else if (key === "project") filters.project = value
    else if (key === "top") {
      const n = Number(value)
      if (Number.isInteger(n) && n > 0) filters.limit = n
    }
  }
  return filters
}

function formatReport(rows: AggregatedSkill[]): string {
  if (rows.length === 0) return "No skills have been used yet."
  const lines = rows.map((row) => `| ${row.skillName} | ${row.count} | ${row.lastUse} |`)
  return ["| Skill | Uses | Last use |", "| --- | --- | --- |", ...lines].join("\n")
}

const plugin: PluginModule = {
  id: "skill-usage-tracker",
  server: async ({ directory, worktree }) => {
    const store = openStore()

    return {
      config: async (config) => {
        config.command = config.command ?? {}
        config.command["skill-usage"] = {
          description: "Show aggregated skill usage per skill",
          template: "Report the skill usage statistics from the data provided.",
        }
      },

      "command.execute.before": async (input, output) => {
        if (input.command !== "skill-usage") return
        const rows = store.aggregateBySkill(parseCommandArgs(input.arguments))
        output.parts = [{ type: "text", text: formatReport(rows) }] as Part[]
      },

      "tool.execute.before": async (input, output) => {
        if (input.tool !== "skill") return
        const skillName = output.args?.name
        if (typeof skillName !== "string" || skillName.length === 0) return
        store.recordEvent({
          timestamp: new Date().toISOString(),
          skillName,
          sessionId: input.sessionID,
          directory,
          gitRoot: worktree || null,
        })
      },
    }
  },
}

export default plugin