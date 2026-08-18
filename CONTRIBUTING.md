# Contributing to skill-pulse

Thanks for taking the time to contribute. This guide explains how to report issues, set up a development environment, and submit changes.

## Roles and permissions

The project is governed by a single maintainer.

- **Maintainer** — the repository owner with write access. The maintainer merges pull requests, cuts releases, publishes tags, approves the first CI run of new contributors, and resolves whether an issue is a `wontfix`.
- **Contributor** — anyone without write access. Contributors work on a fork and submit changes via pull requests. In exchange for helping, the maintainer reviews the changes on two axes (see [Reviewing changes](#reviewing-changes)) and keeps the build green.

As the single person with write access, the maintainer also follows the contribution process: they work on feature branches off `develop` and merge their own pull requests like anyone else. Direct pushes to `main` and `develop` are blocked for everyone.

**Emergency exception**: in exceptional cases the maintainer may bypass a protection (for example, temporarily disabling the ruleset). The exception must be exceptional and visible: it leaves a trace in the GitHub audit log and is recorded in writing in the affected pull request or release notes.

## Reporting issues

Issues live on [GitHub Issues](https://github.com/alexmarco/opencode-skill-pulse/issues). Use the `gh` CLI or the web UI.

When filing a bug, include:

- The opencode version and your OS.
- Steps to reproduce.
- What you expected to happen and what happened instead.
- Relevant log output or error messages, if any.

Before reporting, search the existing issues for a duplicate.

## Development setup

Requirements: [Bun](https://bun.sh) and opencode.

```bash
bun install
bun run typecheck
bun test
```

`bun test` runs the unit tests in `skill-pulse.test.ts` against temporary fixture databases created under the system temp directory; they are removed when the run finishes.

## Codebase layout

| Path | Purpose |
| --- | --- |
| `skill-pulse.ts` | The plugin: event recording, the store, the slash command, and the agent tool |
| `skill-pulse.test.ts` | Unit tests for the store |
| `docs/adr/` | Architecture decision records |
| `CONTEXT.md` | Domain glossary — read it before working to match the project's vocabulary |

## Making changes

Follow these conventions when working on the code:

- Work on a branch off `develop` (GitFlow). Direct commits to `main` are forbidden.
- Write atomic commits following [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
- Keep changes minimal and focused on the issue at hand; don't refactor adjacent code.
- Use the domain vocabulary from `CONTEXT.md` in code, commits, and issue text.
- Record hard-to-reverse decisions in `docs/adr/` following the existing numbering and style.
- Run `bun run typecheck` and `bun test` before pushing.

## Submitting a pull request

1. Open a PR against `develop` (not `main`).
2. Describe what the change does and why, and link the issue it closes.
3. Make sure the branch is up to date by rebasing against `develop` before merging.
4. After merge, delete the feature branch.

## Reviewing changes

Changes are reviewed on two axes:

- **Standards** — does the code follow the conventions above and the existing style?
- **Spec** — does the code do what the linked issue asked for?

Feedback should be concrete and actionable; the author is expected to address it and re-run the checks.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
