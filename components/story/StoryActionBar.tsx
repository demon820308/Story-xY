"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";

interface StoryActionBarProps {
  onInsertPrompt: (prompt: string) => void;
  chapterIndex?: number;
  cwd?: string | null;
}

function extractChapterNumber(name: string): number | null {
  const m1 = name.match(/第\s*0*(\d+)\s*[章节回]/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = name.match(/细纲[_-]+0*(\d+)/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

export const StoryActionBar = memo(function StoryActionBar({
  onInsertPrompt,
  chapterIndex,
  cwd,
}: StoryActionBarProps) {
  const { activeBook } = useActiveBook(cwd);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [existingOutlines, setExistingOutlines] = useState<Set<number>>(new Set());
  const [existingChapters, setExistingChapters] = useState<Set<number>>(new Set());

  // 短篇特有状态
  const [shortHasSettings, setShortHasSettings] = useState(false);
  const [shortHasOutlineFile, setShortHasOutlineFile] = useState(false);
  const [shortOutlineRows, setShortOutlineRows] = useState<number>(0);
  const [shortDetailSections, setShortDetailSections] = useState<Set<number>>(new Set());
  const [shortProseSections, setShortProseSections] = useState<Set<number>>(new Set());

  const isShort = useMemo(() => {
    if (!activeBook) return false;
    return (
      activeBook.id?.startsWith("short:") ||
      activeBook.type?.includes("短篇") ||
      activeBook.path?.includes("/短篇/") ||
      activeBook.path?.includes("\\短篇\\")
    );
  }, [activeBook]);

  // 1. 从当前活跃书籍自动解析最新待写章/节号
  const autoNextChapter = useMemo(() => {
    if (!activeBook || activeBook.isUninitialized) return 1;
    if (isShort) {
      if (shortOutlineRows > 0) {
        // 找到尚未写正文的最小节号
        for (let i = 1; i <= shortOutlineRows; i++) {
          if (!shortProseSections.has(i)) return i;
        }
        return shortOutlineRows;
      }
      return 1;
    }
    const match = activeBook.currentChapter?.match(/第?(\d+)章?/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > 0 ? num + 1 : 1;
    }
    return 1;
  }, [activeBook, isShort, shortOutlineRows, shortProseSections]);

  // 2. 扫描当前书目已有的细纲与正文章节/小节
  useEffect(() => {
    if (!activeBook || activeBook.isUninitialized || !activeBook.path) {
      setExistingOutlines(new Set());
      setExistingChapters(new Set());
      setShortHasSettings(false);
      setShortHasOutlineFile(false);
      setShortOutlineRows(0);
      setShortDetailSections(new Set());
      setShortProseSections(new Set());
      return;
    }

    let isCancelled = false;
    const basePath = activeBook.path.replace(/\\/g, "/").replace(/\/+$/, "");

    if (isShort) {
      const fetchShortStatus = async () => {
        try {
          const listRes = await fetch(`/api/files/${encodeFilePathForApi(basePath)}?type=list`);
          if (!listRes.ok || isCancelled) return;
          const listData = await listRes.json();
          const entries = Array.isArray(listData?.entries) ? listData.entries : [];
          const hasSettings = entries.some((e: { name: string }) => e.name === "设定.md");
          const hasOutline = entries.some((e: { name: string }) => e.name === "小节大纲.md");
          const hasProse = entries.some((e: { name: string }) => e.name === "正文.md");

          if (isCancelled) return;
          setShortHasSettings(hasSettings);
          setShortHasOutlineFile(hasOutline);

          let outlineRowsCount = 0;
          const details = new Set<number>();
          if (hasOutline) {
            const outlineRes = await fetch(`/api/files/${encodeFilePathForApi(`${basePath}/小节大纲.md`)}?type=read`);
            if (outlineRes.ok && !isCancelled) {
              const outlineData = await outlineRes.json();
              const text = outlineData?.content || "";
              const lines = text.split(/\r?\n/);
              // 计算粗纲表的数据行数（排除表头和分隔线）
              let inTable = false;
              for (const line of lines) {
                const tr = line.trim();
                if (tr.startsWith("|") && tr.includes("结构段/五段功能")) {
                  inTable = true;
                  continue;
                }
                if (inTable) {
                  if (!tr.startsWith("|")) {
                    inTable = false;
                  } else if (!/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(tr)) {
                    outlineRowsCount++;
                  }
                }
              }

              // 扫描已存在的 ## 第N节
              const sectionMatches = text.matchAll(/^##\s*第\s*(\d+)\s*节/gm);
              for (const m of sectionMatches) {
                const sec = parseInt(m[1], 10);
                if (sec > 0) details.add(sec);
              }
            }
          }

          const proseSecs = new Set<number>();
          if (hasProse) {
            const proseRes = await fetch(`/api/files/${encodeFilePathForApi(`${basePath}/正文.md`)}?type=read`);
            if (proseRes.ok && !isCancelled) {
              const proseData = await proseRes.json();
              const text = proseData?.content || "";
              const lines = text.split(/\r?\n/);
              for (const l of lines) {
                const tr = l.trim();
                const m = tr.match(/^(?:###\s*)?(?:第\s*(\d+)\s*[章节]|(\d+)\.)/);
                if (m) {
                  const num = parseInt(m[1] || m[2], 10);
                  if (num > 0) proseSecs.add(num);
                }
              }
            }
          }

          if (!isCancelled) {
            setShortOutlineRows(outlineRowsCount);
            setShortDetailSections(details);
            setShortProseSections(proseSecs);
          }
        } catch {}
      };

      fetchShortStatus();
      window.addEventListener("focus", fetchShortStatus);
      window.addEventListener("open-story-file", fetchShortStatus);

      return () => {
        isCancelled = true;
        window.removeEventListener("focus", fetchShortStatus);
        window.removeEventListener("open-story-file", fetchShortStatus);
      };
    }

    // 长篇扫描逻辑
    const zhengwenDir = `${basePath}/正文`;
    const dagangDir = `${basePath}/大纲`;

    const fetchStatus = () => {
      Promise.all([
        fetch(`/api/files/${encodeFilePathForApi(dagangDir)}?type=list`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(`/api/files/${encodeFilePathForApi(zhengwenDir)}?type=list`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]).then(([dagangRes, zhengwenRes]) => {
        if (isCancelled) return;
        const outlines = new Set<number>();
        if (dagangRes && Array.isArray(dagangRes.entries)) {
          for (const e of dagangRes.entries) {
            if (e.name) {
              const num = extractChapterNumber(e.name);
              if (num !== null) outlines.add(num);
            }
          }
        }
        const chapters = new Set<number>();
        if (zhengwenRes && Array.isArray(zhengwenRes.entries)) {
          for (const e of zhengwenRes.entries) {
            if (e.name) {
              const num = extractChapterNumber(e.name);
              if (num !== null) chapters.add(num);
            }
          }
        }
        setExistingOutlines(outlines);
        setExistingChapters(chapters);
      });
    };

    fetchStatus();

    window.addEventListener("focus", fetchStatus);
    window.addEventListener("open-story-file", fetchStatus);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", fetchStatus);
      window.removeEventListener("open-story-file", fetchStatus);
    };
  }, [activeBook, isShort]);

  // 3. 监听侧边栏章节打开事件，自动聚焦到选中的章节
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ filePath?: string; fileName?: string }>;
      const name = custom.detail?.fileName || "";
      const match = name.match(/(?:第?(\d+)[章节]|(\d+)\.)/);
      if (match) {
        setSelectedChapter(parseInt(match[1] || match[2], 10));
      }
    };
    window.addEventListener("open-story-file", handler);
    return () => window.removeEventListener("open-story-file", handler);
  }, []);

  // 最终使用的章节序号
  const currentNum = typeof chapterIndex === "number"
    ? chapterIndex
    : (selectedChapter ?? autoNextChapter);

  const padNum = String(currentNum).padStart(isShort ? 2 : 3, "0");
  const isSelectedManual = selectedChapter !== null && selectedChapter !== autoNextChapter;

  const hasOutline = isShort ? shortDetailSections.has(currentNum) : existingOutlines.has(currentNum);
  const hasProse = isShort ? shortProseSections.has(currentNum) : existingChapters.has(currentNum);

  const primaryBtnClass =
    "px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition flex items-center gap-1.5 shrink-0 serif-text shadow-xs cursor-pointer font-bold text-xs";
  const secondaryBtnClass =
    "px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[var(--text)] border border-[var(--border)] transition flex items-center gap-1.5 shrink-0 serif-text shadow-2xs cursor-pointer font-medium text-xs";

  // 短篇状态机
  const isShortInitial = isShort && (!shortHasSettings || !shortHasOutlineFile || shortOutlineRows === 0);
  const isShortAllProseDone = isShort && shortOutlineRows > 0 && shortProseSections.size >= shortOutlineRows;

  const handleOutline = () => {
    if (isShort) {
      if (isShortInitial) {
        onInsertPrompt(
          `/story-short-write 为《${activeBook.fullTitle}》完成构思：输出 设定.md 与 小节大纲.md（顶部 5 列全篇粗纲表 + 首批 ## 第1-3节 逐节细纲），完成后停下待确认。`
        );
      } else {
        onInsertPrompt(
          `/story-short-write 为《${activeBook.fullTitle}》在 小节大纲.md 中补齐/细化第 ${currentNum} 节的「## 第${currentNum}节」逐节细纲（情节推进、情绪与变化、因果与信息、场景与对白），只改小节大纲不写正文。`
        );
      }
    } else {
      onInsertPrompt(
        `/story-long-write 为第${padNum}章推演细纲：梳理冲突焦点、镜头转场、登场角色与伏笔激活点。`
      );
    }
  };

  const handleWrite = () => {
    if (isShort) {
      onInsertPrompt(
        `/story-short-write 依据 设定.md 与 小节大纲.md 的「## 第${currentNum}节」细纲，推进《${activeBook.fullTitle}》第 ${currentNum} 节正文写入 正文.md，执行短篇格式与去AI味自检，写完本节停下交付。`
      );
    } else {
      onInsertPrompt(
        `/story-long-write 依据第${padNum}章细纲推进正文：仅撰写该单章，严格执行去AI味三层规范与门禁自检，写完提交追踪后立即停下交付，不连写后续章节。`
      );
    }
  };

  const handleRevision = () => {
    onInsertPrompt(
      `/story-short-write 对《${activeBook.fullTitle}》执行 Phase 4 精修打磨（去AI味、事实一致性检查与交付字数验收）。`
    );
  };

  // 高亮规则
  const isOutlinePrimary = isShort
    ? isShortInitial || (!hasOutline && !hasProse)
    : !hasOutline && !hasProse;
  const isWritePrimary = isShort
    ? !isShortInitial && hasOutline && !hasProse
    : hasOutline && !hasProse;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto mb-2 text-xs select-none py-1">
      {/* 章节/小节指示与微调切换 */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shrink-0 font-mono text-[11px] text-[var(--text)] shadow-2xs">
        <span className="text-[10px] text-[var(--text-muted)] serif-text font-bold">目标:</span>
        <button
          type="button"
          onClick={() => setSelectedChapter(Math.max(1, currentNum - 1))}
          className="hover:text-[var(--accent)] px-0.5 cursor-pointer text-[10px]"
          title={isShort ? "切到上一节" : "切到上一章"}
        >
          ‹
        </button>
        <span className="font-bold text-[var(--accent)] serif-text px-0.5">
          {isShort ? `第${padNum}节` : `第${padNum}章`}
        </span>
        <button
          type="button"
          onClick={() => setSelectedChapter(currentNum + 1)}
          className="hover:text-[var(--accent)] px-0.5 cursor-pointer text-[10px]"
          title={isShort ? "切到下一节" : "切到下一章"}
        >
          ›
        </button>
        {isSelectedManual && (
          <button
            type="button"
            onClick={() => setSelectedChapter(null)}
            className="text-[9px] text-[var(--text-muted)] hover:text-[var(--accent)] serif-text cursor-pointer ml-0.5 underline"
            title={isShort ? "重置为最新待写节" : "重置为最新待写章"}
          >
            最新
          </button>
        )}
      </div>

      {/* 1. 大纲/细纲按钮 */}
      <button
        type="button"
        onClick={handleOutline}
        className={isOutlinePrimary ? primaryBtnClass : secondaryBtnClass}
        title={
          isShort
            ? isShortInitial
              ? "构思短篇核心框架，生成设定.md与顶部5列粗纲表"
              : `针对第${padNum}节在小节大纲.md补充细纲块${hasOutline ? "（细纲已就绪）" : "（待推演）"}`
            : `针对第${padNum}章出细纲、推演镜头与节拍${hasOutline ? "（细纲已就绪）" : "（待推演）"}`
        }
      >
        <span>{isShort ? (isShortInitial ? "📐" : "📋") : "📋"}</span>
        <span>
          {isShort
            ? isShortInitial
              ? "出设定与小节粗纲"
              : `出第${padNum}节细纲`
            : `出第${padNum}章细纲`}
        </span>
      </button>

      {/* 2. 推进正文按钮 */}
      <button
        type="button"
        onClick={handleWrite}
        className={isWritePrimary ? primaryBtnClass : secondaryBtnClass}
        title={
          isShort
            ? `依据小节细纲推进第${padNum}节正文${hasProse ? "（已成文）" : ""}`
            : `一键执行全自动流水线：撰写第${padNum}章 + 自动三层去AI味 + 自动门禁质检${hasProse ? "（已成稿）" : ""}`
        }
      >
        <span>✍️</span>
        <span>{isShort ? `推进第${padNum}节正文` : `推进第${padNum}章正文`}</span>
      </button>

      {/* 3. 短篇专属：全篇精修验收（当全部小节已成文时优先高亮，或随时可选） */}
      {isShort && (
        <button
          type="button"
          onClick={handleRevision}
          className={isShortAllProseDone ? primaryBtnClass : secondaryBtnClass}
          title="对短篇正文执行去AI味三层打磨、事实一致性与字数交付验收"
        >
          <span>✨</span>
          <span>全篇精修验收</span>
        </button>
      )}

      {/* 4. 看全书 */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("open-story-reader", {
                detail: { chapterNum: currentNum },
              })
            );
          }
        }}
        className={secondaryBtnClass}
        title="打开全书小说阅读器：完整章节目录、沉浸式阅读、手动精修与实时自动保存"
      >
        <span>📖</span>
        <span>{isShort ? "看全篇" : "看全书"}</span>
      </button>
    </div>
  );
});
