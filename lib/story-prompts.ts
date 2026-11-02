/**
 * 写作系统提示词唯一源头（M18 单一事实源与契约对齐）
 * 全应用禁止在组件内手写 `/story-` 字符串字面量。
 */

function formatRelPath(relPath?: string): string {
  if (!relPath) return "";
  const clean = relPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return clean ? `（路径: ${clean}）` : "";
}

/**
 * 工作区环境初始化提示词（M20 统一口径）
 */
export function buildWorkspaceInitPrompt(): string {
  return "运行 /story-setup（宿主: pi，应用内置注入模式），在工作区建立长篇/短篇目录结构。";
}

/**
 * 新书立项提示词（M21 骨架已建口径）
 */
export function buildNewBookPrompt(
  kind: "long" | "short",
  bookTitle: string,
  relPath?: string,
  genre?: string,
  hook?: string
): string {
  const pathPart = formatRelPath(relPath);
  const genrePart = genre ? `（题材：${genre}）` : "";
  const hookPart = hook?.trim() ? `：核心梗：“${hook.trim()}”` : "";

  if (kind === "short") {
    return `/story-short-write 新书立项《${bookTitle}》${pathPart}${genrePart}${hookPart}。骨架已建，按 Phase 2 契约输出 设定.md 与 小节大纲.md（12 列全篇粗纲表），执行 check-phase2-contract 验收，完成后停下待确认。`;
  }
  return `/story-long-write 新书立项《${bookTitle}》${pathPart}${genrePart}${hookPart}。骨架已建，按 workflow-outline 输出第1卷卷纲架构与前3章细纲推演计划，完成后停下待确认。`;
}

/**
 * 长篇细纲提示词（M18 契约版：九字段模板 + 情节点表 + check-outline-contract）
 */
export function buildLongOutlinePrompt(
  bookTitle: string,
  relPath: string | undefined,
  chapterNum: number
): string {
  const padNum = String(chapterNum).padStart(3, "0");
  const pathPart = formatRelPath(relPath);
  return `/story-long-write 为《${bookTitle}》${pathPart}按 workflow-outline 出第${padNum}章细纲，过 check-outline-contract 验收，只出本章，完成后停下待确认。`;
}

/**
 * 长篇正文提示词（M18 契约版：单章纪律、三层去味、门禁自检）
 */
export function buildLongWritePrompt(
  bookTitle: string,
  relPath: string | undefined,
  chapterNum: number
): string {
  const padNum = String(chapterNum).padStart(3, "0");
  const pathPart = formatRelPath(relPath);
  return `/story-long-write 依据《${bookTitle}》${pathPart}第${padNum}章细纲推进正文：仅撰写该单章，严格执行去AI味三层规范与门禁自检，写完提交追踪后立即停下交付，不连写后续章节。`;
}

/**
 * 长篇卷纲提示词（侧栏引导）
 */
export function buildLongVolumeOutlinePrompt(
  bookTitle: string,
  relPath?: string
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-long-write 为《${bookTitle}》${pathPart}推演第1卷卷纲：明确核心爽点与主线目标，规划前3章冲突节拍与金手指激活契机，完成后停下。`;
}

/**
 * 短篇构思与小节大纲初始化提示词（M18 契约版：12 列全篇粗纲表）
 */
export function buildShortOutlinePrompt(
  bookTitle: string,
  relPath?: string
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-short-write 为《${bookTitle}》${pathPart}完成构思：输出 设定.md 与 小节大纲.md（12 列全篇粗纲表，执行 check-phase2-contract 验收），完成后停下待确认。`;
}

/**
 * 短篇逐节大纲修订提示词（M18 契约版：修订小节大纲第 N 行）
 */
