# Only the `skill` tool counts as a skill use

Skills load only through the native `skill` tool; slash commands are custom commands (prompts), not skills. The reference plugin also counted every non-builtin slash command, which pollutes the data with commands that are not skills. We count only `skill` tool invocations so the stored history has a precise, unambiguous meaning.
