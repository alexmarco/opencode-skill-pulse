import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createStore } from "./skill-pulse"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), "skill-pulse-"))
  tempDirs.push(dir)
  return createStore(new Database(join(dir, "test.db")))
}

const BASE = {
  sessionId: "s1",
  directory: "/home/user/project-a",
  gitRoot: "/home/user/project-a",
} as const

describe("createStore", () => {
  test("records a skill use event and reads it back", () => {
    const store = makeStore()

    store.recordEvent({
      ...BASE,
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })

    const events = store.queryEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      ...BASE,
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })
  })

  test("records an event without a git root", () => {
    const store = makeStore()

    store.recordEvent({
      sessionId: "s1",
      directory: "/tmp/somewhere",
      gitRoot: "",
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })

    expect(store.queryEvents()[0].gitRoot).toBe("")
  })

  test("aggregates counts per skill including repeated loads", () => {
    const store = makeStore()

    store.recordEvent({ ...BASE, timestamp: "2026-08-18T10:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T11:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T12:00:00.000Z", skillName: "tdd" })

    expect(store.aggregateBySkill()).toEqual([
      { skillName: "grilling", count: 2, lastUse: "2026-08-18T11:00:00.000Z" },
      { skillName: "tdd", count: 1, lastUse: "2026-08-18T12:00:00.000Z" },
    ])
  })

  test("aggregates filtered by skill name", () => {
    const store = makeStore()

    store.recordEvent({ ...BASE, timestamp: "2026-08-18T10:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T11:00:00.000Z", skillName: "tdd" })

    expect(store.aggregateBySkill({ skillName: "grilling" })).toEqual([
      { skillName: "grilling", count: 1, lastUse: "2026-08-18T10:00:00.000Z" },
    ])
  })

  test("aggregate respects the top N limit", () => {
    const store = makeStore()

    store.recordEvent({ ...BASE, timestamp: "2026-08-18T10:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T11:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T12:00:00.000Z", skillName: "tdd" })

    const rows = store.aggregateBySkill({ limit: 1 })
    expect(rows).toHaveLength(1)
    expect(rows[0].skillName).toBe("grilling")
  })

  test("queryEvents returns events newest first", () => {
    const store = makeStore()

    store.recordEvent({ ...BASE, timestamp: "2026-08-18T10:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T12:00:00.000Z", skillName: "tdd" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T11:00:00.000Z", skillName: "research" })

    expect(store.queryEvents().map((e) => e.skillName)).toEqual(["tdd", "research", "grilling"])
  })

  test("queryEvents respects the limit", () => {
    const store = makeStore()

    store.recordEvent({ ...BASE, timestamp: "2026-08-18T10:00:00.000Z", skillName: "grilling" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T11:00:00.000Z", skillName: "tdd" })
    store.recordEvent({ ...BASE, timestamp: "2026-08-18T12:00:00.000Z", skillName: "research" })

    const events = store.queryEvents({ limit: 2 })
    expect(events).toHaveLength(2)
    expect(events[0].skillName).toBe("research")
  })

  test("queryEvents filters by session, project and date range", () => {
    const store = makeStore()

    store.recordEvent({
      sessionId: "s1",
      directory: "/p1",
      gitRoot: "/p1",
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })
    store.recordEvent({
      sessionId: "s2",
      directory: "/p1",
      gitRoot: "/p1",
      timestamp: "2026-08-18T11:00:00.000Z",
      skillName: "grilling",
    })
    store.recordEvent({
      sessionId: "s1",
      directory: "/p2",
      gitRoot: "/p2",
      timestamp: "2026-08-18T12:00:00.000Z",
      skillName: "tdd",
    })

    expect(store.queryEvents({ sessionId: "s1" })).toHaveLength(2)
    expect(store.queryEvents({ project: "/p1" })).toHaveLength(2)
    expect(store.queryEvents({ project: "/p2" })).toHaveLength(1)
    const ranged = store.queryEvents({ from: "2026-08-18T10:30:00.000Z", to: "2026-08-18T11:30:00.000Z" })
    expect(ranged).toHaveLength(1)
    expect(ranged[0].sessionId).toBe("s2")
  })

  test("queryEvents matches the project exactly, by git root or working directory", () => {
    const store = makeStore()

    store.recordEvent({
      sessionId: "s1",
      directory: "/repo/subdir",
      gitRoot: "/repo",
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })
    store.recordEvent({
      sessionId: "s1",
      directory: "/repo10",
      gitRoot: "",
      timestamp: "2026-08-18T11:00:00.000Z",
      skillName: "tdd",
    })
    store.recordEvent({
      sessionId: "s1",
      directory: "/repo",
      gitRoot: "",
      timestamp: "2026-08-18T12:00:00.000Z",
      skillName: "research",
    })

    expect(store.queryEvents({ project: "/repo" }).map((e) => e.skillName)).toEqual(["research", "grilling"])
    expect(store.queryEvents({ project: "/repo10" }).map((e) => e.skillName)).toEqual(["tdd"])
  })
})

describe("concurrency", () => {
  test("concurrent writers across processes do not fail with SQLITE_BUSY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "skill-pulse-conc-"))
    tempDirs.push(dir)
    const dbPath = join(dir, "shared.db")
    const childCount = 5
    const insertsPerChild = 20

    const childCode = `
import { Database } from "bun:sqlite"
import { createStore } from ${JSON.stringify(join(import.meta.dir, "skill-pulse.ts"))}

;(async () => {
  const dbPath = process.env.DB_PATH
  if (!dbPath) throw new Error("DB_PATH missing")
  const childName = process.env.CHILD ?? "child"
  const store = createStore(new Database(dbPath))
  for (let i = 0; i < ${insertsPerChild}; i++) {
    store.recordEvent({
      timestamp: new Date().toISOString(),
      skillName: childName,
      sessionId: "subprocess",
      directory: "/tmp",
      gitRoot: "",
    })
    await Bun.sleep(5 + Math.random() * 20)
  }
})()
`

    const subprocesses = await Promise.all(
      Array.from({ length: childCount }, (_, i) =>
        Bun.spawn([process.execPath, "-e", childCode], {
          cwd: import.meta.dir,
          env: { ...process.env, DB_PATH: dbPath, CHILD: `child-${i}` },
          stdout: "pipe",
          stderr: "pipe",
        }),
      ),
    )
    const exitCodes = await Promise.all(subprocesses.map((sub) => sub.exited))
    const failed = subprocesses.filter((sub, i) => exitCodes[i] !== 0)
    const stderrOutput = await Promise.all(failed.map((sub) => new Response(sub.stderr).text()))
    expect(failed).toHaveLength(0)
    if (failed.length > 0) console.error(stderrOutput)

    const store = createStore(new Database(dbPath))
    const total = store.aggregateBySkill().reduce((sum, row) => sum + row.count, 0)
    expect(total).toBe(childCount * insertsPerChild)
  })
})