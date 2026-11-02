# Agent Note: 宿主收敛为 Pi 单端与 v1.1 止血基线落地

Status: implemented

## Problem

Story-xY 维护了面向 8 个编程宿主（Claude Code、Codex、ZCode、Reasonix、OpenCode、Antigravity、Generic、OpenClaw）的适配矩阵，总计产生 56 份同名 agent 副本与 23 个独立守卫脚本。庞大的维护表面积导致严重副本漂移与质量债：
1. Pi 模板副本损坏为严格非法 UTF-8（共 1112 处 U+FFFD 乱码），且 `.pi/agents` 直接照抄 Claude 原型、写死 Claude 工具名与档位名；
2. 验收脚本 `verify-8-flows.mjs` 调用 8 个不存在的接口无条件打 100% 假绿；
3. 产品代码内残留 `E:/` 绝对路径与虚构的《剑道独尊》演示书目数据；
4. 守卫脚本多处因缺少各宿主打包分发件而报红退回。

## Decision

按照总方案 D1 拍板决议，推进宿主体系向 Pi / Studio 单端收敛，并分批落实 v1.1 止血与治理：
1. **生成器先行建立正本管线**：新建 `scripts/generate-pi-agents.py`，以唯一纯净源 `skills/story-setup/references/templates/agents/` 为事实源，自动清洗 frontmatter、映射小写工具集与 `slot:` 字段，生成 `references/pi/agents/*.md` 与 `.pi/agents/*.md`，并以 `--check` 模式纳入日常守卫。
2. **彻底解耦模型层与死路径**：重构 `lib/story-agent-resolver.ts`，删除写死 `MiniMax-M3` 默认值与跨工作区路径探测；删除 `useActiveBook.ts` 中的 `INITIAL_BOOKS` 假数据，改用纯动态扫描；产品代码中的 `E:/` 绝对路径全部清零。
3. **真实路径真实验收**：路线 A 重写 `verify-8-flows.mjs`，服务未启动时严格非零退出，无端点虚假报过彻底消灭。
4. **三件套与写锁治理**：装入 `story-guard.ts` 白名单与定稿修改确认制；重构 `story-agents.ts` 写锁按 toolCallId 绑定持有者，彻底消除并发竞态。
5. **Antigravity 暂留自用**：为保证维护期平滑过渡，Antigravity 适配器暂留作本地自用，待 Studio 验证稳固后再行收尾。

## Alternatives considered

- **方案 A：继续维持 8 个宿主全量同步**。被否决。理由：多宿主不仅需要补全 Codex、ZCode 等缺失打包件，且每次修改都要级联同步 56 份文件，单人维护完全不可持续；且真实用户与产品核心本体正是 Pi / Studio。
- **方案 B：手工逐字修复损坏的 7 个 Pi agent 文件**。被否决。理由：手工修复治标不治本，极易遗漏标点并产生补丁接缝；写出确定性生成脚本才能保证事实源单一且可反复验证。

## Consequences

- **收益**：
  - 1112 处非法字符彻底清零，编码与一致性守卫转绿；
  - 杜绝假绿验收与环境写死问题，换机与跨平台均可真实运行；
  - 明确了 templates 为唯一语义事实源，消除副本手改漂移风险。
- **代价**：
  - 上游 oh-story 今后若有新规则更新，需经生成管线人工单向引入，不再具备多宿主自动同步能力。
