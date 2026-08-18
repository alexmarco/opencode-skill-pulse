import { Database } from "bun:sqlite"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const OPENCODE = process.env.OPENCODE_BIN ?? "opencode"
const PLUGIN_PATH = process.env.PLUGIN_PATH ?? process.cwd()
const MIN_PASS_RATIO = 0.5
const MAX_ATTEMPTS = 3
const RUN_TIMEOUT_MS = 120_000
const PROBE_TIMEOUT_MS = 90_000
const SKILL_NAME = "hello"

const SKILL_MD = `---
name: ${SKILL_NAME}
description: A trivial skill used for end-to-end testing.
---

# ${SKILL_NAME}

Greet the user when loaded.
`

const PROMPT = `Use the skill tool to load the skill named '${SKILL_NAME}' and report what it says.`

type Result = { ok: boolean; error?: string }
type ModelResult = Result & { attempts: number }

function log(msg: string) {
  console.error(`[e2e] ${msg}`)
}

async function runOpencode(
  args: string[],
  opts: { cwd: string; env: Record<string, string> },
  timeoutMs: number,
): Result {
  const proc = Bun.spawn([OPENCODE, ...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdout: "ignore",
    stderr: "pipe",
  })
  const timer = setTimeout(() => proc.kill(), timeoutMs)
  try {
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      return { ok: false, error: `exit code ${exitCode}` }
    }
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }
}

function setupIsolatedEnv(): { home: string; xdg: string; project: string; dbPath: string; env: Record<string, string> } {
  const home = mkdtempSync(join(tmpdir(), "skill-pulse-e2e-"))
  const xdg = join(home, ".config")
  const project = join(home, "project")
  const dbPath = join(xdg, "opencode", "skill-pulse.db")
  mkdirSync(join(xdg, "opencode"), { recursive: true })
  mkdirSync(join(project, ".agents", "skills", SKILL_NAME), { recursive: true })
  writeFileSync(join(project, ".agents", "skills", SKILL_NAME, "SKILL.md"), SKILL_MD)
  writeFileSync(
    join(xdg, "opencode", "opencode.json"),
    JSON.stringify({ plugin: [PLUGIN_PATH] }, null, 2),
  )
  const env: Record<string, string> = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: xdg,
    PATH: `${dirname(OPENCODE)}:${process.env.PATH ?? ""}`,
  }
  return { home, xdg, project, dbPath, env }
}

function eventRecorded(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db.query("SELECT COUNT(*) AS n FROM skill_usage_events WHERE skill_name = ?").all(SKILL_NAME) as {
      n: number
    }[]
    return rows[0].n > 0
  } finally {
    db.close()
  }
}

async function probeRegistration(): Promise<Result> {
  log("probing plugin registration via headless server")
  let env: Record<string, string>
  try {
    const setup = setupIsolatedEnv()
    env = setup.env
    const dbPath = setup.dbPath
    const port = 40000 + Math.floor(Math.random() * 20000)
    const proc = Bun.spawn([OPENCODE, "serve", "--port", String(port)], { env, stdout: "ignore", stderr: "ignore" })
    try {
      const deadline = Date.now() + PROBE_TIMEOUT_MS
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/config`, { signal: AbortSignal.timeout(2_000) })
          if (res.ok) {
            const text = await res.text()
            const commandRegistered = text.includes("Show aggregated skill usage per skill")
            if (!commandRegistered) return { ok: false, error: "plugin command not registered in server config" }
            if (!existsSync(dbPath)) return { ok: false, error: "plugin store not created" }
            return { ok: true }
          }
        } catch {
          /* server not ready yet */
        }
        await Bun.sleep(500)
      }
      return { ok: false, error: "timed out waiting for server config" }
    } finally {
      proc.kill()
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function modelPasses(model: string): Promise<ModelResult> {
  return (async () => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      log(`model ${model} attempt ${attempt}/${MAX_ATTEMPTS}`)
      const setup = setupIsolatedEnv()
      try {
        const run = await runOpencode(["run", "-m", model, PROMPT], { cwd: setup.project, env: setup.env }, RUN_TIMEOUT_MS)
        if (!run.ok) {
          if (attempt < MAX_ATTEMPTS) {
            log(`  run failed (${run.error}), retrying`)
            continue
          }
          return { ok: false, error: `opencode run failed: ${run.error}`, attempts: attempt }
        }
        if (eventRecorded(setup.dbPath)) return { ok: true, attempts: attempt }
        if (attempt < MAX_ATTEMPTS) {
          log("  no skill use event recorded, retrying")
          continue
        }
        return { ok: false, error: "no skill use event recorded", attempts: attempt }
      } finally {
        rmSync(setup.home, { recursive: true, force: true })
      }
    }
    return { ok: false, error: "unreachable", attempts: MAX_ATTEMPTS }
  })()
}

const registration = await probeRegistration()
if (!registration.ok) {
  log(`FATAL: plugin registration probe failed: ${registration.error}`)
  console.log("E2E FAILED: deterministic core (init + registration) did not pass")
  process.exit(1)
}
log("plugin registration probe passed")

const modelsOut = Bun.spawnSync([OPENCODE, "models", "opencode"], {
  stdout: "pipe",
  stderr: "pipe",
})
if (modelsOut.exitCode !== 0) {
  log(`FATAL: could not enumerate free models: ${new TextDecoder().decode(modelsOut.stderr)}`)
  process.exit(1)
}
const models = new TextDecoder()
  .decode(modelsOut.stdout)
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("opencode/") && line.length > 0)
if (models.length === 0) {
  log("FATAL: no free opencode models enumerated")
  process.exit(1)
}
log(`enumerated ${models.length} free models: ${models.join(", ")}`)

const results: (ModelResult & { model: string })[] = []
for (const model of models) {
  const result = await modelPasses(model)
  results.push({ model, ...result })
}

const passes = results.filter((result) => result.ok)
const failures = results.filter((result) => !result.ok)

const required = Math.ceil(MIN_PASS_RATIO * models.length)
log(`passed ${passes.length}/${models.length} (need >= ${required})`)

console.log("per-model summary:")
for (const result of results) {
  const status = result.ok ? "PASS" : "FAIL"
  console.log(`  ${status} ${result.model} (attempt ${result.attempts}/${MAX_ATTEMPTS})${result.error ? ` - ${result.error}` : ""}`)
}

for (const failure of failures) {
  console.log(`::warning::e2e: model ${failure.model} FAILED: ${failure.error}`)
}

if (passes.length >= required) {
  console.log(`E2E PASSED: ${passes.length}/${models.length} models (>= ${required})`)
  process.exit(0)
} else {
  console.log(`E2E FAILED: ${passes.length}/${models.length} models (need >= ${required})`)
  process.exit(1)
}