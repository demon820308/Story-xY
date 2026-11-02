/**
 * 活跃书籍解析与状态推导纯函数模块（M16, M21, M22）
 * 供 UI 组件与独立单测无头运行
 */

export interface BookInfo {
  id: string;
  title: string;
  fullTitle: string;
  type: string;
  status: string;
  statusColor: string;
  desc: string;
  path: string;
  currentChapter: string;
  words: string;
  coverUrl?: string;
  isUninitialized?: boolean;
}

export function makePlaceholderBook(cwd: string | null | undefined): BookInfo {
  return {
    id: `workspace:${cwd || "none"}`,
    title: "暂未立项书籍",
    fullTitle: "暂未立项书籍",
    type: "当前工作区",
    status: "○ 待立项",
    statusColor: "text-[#8a8e9b]",
    desc: "点击立项新书开始创作",
    path: cwd || "",
    currentChapter: "待起笔",
    words: "—",
    isUninitialized: true,
  };
}

/**
 * 提取相对于工作区的统一路径（如 长篇/书名 或 短篇/书名）
 */
export function getBookRelPath(workspace: string, bookPath: string): string {
  if (!bookPath) return "";
  const normWs = workspace.replace(/\\/g, "/").replace(/\/+$/, "");
  const normBp = bookPath.replace(/\\/g, "/");
  if (normWs && normBp.startsWith(normWs + "/")) {
    return normBp.slice(normWs.length + 1);
  }
  return normBp;
}

/**
 * 选书精确解析链（M16 路线 A）：
 * 1. 显式选中 id / 路径 / 标题
 * 2. .active-book 精确相对路径匹配
 * 3. 扫描结果首本
 * 严禁使用模糊包含匹配。
 */
export function resolveActiveBookFromChain(
  books: BookInfo[],
  selectedId: string | null | undefined,
  activeBookRel: string | null | undefined,
  workspaceCwd: string
): BookInfo {
  if (!books || books.length === 0) {
    return makePlaceholderBook(workspaceCwd);
  }

  // 1. 显式选中 id
  if (selectedId) {
    const matched = books.find(
      (b) => b.id === selectedId || b.path === selectedId || b.fullTitle === selectedId
    );
    if (matched) return matched;
  }

  // 2. .active-book 精确匹配
  if (activeBookRel) {
    const cleanRel = activeBookRel.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (cleanRel) {
      const matched = books.find((b) => {
        const rel = getBookRelPath(workspaceCwd, b.path);
        return rel === cleanRel;
      });
      if (matched) return matched;
    }
  }

  // 3. 扫描结果第一本
  return books[0];
}

export interface ShortStatusResult {
  status: string;
  statusColor: string;
  desc: string;
  words: string;
}

/**
 * 短篇状态推导（M21）：
 * 无正文 -> 待构思/待起笔
 * 有正文无精修标记 -> 连载推进中
 * 精修标记存在 -> 精修中
 */
export function deriveShortStatus(
  hasOutline: boolean,
  hasProse: boolean,
  hasRevisionMark = false
): ShortStatusResult {
  if (!hasProse && !hasOutline) {
    return {
      status: "○ 待构思",
      statusColor: "text-[#8a8e9b]",
      desc: "待出小节大纲",
      words: "—",
    };
  }
  if (!hasProse && hasOutline) {
    return {
      status: "○ 待起笔",
      statusColor: "text-[#d97706]",
      desc: "小节大纲已就绪",
      words: "—",
    };
  }
  if (hasProse && !hasRevisionMark) {
    return {
      status: "● 连载推进中",
      statusColor: "text-[#2e7a4c]",
      desc: "正文推进中",
      words: "成文中",
    };
  }
  return {
    status: "● 精修中",
    statusColor: "text-[#0891b2]",
    desc: "Phase 4 精修打磨",
    words: "成稿",
  };
}
