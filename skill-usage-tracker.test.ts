import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createStore } from "./skill-usage-tracker"

function makeStore() {
  return createStore(new Database(":memory:"))
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
      gitRoot: null,
      timestamp: "2026-08-18T10:00:00.000Z",
      skillName: "grilling",
    })

    expect(store.queryEvents()[0].gitRoot).toBeNull()
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
})