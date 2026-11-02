"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { useActiveBook, getBookRelPath } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { isShortBook } from "@/lib/story-book-kind";
import { extractChapterNumber } from "@/lib/story-chapter-parser";
import {
  buildLongOutlinePrompt,
  buildLongWritePrompt,
  buildShortOutlinePrompt,
  buildShortSectionOutlinePrompt,
  buildShortWritePrompt,
  buildShortRevisionPrompt,
} from "@/lib/story-prompts";
import {
  countShortOutlineSections,
  extractShortDetailSections,
  extractShortProseSections,
} from "@/lib/story-short-outline";

interface StoryActionBarProps {
  onInsertPrompt: (prompt: string) => void;
  chapterIndex?: number;
  cwd?: string | null;
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

  // M17 单一事实源判定
  const isShort = useMemo(() => isShortBook(activeBook), [activeBook]);
  const isSingleFileShort = useMemo(
    () => isShort && Boolean(activeBook?.path && (activeBook.path.endsWith(".txt") || activeBook.path.endsWith(".md"))),
    [isShort, activeBook]
  );

  // M19 切书重置手动章节选择，禁止跨书残留
  useEffect(() => {
    setSelectedChapter(null);
  }, [activeBook?.id]);

  // 1. 从当前活跃书籍自动解析最新待写章/节号
  const autoNextChapter = useMemo(() => {
    if (!activeBook || activeBook.isUninitialized) return 1;
    if (isShort) {
      if (shortOutlineRows > 0) {
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
          let details = new Set<number>();
          if (hasOutline) {
            const outlineRes = await fetch(`/api/files/${encodeFilePathForApi(`${basePath}/小节大纲.md`)}?type=read`);
            if (outlineRes.ok && !isCancelled) {
              const outlineData = await outlineRes.json();
              const text = outlineData?.content || "";
              outlineRowsCount = countShortOutlineSections(text);
              details = extractShortDetailSections(text);
            }
          }

          let proseSecs = new Set<number>();
          if (hasProse) {
            const proseRes = await fetch(`/api/files/${encodeFilePathForApi(`${basePath}/正文.md`)}?type=read`);
            if (proseRes.ok && !isCancelled) {
              const proseData = await proseRes.json();
              const text = proseData?.content || "";
              proseSecs = extractShortProseSections(text);
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
      window.addEventListener("story-refresh", fetchShortStatus);

      return () => {
        isCancelled = true;
        window.removeEventListener("focus", fetchShortStatus);
        window.removeEventListener("open-story-file", fetchShortStatus);
        window.removeEventListener("story-refresh", fetchShortStatus);
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
    window.addEventListener("story-refresh", fetchStatus);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", fetchStatus);
      window.removeEventListener("open-story-file", fetchStatus);
      window.removeEventListener("story-refresh", fetchStatus);
    };
  }, [activeBook, isShort]);

  // 3. 监听侧边栏章节打开事件，自动聚焦到选中的章节
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ filePath?: string; fileName?: string }>;
      const name = custom.detail?.fileName || "";
      const num = extractChapterNumber(name);
      if (num !== null) {
        setSelectedChapter(num);
      }
    };
    window.addEventListener("open-story-file", handler);
    return () => window.removeEventListener("open-story-file", handler);
  }, []);

  const currentNum = typeof chapterIndex === "number"
    ? chapterIndex
    : (selectedChapter ?? autoNextChapter);

  const padNum = String(currentNum).padStart(isShort ? 2 : 3, "0");
  const isSelectedManual = selectedChapter !== null && selectedChapter !== autoNextChapter;

  const hasOutline = isShort ? (shortOutlineRows >= currentNum || shortDetailSections.has(currentNum)) : existingOutlines.has(currentNum);
  const hasProse = isShort ? shortProseSections.has(currentNum) : existingChapters.has(currentNum);

  const primaryBtnClass =
    "px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition flex items-center gap-1.5 shrink-0 serif-text shadow-xs cursor-pointer font-bold text-xs";
  const secondaryBtnClass =
    "px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-[var(--text)] border border-[var(--border)] transition flex items-center gap-1.5 shrink-0 serif-text shadow-2xs cursor-pointer font-medium text-xs";