export function buildShortSectionOutlinePrompt(
  bookTitle: string,
  relPath: string | undefined,
  sectionNum: number
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-short-write 为《${bookTitle}》${pathPart}修订小节大纲第 ${sectionNum} 行（补齐该行九列要素：节拍类型、出场角色、核心悬念与动作推进），只改小节大纲不写正文。`;
}

/**
 * 短篇正文推进提示词（M18 契约版：锚定小节大纲第 N 行＋设定.md）
 */
export function buildShortWritePrompt(
  bookTitle: string,
  relPath: string | undefined,
  sectionNum: number
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-short-write 依据 设定.md 与 小节大纲.md 第 ${sectionNum} 行要素，推进《${bookTitle}》${pathPart}第 ${sectionNum} 节正文写入 正文.md，执行格式与因果自检，写完本节停下交付。`;
}

/**
 * 短篇导语与开篇提示词（侧栏引导）
 */
export function buildShortLeadPrompt(
  bookTitle: string,
  relPath?: string
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-short-write 依据 设定.md 与 小节大纲.md 第 1 行要素，撰写《${bookTitle}》${pathPart}导语与第1节正文：交代起因与核心冲突，执行短篇格式自检并停下交付。`;
}

/**
 * 短篇 Phase 4 精修打磨提示词
 */
export function buildShortRevisionPrompt(
  bookTitle: string,
  relPath?: string
): string {
  const pathPart = formatRelPath(relPath);
  return `/story-short-write 对《${bookTitle}》${pathPart}执行 Phase 4 精修打磨（去AI味、事实一致性检查与交付字数验收）。`;
}

/**
 * 文本去AI味清洗提示词（阅读器/文件查看器）
 */
export function buildDeslopPrompt(text: string, label?: string): string {
  if (label) {
    return `/story-deslop 对当前${label}成稿正文运行二次三层去AI味清洗：过滤模式化口癖、机械排比与空洞说教。`;
  }
  return `/story-deslop 对以下正文段落（${text.length}字）执行三层去AI味清洗：\n"${text}"`;
}

/**
 * 对抗性审查核验提示词（阅读器/文件查看器）
 */
export function buildReviewPrompt(text: string, label?: string): string {
  if (label) {
    return `/story-review 对抗性审查${label}成稿：核验事实一致性（S1-S4）、角色人设OOC、伏笔闭环与时间线。`;
  }
  return `/story-review 对以下手改段落核验因果与伏笔一致性：\n"${text}"`;
}

/**
 * 封面插图生成提示词
 */
export function buildCoverPrompt(bookTitle: string, relPath?: string): string {
  const pathPart = formatRelPath(relPath);
  return `/story-cover 为《${bookTitle}》${pathPart}构思并生成高质量竖版小说封面插图。`;
}

/**
 * 外部小说文件导入提示词
 */
export function buildImportBookPrompt(filePath: string, bookTitle: string): string {
  return `/story-import 导入小说文件 "${filePath}"（目标书名：《${bookTitle}》）：自动执行章节切分、提取轻量事实、反推人物动机链与伏笔初始状态。`;
}

/**
 * 核心设定生成提示词（M34 空状态一键动作，无内部黑话）
 */
export function buildGenerateSettingsPrompt(
  kind: "long" | "short",
  bookTitle: string,
  relPath?: string
): string {
  const pathPart = formatRelPath(relPath);
  if (kind === "short") {
    return `/story-short-write 为《${bookTitle}》${pathPart}构思核心支点与人设速写：输出 设定.md 与对标要素，完成后停下待确认。`;
  }
  return `/story-long-write 为《${bookTitle}》${pathPart}构建核心设定体系：在 设定/ 目录下输出题材定位、世界观架构与首批核心角色人设，完成后停下。`;
}

/**
 * 追踪骨架初始化提示词（M35 空状态一键动作）
 */
export function buildGenerateTrackingPrompt(bookTitle: string, relPath?: string): string {
  const pathPart = formatRelPath(relPath);
  return `/story-long-write 为《${bookTitle}》${pathPart}初始化追踪骨架：生成 追踪/_tracking-state.json 与全景看板、伏笔雷达初始文档，完成后停下。`;
}

