/**
 * Story Studio 短篇大纲与正文小节计数权威共享 Helper
 *
 * 规范事实源对齐：
 * 1. 小节大纲主表行数：对齐 check-phase2-contract.js，定位含「结构段/五段功能」的主表头，
 *    只数其下连续数据行，排除分隔行，遇非表格行即止，绝不误计后续追加的细纲情节点表或复沓锚句表。
 * 2. 正文小节数：对齐 check-delivery-contract.js，严格匹配规范小节标记样式，
 *    避免将正文内的有序列表（如 "1. 他走出门去"）误判为小节序号。
 */

/**
 * 清理单元格内容
 */
export function cleanTableCell(value: string): string {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

/**
 * 解析表格单行单元格
 */
export function parseTableLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map(cleanTableCell);
}

/**
 * 判断是否为表格分隔线 (如 |---|---| 或 | :---: |)
 */
export function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  const cells = trimmed.slice(1, -1).split("|").map(cleanTableCell);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

/**
 * 从小节大纲.md 正文中计算全篇规划小节总数
 */
export function countShortOutlineSections(outlineText: string): number {
  if (!outlineText) return 0;
  const lines = outlineText.split(/\r?\n/);

  let headerAt = -1;
  for (let i = 0; i < lines.length; i++) {
    const cells = parseTableLine(lines[i]);
    if (cells && cells.length > 0 && cells[0].includes("结构段")) {
      headerAt = i;
      break;
    }
  }

  if (headerAt < 0) return 0;

  let count = 0;
  for (let i = headerAt + 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = parseTableLine(line);
    if (!cells) {
      // 遇到非表格行，主表结束，立即终止（防止误扫后续的独立细纲表格）
      if (count > 0) break;
      continue;
    }
    if (isTableSeparatorRow(line)) continue;
    count++;
  }

  return count;
}

/**
 * 从小节大纲.md 中获取已编写独立细纲块的小节集合（## 第N节）
 */
export function extractShortDetailSections(outlineText: string): Set<number> {
  const details = new Set<number>();
  if (!outlineText) return details;

  const matches = outlineText.matchAll(/^##\s*第\s*(\d+)\s*节/gm);
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    if (num > 0) details.add(num);
  }
  return details;
}

/**
 * 判断一行是否为符合短篇规范的独立小节标记
 * 遵循 short-format.md 与 check-delivery-contract.js:
 * 1. numeric-heading: /^###\s*\d+\.$/
 * 2. zhihu-numeric: /^\d+\.$/
 * 3. chapter-heading: /^###\s*第[一二三四五六七八九十百千万两〇零0-9]+章$/
 * 4. section-heading: /^###\s*第\s*\d+\s*节/
 */
export function extractSectionNumberFromLine(line: string): number | null {
  const trimmed = line.trim();

  // 1. zhihu-numeric: 必须是整行独立的数字+点，如 "1." 或 "12."
  const zhihuMatch = trimmed.match(/^(\d+)\.$/);
  if (zhihuMatch) {
    return parseInt(zhihuMatch[1], 10);
  }

  // 2. numeric-heading: 如 "### 1."
  const numHeadingMatch = trimmed.match(/^###\s*(\d+)\.$/);
  if (numHeadingMatch) {
    return parseInt(numHeadingMatch[1], 10);
  }

  // 3. section-heading / chapter-heading: 如 "### 第1节" 或 "### 第01章"
  const secHeadingMatch = trimmed.match(/^###\s*第\s*(\d+)\s*[章节]/);
  if (secHeadingMatch) {
    return parseInt(secHeadingMatch[1], 10);
  }

  // 中文小节/章节标记: "### 第一节" 等
  const cnMatch = trimmed.match(/^###\s*第([一二三四五六七八九十百千万两〇零0-9]+)[章节]/);
  if (cnMatch) {
    // 粗略数字解析
    const parsed = parseInt(cnMatch[1], 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  return null;
}

/**
 * 从正文.md 中获取已写成正文的小节集合
 */
export function extractShortProseSections(proseText: string): Set<number> {
  const sections = new Set<number>();
  if (!proseText) return sections;

  const lines = proseText.split(/\r?\n/);
  for (const line of lines) {
    const secNum = extractSectionNumberFromLine(line);
    if (secNum !== null && secNum > 0) {
      sections.add(secNum);
    }
  }
  return sections;
}
