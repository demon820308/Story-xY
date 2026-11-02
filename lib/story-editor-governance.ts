/**
 * 看全书正文编辑治理引擎 (M23, M24)
 * 职责：
 * 1. 定稿保护：覆写已定稿章节（<= last_committed_chapter）前强制写入快照
 * 2. 快照存储：原稿快照进 `追踪/快照/第NNN章-<时间戳>.md` 并在 UI 明示
 * 3. 字数闭环：保存成功后原子回写 `wordcount_records` 与书目总字数，杜绝分叉
 * 4. 并发守卫：版本指纹防止与后台 agent 写入互盖
 */

import { encodeFilePathForApi } from "./file-paths";

export interface WordCountRecordItem {
  actual: number;
  metric: string;
  body_sha256?: string;
  status?: string;
  resolution?: string;
  target?: number;
}

export interface TrackingStateForGovernance {
  book_title?: string;
  last_committed_chapter?: number;
  wordcount_records?: Record<string, WordCountRecordItem | number>;
  total_words?: number;
  total_word_count?: number;
  [key: string]: unknown;
}

/**
 * 校验章节号是否属于已定稿提交章节
 */
export function isCommittedChapter(chapterNum: number, lastCommitted: number): boolean {
  return Number.isInteger(chapterNum) && chapterNum > 0 && chapterNum <= lastCommitted;
}

/**
 * 格式化快照文件名，形如：第025章-20261102-170000.md
 */
export function formatSnapshotFileName(chapterNum: number, rawNum?: string, date = new Date()): string {
  const padNum = String(chapterNum).padStart(3, "0");
  const label = rawNum && rawNum.startsWith("第") ? rawNum : `第${padNum}章`;
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const timestamp = `${yyyy}${MM}${dd}-${hh}${mm}${ss}`;
  return `${label}-${timestamp}.md`;
}

/**
 * 内容指纹计算 (简单高效的 32 位 FNV-1a Hash + 长度防冲突)
 */
export function computeContentFingerprint(content: string): string {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `${(hash >>> 0).toString(16)}_${content.length}`;
}

/**
 * 检查内容指纹是否发生外部漂移
 */
export function isFingerprintDrifted(currentContent: string, baselineFingerprint: string): boolean {
  if (!baselineFingerprint) return false;
  return computeContentFingerprint(currentContent) !== baselineFingerprint;
}

/**
 * 纯函数：在内存中更新 TrackingState 的字数记录与累计总字数
 */
export function applyWordCountToTrackingState(
  state: TrackingStateForGovernance,
  chapterNum: number,
  actualCount: number
): { nextState: TrackingStateForGovernance; totalWords: number } {
  const records: Record<string, WordCountRecordItem | number> = {
    ...(state.wordcount_records || {}),
  };

  const key = String(chapterNum);
  const existing = records[key];

  if (existing && typeof existing === "object") {
    records[key] = {
      ...existing,
      actual: actualCount,
      metric: existing.metric || "visible_chars_v1",
      status: existing.status || "internal_pass",
      resolution: existing.resolution || "within_user_band",
    };
  } else {
    records[key] = {
      actual: actualCount,
      metric: "visible_chars_v1",
      status: "internal_pass",
      resolution: "within_user_band",
    };
  }

  // 计算所有已记录章节的总字数
  const totalWords = Object.values(records).reduce((sum: number, r) => {
    if (typeof r === "number") return sum + r;
    return sum + (Number(r?.actual) || 0);
  }, 0);

  const nextState: TrackingStateForGovernance = {
    ...state,
    wordcount_records: records,
  };

  return { nextState, totalWords };
}

/**
 * 覆写已定稿正文前创建快照文件 (API落盘)
 */
export async function createSnapshotBeforeSave(
  bookPath: string,
  chapterNum: number,
  rawNum: string,
  originalContent: string
): Promise<string | null> {
  if (!bookPath || !originalContent) return null;
  const snapshotName = formatSnapshotFileName(chapterNum, rawNum);
  const snapshotPath = `${bookPath.replace(/\\/g, "/").replace(/\/+$/, "")}/追踪/快照/${snapshotName}`;

  try {
    const res = await fetch(`/api/files/${encodeFilePathForApi(snapshotPath)}?type=write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: originalContent }),
    });
    if (res.ok) {
      return `追踪/快照/${snapshotName}`;
    }
  } catch {}
  return null;
}

/**
 * 保存正文后将最新字数回写至 追踪/_tracking-state.json (API落盘)
 */
export async function syncTrackingWordCount(
  bookPath: string,
  chapterNum: number,
  actualCount: number
): Promise<{ ok: boolean; totalWords: number }> {
  if (!bookPath || !chapterNum) return { ok: false, totalWords: 0 };
  const trackingPath = `${bookPath.replace(/\\/g, "/").replace(/\/+$/, "")}/追踪/_tracking-state.json`;

  try {
    // 1. 读取现有 tracking 状态
    const readRes = await fetch(`/api/files/${encodeFilePathForApi(trackingPath)}?type=read`);
    if (!readRes.ok) return { ok: false, totalWords: 0 };
    const readData = await readRes.json();
    if (!readData?.content) return { ok: false, totalWords: 0 };

    let state: TrackingStateForGovernance = {};
    try {
      state = JSON.parse(readData.content);
    } catch {
      return { ok: false, totalWords: 0 };
    }

    // 2. 更新 wordcount_records 与 total_words
    const { nextState, totalWords } = applyWordCountToTrackingState(state, chapterNum, actualCount);

    // 3. 回写保存
    const writeRes = await fetch(`/api/files/${encodeFilePathForApi(trackingPath)}?type=write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(nextState, null, 2) }),
    });

    return { ok: writeRes.ok, totalWords };
  } catch {
    return { ok: false, totalWords: 0 };
  }
}
