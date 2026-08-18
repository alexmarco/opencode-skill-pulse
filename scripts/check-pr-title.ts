const TYPES = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "release",
  "revert",
  "style",
  "test",
] as const

export type PrTitleValidation = {
  valid: boolean
  error: string | null
}

export function validatePrTitle(title: string): PrTitleValidation {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: "title is empty" }
  }

  const match = trimmed.match(/^([a-z]+)(\([^()]+\))?: (.+)$/)
  if (!match) {
    return {
      valid: false,
      error: `title must match "type(scope): description", got "${trimmed}"`,
    }
  }

  const type = match[1]
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return { valid: false, error: `unknown type "${type}"` }
  }

  return { valid: true, error: null }
}

if (import.meta.main) {
  const title = process.argv[2] ?? ""
  const result = validatePrTitle(title)
  if (!result.valid) {
    console.error(result.error)
    process.exit(1)
  }
  console.log(`PR title is valid: ${title}`)
}