# Agent Note: 修复 story-gates 在外部工作区下无法解析共享内核导致状态栏报错

Status: implemented
Date: 2026-11-02

## Problem

在用户使用全局/外部挂载的工作区（如 `G:\Books`）进行小说创作时，Pi 的底部状态栏始终显示：
```
Story状态
📖 当前工作区未检测到活跃书籍 | 请在左侧栏创建新书籍或导入已有小说
```
即使用户工作区根目录下已存在 `.active-book`（如 `短篇/我变成了孙悟空，去西天取经`）且对应短篇/长篇目录与大纲/正文均真实存在，状态栏依然无法识别。

排查发现根本原因：
`.pi/extensions/story-gates.ts` 与 `skills/story-setup/references/pi/extensions/story-gates.ts` 中的 `getCore(root)` 函数负责动态加载底层共享核 `story_hook_core.js`。
当扩展从 `skills/story-setup/references/pi/extensions/` 挂载运行时，原有相对寻址路径 `../../skills/story-setup/references/...` 无法匹配到同级上层的 `templates/hooks/story_hook_core.js`。同时由于外部工作区根目录不包含 `skills/` 或 `.agents/`，导致 `getCore(root)` 返回 `null`。
共享核加载失败导致 `getStoryInfo(root)` 直接回退为 `null`，从而触发空工作区降级文案。

## Decision

1. **补全 `story-gates.ts` 中 `getCore(root)` 候选路径**：
   - 增加扩展自身的相对寻址：`path.resolve(__dirname, "../../templates/hooks/story_hook_core.js")` 与 `../templates/hooks/story_hook_core.js`；
   - 增加宿主进程工作目录（`process.cwd()`）的候选探测：`skills/story-setup/references/templates/hooks/story_hook_core.js` 与 `.agents/hooks/story_hook_core.js`；
   - 保证无论扩展是从 `.pi/extensions/` 还是 `skills/.../references/pi/extensions/` 挂载，无论当前小说会话位于哪个外部盘符或外部工作区，均可无缝唯一定位到共享核。
2. **优化短篇状态栏超长情绪文本截断**：
   - 短篇专属状态栏中，当 `emotion` 超过 20 字符时做自动省略（`...`），防止超长情绪描述挤占状态栏。
3. **补充自动化单测保护**：
   - 在 `test/story-ui-logic.test.mjs` 中增加 `M27` 测试用例，断言从两个挂载目录在外部独立目录（`G:\Books`）下均能 100% 正确命中共享核。

## Alternatives considered

- **在每个外部工作区部署 `.agents/hooks/story_hook_core.js`**：
  - *最强理由*：每个工作区自包含，扩展无须跨目录查找。
  - *为何不用*：严重违背项目定位中的“全局常驻挂载、工作区零冗余污染”原则。用户纯净写书目录不应被强行塞入 hooks 基础设施脚本。

- **硬编码绝对路径**：
  - *最强理由*：直接指向固定路径最为简便。
  - *为何不用*：严重违反零写死（Zero Hardcoding）铁律，无法跨平台与不同开发环境工作。

## Consequences

- **收益**：彻底解决外部工作区下 `story-gates` 无法检测活跃书籍的问题，使状态栏能实时且准确展示短篇小节进度、长篇章节进度与剧情场景。同时恢复了写前细纲门禁与写后正文质检机制在外部工作区下的正常生效。
- **代价**：`getCore` 增加了几个路径探测判定，但首次命中后会缓存为单例（`coreInstance`），对运行时性能零影响。
