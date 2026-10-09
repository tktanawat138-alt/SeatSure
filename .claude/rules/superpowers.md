<!-- Synced from https://github.com/obra/superpowers @ 8ca22dba9a94f28898bbce59f2537ff4d87c747d. Skills live in .claude/skills/. -->

<EXTREMELY_IMPORTANT>
You have superpowers.

Below is the full content of your 'superpowers:using-superpowers' skill - your introduction to using skills. All other skills live in `.claude/skills/<name>/SKILL.md`; read and follow the matching one.


<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. Brainstorming and systematic-debugging are Superpowers' most common process skills, but the rule holds for any of them.

- "Let's build X" → superpowers:brainstorming first, then implementation skills.
- "Fix this bug" → superpowers:systematic-debugging first, then domain skills.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Platform Adaptation

If your harness appears here, read its reference file for special instructions:

- Claude Code: `references/claude-code-tools.md`
- Codex: `references/codex-tools.md`
- Pi: `references/pi-tools.md`
- Antigravity: `references/antigravity-tools.md`
- Hermes Agent: `references/hermes-tools.md`
- Muse: `references/muse-tools.md`

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, etc, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.

# Claude Code Tool Notes

Claude Code is the reference harness: skills speak its vocabulary
(`Agent` for a subagent dispatch, todos, `Skill`). These notes cover the
one place Claude Code can run a plan cheaper than the skills' default
shape. It is opt-in by your human partner and changes nothing the skills
require.

## Cheaper orchestration for subagent-driven development

The controller session is the most expensive seat in a
superpowers:subagent-driven-development run: it reads every dispatch
result and every report, and it usually runs on the session's most
capable model. Claude Code supports nested subagents (three layers below
the main conversation by default; `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`
adjusts it), so the whole loop can run one layer down.

When your human partner asks for it — or has said the session model is
too expensive to spend on coordination — dispatch ONE orchestrator
subagent on a mid-tier model with the plan path and the instruction to
use superpowers:subagent-driven-development end to end. The orchestrator
dispatches its own implementers and reviewers per that skill's Model
Selection; the workspace and ledger live on disk, so nothing is lost to
the extra layer. Its final message must carry the "Rulings I made" list
verbatim — that list is how the decisions reach your human partner, and
you relay it, not summarize it.

Do this only for a whole plan. Nesting a single task's dispatch buys
nothing and adds a seat.

</EXTREMELY_IMPORTANT>
