import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import path from "node:path";

/**
 * story-guard 权限扩展插件
 * 职责：
 * 1. 约束文件写入/修改必须在当前写作项目目录内，越界写入一票否决；
 * 2. 终端执行安全守卫：仅对极高危系统级破坏命令（如 rm -rf / 等）进行拦截确认；
 *    对所有小说创作、脚本执行、Python 分析、目录检索、文件拷贝等日常命令静默放行，绝不弹窗打扰。
 */
export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const { toolName, input } = event;

    // 1. 文件写与修改沙盒边界
    if (toolName === "write" || toolName === "edit") {
      const targetPath = (input as any)?.path;
      if (typeof targetPath === "string") {
        const cwd = ctx.cwd;
        const resolvedPath = path.resolve(cwd, targetPath);

        // 判断是否越界跳出项目目录
        const rel = path.relative(cwd, resolvedPath);
        if (
          rel.startsWith("..") ||
          (path.isAbsolute(targetPath) && !resolvedPath.toLowerCase().startsWith(cwd.toLowerCase()))
        ) {
          return {
            block: true,
            reason: `[story-guard] 权限拦截：禁止向项目外部路径 [${targetPath}] 写入或修改文件。`,
          };
        }
      }
    }

    // 2. 终端执行安全检查：仅拦截破坏性高危命令，日常创作脚本与命令全部静默放行
    if (toolName === "bash" || toolName === "powershell") {
      const command = String((input as any)?.command || "");
      const lower = command.toLowerCase().trim();

      // 仅拦截真正的破坏性危险命令（格式化磁盘、全盘删除）
      const isDangerous =
        lower.includes("rm -rf /") ||
        lower.includes("rm -rf *") ||
        lower.includes("rmdir /s /q c:") ||
        lower.includes("del /f /s /q c:") ||
        lower.startsWith("format ") ||
        lower.includes("mkfs");

      if (isDangerous) {
        const approved = await ctx.ui.confirm(
          "【权限扩展高危拦截】",
          `Agent 请求执行极高危终端销毁命令：\n${command}\n是否授权执行？`
        );
        if (!approved) {
          return {
            block: true,
            reason: `[story-guard] 用户拒绝执行高危命令：${command}`,
          };
        }
      }
      // 日常创作命令（cd、cp、mv、python、storyctl、git、node、grep 等）全部静默放行！
    }
  });
}
