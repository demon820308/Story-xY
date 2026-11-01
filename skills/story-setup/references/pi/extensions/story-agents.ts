import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// 内存书目写锁，进程崩溃自动释放，避免死锁
const bookWriteLocks = new Set<string>();

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
 * 2. 保证单本书的正文写入排他锁（In-Memory Book Lock）；
 * 3. 向工作台暴露「编辑部条」人话工作状态。
 */
export default function (pi: ExtensionAPI) {
  // 注册获取当前编辑部角色列表的命令
  pi.registerCommand("editorial-team", {
    description: "查看编辑部分工与当前运行角色",
    handler: async (args, ctx) => {
      const summary = EDITORIAL_ROLES.map(r => `• ${r.title}: ${r.description} (槽位: ${r.slot})`).join("\n");
      ctx.ui.notify(`编辑部 7 位成员已在岗：\n${summary}`, "info");
    }
  });

  // 写入锁控制
  pi.on("tool_call", async (event, ctx) => {
    const { toolName, input } = event;
    if (toolName === "write" || toolName === "edit") {
      const targetPath = String((input as any)?.path || "");
      if (targetPath.includes("正文/") || targetPath.includes("_tracking-state.json")) {
        const bookKey = ctx.cwd;
        if (bookWriteLocks.has(bookKey)) {
          // 当前书正在被另一个写入任务占用
          return {
            block: true,
            reason: `【并发写锁】当前书目正在由其他写手任务落盘，请等待本章写入完成后再提交新章！`
          };
        }
        // 上锁
        bookWriteLocks.add(bookKey);
      }
    }
  });

  // 写入结束后解锁
  pi.on("tool_result", async (event, ctx) => {
    const bookKey = ctx.cwd;
    bookWriteLocks.delete(bookKey);
  });
}
