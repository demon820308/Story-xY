# Story-xY Studio 开发者与 Agent 指引

本文件是 Story-xY Studio 仓库（`story-app`）的顶层开发与维护指引，供在本仓库工作的各类 coding agent 与开发者阅读。

---

## 一、项目定位与核心架构

- **项目定位**：Story-xY Studio（`story-xy-studio` v1.1）是面向 AI 时代的全流程网文创作工作台与叙事工程底座。
- **架构组成**：
  1. **Web 工作台**：基于 Next.js 16（Turbopack）与 `@earendil-works/pi-coding-agent` SDK 构建的现代化创作工作台。
  2. **原生创作引擎**：通过 `.pi/extensions/` 原生挂载 `story-gates.ts`（门禁状态机）、`story-guard.ts`（命令白名单与定稿保护）、`story-agents.ts`（7 位写手子代理配置与并发写锁）。
  3. **网文专业底座**：14 个创作 Skill（`skills/`）+ 7 位编辑部智能子代理（`templates/agents/`）。
- **宿主收敛原则**：产品端聚焦于 **Pi / Pi Web 体系单端**，彻底清理并移除异构宿主冗余代码（Antigravity 适配器仅在本地保留用于开发维护自用）。

---

## 二、开发与架构三铁律（绝对红线）

1. **零写死（Zero Hardcoding）**：
   - 严禁硬编码任何绝对路径（如 `E:/`、`C:/`、`~/` 等系统相关路径），统一使用相对路径、工作区探测或标准 `process.cwd()`。
   - 严禁硬编码默认模型（如 `MiniMax-M3`），所有智能子代理必须通过槽位化映射（`story-agent-resolver.ts`）动态解析工作区配置。
   - 严禁硬编码虚构书目（如 `INITIAL_BOOKS` 或《剑道独尊》），书目与章节必须走动态扫描真实文件系统。
2. **零假报（Zero False Reporting）**：
   - 实行**真实路径验证（路线 A）**。严禁编写虚假全绿或脱离运行时的假测试桩。
   - 当 Dev 服务离线时，验收探针 `verify-8-flows.mjs` 必须明确报错并以非零状态码退出（exit 1）。只有全链路真实跑通才允许 PASS。
3. **内核不动（Keep Core Untouched）**：
   - 严禁修改 `@earendil-works/*` SDK 源码与内部类型。
   - 严禁向 Pi 的扩展 API（`ctx.ui.*`、`extension_ui_request`）注入专有或私有字段，保持与 Pi CLI 扩展协议的 100% 纯净兼容。

---

## 三、Agent 治理与生成纪律

1. **唯一事实源锚定**：
   - `skills/story-setup/references/templates/agents/*.md` 是 7 位写手子代理配置的**唯一语义事实源**。
2. **严禁直接手改派生文件**：
   - 严禁手动编辑 `.pi/agents/*.md` 或 `skills/story-setup/references/pi/agents/*.md`。
   - 任何 Agent 的改动必须先修改 `templates/agents/*.md`，然后运行 `python scripts/generate-pi-agents.py` 重新生成。
3. **编码与格式守卫**：
   - 必须保持严格无 BOM UTF-8 编码，**绝对不允许引入非法字符或 U+FFFD 乱码**。
   - 工具名全小写（如 `read`, `bash`），只读角色（`consistency-checker`, `story-explorer`）严禁授予写权限（`write`, `edit`）。
   - Agent 模型声明必须统一使用 `slot:` 槽位声明（如 `slot: writer`、`slot: architect`），严禁使用 `model:`。
4. **CI 强同步卡点**：
   - `python scripts/generate-pi-agents.py --check` 作为 CI 核心卡点，任何未同步修改将直接阻断提交。

---

## 四、代码修改纪律（改写不打补丁）

- **整单元重写，禁止补丁式追加**：修改 skill、扩展代码或文档时，先读懂整段或整函数的现有逻辑，将新要求融进去重写成一个连贯整体；**严禁**在末尾追加"补充说明""另外注意""例外：……"等补丁去覆盖或修正前文，旧规则被取代就立即删改原句，同一件事只在一处讲透。
- **最少必要代码（Ponytail 原则）**：避免不必要的抽象、封装与配置项，短小精悍且能一眼看懂的单行优于冗长封装。

