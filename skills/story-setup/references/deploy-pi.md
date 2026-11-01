# Pi / Pi Web 写作工作台部署

`target_cli` 含 `pi` 时，由 SKILL.md Phase 2 完整读取并依次执行本文件。路径检查、幂等重跑、残留清理、部署标记、模板占位符、项目指令合并和报告遵循 SKILL.md 的公共规则。

## 部署清单（机械可检查）

| Source path | Target path | Owner class | Merge mode | Validation check |
|-------------|-------------|-------------|------------|------------------|
| `skills/story-setup/references/pi/AGENTS.md.tmpl` | `AGENTS.md` | user+managed | managed block merge | contains Pi Web story skill routing sections |

> 注：Pi Web (Story Studio) 原生在运行时内置挂载 14 个网文技能包、7 位写手子代理配置与 `story-gates.ts` 门禁状态机。写作项目目录与用户主目录无需复制任何 `skills/`、`agents/` 或扩展代码，保证环境与项目绝对纯净。

## Pi / Pi Web 部署算法

Pi Web 运行在 `@agegr/pi-web` 环境中，采用**内部原生内置模式**承载工作台扩展插件与自定义子代理 profiles：

1. 确认 Pi Web 宿主运行时已就绪（14 个网文技能、7 个专用子代理及门禁扩展由宿主内存服务直接提供）。
2. 用 `skills/story-setup/references/pi/AGENTS.md.tmpl` 按 SKILL.md「项目指令合并」写入项目 `AGENTS.md`（`--host pi`）。
3. 清理目标项目中若存在的旧版本本地残留目录（如 `<cwd>/.pi/extensions/`、`<cwd>/extensions/`、`<cwd>/skills/` 等）。
4. 确保目标写作工作区包含 `长篇/` 与 `短篇/` 目录（若不存在则自动创建，保证多书书架与新书立项向导即刻感知列出）。
5. `.story-deployed` 的 `target_cli` 写入 `pi` 或多端组合；`references_dir` 写 `skills/story-setup/references/agent-references`。
6. 安装报告提示项见下方「安装报告必须提示」。

## 验证

- 检查项目 `AGENTS.md` 包含 Pi Web 路由段
- 检查目标工作区 `长篇/` 与 `短篇/` 目录存在

## 安装报告必须提示

部署完成后，Pi Web 已原生激活网文创作引擎与 7 个专用子代理。写作项目目录保持纯净（无需包含代码与扩展文件夹）。请刷新浏览器界面（F5），输入框上方将自动呈现小说工作台 Widget，并在底部状态栏常驻操作按键。
