"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { buildDeslopPrompt, buildReviewPrompt } from "@/lib/story-prompts";
import {
  normalizeNovelContent,
  findInSource,
  replaceMatchInSource,
  replaceAllInSource,
  FindMatch,
} from "@/lib/story-reader-format";

interface StoryReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  cwd?: string | null;
  initialChapterNum?: number;
}

export interface ChapterItem {
  fileName: string;
  fullPath: string;
  title: string;
  chapterNum: number;
  rawNum: string;
  wordCount?: number;
}

type ViewMode = "reader" | "source" | "split";
type PaperTheme = "default" | "parchment" | "dark";
type FontSize = "base" | "lg" | "xl"; // 16px, 18px, 20px
type LineHeight = "relaxed" | "standard" | "loose"; // 1.75, 1.95, 2.15

interface ReaderSettings {
  theme: PaperTheme;
  fontSize: FontSize;
  lineHeight: LineHeight;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "default",
  fontSize: "base",
  lineHeight: "standard",
};

function extractChapterInfo(fileName: string, fullPath: string): ChapterItem | null {
  const nameWithoutExt = fileName.replace(/\.(md|txt|markdown)$/i, "");

  // 排除非正文成稿文件
  if (/(细纲|大纲|逐章记录|摘要|时间线|设定|草稿|架构)/.test(nameWithoutExt)) {
    return null;
  }

  // 短篇成稿
  if (nameWithoutExt === "正文") {
    return {
      fileName,
      fullPath,
      title: "短篇正文成稿",
      chapterNum: 1,
      rawNum: "全篇",
    };
  }

  // 匹配第几章格式，如：第001章、第1章、第25章_别做成晚会、第1节 等
  const match = nameWithoutExt.match(/^第\s*(\d+|[一二三四五六七八九十百千万]+)\s*([章节回集])(.*)$/);
  if (match) {
    const rawNum = match[1];
    const unit = match[2];
    const titlePart = match[3]?.replace(/^[_\s-]+/, "") || "";
    const num = /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : 1;
    const formattedNum = /^\d+$/.test(rawNum) ? String(num).padStart(3, "0") : rawNum;
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

async function fetchFullText(fullPath: string): Promise<string> {
  let full = "";
  let offset = 0;
  while (true) {
    const query = offset > 0 ? `&offset=${offset}` : "";
    const res = await fetch(`/api/files/${encodeFilePathForApi(fullPath)}?type=read${query}`);
    if (!res.ok) {
      throw new Error(`Failed to read file: ${res.status}`);
    }
    const data = (await res.json()) as { content?: string; truncated?: boolean; nextOffset?: number };
    full += data.content ?? "";
    if (!data.truncated) break;
    offset = data.nextOffset ?? offset + (data.content?.length ?? 0);
  }
  // 如果读取出的文本不幸包含 JSON 字符串包裹，安全自动解包
  if (full.startsWith('{"content":') && full.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(full);
      if (typeof parsed.content === "string") {
        full = parsed.content;
      }
    } catch {}
  }
  return full;
}

export const StoryReaderModal = memo(function StoryReaderModal({
  isOpen,
  onClose,
  cwd,
  initialChapterNum,
}: StoryReaderModalProps) {
  const { activeBook } = useActiveBook(cwd);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // 视图三态：阅览 / 源码 / 分屏
  const [viewMode, setViewMode] = useState<ViewMode>("reader");
  const [content, setContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [actionFeedback, setActionFeedback] = useState<"deslop" | "review" | null>(null);

  // 结构与全屏控制
  const [isCatalogOpen, setIsCatalogOpen] = useState(true);
  const [isMobileCatalogOpen, setIsMobileCatalogOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 查找替换
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // 阅读设置 (主题、字号、行高)
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("story_reader_settings");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // 滚动与回到顶部
  const [readScrollProgress, setReadScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 源码编辑器当前行号
  const [currentLineNum, setCurrentLineNum] = useState(1);

  // 各章节已统计字数缓存
  const [chapterWordsMap, setChapterWordsMap] = useState<Record<string, number>>({});

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const catalogListRef = useRef<HTMLDivElement>(null);
  const currentChapterButtonRef = useRef<HTMLButtonElement | null>(null);
  const readerScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChapter = chapters[selectedIndex] ?? null;

  // 持久化设置
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("story_reader_settings", JSON.stringify(settings));
      } catch {}
    }
  }, [settings]);

  // 1. 扫描当前作品所有正文章节
  useEffect(() => {
    if (!isOpen || !activeBook || activeBook.isUninitialized || !activeBook.path) {
      setChapters([]);
      return;
    }

    let isCancelled = false;
    setLoadingList(true);

    const basePath = activeBook.path.replace(/\\/g, "/").replace(/\/+$/, "");
    const zhengwenDir = `${basePath}/正文`;

    Promise.all([
      fetch(`/api/files/${encodeFilePathForApi(zhengwenDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(basePath)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([zwRes, rootRes]) => {
        if (isCancelled) return;
        const list: ChapterItem[] = [];

        if (zwRes && Array.isArray(zwRes.entries)) {
          for (const e of zwRes.entries) {
            if (e.name && /\.(md|txt)$/i.test(e.name)) {
              const item = extractChapterInfo(e.name, `${zhengwenDir}/${e.name}`);
              if (item) list.push(item);
            }
          }
        } else if (rootRes && Array.isArray(rootRes.entries)) {
          // 兼容短篇存放在根目录的 正文.md
          const rootZw = rootRes.entries.find((e: { name?: string }) => e.name === "正文.md");
          if (rootZw) {
            const item = extractChapterInfo("正文.md", `${basePath}/正文.md`);
            if (item) list.push(item);
          }
        }

        list.sort((a, b) => a.chapterNum - b.chapterNum || a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
        setChapters(list);

        if (list.length > 0) {
          if (typeof initialChapterNum === "number") {
            const foundIdx = list.findIndex((c) => c.chapterNum === initialChapterNum);
            setSelectedIndex(foundIdx >= 0 ? foundIdx : list.length - 1);
          } else {
            setSelectedIndex(list.length - 1); // 默认定位到最新章
          }
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingList(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeBook, initialChapterNum]);

  // 2. 加载当前选中章节正文
  useEffect(() => {
    if (!isOpen || !currentChapter) {
      setContent("");
      return;
    }

    let isCancelled = false;
    setLoadingContent(true);
    setSaveStatus("saved");

    fetchFullText(currentChapter.fullPath)
      .then((rawText) => {
        if (!isCancelled) {
          setContent(rawText);
          setSaveStatus("saved");
          const cleanedCount = rawText.replace(/\s+/g, "").length;
          setChapterWordsMap((prev) => ({ ...prev, [currentChapter.fullPath]: cleanedCount }));
        }
      })
      .catch((err) => {
        if (!isCancelled) setContent(`（加载正文失败: ${err?.message || err}）`);
      })
      .finally(() => {
        if (!isCancelled) setLoadingContent(false);
      });

    return () => {
      isCancelled = true;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isOpen, currentChapter]);

  // 3. 执行文件静默落盘保存
  const saveContentImmediately = useCallback(
    async (textToSave: string, targetPath?: string) => {
      const path = targetPath || currentChapter?.fullPath;
      if (!path) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/files/${encodeFilePathForApi(path)}?type=write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: textToSave }),
        });
        if (res.ok) {
          setSaveStatus("saved");
          const cleanedCount = textToSave.replace(/\s+/g, "").length;
          setChapterWordsMap((prev) => ({ ...prev, [path]: cleanedCount }));
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("story-refresh"));
          }
        } else {
          setSaveStatus("unsaved");
        }
      } catch {
        setSaveStatus("unsaved");
      }
    },
    [currentChapter]
  );

  // 4. 输入时防抖自动保存 (1000ms)
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setSaveStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void saveContentImmediately(val);
    }, 1000);
  };

  // 5. 切换章节前强制刷新保存
  const handleSelectChapter = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= chapters.length || newIndex === selectedIndex) return;
      if (saveStatus === "unsaved" && currentChapter) {
        void saveContentImmediately(contentRef.current, currentChapter.fullPath);
      }
      setSelectedIndex(newIndex);
      setIsMobileCatalogOpen(false);
      if (readerScrollContainerRef.current) {
        readerScrollContainerRef.current.scrollTop = 0;
      }
    },
    [chapters.length, currentChapter, saveStatus, saveContentImmediately, selectedIndex]
  );

  // 6. 关闭窗口前强制保存
  const handleClose = useCallback(() => {
    if (saveStatus === "unsaved" && currentChapter) {
      void saveContentImmediately(contentRef.current, currentChapter.fullPath);
    }
    onClose();
  }, [saveStatus, currentChapter, saveContentImmediately, onClose]);

  // 7. 目录自动滚入可视区 (M29)
  useEffect(() => {
    if (currentChapterButtonRef.current) {
      currentChapterButtonRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, chapters.length]);

  // 8. 键盘快捷键监听 (Esc, ←, →, Ctrl+S, Ctrl+F)
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      // Esc: 若查找栏开着则先关查找栏，否则关闭模态框
      if (e.key === "Escape") {
        e.preventDefault();
        if (showFindBar) {
          setShowFindBar(false);
        } else {
          handleClose();
        }
        return;
      }

      // Ctrl+S / Cmd+S: 存盘
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        void saveContentImmediately(contentRef.current);
        return;
      }

      // Ctrl+F / Cmd+F: 打开查找替换
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFindBar((prev) => !prev);
        return;
      }

      // 翻章快捷键：当焦点未处于可输入元素时，← / → 翻章
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      if (!isInputFocused) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleSelectChapter(selectedIndex - 1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleSelectChapter(selectedIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isOpen, showFindBar, handleClose, handleSelectChapter, selectedIndex, saveContentImmediately]);

  // 9. 阅读滚动进度与回到顶部监听
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      const progress = Math.min(100, Math.max(0, (el.scrollTop / maxScroll) * 100));
      setReadScrollProgress(progress);
      setShowBackToTop(el.scrollTop > 300);
    } else {
      setReadScrollProgress(0);
      setShowBackToTop(false);
    }
  };

  const scrollToTop = () => {
    if (readerScrollContainerRef.current) {
      readerScrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // 10. 源码编辑器行号与当前行指示
  const sourceLines = useMemo(() => content.split("\n"), [content]);
  const handleTextareaSelect = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textBefore = content.slice(0, pos);
    const line = textBefore.split("\n").length;
    setCurrentLineNum(line);
  };

  // 11. 查找替换计算
  const findMatches: FindMatch[] = useMemo(() => {
    if (!showFindBar || !findQuery) return [];
    return findInSource(content, findQuery);
  }, [showFindBar, findQuery, content]);

  const handleNextMatch = () => {
    if (findMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % findMatches.length);
  };

  const handlePrevMatch = () => {
    if (findMatches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + findMatches.length) % findMatches.length);
  };

  const handleReplaceOne = () => {
    if (findMatches.length === 0) return;
    const currentMatch = findMatches[activeMatchIndex] || findMatches[0];
    const newText = replaceMatchInSource(content, currentMatch, replaceQuery);
    setContent(newText);
    setSaveStatus("unsaved");
    void saveContentImmediately(newText);
  };

  const handleReplaceAll = () => {
    if (!findQuery) return;
    const newText = replaceAllInSource(content, findQuery, replaceQuery);
    setContent(newText);
    setSaveStatus("unsaved");
    void saveContentImmediately(newText);
  };

  // 12. 正文规范化段落 (M31 规范化排版引擎)
  const normalizedNovel = useMemo(() => normalizeNovelContent(content), [content]);

  // 全书已统计总字数
  const totalBookWords = useMemo(() => {
    let sum = 0;
    for (const count of Object.values(chapterWordsMap)) {
      sum += count;
    }
    return sum;
  }, [chapterWordsMap]);

  // 13. 成稿工具联动：重新去AI味
  const handleDeslop = async () => {
    if (!currentChapter) return;
    if (saveStatus === "unsaved") {
      await saveContentImmediately(content);
    }
    const label = currentChapter.rawNum || "当前章";
    const prompt = buildDeslopPrompt("", label);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
    }
    setActionFeedback("deslop");
    setTimeout(() => {
      setActionFeedback(null);
    }, 2500);
  };

  // 14. 成稿工具联动：重新审稿质检
  const handleReview = async () => {
    if (!currentChapter) return;
    if (saveStatus === "unsaved") {
      await saveContentImmediately(content);
    }
    const label = currentChapter.rawNum || "当前章";
    const prompt = buildReviewPrompt("", label);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
    }
    setActionFeedback("review");
    setTimeout(() => {
      setActionFeedback(null);
    }, 2500);
  };

  if (!isOpen) return null;

  // 字号与行高样式映射
  const fontSizeClass =
    settings.fontSize === "xl" ? "text-[20px]" : settings.fontSize === "lg" ? "text-[18px]" : "text-[16px]";
  const lineHeightClass =
    settings.lineHeight === "loose"
      ? "leading-[2.15]"
      : settings.lineHeight === "relaxed"
      ? "leading-[1.75]"
      : "leading-[1.95]";

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 md:p-4 select-none animate-fade-in">
      <div
        className={`relative flex flex-col overflow-hidden text-[var(--text)] transition-all duration-200 ${
          isFullscreen
            ? "fixed inset-0 w-full h-full rounded-none border-none bg-[var(--bg-panel)]"
            : "w-full max-w-6xl h-[94vh] rounded-2xl border border-[var(--border)] shadow-2xl bg-[var(--bg-panel)]"
        }`}
      >
        {/* 阅读进度条 (顶部微细指示条) */}
        {viewMode !== "source" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-transparent z-40 pointer-events-none">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-150"
              style={{ width: `${readScrollProgress}%` }}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* 第一层：主工具栏 (保书名、三态切换、全屏、关闭) */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] shrink-0 gap-2">
          {/* 左侧：目录折叠按钮 + 书名 */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 桌面端目录折叠 / 移动端抽屉开关 */}
            <button
              type="button"
              onClick={() => {
                setIsCatalogOpen((prev) => !prev);
                setIsMobileCatalogOpen((prev) => !prev);
              }}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
              title={isCatalogOpen ? "收起全书目录" : "展开全书目录"}
              aria-label="切换目录"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <span className="text-sm md:text-base font-bold serif-text truncate text-[var(--text)]">
              {activeBook?.title ? `《${activeBook.title}》` : "全本小说阅览与精修"}
            </span>

            {/* 全书总览徽标 */}
            <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] font-mono shrink-0">
              共 {chapters.length} 章
              {totalBookWords > 0 && ` · 约 ${(totalBookWords / 10000).toFixed(1)} 万字`}
            </span>
          </div>

          {/* 右侧：三态视图切换 (阅览 / 源码 / 分屏) + 全屏 + 关闭 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 视图三态切换 */}
            <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("reader")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium serif-text transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "reader"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="阅览排版视图"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span>阅览</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("source")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium serif-text transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "source"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="纯文本源码编辑模式"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <span>源码</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`hidden md:flex px-2.5 py-1 rounded-lg text-xs font-medium serif-text transition cursor-pointer items-center gap-1.5 ${
                  viewMode === "split"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="分屏对照模式 (左侧源码，右侧排版预览)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
                <span>分屏</span>
              </button>
            </div>

            {/* 全屏沉浸切换按钮 */}
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
              title={isFullscreen ? "退出全屏" : "全屏沉浸阅读"}
              aria-label="全屏沉浸"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
              title="关闭阅读器 (Esc)"
              aria-label="关闭"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 第二层：辅助操作条 (当前章信息、存盘状态、排版设置、工具) */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between px-3 md:px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text-muted)] shrink-0 gap-2 flex-wrap">
          {/* 左侧：当前章标签 + 字数 */}
          <div className="flex items-center gap-2 min-w-0">
            {currentChapter && (
              <span className="font-medium text-[var(--text)] serif-text truncate">
                {currentChapter.rawNum}
                {currentChapter.title && currentChapter.title !== currentChapter.rawNum ? ` · ${currentChapter.title}` : ""}
              </span>
            )}
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border)]">
              {normalizedNovel.charCount} 字
            </span>

            {/* 跨章导航小按钮 */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={() => handleSelectChapter(selectedIndex - 1)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="上一章 (←)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {selectedIndex + 1}/{chapters.length}
              </span>
              <button
                type="button"
                disabled={selectedIndex >= chapters.length - 1}
                onClick={() => handleSelectChapter(selectedIndex + 1)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="下一章 (→)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* 右侧：保存状态 + 查找替换 + 阅读设置 + 成稿工具 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 自动保存状态指示 */}
            {viewMode !== "reader" && (
              <div className="text-[11px] font-medium flex items-center gap-1.5 transition">
                {saveStatus === "saving" ? (
                  <span className="text-[var(--accent)] flex items-center gap-1 animate-pulse">
                    <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    正在存盘...
                  </span>
                ) : saveStatus === "unsaved" ? (
                  <span className="text-amber-500">有修改未存 (Ctrl+S) *</span>
                ) : (
                  <span className="text-emerald-500 opacity-90 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    已存盘
                  </span>
                )}
              </div>
            )}

            {/* 查找替换切换按钮 */}
            {viewMode !== "reader" && (
              <button
                type="button"
                onClick={() => setShowFindBar((prev) => !prev)}
                className={`p-1.5 rounded-lg border border-[var(--border)] transition cursor-pointer flex items-center gap-1 ${
                  showFindBar
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                    : "bg-[var(--bg)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="查找替换 (Ctrl+F)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-[11px]">查找</span>
              </button>
            )}

            {/* 阅读排版设置 (纸白/暗色、字号、行高) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettingsMenu((prev) => !prev)}
                className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer flex items-center gap-1"
                title="阅读排版偏好设置"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="text-[11px]">排版</span>
              </button>

              {/* 弹出的设置下拉面板 */}
              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 p-3 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl shadow-xl z-50 text-xs space-y-3">
                  <div>
                    <div className="text-[11px] text-[var(--text-muted)] mb-1 font-medium">阅读纸面</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, theme: "default" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.theme === "default"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        默认
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, theme: "parchment" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer bg-[#fbf7ee] text-[#2c2520] ${
                          settings.theme === "parchment" ? "border-amber-700 font-bold" : "border-stone-300"
                        }`}
                      >
                        暖纸
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, theme: "dark" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer bg-[#141416] text-[#dcdde1] ${
                          settings.theme === "dark" ? "border-blue-500 font-bold" : "border-stone-700"
                        }`}
                      >
                        深色
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-[var(--text-muted)] mb-1 font-medium">正文字号</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, fontSize: "base" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.fontSize === "base"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        标准 16px
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, fontSize: "lg" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.fontSize === "lg"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        中号 18px
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, fontSize: "xl" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.fontSize === "xl"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        大号 20px
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-[var(--text-muted)] mb-1 font-medium">行间距</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, lineHeight: "relaxed" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.lineHeight === "relaxed"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        紧凑
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, lineHeight: "standard" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.lineHeight === "standard"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        标准 1.95
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, lineHeight: "loose" }))}
                        className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                          settings.lineHeight === "loose"
                            ? "border-[var(--accent)] bg-[var(--bg)] text-[var(--accent)] font-bold"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        宽松
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 成稿工具：重新去AI味 */}
            <button
              type="button"
              onClick={handleDeslop}
              className="px-2 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium serif-text transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="对该章调用 Agent 重新执行三层去AI味清洗"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
                <path d="M17.64 15 22 10.64" />
                <path d="m20.91 3.26-2.17-2.17a2.12 2.12 0 0 0-3 0L13.5 3.33l5.17 5.17 2.24-2.24c.83-.83.83-2.17 0-3Z" />
              </svg>
              <span>{actionFeedback === "deslop" ? "已填入输入框，待发送" : "去AI味"}</span>
            </button>

            {/* 成稿工具：重新审稿质检 */}
            <button
              type="button"
              onClick={handleReview}
              className="px-2 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium serif-text transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="对该章调用 Agent 重新执行对抗性质检与矛盾核验"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>{actionFeedback === "review" ? "已填入输入框，待发送" : "审稿质检"}</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 查找替换悬浮条 (M32) */}
        {/* ============================================================== */}
        {showFindBar && viewMode !== "reader" && (
          <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-[var(--bg-panel)] border-b border-[var(--border)] shrink-0 gap-2 flex-wrap animate-fade-in text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="flex items-center gap-1 flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="查找正文内容..."
                  value={findQuery}
                  onChange={(e) => {
                    setFindQuery(e.target.value);
                    setActiveMatchIndex(0);
                  }}
                  className="w-full bg-transparent outline-none font-mono text-xs text-[var(--text)]"
                  autoFocus
                />
                <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                  {findMatches.length > 0 ? `${activeMatchIndex + 1}/${findMatches.length}` : "0/0"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMatch}
                  disabled={findMatches.length === 0}
                  className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer"
                  title="上一个匹配项"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleNextMatch}
                  disabled={findMatches.length === 0}
                  className="p-1 rounded hover:bg-[var(--bg-hover)] disabled:opacity-30 cursor-pointer"
                  title="下一个匹配项"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="flex items-center gap-1 flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1">
                <input
                  type="text"
                  placeholder="替换为..."
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="w-full bg-transparent outline-none font-mono text-xs text-[var(--text)]"
                />
              </div>
              <button
                type="button"
                onClick={handleReplaceOne}
                disabled={findMatches.length === 0}
                className="px-2 py-1 rounded bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] disabled:opacity-30 cursor-pointer text-xs"
              >
                替换
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={!findQuery}
                className="px-2 py-1 rounded bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] disabled:opacity-30 cursor-pointer text-xs"
              >
                全部替换
              </button>
              <button
                type="button"
                onClick={() => setShowFindBar(false)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
                title="关闭查找栏"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 主体双栏区域 */}
        {/* ============================================================== */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* 移动端目录抽屉遮罩 */}
          {isMobileCatalogOpen && (
            <div
              className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-2xs animate-fade-in"
              onClick={() => setIsMobileCatalogOpen(false)}
            />
          )}

          {/* 左侧：全书章节目录 (桌面可折叠 / 移动端抽屉) */}
          <div
            ref={catalogListRef}
            className={`transition-all duration-200 z-35 flex flex-col shrink-0 bg-[var(--bg-panel)] border-r border-[var(--border)] ${
              // 移动端：浮动抽屉
              isMobileCatalogOpen
                ? "fixed inset-y-0 left-0 w-72 shadow-2xl flex"
                : "hidden md:flex"
            } ${
              // 桌面端折叠状态
              isCatalogOpen ? "md:w-64" : "md:w-0 md:border-r-0 md:overflow-hidden"
            }`}
          >
            {/* 目录顶栏 */}
            <div className="p-3 border-b border-[var(--border)] text-xs font-bold serif-text text-[var(--text-muted)] flex items-center justify-between">
              <span>全书目录（{chapters.length}）</span>
              {loadingList && (
                <svg className="animate-spin text-[var(--accent)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              )}
            </div>

            {/* 目录项列表 (改用真 button 语义，M29) */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {chapters.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)] serif-text">
                  {loadingList ? "正在扫描全文章节..." : "暂未检测到已成稿章节"}
                </div>
              ) : (
                chapters.map((ch, idx) => {
                  const isCurrent = idx === selectedIndex;
                  const wordCountItem = chapterWordsMap[ch.fullPath];
                  return (
                    <button
                      key={ch.fileName}
                      ref={isCurrent ? currentChapterButtonRef : null}
                      type="button"
                      onClick={() => handleSelectChapter(idx)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`w-full text-left p-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-between gap-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
                        isCurrent
                          ? "bg-[var(--accent)]/12 text-[var(--accent)] border-l-3 border-[var(--accent)] font-semibold shadow-2xs"
                          : "hover:bg-[var(--bg-hover)] text-[var(--text)] border-l-3 border-transparent"
                      }`}
                    >
                      <div className="min-w-0 flex-1 truncate serif-text">
                        <span>{ch.rawNum}</span>
                        {ch.title && ch.title !== ch.rawNum && (
                          <span className="ml-1 opacity-85 truncate">{ch.title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                        {wordCountItem ? <span>{wordCountItem}字</span> : null}
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧：舞台区域 (阅览 / 源码 / 分屏) */}
          <div className="flex-1 flex min-w-0 overflow-hidden relative">
            {loadingContent ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] serif-text">
                <svg className="animate-spin mr-2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                正在加载正文...
              </div>
            ) : !currentChapter ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] serif-text">
                请在左侧选择章节开始阅读
              </div>
            ) : viewMode === "reader" ? (
              /* ====================================================== */
              /* 1. 阅览模式：M31 规范化正文段落化排版管线 */
              /* ====================================================== */
              <div
                ref={readerScrollContainerRef}
                onScroll={handleScroll}
                className={`flex-1 overflow-y-auto px-4 md:px-8 py-8 story-reader-paper theme-${settings.theme}`}
              >
                <div className="story-reader-container">
                  {/* 章题识别与渲染 */}
                  {normalizedNovel.mainTitle && (
                    <h1 className="story-chapter-title serif-text text-[var(--text)]">
                      {normalizedNovel.mainTitle}
                    </h1>
                  )}

                  {/* 规范化段落渲染 */}
                  <div className={`serif-text ${fontSizeClass} ${lineHeightClass}`}>
                    {normalizedNovel.paragraphs.map((p, pIdx) => {
                      if (p.type === "chapter-title") {
                        // 已经作为 mainTitle 渲染过首章题，略过以防重复
                        return null;
                      }
                      if (p.type === "section-title") {
                        return (
                          <div key={pIdx} className="story-section-title font-mono">
                            {p.text}
                          </div>
                        );
                      }
                      if (p.type === "divider") {
                        return (
                          <div key={pIdx} className="story-scene-divider">
                            {p.text}
                          </div>
                        );
                      }
                      return (
                        <p key={pIdx} className="story-p">
                          {p.text}
                        </p>
                      );
                    })}
                  </div>

                  {/* 底部跨章导航 */}
                  <div className="mt-14 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs serif-text text-[var(--text-muted)]">
                    <button
                      type="button"
                      disabled={selectedIndex <= 0}
                      onClick={() => handleSelectChapter(selectedIndex - 1)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>上一章</span>
                    </button>

                    <span className="font-mono text-[11px]">
                      {selectedIndex + 1} / {chapters.length}
                    </span>

                    <button
                      type="button"
                      disabled={selectedIndex >= chapters.length - 1}
                      onClick={() => handleSelectChapter(selectedIndex + 1)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>下一章</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : viewMode === "source" ? (
              /* ====================================================== */
              /* 2. 源码编辑模式 (M32 源码编辑器：等宽、行号、无IDE杂项) */
              /* ====================================================== */
              <div className="flex-1 flex flex-col bg-[var(--bg)] overflow-hidden">
                <div className="flex-1 flex overflow-hidden">
                  {/* 左侧行号列 */}
                  <div className="w-12 py-4 bg-[var(--bg-subtle)] border-r border-[var(--border)] select-none text-right font-mono text-xs text-[var(--text-dim)] shrink-0 overflow-hidden leading-6">
                    {sourceLines.map((_, idx) => {
                      const isLineActive = idx + 1 === currentLineNum;
                      return (
                        <div
                          key={idx}
                          className={`pr-2 ${isLineActive ? "text-[var(--accent)] font-bold bg-[var(--accent)]/10" : ""}`}
                        >
                          {idx + 1}
                        </div>
                      );
                    })}
                  </div>

                  {/* 源码 textarea 编辑区 */}
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    onSelect={handleTextareaSelect}
                    onKeyUp={handleTextareaSelect}
                    onClick={handleTextareaSelect}
                    placeholder="在此编辑章节 Markdown 源码..."
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none resize-none font-mono text-xs md:text-sm leading-6 text-[var(--text)] placeholder-[var(--text-dim)] p-4 overflow-y-auto selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)]"
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              /* ====================================================== */
              /* 3. 分屏对照模式 (左侧源码，右侧 M31 规范化排版只读预览) */
              /* ====================================================== */
              <div className="flex-1 flex min-w-0 overflow-hidden">
                {/* 左半区：源码编辑器 */}
                <div className="w-1/2 flex flex-col border-r border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between shrink-0">
                    <span>源码编辑器 (实时双向)</span>
                    <span>行 {currentLineNum}</span>
                  </div>
                  <div className="flex-1 flex overflow-hidden">
                    <div className="w-10 py-3 bg-[var(--bg-subtle)] border-r border-[var(--border)] select-none text-right font-mono text-xs text-[var(--text-dim)] shrink-0 overflow-hidden leading-6">
                      {sourceLines.map((_, idx) => (
                        <div
                          key={idx}
                          className={`pr-2 ${idx + 1 === currentLineNum ? "text-[var(--accent)] font-bold" : ""}`}
                        >
                          {idx + 1}
                        </div>
                      ))}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={handleContentChange}
                      onSelect={handleTextareaSelect}
                      onKeyUp={handleTextareaSelect}
                      onClick={handleTextareaSelect}
                      className="flex-1 bg-transparent border-none outline-none resize-none font-mono text-xs leading-6 text-[var(--text)] p-3 overflow-y-auto"
                      spellCheck={false}
                    />
                  </div>
                </div>

                {/* 右半区：M31 规范化排版只读预览 */}
                <div
                  className={`w-1/2 overflow-y-auto px-6 py-6 story-reader-paper theme-${settings.theme}`}
                >
                  <div className="text-[11px] font-mono text-[var(--text-muted)] mb-4 pb-1 border-b border-[var(--border)]">
                    排版只读预览 (M31 规范化)
                  </div>
                  {normalizedNovel.mainTitle && (
                    <h1 className="story-chapter-title serif-text text-[var(--text)] text-xl">
                      {normalizedNovel.mainTitle}
                    </h1>
                  )}
                  <div className={`serif-text ${fontSizeClass} ${lineHeightClass}`}>
                    {normalizedNovel.paragraphs.map((p, pIdx) => {
                      if (p.type === "chapter-title") return null;
                      if (p.type === "section-title") {
                        return (
                          <div key={pIdx} className="story-section-title font-mono text-sm">
                            {p.text}
                          </div>
                        );
                      }
                      if (p.type === "divider") {
                        return (
                          <div key={pIdx} className="story-scene-divider">
                            {p.text}
                          </div>
                        );
                      }
                      return (
                        <p key={pIdx} className="story-p">
                          {p.text}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 回到顶部悬浮按钮 */}
            {showBackToTop && viewMode === "reader" && (
              <button
                type="button"
                onClick={scrollToTop}
                className="absolute bottom-6 right-6 p-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border)] shadow-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer z-40 animate-fade-in"
                title="回到顶部"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
