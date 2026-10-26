<!-- Last synced with README.md: 2026-10-26 -->

<h1 align="center">Story-xY</h1>

<p align="center">
  <b>A pure-skill fiction writing framework for any coding agent: chart scanning, deconstruction, multi-axis progression, hook governance, scene budgeting, de-slop and cover art.</b>
</p>

<p align="center">
  <a href="https://github.com/demon820308/Story-xY"><b>GitHub Repository</b></a>
  &nbsp;·&nbsp;
  <a href="#installation"><b>Install</b></a>
  &nbsp;·&nbsp;
  <a href="#supported-agents"><b>Supported Agents</b></a>
  &nbsp;·&nbsp;
  <a href="#narrative-engineering-assets"><b>Narrative Assets</b></a>
  &nbsp;·&nbsp;
  <a href="#interactive-narrative--dm-mode"><b>Interactive / DM Mode</b></a>
  &nbsp;·&nbsp;
  <a href="#faq"><b>FAQ</b></a>
  &nbsp;·&nbsp;
  <a href="README.md"><b>中文</b></a>
</p>

<p align="center">
  <img alt="Skills 13" src="https://img.shields.io/badge/Skills-13-081431?style=flat-square">
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/License-MIT-1F6FEB?style=flat-square"></a>
  <a href="https://github.com/demon820308/Story-xY/tree/feature/interactive-play"><img alt="Branch interactive-play" src="https://img.shields.io/badge/Experimental-interactive--play-FF6B6B?style=flat-square"></a>
</p>

---

## What it is

**Story-xY** is a **pure-skill** web fiction and storytelling framework covering the entire creative lifecycle: **chart scanning → bestseller deconstruction → multi-axis plotting → scene-level drafting → de-slop editing → cover generation**.

It installs as 13 agent skills into the coding agent you already use. **The writing model is your agent's own model** — no separate API keys, no local LLM servers, zero external inference dependencies. The runtime consists entirely of Markdown workflows/craft references and fast, deterministic Node.js / Python guard scripts.

### Core Principles

1. **Host-Model Direct Drive (Zero Extra API Overhead)**
   - No private inference layer. Works seamlessly with Claude Code (Claude 3.7 / 3.5 Sonnet), Google Antigravity (Gemini 2.5 Pro / Flash), OpenAI Codex, Pi Coding Agent, and OpenCode (DeepSeek-V3 / R1).
2. **Native Out-of-the-Box Host Adaptation**
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

## Supported Agents

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

## Interactive Narrative & DM Mode

<p align="center">
  <a href="https://github.com/demon820308/Story-xY/tree/feature/interactive-play"><img alt="Branch interactive-play" src="https://img.shields.io/badge/Branch-feature%2Finteractive--play-FF6B6B?style=flat-square"></a>
  <a href="./docs/experimental/interactive-play-engine.md"><img alt="Spec Document" src="https://img.shields.io/badge/Architecture-interactive--play--engine.md-1F6FEB?style=flat-square"></a>
</p>

Story-xY supports both single-timeline serialized novel writing and **interactive branching narratives (CYOA / text RPG / interactive screenplay) via a deterministic state-machine simulation engine**. In this mode, the Agent transitions from a passive prose generator to an active **Dungeon Master (DM) / Narrative Arbiter**, dynamically resolving player choices against physical clues, world rules, and character stakes.

### 1. Direct DM Mode on Main Branch (No Branch Switching Needed)

**No branch switching or reinstallation is required.** The main branch ships with the architectural spec [`docs/experimental/interactive-play-engine.md`](docs/experimental/interactive-play-engine.md). Simply copy and send the following activation prompt to your Agent:

```text
Activate Interactive Dungeon Master (DM) mode. Based on Story-xY's de-slop and scene-budgeting rules, and the state-machine specifications in docs/experimental/interactive-play-engine.md:
1. Establish current premise and opening crisis (or use my supplied outline/setting).
2. For each turn, write 1 scene prose beat (800–1200 words, sensory-rich, zero AI fluff).
3. Conclude each scene with an actionable [Choice Panel] presenting 2–4 distinct options with [Intent], [Risk], and [Potential Fallout / Gain].
4. Halt and wait for my decision; upon receiving my action, arbitrate outcomes, update active hooks/clues, and advance to the next beat.

Begin Scene 1 now.
```

### 2. Gameplay Loop & Experience

1. **Agent Presents Scene & Choice Panel**:
   - **Prose**: 800–1500 words of atmospheric, de-slopped prose.
   - **Choice Panel**:
     - `[1] Probe subtly`: [Intent: Read facial micro-expressions] [Risk: Very Low] [Cost: Spends conversational turn]
     - `[2] Strike decisively`: [Intent: Neutralize threat] [Risk: High, may trigger alarm bells]
     - `[3] Feign compliance & mark path`: [Intent: Trace behind-the-scenes actors] [Hidden Gain: Unlocks secret room clues]
2. **Player Decision**:
   - Reply with option number (e.g., `Choice 2`) or custom derivative action (`"I choose 1, but secretly ready my dagger"`).
3. **State Machine (PlayReducer) Progression**:
   - The Agent evaluates outcomes against author truth, updating active hook registers, physical clues, and secondary fallout for the subsequent scene.

### 3. How to Upgrade (Zero Reinstallation)

Existing users do not need to reinstall. Upgrade seamlessly based on your environment:

- **Local Git Repository (Antigravity / Codex / Pi / Cursor)**:
  ```bash
  cd E:\story-xy
  git pull
  ```
- **CLI Package Install (npx skills)**:
  ```bash
  npx skills add demon820308/Story-xY -y -g
  ```
- **Existing Fiction Project**:
  Run `/story-setup` from your novel project root to refresh references and agent configs without touching manuscripts.

### 4. Dedicated Experimental Branch: feature/interactive-play

For developers seeking an isolated sandbox for custom interactive engine features or game runtime experiments:
- **Switch branch**: `git checkout feature/interactive-play`
- **CLI install from branch**: `npx skills add demon820308/Story-xY#feature/interactive-play -y -g`
- **Architectural Specs**: See [`docs/experimental/interactive-play-engine.md`](docs/experimental/interactive-play-engine.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
