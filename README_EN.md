<!-- Last synced with README.md: 2026-10-26 -->

<p align="center">
  <img src="https://zenstory.ai/brand/zenstory-ai-mark.svg" alt="" width="76" height="76">
</p>

<h1 align="center">Story-xY</h1>

<p align="center">
  <b>A pure-skill fiction writing framework for any coding agent: chart scanning, deconstruction, multi-axis progression, hook governance, scene budgeting, de-slop and cover art.</b>
</p>

<p align="center">
  <a href="https://zenstory.ai/oh-story"><b>Project page</b></a>
  &nbsp;·&nbsp;
  <a href="#installation"><b>Install</b></a>
  &nbsp;·&nbsp;
  <a href="#native-multi-agent-support"><b>Multi-Agent</b></a>
  &nbsp;·&nbsp;
  <a href="#narrative-engineering-assets"><b>Narrative Assets</b></a>
  &nbsp;·&nbsp;
  <a href="#faq"><b>FAQ</b></a>
  &nbsp;·&nbsp;
  <a href="README.md"><b>中文</b></a>
</p>

<p align="center">
  <img alt="Skills 13" src="https://img.shields.io/badge/Skills-13-081431?style=flat-square">
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/License-MIT-1F6FEB?style=flat-square"></a>
  <img alt="Zero API Key" src="https://img.shields.io/badge/API%20Key-None%20Needed-success?style=flat-square">
  <img alt="Multi-Agent" src="https://img.shields.io/badge/Agents-Antigravity%20%7C%20Codex%20%7C%20Pi%20%7C%20Claude%20%7C%20OpenCode-blueviolet?style=flat-square">
</p>

---

## What it is

**Story-xY** is a **pure-skill** web fiction and storytelling framework covering the entire creative lifecycle: **chart scanning → bestseller deconstruction → multi-axis plotting → scene-level drafting → de-slop editing → cover generation**.

It installs as 13 agent skills into the coding agent you already use. **The writing model is your agent's own model** — no separate API keys, no local LLM servers, zero external inference dependencies. The runtime consists entirely of Markdown workflows/craft references and fast, deterministic Node.js / Python guard scripts.

### Core Principles

1. **Host-Model Direct Drive (Zero Extra API Overhead)**
   - No private inference layer. Works seamlessly with Claude Code (Claude 3.7 / 3.5 Sonnet), Google Antigravity (Gemini 2.5 Pro / Flash), OpenAI Codex, Pi Coding Agent, and OpenCode (DeepSeek-V3 / R1).
2. **Native Out-of-the-Box Multi-Agent Adaptation**
   - Repository-root configs are pre-materialized: Google Antigravity (`.antigravity/` & `.agents/`), OpenAI Codex (`.codex/`), Pi Coding Agent (`.pi/` & `PI.md`), Claude Code (`.claude-plugin/` & `CLAUDE.md`), OpenCode (`opencode.json`), ZCode (`.zcode-plugin/`), OpenClaw (`.clawhub/`), Reasonix (`reasonix-plugin.json`). Clone and open — zero setup commands required.
3. **Deterministic Hard Gates & Guardrails**
   - Pre-write gates: validates scene structure, hook quotas, and tracking state.
   - Post-write gates: catches mid-sentence truncation, verbatim repetition loops, leaked pipeline terms, and prompt artifact tags (`[润色备注]`, `【场景说明】`, `[字数：` are strictly blocked).
   - Deterministic style linter: checks high-risk AI patterns (negation flip, voice contrast, stock physical reactions).
4. **Clean-Room Narrative Intelligence (MIT Licensed)**
   - Commercial opening 1-2-3 rule, multi-axis chapter progression matrix, scene-level length budgeting, 5-tier hook lifecycle governance, short-form twist evidence trail, and 7-question semantic de-slop audit.
5. **The File System is the Memory**
   - Settings, outlines, prose, and tracking reside in separate versioned files. The single source of truth `_tracking-state.json` derives context cards, active hook registers, and dual timelines ("Author Truth" vs "Reader Known"). Context can be compacted or reset without loss of story continuity.

