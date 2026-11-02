# Story-xY Studio 开发者与 Antigravity Agent 核心规范

本文件是 Antigravity 作为 coding agent 在本仓库（`story-app` / Story-xY Studio）进行开发、重构、改动与维护时的核心契约。所有行为必须以此为最高准则，严防行为偏移。

---

## 一、三项绝对铁律（红线）

1. **零写死（Zero Hardcoding）**：
   - 严禁硬编码绝对路径（如 `E:/`、`C:/`、`~/`），一律使用相对路径、工作区探测或安全路径工具。
   - 严禁硬编码默认模型（如 `MiniMax-M3`），所有 Agent 模型必须通过槽位化映射（`storySlots`）动态解析，未配置时显式报错，绝不静默回退。
   - 严禁硬编码虚假书目（如 `INITIAL_BOOKS` 或《剑道独尊》），书目与章节必须由真实文件系统扫描生成。
2. **零假报（Zero False Reporting）**：
   - 实行真实路径验收（路线 A）。严禁编写脱离运行时的假测试桩，严禁在服务未就绪时虚假返回 PASS。
   - 探针 `verify-8-flows.mjs` 在 Dev 服务离线时必须明确报错并以非零码（exit 1）退出；只有全链路真实跑通才允许通过。
3. **内核不动（Keep Core Untouched）**：
   - 严禁修改 `@earendil-works/*` SDK 源码或篡改内部类型。
   - 严禁向 Pi 扩展 API（`ctx.ui.*`、`extension_ui_request`）注入专有或私有字段，保持扩展协议完全标准。

---

## 二、Agent 治理与生成纪律

1. **唯一事实源锚定**：
   - `skills/story-setup/references/templates/agents/*.md` 是 7 位写手子代理配置的**唯一语义事实源**。
2. **严禁直接手改派生文件**：
   - 严禁手动编辑 `.pi/agents/*.md` 或 `skills/story-setup/references/pi/agents/*.md`。
   - 任何 Agent 的改动必须先修改 `templates/agents/*.md`，然后运行 `python scripts/generate-pi-agents.py` 重新生成。
3. **编码与格式守卫**：
   - 必须保持严格无 BOM UTF-8 编码，**绝对不允许引入非法字符或 U+FFFD 乱码**。
   - 工具名全小写（如 `read`, `bash`），只读角色（`consistency-checker`, `story-explorer`）严禁授予写权限。
   - Agent 模型声明必须统一使用 `slot:` 槽位声明（如 `slot: writer`、`slot: architect`），严禁使用 `model:`。
4. **CI 强同步卡点**：
   - `python scripts/generate-pi-agents.py --check` 作为 CI 核心卡点，任何未同步修改将直接阻断提交。

---

## 三、代码修改纪律（改写不打补丁）

- **整单元重写，禁止补丁式追加**：修改 skill、扩展代码或文档时，先读懂整段或整函数的现有逻辑，将新要求融进去重写成一个连贯整体；**严禁**在末尾追加"补充说明""另外注意""例外：……"等补丁去覆盖或修正前文，旧规则被取代就立即删改原句，同一件事只在一处讲透。
- **最少必要代码（Ponytail 原则）**：避免不必要的抽象、封装与配置项，短小精悍且能一眼看懂的单行优于冗长封装。

---

## 四、安全门禁与写锁规范

1. **Guard 执行白名单**：
   - Bash 工具仅放行 `skills/` 目录下实际存在的 Python/JS 创作套件脚本以及安全的系统只读命令（如 `dir`, `cat`, `git status`, `node -v` 等）。
   - 阻断所有非白名单系统修改命令，跨工作区写入严格拒绝。
2. **定稿正文保护**：
   - 以 `追踪/_tracking-state.json` 的 `last_committed_chapter` 为界。修改或删除小于等于该章号的正文必须弹出确认；草稿与最新推进章正常放行。
3. **写锁防竞态**：
   - 并发写锁必须携带 `toolCallId`，仅锁持有者能够释放锁。

---

## 五、改动后强制验收流水线（每次必跑）

在任何非琐碎改动完成后，必须在终端依次执行并通过以下守卫：

```bash
python scripts/static-check.py
python scripts/skill-numbering.py check
node scripts/run-doc-budget.js
python scripts/check-agent-notes.py
python scripts/generate-pi-agents.py --check
node --test test/story-agent-resolver.test.mjs test/story-agents-lock.test.mjs test/story-short-outline.test.mjs test/story-ui-logic.test.mjs
npx tsc --noEmit
npm run lint
npm run probe
```

---

## 六、Windows 运行防坑守卫

- Windows 环境下禁止使用 bash heredoc（`<<'EOF'`）或 stdin piping 传参给 python/node，防止 MSYS2 管道死锁；复杂脚本编写独立临时文件运行。
- 单测与探针若在进程退出时报 libuv assertion，必须使用 `process.exitCode = 0;` 让事件循环自然排空，不要强制 `process.exit(0)`。
