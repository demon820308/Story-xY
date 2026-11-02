import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface BookWriteLockHolder {
  toolCallId: string;
  targetPath: string;
}

// 内存书目写锁，按 bookKey 记录当前持锁的 toolCallId，解决并发竞态
const bookWriteHolders = new Map<string, BookWriteLockHolder>();

export function checkAndAcquireBookWriteLock(
  bookKey: string,
  targetPath: string,
  callId: string
): { success: boolean; reason?: string } {
  const normPath = targetPath.replace(/\\/g, "/");
  const isProtected = normPath.includes("正文/") || normPath.includes("_tracking-state.json");
  if (!isProtected) {
    return { success: true };
  }

  const currentHolder = bookWriteHolders.get(bookKey);
  if (currentHolder && currentHolder.toolCallId !== callId) {
    return {
      success: false,
      reason: `【并发写锁拦截】当前书目正在由其他写手任务落盘 (${currentHolder.targetPath})，请等待其写入完成后再提交新章！`,
    };
  }

  // 获取锁
  bookWriteHolders.set(bookKey, { toolCallId: callId, targetPath });
  return { success: true };
}

export function releaseBookWriteLock(bookKey: string, callId?: string): boolean {
  const currentHolder = bookWriteHolders.get(bookKey);
  if (!currentHolder) return false;

  // 严格要求只有锁的持有者自身调用结束时方可解锁
  if (callId && currentHolder.toolCallId !== callId) {
    return false; // 他人结果不能解别人的锁
  }

  bookWriteHolders.delete(bookKey);
  return true;
}

export interface EditorialRole {
  roleId: string;
  title: string;
  slot: "architect" | "writer" | "reviewer" | "runner";
  description: string;
  isReadOnly: boolean;
}

export const EDITORIAL_ROLES: EditorialRole[] = [
  { roleId: "story-architect", title: "策划编辑 (架构师)", slot: "architect", description: "卷纲、细纲与全书结构裁决", isReadOnly: false },
  { roleId: "narrative-writer", title: "正文执笔 (写手)", slot: "writer", description: "正文流式生成与局部修补", isReadOnly: false },
  { roleId: "character-designer", title: "人设编辑", slot: "architect", description: "人设建立与角色弧线核验", isReadOnly: false },
  { roleId: "consistency-checker", title: "审稿编辑 (一致性)", slot: "reviewer", description: "前后文伏笔账本与连续性校对", isReadOnly: true },
  { roleId: "story-explorer", title: "资料员 (检索)", slot: "runner", description: "前文设定与历史情节点检索", isReadOnly: true },
  { roleId: "story-researcher", title: "资料员 (调研)", slot: "runner", description: "专业背景与现实资料库检索", isReadOnly: true },
  { roleId: "chapter-extractor", title: "资料员 (拆解)", slot: "runner", description: "爆款拆文与黄金三章结构提取", isReadOnly: true },
];

/**
 * story-agents 编辑部与子代理调度扩展
 * 职责：
 * 1. 维护 7 个定职角色与槽位映射；
 * 2. 保证单本书的正文写入排他锁（按 toolCallId 安全管理持有者，防并发冲突）；
 * 3. 向工作台暴露「编辑部条」人话工作状态。
 */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("editorial-team", {
    description: "查看编辑部分工与当前运行角色",
    handler: async (args, ctx) => {
      const summary = EDITORIAL_ROLES.map(r => `• ${r.title}: ${r.description} (槽位: ${r.slot})`).join("\n");
      ctx.ui.notify(`编辑部 7 位成员已在岗：\n${summary}`, "info");
    },
  });

  // 写入锁控制
  pi.on("tool_call", async (event, ctx) => {
    const { toolName, input } = event;
    if (toolName === "write" || toolName === "edit") {
      const targetPath = String((input as any)?.path || "");
      const callId = String((event as any)?.toolCallId || (event as any)?.id || targetPath);
      const bookKey = ctx.cwd || process.cwd();

      const result = checkAndAcquireBookWriteLock(bookKey, targetPath, callId);
      if (!result.success) {
        return {
          block: true,
          reason: result.reason,
        };
      }
    }
    return undefined;
  });

  // 写入结束后只有对应持有者解锁
  pi.on("tool_result", async (event, ctx) => {
    const bookKey = ctx.cwd || process.cwd();
    const callId = (event as any)?.toolCallId || (event as any)?.id;
    releaseBookWriteLock(bookKey, callId);
  });
}
