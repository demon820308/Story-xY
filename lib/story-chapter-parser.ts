/**
 * 小说章节解析与数字规范化统一模块 (M26)
 * 收敛阅读器、侧边栏、动作条与书籍状态中的多套解析逻辑为单一事实源
 */

const CHINESE_DIGIT_MAP: Record<string, number> = {
  "零": 0, "〇": 0,
  "一": 1, "壹": 1,
  "二": 2, "贰": 2, "两": 2,
  "三": 3, "叁": 3,
  "四": 4, "肆": 4,
  "五": 5, "伍": 5,
  "六": 6, "陆": 6,
  "七": 7, "柒": 7,
  "八": 8, "捌": 8,
  "九": 9, "玖": 9,
};

/**
 * 将中文数字（一至万）解析为阿拉伯整数
 */
export function parseChineseNumber(str: string): number {
  const trimmed = str.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  let total = 0;
  let temp = 0;
  let unit = 1;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (CHINESE_DIGIT_MAP[char] !== undefined) {
      temp = CHINESE_DIGIT_MAP[char];
      if (i === trimmed.length - 1) {
        total += temp;
      }
    } else if (char === "十" || char === "拾") {
      unit = 10;
      total += (temp === 0 ? 1 : temp) * unit;
      temp = 0;
    } else if (char === "百" || char === "佰") {
      unit = 100;
      total += temp * unit;
      temp = 0;
    } else if (char === "千" || char === "仟") {
      unit = 1000;
      total += temp * unit;
      temp = 0;
    } else if (char === "万") {
      total = (total + temp) * 10000;
      temp = 0;
    }
  }

  return total > 0 ? total : 1;
}

export interface ChapterItem {
  fileName: string;
  fullPath: string;
  title: string;
  chapterNum: number;
  rawNum: string;
}

/**
 * 排除非正文成稿的规划与辅助文件
 */
export function isNonProseFileName(fileName: string): boolean {
  const nameWithoutExt = fileName.replace(/\.(md|txt|markdown)$/i, "");
  return /(细纲|大纲|逐章记录|摘要|时间线|设定|草稿|架构)/.test(nameWithoutExt);
}

/**
 * 从文件名与路径中统一提取章节信息 (M26)
 */
export function extractChapterInfo(fileName: string, fullPath: string): ChapterItem | null {
  const nameWithoutExt = fileName.replace(/\.(md|txt|markdown)$/i, "");

  // 1. 排除非正文成稿文件
  if (isNonProseFileName(fileName)) {
    return null;
  }

  // 2. 短篇成稿
  if (nameWithoutExt === "正文") {
    return {
      fileName,
      fullPath,
      title: "短篇正文成稿",
      chapterNum: 1,
      rawNum: "全篇",
    };
  }

  // 3. 匹配长篇章节，如：第001章、第1章、第25章_别做成晚会、第1节、第二十五章 等
  const match = nameWithoutExt.match(/^第\s*(\d+|[零〇一壹二贰两三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万]+)\s*([章节回集])(.*)$/);
  if (match) {
    const rawNumStr = match[1];
    const unit = match[2];
    const titlePart = match[3]?.replace(/^[_\s-]+/, "") || "";
    const num = /^\d+$/.test(rawNumStr) ? parseInt(rawNumStr, 10) : parseChineseNumber(rawNumStr);
    const formattedNum = String(num).padStart(3, "0");
    const label = `第${formattedNum}${unit}`;

    return {
      fileName,
      fullPath,
      title: titlePart || label,
      chapterNum: num,
      rawNum: label,
    };
  }

  return {
    fileName,
    fullPath,
    title: nameWithoutExt,
    chapterNum: 9999,
    rawNum: nameWithoutExt,
  };
}

/**
 * 从文件名或任意文本中提取章号整数
 */
export function extractChapterNumber(nameOrPath: string): number | null {
  if (!nameOrPath) return null;
  const basename = nameOrPath.split("/").pop()?.split("\\").pop() || nameOrPath;

  // 匹配第几章/节/回
  const m1 = basename.match(/第\s*(\d+|[零〇一壹二贰两三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万]+)\s*[章节回集]/);
  if (m1) {
    return /^\d+$/.test(m1[1]) ? parseInt(m1[1], 10) : parseChineseNumber(m1[1]);
  }

  // 匹配细纲
  const m2 = basename.match(/细纲[_-]+(\d+|[零〇一壹二贰两三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万]+)/);
  if (m2) {
    return /^\d+$/.test(m2[1]) ? parseInt(m2[1], 10) : parseChineseNumber(m2[1]);
  }

  // 匹配带点前缀 (如 01. 标题)
  const m3 = basename.match(/^(\d+)\./);
  if (m3) {
    return parseInt(m3[1], 10);
  }

  return null;
}
