# Skill Usage Tracking

This context covers how the `opencode-skill-pulse` plugin observes and records which skills are used across opencode sessions. It exists to make skill usage observable so the user can decide which skills to keep, prune, or improve.

## Language

**Skill**:
A reusable set of instructions (`SKILL.md`) that an opencode agent loads on demand via the `skill` tool.
_Avoid_: slash command, custom command, tool

**Skill use**:
An invocation of the `skill` tool naming a skill. Every invocation counts, including repeated loads within the same session.
_Avoid_: skill run, skill execution, skill trigger

**Skill use event**:
A single recorded occurrence of a skill use, carrying a timestamp, the skill name, the session ID, and the project where it happened.
_Avoid_: log entry, usage record

**Project**:
The working context of an event, identified by the working directory and, when under git, the worktree root.
_Avoid_: repo, workspace

**Session**:
An opencode session, identified by its session ID.

**Slash command**:
A user-invoked custom or built-in command (`/init`, `/review`, ...). Slash commands are not skills; invoking one is not a skill use.
_Avoid_: (confusing with) skill command