  // 短篇状态机
  const isShortInitial = isShort && (!shortHasSettings || !shortHasOutlineFile || shortOutlineRows === 0);
  const isShortAllProseDone = isShort && shortOutlineRows > 0 && shortProseSections.size >= shortOutlineRows;

  const bookRel = useMemo(() => {
    if (!activeBook?.path) return "";
    return getBookRelPath(cwd || "", activeBook.path);
  }, [activeBook, cwd]);

  const handleOutline = () => {
    if (isShort) {
      if (isShortInitial) {
        onInsertPrompt(buildShortOutlinePrompt(activeBook.fullTitle, bookRel));
      } else {
        onInsertPrompt(buildShortSectionOutlinePrompt(activeBook.fullTitle, bookRel, currentNum));
      }
    } else {
      onInsertPrompt(buildLongOutlinePrompt(activeBook.fullTitle, bookRel, currentNum));
    }
  };

  const handleWrite = () => {
    if (isShort) {
      onInsertPrompt(buildShortWritePrompt(activeBook.fullTitle, bookRel, currentNum));
    } else {
      onInsertPrompt(buildLongWritePrompt(activeBook.fullTitle, bookRel, currentNum));
    }
  };

  const handleRevision = () => {
    onInsertPrompt(buildShortRevisionPrompt(activeBook.fullTitle, bookRel));
  };

  // 高亮规则
  const isOutlinePrimary = isShort
    ? isShortInitial
    : !hasOutline && !hasProse;
  const isWritePrimary = isShort
    ? !isShortInitial && !isShortAllProseDone
    : hasOutline && !hasProse;

  // 零状态守卫：未初始化或未立项书籍时隐藏动作条
  if (!activeBook || activeBook.isUninitialized) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto mb-2 text-xs select-none py-1">
      {/* M19 模式与书名常驻徽章 */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] shrink-0 font-mono text-[11px] text-[var(--text)] shadow-2xs">
        <span className="font-bold text-[var(--text)] serif-text truncate max-w-[140px]">
          {activeBook?.title || "《未命名》"}
        </span>
        <span
          className={
            isShort
              ? "text-[var(--accent)] text-[10px] px-1 py-0.2 rounded bg-[var(--accent)]/10 serif-text font-bold"
              : "text-[#2e7a4c] text-[10px] px-1 py-0.2 rounded bg-[#2e7a4c]/10 serif-text font-bold"
          }
        >
          {isShort ? "短篇小说" : "长篇连载"}
        </span>
      </div>

      {/* 针对单文件短篇成稿：直接给精修动作 */}
      {isSingleFileShort ? (
        <button
          type="button"
          onClick={handleRevision}
          className={primaryBtnClass}
          title="对单文件短篇正文执行去AI味三层打磨、事实一致性与字数交付验收"
        >
          <span>✨</span>
          <span>执行成稿精修 (Phase 4)</span>
        </button>
      ) : (
        <>
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

          {/* 1. 大纲/细纲按钮：短篇只在立项未出大纲时展示「出设定与小节粗纲」；长篇则每章展示「出第N章细纲」 */}
          {(!isShort || isShortInitial) && (
            <button
              type="button"
              onClick={handleOutline}
              className={isOutlinePrimary ? primaryBtnClass : secondaryBtnClass}
              title={
                isShort
                  ? "构思短篇核心框架，生成设定.md与12列全篇粗纲表"
                  : `按 workflow-outline 推演第${padNum}章细纲${hasOutline ? "（细纲已就绪）" : "（待推演）"}`
              }
            >
              <span>{isShort ? "📐" : "📋"}</span>
              <span>
                {isShort ? "出设定与小节粗纲" : `出第${padNum}章细纲`}
              </span>
            </button>
          )}

          {/* 2. 推进正文按钮 */}
          <button
            type="button"
            onClick={handleWrite}
            className={isWritePrimary ? primaryBtnClass : secondaryBtnClass}
            title={
              isShort
                ? `依据设定与小节大纲推进第${padNum}节正文${hasProse ? "（已成文）" : ""}`
                : `依据细纲推进第${padNum}章正文，执行去AI味三层规范与门禁自检${hasProse ? "（已成稿）" : ""}`
            }
          >
            <span>✍️</span>
            <span>{isShort ? `推进第${padNum}节正文` : `推进第${padNum}章正文`}</span>
          </button>

          {/* 3. 短篇专属：全篇精修验收 */}
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
        </>
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
