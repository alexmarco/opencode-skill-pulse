import { describe, expect, test } from "bun:test"
import { validatePrTitle } from "./check-pr-title"

describe("validatePrTitle", () => {
  test("accepts a standard conventional commit title", () => {
    expect(validatePrTitle("feat: add a new query surface")).toEqual({
      valid: true,
      error: null,
    })
  })

  test("accepts a type with scope", () => {
    expect(validatePrTitle("fix(store): record skill use events")).toEqual({
      valid: true,
      error: null,
    })
  })

  test("accepts the release type", () => {
    expect(validatePrTitle("release: v0.2.0")).toEqual({ valid: true, error: null })
  })

  test("trims surrounding whitespace", () => {
    expect(validatePrTitle("  chore: tidy up  ")).toEqual({ valid: true, error: null })
  })

  test("rejects an uppercase type", () => {
    expect(validatePrTitle("Feat: capitalised type")).toEqual({
      valid: false,
      error: expect.any(String),
    })
  })

  test("rejects a missing description", () => {
    expect(validatePrTitle("feat:")).toEqual({ valid: false, error: expect.any(String) })
  })

  test("rejects a missing type", () => {
    expect(validatePrTitle("some random title")).toEqual({
      valid: false,
      error: expect.any(String),
    })
  })

  test("rejects a non-standard type", () => {
    expect(validatePrTitle("wibble: something")).toEqual({
      valid: false,
      error: expect.any(String),
    })
  })

  test("rejects an empty title", () => {
    expect(validatePrTitle(" ")).toEqual({ valid: false, error: expect.any(String) })
  })

  test("rejects a type with scope but no description", () => {
    expect(validatePrTitle("feat(store):")).toEqual({
      valid: false,
      error: expect.any(String),
    })
  })
})