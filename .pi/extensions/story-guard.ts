import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import fs from "node:fs";

/**
 * 检查正文文件是否属于已定稿章节（章节号 <= last_committed_chapter）
 */
function isCommittedProseFile(cwd: string, targetPath: string): boolean {
  try {
    const norm = targetPath.replace(/\\/g, "/");
    if (!norm.includes("/正文/") && !norm.startsWith("正文/")) {
      return false;
    }

    const m = norm.match(/第(\d+)章/);
    if (!m) return false;
    const chapNum = parseInt(m[1], 10);

    const trackingFile = path.resolve(cwd, "追踪", "_tracking-state.json");
    if (!fs.existsSync(trackingFile)) return false;

    const raw = fs.readFileSync(trackingFile, "utf-8");
    const state = JSON.parse(raw);
    const lastCommitted = Number(state.last_committed_chapter) || 0;
    return chapNum > 0 && chapNum <= lastCommitted;
  } catch {
    return false;
  }
}

/**
 * 判断命令是否属于只读安全的系统命令或只读 git 子命令
 */
function isReadOnlyCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  const lower = trimmed.toLowerCase();

  // 基础只读系统命令
  const readOnlyPrefixes = [
    "ls", "dir", "cat", "type", "head", "tail", "more",
    "grep", "rg", "findstr", "pwd", "echo", "cd"
  ];
  for (const prefix of readOnlyPrefixes) {
    if (lower === prefix || lower.startsWith(prefix + " ")) {
      // 避免重定向写操作 (如 echo ... > file 或 cat ... >> file)
      if (!lower.includes(">")) {
        return true;
      }
    }
  }

  // 只读 git 命令
  if (lower.startsWith("git ")) {
    const gitSub = lower.slice(4).trim();
    const readOnlyGit = ["status", "diff", "log", "branch", "show", "rev-parse"];
    for (const sub of readOnlyGit) {
      if (gitSub === sub || gitSub.startsWith(sub + " ")) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 判断是否属于 Story-xY 创作套件内置支持的脚本
 */
function isStoryScriptCommand(cmd: string): boolean {
  const lower = cmd.toLowerCase().replace(/\\/g, "/");
  // 必须是解释器且调用落在 skills 目录下的已知脚本
  const isInterpreter = /^(python\d?|py|node|bash|sh)\s+/.test(lower);
  if (!isInterpreter && !lower.startsWith("storyctl")) {
    return false;
  }

  const allowedScripts = [
    "storyctl",
    "tracking_commit",
    "story_hook_cli",
    "wordcount",
    "static-check",
    "skill-numbering",
    "check-delivery-contract",
    "check-phase2-contract",
    "check-doc-budget",
  ];

  return allowedScripts.some(script => lower.includes(script));
}

/**
 * story-guard 权限扩展插件
 * 遵循《Story-xY × Pi 壳方案》§4.3 白名单与破坏性操作确认原则
 */
export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const { toolName, input } = event;
    const cwd = ctx.cwd || process.cwd();

    // 1. 文件写与修改沙盒边界
    if (toolName === "write" || toolName === "edit") {
      const targetPath = (input as any)?.path;
      if (typeof targetPath === "string") {
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

        // 破坏性操作检查：覆盖已定稿正文必须弹窗确认
        if (fs.existsSync(resolvedPath) && isCommittedProseFile(cwd, targetPath)) {
          const fileName = path.basename(targetPath);
          const approved = await ctx.ui.confirm(
            "【正文定稿修改确认】",
            `即将修改或覆盖已定稿的历史正文章节：\n${fileName}\n是否确认修改？`
          );
          if (!approved) {
            return {
              block: true,
              reason: `[story-guard] 用户取消了对已定稿正文 [${fileName}] 的修改操作。`,
            };
          }
        }
      }
    }

    // 2. 终端执行白名单与破坏性操作检查
    if (toolName === "bash" || toolName === "powershell") {
      const command = String((input as any)?.command || "").trim();
      const lower = command.toLowerCase();

      // 破坏性删除操作必须经用户确认
      const isDestructive =
        lower.includes("rm ") ||
        lower.includes("del ") ||
        lower.includes("rmdir ") ||
        lower.includes("git reset --hard") ||
        lower.includes("git clean");

      if (isDestructive) {
        const approved = await ctx.ui.confirm(
          "【破坏性操作确认】",
          `Agent 请求执行可能删除文件或重置状态的操作：\n是否授权执行该终端命令？`
        );
        if (!approved) {
          return {
            block: true,
            reason: `[story-guard] 用户拒绝执行破坏性终端命令。`,
          };
        }
        return undefined;
      }

      // 白名单判定：只读命令或内置创作脚本
      if (isReadOnlyCommand(command) || isStoryScriptCommand(command)) {
        return undefined; // 白名单放行
      }

      // 白名单外其余一切命令一律拦截，回传人话原因
      return {
        block: true,
        reason: `[story-guard] 安全拦截：终端命令不在小说工作台白名单中。工作台仅允许执行 Story 创作套件内置脚本及安全只读命令。`,
      };
    }

    return undefined;
  });
}
