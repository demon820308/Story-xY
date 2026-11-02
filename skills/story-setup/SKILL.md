---
name: story-setup
version: 1.3.4
description: "网文写作工具集基础设施部署与检查。内置适配 Pi / Pi Web 写作工作台与 Antigravity。触发方式：/story-setup、「准备写书」「帮我搭一下环境」「配置写作项目」「检查写作环境」。"
metadata: {"openclaw":{"source":"https://github.com/demon820308/Story-xY"}}
---
# story-setup：网文写作工具集基础设施部署

你负责把网文写作工具集部署到用户项目目录：Pi / Pi Web 写作工作台原生挂载运行，或为 Google Antigravity 提供本地适配。

**保留用户配置；受管文件按清单更新，共同维护的文件按管理块合并。**

作者第一次部署的顺序：判断当前宿主 → 确认项目根 → 按宿主部署 → 验收 → 告诉作者下一步。本文件写公共流程；各宿主的部署清单、算法、校验和报告提示见 Phase 2 对应文件，**只读本次目标宿主的那一份**。

## 选择模式

- 参数为 `check`，或用户只要求检查部署、诊断环境、排查 agent 不可用时：完整读取 [references/diagnostics.md](references/diagnostics.md)，按其中流程仅检查并报告；不进入下面的部署流程。
- 用户要求安装、更新或修复时：执行下面的部署流程。检查后已明确授权的修复沿用本文件与宿主部署文件的部署与合并规则。

---

## Phase 1：判断宿主与项目

**先自检参考目录**：以正在执行的本 `SKILL.md` 所在目录为准，列出与它同级的 `references/` 下的子目录，核对下面 4 个名字是否都在**且都非空**——`agent-references`、`templates`、`pi`、`antigravity`；同级 `references/deploy-pi.md`、`references/deploy-antigravity.md`、`scripts/merge-antigravity-hooks.py`、`scripts/generate-antigravity-agents.mjs`、`scripts/deploy-antigravity-skills.py`、`scripts/merge-project-instructions.py` 与 `scripts/copy-path-safety.py` 也必须存在。有缺即 skill 包没装全，**立即停止，不写任何部署文件**，报告里区分「缺目录」「目录为空」和「缺脚本或部署文件」，并给出修复指令。

1. 检查当前目录是否已部署过（存在 `.story-deployed`）
   - `agents_version` 缺失、非整数或小于 `36` → 标记为待更新，继续执行当前部署
   - `agents_version: 36` → 提示重新部署只用当前本地 skill 包刷新项目文件
   - `agents_version` 大于 `36` → 当前 story-setup 比项目部署旧；停止以避免降级覆盖
   - 同时读 `target_cli` 字段，已部署项目以 sentinel 里的值为准
2. 检查是否有书名目录（包含 `追踪/` 子目录的目录，或用户自定义结构）
   - 有 → 识别为长篇项目，显示当前项目信息
   - 无 → 识别为新项目或短篇项目
3. 检查 `.active-book` 文件是否存在：存在 → 显示当前活跃书目；不存在 → 跳过
4. **判断当前宿主（能判断就不问作者）**。依次看，第一条能定下来的就用：
   - 你自身的运行环境：系统提示、可用工具名或 skill 调用语法已表明你运行在 Pi（含 Pi Web）或 Google Antigravity（含命令行 `agy`）里；
   - 正在执行的本 `SKILL.md` 的安装位置带有宿主专属目录（如 `.pi/`、`.gemini/`、`.agents/`）；
   - 默认为 `pi`。
5. 看项目里已有哪些宿主的标记：
   - `.pi/` 或 `AGENTS.md` 中的 Pi 段（标题行含 `Pi / Pi Web 写作工作台`）→ `target_cli = pi`
   - `.agents/hooks.json`、`.agents/agents/`，或 `.agents/rules/oh-story.md` 中的 Antigravity 标记 → `target_cli = antigravity`
6. 定下 `target_cli`：默认为 `pi`，当前为 Antigravity 时为 `antigravity`。
7. **确认项目根（通常不问）**：项目根就是当前工作目录。其他情况直接部署，在安装报告的「部署明细」里写明装在哪。

## Phase 2：部署基础设施

Phase 2 幂等：复制、写入与各宿主合并重复执行结果一致。受管目录中只覆盖 oh-story 自己的 14 个 skill、7 个助手、hook 与规则文件，保留同目录里作者自己的文件；不覆盖书稿、设定、大纲、追踪和 `.active-book`。

### Step 1：按宿主部署

对 `target_cli` 里的每个宿主，**完整读取**对应部署文件，按其中的部署清单与算法依次执行；不读其他宿主的文件。

| `target_cli` | 部署文件 |
|---|---|
| `pi` | [references/deploy-pi.md](references/deploy-pi.md) |
| `antigravity` | [references/deploy-antigravity.md](references/deploy-antigravity.md) |

### Step 2：创建部署标记

- 仅为本次成功部署的目标创建或更新 `.story-deployed`（sentinel file）。
- 写入以下字段（YAML `key: value` 格式）：
  ```yaml
  deployed_at: <date -u +"%Y-%m-%dT%H:%M:%SZ">
  agents_version: 36
  setup_skill_version: 1.3.4
  target_cli: pi（或 antigravity）
  resolver_strategy: project-local-skill-reference
  references_dir: skills/story-setup/references/agent-references
  ```

## Phase 3：验证安装

1. 对 `target_cli` 里的每个宿主，执行其部署文件的「验证」一节。
2. 验证部署标记：
   - 检查 `.story-deployed` 存在，字段齐全，版本号与 Step 2 的字段块一致。
3. 输出安装报告：
   - **先写「现在可以做什么」**：用写书的话列本次部署后真正可用的事。
   - **再写「你还需要做的事」**：无需其他操作。
   - **最后是简短的「部署明细」**：装在哪个文件夹、已部署文件、已合并的配置。

---

## 模板占位符

只替换 `{项目名}`：用作者给的书名或项目名，没给就用当前目录名，去掉花括号。模板里其余花括号写法（如 `{书名}/正文/`）表示「任意一本书的目录」，原样保留。

## 项目指令合并（AGENTS.md）

每个宿主在项目指令文件里占一个管理块：`<!-- oh-story:{宿主} 开始 … -->` 到 `<!-- oh-story:{宿主} 结束 -->`，块里是渲染后的模板；共用根 `AGENTS.md`。按 `python3` → `python` → `py` 的顺序探测出可用的 Python 记为 `PYBIN`，运行：

```text
"$PYBIN" "{story-setup skill目录}/scripts/merge-project-instructions.py" --host {宿主} --template {该宿主模板} --existing {项目指令文件} --output {项目指令文件} --project-name {项目名}
```

---

## 参考资料

| 文件 | 用途 |
|------|------|
| [references/deploy-pi.md](references/deploy-pi.md) | Pi / Pi Web 写作工作台部署 |
| [references/deploy-antigravity.md](references/deploy-antigravity.md) | Antigravity 部署 |
| [references/diagnostics.md](references/diagnostics.md) | 仅检查模式 |

---

## 流程衔接

**流水线：** 部署
**位置：** 初始化（最前置）

| 时机 | 跳转到 | 命令 |
|---|---|---|
| 部署完成，开始写作 | story-long-write / story-short-write | `/story-long-write` 或 `/story-short-write` |
| 导入已有小说做拆解 | story-import | `/story-import` |
| 需要浏览器登录态（扫榜/拆文取原文） | browser-cdp | `/browser-cdp` |
