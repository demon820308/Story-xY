# Agent Note: 宿主收敛方案 B 落地（产品端聚焦 Pi 单端，开发维护端追认 Antigravity 双轨）

Status: implemented
Date: 2026-11-02
Related: 2026-10-28-pi-web-global-resident-mounting.md, D1, R6, story-setup, M0

## Problem

在 v1.1.0 验收中，验收方指出虽然移除了 Claude Code、OpenCode、ZCode、Codex、Reasonix、OpenClaw 等异构宿主，但根目录残留了旧版 `.claude/agents` 副本，且 Antigravity 被完整保留为第二宿主，与原 D1 单端收敛方案（仅保留 Pi 单端）存在表述和范围差异。用户裁定执行方案 B：产品交付端聚焦 Pi / Pi Web 唯一单端，开发维护端追认 Antigravity 作为本地维护与开发 Agent 工作台。

## Decision

1. 彻底清理根目录及 demo 书中的遗留 `.claude` 目录与历史过期副本。
2. 明确双轨定位并在各规范与部署文档中回写落地：
   - **产品端（Product Host）**：以 Pi / Pi Web 为唯一产品级创作工作台宿主，原生内置挂载 14 个 Skill 与 7 个写手子代理。
   - **维护端（Dev Host）**：正式追认 Antigravity 作为开发、测试与维护 Agent 专用工作台宿主，保留 `.agents/` 部署规则与适配脚本。
3. 根目录及 Demo 书中的 `.story-deployed` 部署标记统一刷新为 `target_cli: pi,antigravity`。
4. 全面同步四处宿主枚举名单（`shared-assets.json`、`check-hook-regex-sync.sh`、`check-plugin-packaging.py`、`check-story-setup-deployment.sh`），所有收尾守卫全部转绿。

## Alternatives considered

- **方案 A（完全清理 Antigravity，仅保留纯净 Pi）**：
  - *最强理由*：严格对齐原 D1 单端描述，仓库彻底不存在任何异构适配层，代码量最少。
  - *否决原因*：当前维护开发环境依赖 Antigravity IDE 及其自定义 Agent；一旦清理 `.agents/`，后续 coding agent 与维护流水线将丧失现有本地 Agent 套件支撑。因此用户明确裁定方案 B。

## Consequences

- **收益**：
  - 彻底消除了过期 `.claude` 副本与未同步旧宿主名单带来的红项；
  - 规范、实现与实际开发环境完全名正言顺一致，不再存在范围冲突；
  - 5 项守卫（R1–R5）与 D1（R6）全面清零转绿。
- **代价**：
  - 需要在 `story-setup` 中持续维护 Antigravity 的规则和 hooks 部署契约。
