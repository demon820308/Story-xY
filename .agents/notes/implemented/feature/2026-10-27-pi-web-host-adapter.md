# Agent Note: story-setup 新增 Pi / Pi Web 写作工作台宿主适配层

Status: implemented
Date: 2026-10-27
Related: story-setup, pi-web

## Problem

用户在本地利用 `@agegr/pi-web`（基于 `@earendil-works/pi-coding-agent`）构建轻量无黑盒的本地小说创作工作台。此前 `story-setup` 官方仅内置 8 个宿主（Claude Code, OpenCode, Codex, Antigravity, ZCode, OpenClaw, Reasonix, generic），未收录 Pi Web。当用户在新目录或空工作区执行 `/story-setup` 部署基础设施时，由于缺乏针对 Pi 的适配分发，`.pi/extensions/story-gates.ts`（门禁、全景看板、双态按键）与 `.pi/agents/*.md`（7 个子代理）无法自动物化到目标项目中，导致部署完成后网页端无法呈现 `story_dashboard` 与创作按键。

## Decision

- 在 `skills/story-setup/` 中正式将 `pi`（Pi / Pi Web 写作工作台）登记为第 9 个官方支持的部署目标（`target_cli: pi`）。
- 新增 `skills/story-setup/references/deploy-pi.md` 部署契约文件，定义机械可检查的部署清单与部署算法：
  - 复制 `.pi/extensions/story-gates.ts`（工作台核心扩展，包含两态状态机、向导式建书/导书弹窗、多书切换、正文门禁）；
  - 复制 `.pi/agents/*.md`（7 个网文写作专用子代理定义）；
  - 复制 `skills/{browser-cdp,story*}/`（13 个技能包）；
  - 写入项目指令 `AGENTS.md`（按 `references/pi/AGENTS.md.tmpl` 合并管理块）；
  - Sentinel 写入 `target_cli: pi`。
- `skills/story-setup/SKILL.md` 识别当前环境的 `.pi/` 或环境变量/进程，自动绑定 `target_cli = pi`；若未识别则在向导弹窗中提供「Pi（Pi Web 写作工作台）」选项。
- 同步更新仓库守卫脚本 `scripts/check-story-setup-deployment.sh`（将 `DEPLOY_HOSTS` 增至 9 宿主，校验清单包含 `pi`）以及 `scripts/doc-budget.json`（将 `deploy-pi.md` 加入预算与 stacking slots）。

## Alternatives considered

- **仅依赖全局安装（~/.pi/agent/extensions/）**：最强理由是无需修改 `story-setup` 源码与部署清单，一份扩展全局生效。不采用：破坏了 oh-story 契约中“工作区级自包含与版本自治”的铁律；不同写作项目可能依赖不同版本的 gates 或 prompt，且无法自动物化 7 个 project-level subagents。
- **让 Pi 走 generic（通用 Web AI / 文件模式）**：最强理由是现存代码无需任何改动。不采用：generic 仅下发通用 Markdown 规则，无法激活 Pi 原生的 `ctx.ui` 状态栏按键、全景看板 Widget、`Agent` 原生子代理调度与细纲/AI腔硬拦截。

## Consequences

- 收益：在全新工作区中执行 `/story-setup` 后，能够确定性自动生成完整的 `.pi/extensions/` 和 `.pi/agents/`。部署完成后刷新网页端，空状态小说工作台卡片与建书/导书按键即刻就绪，无任何断层。
- 体验升级（形态 A 一体化）：将原分散于设置内部的「章节阅读」与「全景看板」合并为统一的「故事看板」门户（包含故事全景罗盘、已落盘章节全文阅读、文末断章快速复盘）；并将旧有歧义的弹窗确认开关重新定义为「创作动作模式（🛡️ 弹窗确认 / ⚡ 极速直发）」，直接整合于故事看板菜单底部，支持作者一键无感切换。
- 代价：仓库需持续维护 Pi Web 的适配层与 `deploy-pi.md` 预算，`scripts/check-story-setup-deployment.sh` 从 8 宿主扩展到 9 宿主。
- 兼容：不影响已有 8 个宿主的部署与已有项目的 `.story-deployed`。
