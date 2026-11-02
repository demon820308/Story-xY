---
trigger: always_on
---

# Story-xY Studio 仓库开发与检验规范 (Antigravity Agent)

本规则是 Antigravity 作为 coding agent 维护和开发 Story-xY Studio（`story-app` 仓库）时的核心纪律与检验契约。每次修改代码、Skill、Agent 或扩展前必须严格遵守，防止行为偏移。

## 一、三项绝对铁律

1. **零写死（Zero Hardcoding）**：
   - 严禁硬编码绝对路径（如 `E:/`、`C:/`、`~/`），一律使用相对路径、工作区动态解析或安全路径工具（`lib/story-paths.ts`）。
   - 严禁硬编码默认大模型（如 `MiniMax-M3`），所有 Agent 模型必须通过 `lib/story-agent-resolver.ts` 走槽位绑定（`storySlots`）；未配置时抛出清晰报错，绝不静默回退。
   - 严禁硬编码假书目或示例数据（如 `INITIAL_BOOKS` 或《剑道独尊》），书目与章节全部由真实文件系统扫描生成。
2. **零假报（Zero False Reporting）**：
   - 坚持真实路径验收（路线 A）。严禁编写脱离实际服务的假测试桩，严禁在服务未就绪时虚假返回 PASS。
   - 探针 `verify-8-flows.mjs` 必须在 Dev 服务离线时明确报错并以非零码（exit 1）退出；只有全链路真实跑通才算通过。
3. **内核不动（Keep Core Untouched）**：
   - 严禁修改 `@earendil-works/*` SDK 源码或篡改内部类型。
   - 严禁向 Pi 扩展 API 注入任何专有字段，保持扩展协议完全标准。

## 二、Agent 治理与生成纪律

1. **唯一事实源**：
   - `skills/story-setup/references/templates/agents/*.md` 是 7 位写手子代理配置的唯一语义源头。
2. **严禁手改派生**：
   - 严禁手动编辑 `.pi/agents/*.md` 或 `skills/story-setup/references/pi/agents/*.md`。
   - 凡有 Agent 提示词或属性修改，必须改 `templates/agents/` 原文，然后运行 `python scripts/generate-pi-agents.py` 重新生成。
3. **格式与编码红线**：
   - 严格无 BOM UTF-8，禁止任何非法编码或 U+FFFD 乱码。
   - 工具名全小写（如 `read`, `bash`）；只读角色（`consistency-checker`, `story-explorer`）严禁拥有 `write` / `edit` 权限。
   - Agent 模型声明统一使用 `slot:`（如 `slot: writer`），严禁使用 `model:`。
4. **同步守卫**：
   - 提交前必须通过 `python scripts/generate-pi-agents.py --check`，任何未同步修改阻断提交。

## 三、代码编写与修改规范（改写不打补丁）

- **整单元重写**：修改 skill、agent 模板、扩展代码或文档前，先完整读懂当前段落/函数的逻辑，把新要求融进去重写成连贯整体。
- **禁止补丁式追加**：严禁在文末追加"补充说明""另外注意""例外：……"等补丁去覆盖前文；被取代的旧逻辑直接从原处删改，同一件事只在一处讲透。读者不需要拼接前后文来推导正确做法。
- **最少必要代码（Ponytail 原则）**：不增加未要求的抽象层、包装器或配置项。短小精炼且一眼看懂的代码优于过度工程。

## 四、安全门禁与写锁规范

1. **Guard 白名单**：
   - Bash 工具仅放行 `skills/` 下实际存在的创作脚本与系统只读命令，拦截所有非白名单系统修改与跨工作区写入。
2. **定稿正文保护**：
   - 以 `追踪/_tracking-state.json` 的 `last_committed_chapter` 为界。修改或删除小于等于该章号的正文必须弹出确认；草稿与最新推进章正常放行。
3. **写锁防竞态**：
   - 并发写锁必须携带 `toolCallId`，仅锁持有者能够释放锁。

## 五、改动后强制验收清单（每次必跑）

在任何非琐碎改动完成后，必须在终端依次执行并通过以下守卫：

1. `python scripts/static-check.py` —— 14 个 Skill 结构、引用与可达性全 PASS
2. `python scripts/skill-numbering.py check` —— 工作流 Step/Phase 编号与引用契约全 PASS
3. `node scripts/run-doc-budget.js` —— 文档去空白字数预算 0 超标 0 报错
4. `python scripts/check-agent-notes.py` —— 决策笔记结构与分类规范全 OK
5. `python scripts/generate-pi-agents.py --check` —— Pi Agent 确定性与模板一致性全 OK
6. `node --test test/story-agent-resolver.test.mjs test/story-agents-lock.test.mjs test/story-short-outline.test.mjs` —— 核心单测全绿
7. `npx tsc --noEmit` —— TypeScript 严格类型检查 0 错误
8. `npm run lint` —— ESLint 检查 0 错误
9. `npm run probe` —— 真实路径 5 流一键探针（Dev 服务运行下 5 流全绿）

## 六、Windows 运行防坑守卫

- Windows 环境下禁止使用 bash heredoc（`<<'EOF'`）或 stdin piping 传参给 python/node，防止 MSYS2 管道死锁；复杂脚本编写独立临时文件运行。
- 单测与探针若在进程退出时报 libuv assertion，必须使用 `process.exitCode = 0;` 让事件循环自然排空，不要强制 `process.exit(0)`。
