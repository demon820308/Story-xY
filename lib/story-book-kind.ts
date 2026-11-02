/**
 * 书籍体裁/模式唯一判定模块（M17 单一事实源）
 * 判定顺序：
 *   1. 书内明确标记（bookKind 属性，对应 .book-kind 或状态文件中的明确标记）
 *   2. 结构探测（单文件/小节大纲且无追踪目录为 short；包含正文/大纲目录为 long）
 *   3. 路径兜底（包含 /短篇/ 或 \短篇\ 或 short: 前缀为 short，否则 long）
 */

export type StoryBookKind = "long" | "short";

export interface BookKindTarget {
  id?: string;
  path?: string;
  type?: string;
  bookKind?: StoryBookKind;
  hasOutlineFile?: boolean;
  hasTrackingDir?: boolean;
  hasProseDir?: boolean;
  hasOutlineDir?: boolean;
  isFile?: boolean;
}

export function resolveBookKind(book: BookKindTarget | null | undefined): StoryBookKind {
  if (!book) return "long";

  // 1. 书内明确标记
  if (book.bookKind === "short" || book.bookKind === "long") {
    return book.bookKind;
  }
  if (book.type?.includes("短篇")) {
    return "short";
  }
  if (book.type?.includes("长篇")) {
    return "long";
  }

  // 2. 结构特征探测
  if (book.isFile) {
    return "short";
  }
  if (book.hasOutlineFile && !book.hasTrackingDir) {
    return "short";
  }
  if (book.hasProseDir && book.hasOutlineDir) {
    return "long";
  }

  // 3. 路径兜底
  const path = book.path || "";
  const id = book.id || "";
  if (
    id.startsWith("short:") ||
    path.includes("/短篇/") ||
    path.includes("\\短篇\\") ||
    path.endsWith(".txt") ||
    path.endsWith(".md")
  ) {
    return "short";
  }

  return "long";
}

export function isShortBook(book: BookKindTarget | null | undefined): boolean {
  return resolveBookKind(book) === "short";
}