---

## Native Multi-Agent Support

| Host Agent | Repository Adapter Path | Features Supported |
|:---|:---|:---|
| **Google Antigravity (AGY)** | [`.agents/`](.agents/) & [`.antigravity/`](.antigravity/) | 13 skills discovery symlink, 7 custom subagents (`agent.md`), `always_on` orchestrator rule, PreToolUse/PostToolUse hooks |
| **OpenAI Codex** | [`.codex/`](.codex/) & [`AGENTS.md`](AGENTS.md) | 13 skills discovery symlink, 7 native TOML subagents, Python hooks, Windows CMD / Bash launchers |
| **Pi Coding Agent** | [`.pi/`](.pi/) & [`PI.md`](PI.md) | 13 skills discovery symlink, Pi config, root system instructions |
| **Claude Code** | [`.claude-plugin/`](.claude-plugin/) & [`CLAUDE.md`](CLAUDE.md) | Claude Code plugin specification & project guidelines |
| **OpenCode** | `opencode.json` | OpenCode 2.x skill discovery & prose guard plugins |
| **ZCode** | [`.zcode-plugin/`](.zcode-plugin/) | ZCode native commands & plugin manifest |
| **OpenClaw** | [`.clawhub/`](.clawhub/) | ClawHub package format & publishing manifest |
| **Reasonix** | `reasonix-plugin.json` | Reasonix plugin configuration & pinned versions |

---

## Narrative Engineering Assets

1. **Scene-Level Length Budget** ([scene-budget.md](skills/story-long-write/references/scene-budget.md))
   - Allocates target chapter words across 2–4 scenes by dramatic task before drafting; dialogue carries tension; repairs only drifting scenes without full-chapter rewrites.
2. **Hook Advancement Mechanics** ([hook-advancement.md](skills/story-long-write/references/hook-advancement.md))
   - Distinguishes `mention` (passive dialogue, does not reset stale timer) from `advance` (new physical clues / stakes escalation); 5-stage payoff horizons (`immediate` to `endgame`).
3. **Commercial Opening & Progression Axes** ([progression-axes.md](skills/story-long-write/references/progression-axes.md))
   - The 1-2-3 opening formula for Chapters 1–3 (disturbance → leverage demonstration → countdown objective); mandatory dual-axis progression per chapter (1 primary + 1 supporting axis).
4. **Short Fiction Packaging & Truth Anchoring** ([packaging-and-truth.md](skills/story-short-write/references/packaging-and-truth.md))
   - 2–3 retroactive physical clues for twist endings; anti-truncation terminal checks; marketing packages strictly grounded in verified manuscript facts.
5. **Semantic De-slop 7-Question Self-Check** ([semantic-seven-questions.md](skills/story-deslop/references/semantic-seven-questions.md))
   - Second-layer human reader audit: narrative delta, physical action evidence, emotion labels removed, specific sensory setting, purposeful dialogue, breathing rhythm, prompt meta-tags erased.

---

## Skills Inventory (13 Skills)

- **`story-setup`**: Deployment and environment diagnostics.
- **`story`**: Master router and local interactive Dashboard.
- **`story-long-write`**: Serialized novel planning, outlines, scene budgeting, and drafting.
- **`story-short-write`**: Short fiction design, reversal structuring, and distribution packaging.
- **`story-deslop`**: Two-layer de-slop (regex scanning + 7-question semantic audit).
- **`story-long-analyze`**: Deconstruction of serialized web fiction bestsellers.
- **`story-long-scan`**: Real-time trend scanning across major Chinese web fiction platforms.
- **`story-short-analyze`**: 50+ beat deconstruction for high-engagement short fiction.
- **`story-short-scan`**: Short-form trending story topic analysis.
- **`story-import`**: Reverse-engineering existing text into standard structured projects.
- **`story-review`**: Multi-perspective rubric-based chapter auditing.
- **`story-cover`**: Book cover generation prompts.
- **`browser-cdp`**: Headless browser automation via CDP.

---

## License

This project is licensed under the [MIT License](LICENSE).
