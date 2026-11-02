# Agent Note: Pi / Pi Web 写作工作台由工作区物化重构为全局常驻挂载

Status: implemented
Date: 2026-10-28
Related: 2026-10-27-pi-web-host-adapter.md, story-setup, pi-web

## Problem

此前在 2026-10-27-pi-web-host-adapter.md 中，Pi Web 的适配方案采取了“工作区级完全物化”策略，即在每个小说写作目录中复制 `.pi/extensions/story-gates.ts`、`.pi/agents/*.md` 与 `skills/`（14 个技能包）。这一方案导致用户在任何小说目录写书时，左侧侧边栏文件树都会充斥大量系统扩展代码与技能包文件，严重污染纯净的书稿目录，且每次新建工作区都要冗余复制相同的基础设施。

## Decision

翻转此前关于仅依赖全局安装的被否决决定，正式将 Pi / Pi Web 的部署模型迁移为**全局常驻挂载模式（Global-Resident Mode）**：
- **全局扩展常驻**：`skills/story-setup/references/pi/extensions/story-gates.ts` 安装并常驻于用户全局代理目录 `~/.pi/agent/extensions/story-gates.ts`。扩展通过当前会话上下文中的 `ctx.cwd` 动态读取任何工作区的小说账本与书籍指针，工作区本身零扩展代码。
- **全局子代理常驻**：7 个小说子代理定义安装至用户全局目录 `~/.pi/agent/agents/*.md`，Pi Web 原生全局解析与调度。
- **全局技能复用**：直接复用用户全局已有的 `~/.agents/skills/`（14 个网文技能包），彻底停止向写作工作区复制 `skills/` 文件夹。
- **工作区彻底纯净**：写作工作区仅保留小说创作资产（设定、大纲、正文、追踪账本与 `.active-book`），基础设施层面仅按需写入 `AGENTS.md` 路由指引与 `.story-deployed` 标记。
- **扩展依赖解耦**：优化 `story-gates.ts` 内 `getCore()` 与 `getWorkbenchSettings()` 的查找路径，优先从全局用户主目录（`~/.agents/...`、`~/.pi/...`）定位依赖与设置，确保在任意纯净工作区下运行不抛出异常。

## Alternatives considered

- **维持工作区级物化（2026-10-27 方案）**：最强理由是工作区完全独立，不同项目可拥有互不影响的扩展版本。不采用：对小说作者造成严重的视觉和心智干扰，小说工作区混入 TypeScript 源码破坏了“工作区只放书”的纯洁性，且作者跨目录写书时面临重复复制与多份扩展不一致的维护负担。
- **仅将扩展移至全局，子代理与技能仍保留在工作区**：最强理由是子代理和技能变更更频繁。不采用：半拉子工程，工作区依然存在大量非正文基础设施文件；Pi 原生对 global agents 和 global skills 有完善支持，一并全局化收益最大。

## Consequences

- 收益：作者的写作工作区彻底纯净，文件树里只有设定、大纲、正文与追踪，干净清爽；新建小说项目秒级就绪，无需再拷贝上千个技能与扩展文件；底部全景看板与状态栏按键在所有工作区全局生效。
- 代价：全局扩展与子代理的版本对本机所有工作区全局统一，若针对单个书目调整门禁需通过参数或项目账本配置驱动，而无法直接硬编码修改单书扩展文件。
- 兼容：旧项目中的本地 `.pi/extensions`、`.pi/agents` 或 `skills/` 可随时安全删除，不影响全局工作台的正常运行。
