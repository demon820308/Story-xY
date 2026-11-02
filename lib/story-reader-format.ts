/**
 * Story Studio 全本阅读器与源码编辑器规范化排版引擎 (M31, M32)
 *
 * 核心契约：
 * 1. 唯一事实源：磁盘纯文本即源码，零所见即所得转换层，零 AST 往返漂移。
 * 2. 正文段落化管线：剥除段首自带全角/半角空格，消除 4em 双重缩进；
 * 3. 结构识别：识别章题、短篇小节标记（对齐 short-format 与 story-short-outline）、场景分隔符，
 *    避免 markdown 引擎将 `---` 错解为 setext 标题或误伤正文。
 */

import { extractSectionNumberFromLine } from "./story-short-outline";

export type ParagraphType = "chapter-title" | "section-title" | "divider" | "text";

export interface NormalizedParagraph {
  type: ParagraphType;
  text: string;
  rawText: string;
  sectionNum?: number;
}

export interface NormalizedNovel {
  mainTitle: string | null;
  paragraphs: NormalizedParagraph[];
  charCount: number; // 去除所有空白后的正文字数
}

/**
 * 判断一行是否为长篇小说章题 (如: 第1章 军宣新星, 第001章, 第1节, 引子, 序章, 尾声 等)
 */
export function isChapterTitleLine(line: string): boolean {
  const trimmed = line.trim().replace(/^#+\s*/, "");
  if (!trimmed) return false;
  return /^(第\s*[\d一二三四五六七八九十百千万]+\s*[章节回集].*|引子.*|序[章言幕].*|尾声.*|番外.*|终章.*|后记.*)$/.test(
    trimmed
  );
}

/**
 * 判断一行是否为场景分隔线 (如: ---, ***, * * *, ——— 等)
 */
export function isSceneDividerLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^([-*_—\s]{3,})$/.test(trimmed) || /^[❖◆◇■□▲△●○★☆\s]{3,}$/.test(trimmed);
}

/**
 * 剥除段落首部的全角空格（　 / \u3000）与半角空格/制表符，
 * 保证正文缩进纯粹由 CSS text-indent: 2em 统一负责，消除正文自带全角空格叠加产生的 4em 双重缩进 (M31.1)
 */
export function stripLeadingIndents(text: string): string {
  return text.replace(/^[　 \t\u3000\u00A0]+/g, "");
}

/**
 * 将小说源码文本按段落化管线处理，输出结构化段落供阅读器与分屏预览渲染
 */
export function normalizeNovelContent(rawText: string): NormalizedNovel {
  if (!rawText) {
    return { mainTitle: null, paragraphs: [], charCount: 0 };
  }

  // 1. 去除 frontmatter (如果有)
  let body = rawText;
  if (body.startsWith("---")) {
    const endMatch = body.slice(3).indexOf("\n---");
    if (endMatch !== -1) {
      body = body.slice(3 + endMatch + 4).trimStart();
    }
  }

  // 2. 字数统计 (去空白)
  const charCount = body.replace(/\s+/g, "").length;

  // 3. 逐行分段与结构识别
  const rawLines = body.split(/\r?\n/);
  const paragraphs: NormalizedParagraph[] = [];
  let mainTitle: string | null = null;
  let hasFoundMainTitle = false;

  let currentBlock: string[] = [];

  const flushBlock = () => {
    if (currentBlock.length === 0) return;
    const joined = currentBlock.join("\n").trim();
    if (!joined) {
      currentBlock = [];
      return;
    }

    const stripped = stripLeadingIndents(joined);
    paragraphs.push({
      type: "text",
      text: stripped,
      rawText: joined,
    });
    currentBlock = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 空行分段
    if (!trimmed) {
      flushBlock();
      continue;
    }

    // 检查首行/首非空块是否为独立章题
    if (!hasFoundMainTitle && paragraphs.length === 0 && currentBlock.length === 0 && isChapterTitleLine(line)) {
      const cleanTitle = trimmed.replace(/^#+\s*/, "");
      mainTitle = cleanTitle;
      hasFoundMainTitle = true;
      paragraphs.push({
        type: "chapter-title",
        text: cleanTitle,
        rawText: line,
      });
      continue;
    }

    // 检查短篇小节标记 (### 1., 1., ### 第1节 等)
    const secNum = extractSectionNumberFromLine(line);
    if (secNum !== null) {
      flushBlock();
      // 小节标题规范化文本: 去除 ### 后的纯净标签
      const displayTag = trimmed.replace(/^###\s*/, "");
      paragraphs.push({
        type: "section-title",
        text: displayTag,
        rawText: line,
        sectionNum: secNum,
      });
      continue;
    }

    // 检查场景分隔线 (---, *** 等)
    if (isSceneDividerLine(line)) {
      flushBlock();
      paragraphs.push({
        type: "divider",
        text: "❖ ❖ ❖",
        rawText: line,
      });
      continue;
    }

    // 普通正文行，放入当前段落块
    currentBlock.push(line);
  }

  flushBlock();

  return {
    mainTitle,
    paragraphs,
    charCount,
  };
}

/**
 * 查找结果匹配项
 */
export interface FindMatch {
  start: number;
  end: number;
  line: number;
}

/**
 * 源码编辑器查找功能
 */
export function findInSource(text: string, query: string, caseSensitive = false): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  const src = caseSensitive ? text : text.toLowerCase();
  const target = caseSensitive ? query : query.toLowerCase();

  let index = 0;
  while ((index = src.indexOf(target, index)) !== -1) {
    // 计算所在行
    const line = text.slice(0, index).split("\n").length;
    matches.push({
      start: index,
      end: index + target.length,
      line,
    });
    index += target.length;
  }
  return matches;
}

/**
 * 替换单个匹配项
 */
export function replaceMatchInSource(text: string, match: FindMatch, replacement: string): string {
  return text.slice(0, match.start) + replacement + text.slice(match.end);
}

/**
 * 全部替换
 */
export function replaceAllInSource(text: string, query: string, replacement: string, caseSensitive = false): string {
  if (!query) return text;
  if (caseSensitive) {
    return text.replaceAll(query, replacement);
  }
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return text.replace(regex, replacement);
}