---

## 五、门禁、写锁与安全机制

1. **Guard 执行白名单**：
   - Bash 工具仅放行 `skills/` 目录下实际存在的 Python/JS 创作套件脚本以及安全的系统只读命令（如 `dir`, `cat`, `git status`, `node -v` 等）。
   - 阻断所有非白名单系统修改命令，跨工作区写入严格拒绝。
2. **正文定稿保护界限**：
   - 正文定稿以 `_tracking-state.json` 中的 `last_committed_chapter` 为界。
   - 对已定稿章节（小于等于该章号）的修改或删除必须经 `ctx.ui.confirm` 弹窗向作者确认；草稿文件及最新正在推进的章节正常放行。
3. **写锁防竞态安全**：
   - 并发写锁必须绑定具体调用的 `toolCallId`，仅锁持有者能释放锁，防止并发执行时提前解除写保护。

---

## 六、每次修改必跑的守卫清单

在提交任何更改前，必须在本地依次执行并通过以下所有检验：

```bash
# 1. 静态可达性与 Skill 结构检查（14 个 Skill 必须全部 PASS）
python scripts/static-check.py

# 2. 工作流编号规范检查（禁止小数子步骤与错误级联）
python scripts/skill-numbering.py check

# 3. 文档字数预算检查（必须 0 超标 0 报错）
node scripts/run-doc-budget.js

# 4. 决策笔记结构规范检查（.agents/notes 格式规范）
python scripts/check-agent-notes.py

# 5. Pi 智能子代理同步检查（确定性校验）
python scripts/generate-pi-agents.py --check

# 6. Story 核心单测（槽位解析器、写锁并发、短篇大纲计数、UI逻辑）
node --test test/story-agent-resolver.test.mjs test/story-agents-lock.test.mjs test/story-short-outline.test.mjs test/story-ui-logic.test.mjs

# 7. TypeScript 严格类型检查
npx tsc --noEmit

# 8. 代码风格与 ESLint 检查
npm run lint

# 9. 真实路径 5 流一键探针（启动 npm run dev 后运行）
npm run probe
```

---

## 七、Web 服务开发与调试注意事项

### 启动命令
```bash
npm run dev   # 默认监听 127.0.0.1:30141 (Turbopack)
```

- **严禁在开发期运行 `next build`**：它会污染 `.next/` 缓存并导致 `npm run dev` 崩溃。
- **端口冲突排查**：若报端口占用，先通过 `netstat -ano | findstr :30141` 找到 PID 并复用已有健康进程；切勿在不同端口启动第二个实例，否则会争抢 `.next/dev/lock`。
- **Windows 管道陷阱**：在 Windows PowerShell/cmd 下，禁止在 Node/Python 调用中使用复杂 bash heredoc（`<<'EOF'`）或 stdin piping，优先编写临时单测或脚本运行。

---

## 八、核心模块代码地图

```
.pi/
  agents/                  生成的 Pi Agent 定义（只读，勿手改）
  extensions/
    story-gates.ts         小说门禁状态机、上下文注入与工作台 Widget
    story-guard.ts         工具执行白名单与已定稿章节写保护
    story-agents.ts        7 位写手子代理配置挂载与并发写锁

lib/
  story-agent-resolver.ts  动态模型槽位解析器（解耦 MiniMax-M3）
  story-short-outline.ts   短篇小节大纲与正文节数精准计数引擎
  story-paths.ts           安全的工作区目录探测与路径工具

skills/
  story-long-write/        长篇连载写作与细纲装配引擎
  story-short-write/       短篇连载写作与小节大纲引擎
  story-deslop/            三层去AI味润色引擎
  story-setup/             项目初始化与纯净部署引擎

scripts/
  generate-pi-agents.py    Pi Agent 确定性生成器（带 --check 守卫）
  run-doc-budget.js        文档预算自动测量与守卫脚本
  static-check.py          全技能静态结构与引用可达性守卫

test/
  story-agent-resolver.test.mjs 槽位解析与错误提示单测
  story-agents-lock.test.mjs    并发写锁持有权单测
  story-short-outline.test.mjs  短篇大纲计数 A19 三夹具单测

verify-8-flows.mjs         全链路真实路径验收探针（npm run probe）
```
