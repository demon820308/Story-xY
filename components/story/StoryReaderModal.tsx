"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import { useActiveBook } from "./useActiveBook";
import { parseFrontmatter } from "@/lib/frontmatter";
import { encodeFilePathForApi } from "@/lib/file-paths";
import {
  isExternalMarkdownHref,
  markdownAppUrlTransform,
  markdownPreviewRehypePlugins,
  markdownPreviewRemarkPlugins,
  normalizeDisplayMath,
} from "@/lib/markdown";
import { CodeBlock, MermaidBlock } from "../MermaidBlock";
import { FrontmatterCard } from "../FrontmatterCard";

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
    const data = await res.json() as { content?: string; truncated?: boolean; nextOffset?: number };
    full += data.content ?? "";
    if (!data.truncated) break;
    offset = data.nextOffset ?? (offset + (data.content?.length ?? 0));
  }
  // 如果读取出的文本不幸包含 JSON 字符串包裹，安全自动解包
  if (full.startsWith('{"content":') && full.trim().endsWith('}')) {
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

  // 模式切换：false = 阅览模式，true = 手动精修模式
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [actionFeedback, setActionFeedback] = useState<"deslop" | "review" | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const currentChapter = chapters[selectedIndex] ?? null;

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

        // 自然数排序（第001章、第002章...第025章）
        list.sort((a, b) => a.chapterNum - b.chapterNum || a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
        setChapters(list);

        // 定位初始章节
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

  // 2. 加载当前选中章节正文（遵循 FileViewer 的文件读取协议）
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

  // 4. 输入时防抖自动保存（1000ms）
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
  const handleSelectChapter = (newIndex: number) => {
    if (newIndex === selectedIndex) return;
    if (saveStatus === "unsaved" && currentChapter) {
      void saveContentImmediately(contentRef.current, currentChapter.fullPath);
    }
    setSelectedIndex(newIndex);
  };

  // 6. 关闭窗口前强制保存
  const handleClose = () => {
    if (saveStatus === "unsaved" && currentChapter) {
      void saveContentImmediately(contentRef.current, currentChapter.fullPath);
    }
    onClose();
  };

  // 7. 键盘快捷键监听：Ctrl+S / Cmd+S 立即保存，Esc 关闭
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      void saveContentImmediately(content);
    }
  };

  // 8. 成稿工具联动：重新去AI味
  const handleDeslop = async () => {
    if (!currentChapter) return;
    if (saveStatus === "unsaved") {
      await saveContentImmediately(content);
    }
    const label = currentChapter.rawNum || "当前章";
    const prompt = `/story-deslop 对当前${label}成稿正文运行二次三层去AI味清洗：过滤模式化口癖、机械排比与空洞说教。`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
    }
    setActionFeedback("deslop");
    setTimeout(() => {
      setActionFeedback(null);
      handleClose(); // 自动关闭阅读器，回到主会话观察执行
    }, 800);
  };

  // 9. 成稿工具联动：重新审稿质检
  const handleReview = async () => {
    if (!currentChapter) return;
    if (saveStatus === "unsaved") {
      await saveContentImmediately(content);
    }
    const label = currentChapter.rawNum || "当前章";
    const prompt = `/story-review 对抗性审查${label}成稿：核验事实一致性（S1-S4）、角色人设OOC、伏笔闭环与时间线。`;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
    }
    setActionFeedback("review");
    setTimeout(() => {
      setActionFeedback(null);
      handleClose();
    }, 800);
  };

  // 统计当前字数
  const wordCount = useMemo(() => {
    const cleaned = content.replace(/\s+/g, "");
    return cleaned.length;
  }, [content]);

  // 10. FileViewer 级 Markdown 解析（处理 frontmatter 与 math）
  const frontmatter = useMemo(() => parseFrontmatter(content), [content]);
  const markdownBody = useMemo(() => normalizeDisplayMath(content), [content]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 select-none animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92vh] bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)]">
        
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base font-bold serif-text truncate text-[var(--text)]">
              {activeBook?.title ? `《${activeBook.title}》` : "小说全本阅览与精修"}
            </span>
            {currentChapter && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] serif-text shrink-0">
                {currentChapter.rawNum} · {wordCount} 字
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 自动保存状态指示 */}
            {isEditing && (
              <div className="text-[11px] px-2 py-0.5 rounded-md serif-text font-medium flex items-center gap-1 transition">
                {saveStatus === "saving" ? (
                  <span className="text-[var(--accent)] animate-pulse">正在保存... 💾</span>
                ) : saveStatus === "unsaved" ? (
                  <span className="text-amber-500">有修改未保存 *</span>
                ) : (
                  <span className="text-emerald-500 opacity-90">已自动保存 ✓</span>
                )}
              </div>
            )}

            {/* 模式切换：阅览 ⇄ 编辑 */}
            <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-2xs">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium serif-text transition cursor-pointer flex items-center gap-1 ${
                  !isEditing
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="切换到小说阅览排版视图"
              >
                <span>📖</span>
                <span>阅览</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium serif-text transition cursor-pointer flex items-center gap-1 ${
                  isEditing
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
                title="切换到手动修改精修模式（支持实时自动保存）"
              >
                <span>✏️</span>
                <span>精修</span>
              </button>
            </div>

            {/* 成稿工具：重新去AI味 */}
            <button
              type="button"
              onClick={handleDeslop}
              className="px-2.5 py-1 rounded-xl bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium serif-text transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="保存当前修改，并对该章调用 Agent 重新执行三层去AI味清洗"
            >
              <span>🧹</span>
              <span>{actionFeedback === "deslop" ? "已发送清洗指令 ✓" : "重新去AI味"}</span>
            </button>

            {/* 成稿工具：重新审稿质检 */}
            <button
              type="button"
              onClick={handleReview}
              className="px-2.5 py-1 rounded-xl bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-medium serif-text transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="保存当前修改，并对该章调用 Agent 重新执行对抗性质检与矛盾核验"
            >
              <span>🛡️</span>
              <span>{actionFeedback === "review" ? "已发送质检指令 ✓" : "重新审稿质检"}</span>
            </button>

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={handleClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer ml-1"
              title="关闭全书阅读器"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 主体双栏区域 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* 左侧：全书章节目录 */}
          <div className="w-60 md:w-68 border-r border-[var(--border)] bg-[var(--bg-panel)] flex flex-col shrink-0">
            <div className="p-3 border-b border-[var(--border)] text-xs font-bold serif-text text-[var(--text-muted)] flex items-center justify-between">
              <span>全书目录（共 {chapters.length} 章）</span>
              {loadingList && <span className="animate-spin text-[10px]">⌛</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {chapters.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-muted)] serif-text">
                  {loadingList ? "正在扫描全文章节..." : "暂未检测到已成稿章节"}
                </div>
              ) : (
                chapters.map((ch, idx) => {
                  const isCurrent = idx === selectedIndex;
                  return (
                    <div
                      key={ch.fileName}
                      onClick={() => handleSelectChapter(idx)}
                      className={`p-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-between gap-1.5 ${
                        isCurrent
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs"
                          : "hover:bg-[var(--bg-hover)] text-[var(--text)]"
                      }`}
                    >
                      <div className="min-w-0 flex-1 truncate serif-text">
                        <span>{ch.rawNum}</span>
                        {ch.title && ch.title !== ch.rawNum && (
                          <span className="ml-1 opacity-90 truncate">{ch.title}</span>
                        )}
                      </div>
                      {isCurrent && <span className="text-[10px] shrink-0 font-sans">当前</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧：正文舞台（阅览 / 手动精修） */}
          <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg)] overflow-hidden">
            {loadingContent ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] serif-text">
                正在加载正文...
              </div>
            ) : !currentChapter ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] serif-text">
                请在左侧选择章节开始阅读
              </div>
            ) : isEditing ? (
              /* 编辑模式：优雅专注的写作框 */
              <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
                <div className="mb-2 text-[11px] text-[var(--text-muted)] serif-text flex items-center justify-between">
                  <span>💡 手动精修中：修改即触发自动保存 · 支持 Ctrl+S 立即存盘 · 修改后可直接点击顶部按钮重新清洗质检</span>
                  <span className="font-mono">{wordCount} 字</span>
                </div>
                <textarea
                  value={content}
                  onChange={handleContentChange}
                  onKeyDown={handleKeyDown}
                  placeholder="在此手动修改章节正文..."
                  autoFocus
                  className="w-full flex-1 bg-transparent border border-[var(--border)] rounded-xl outline-none resize-none serif-text text-[16px] md:text-[17px] leading-[1.95] text-[var(--text)] placeholder-[var(--text-dim)] p-4 selection:bg-[var(--accent)] selection:text-[var(--accent-contrast)] focus:border-[var(--accent)] transition"
                  style={{
                    letterSpacing: "0.02em",
                  }}
                />
              </div>
            ) : (
              /* 阅览模式：完全沿用 FileViewer 的 ReactMarkdown 渲染引擎 */
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <div className="max-w-[760px] mx-auto">
                  <div className="markdown-body markdown-file-preview serif-text">
                    {frontmatter?.data && <FrontmatterCard data={frontmatter.data} />}
                    <ReactMarkdown
                      remarkPlugins={markdownPreviewRemarkPlugins}
                      rehypePlugins={markdownPreviewRehypePlugins}
                      urlTransform={markdownAppUrlTransform}
                      components={{
                        code({ className, children, ...props }) {
                          const lang = className?.replace("language-", "").toLowerCase() ?? "";
                          const raw = String(children);
                          const isBlock = className?.includes("language-") || raw.includes("\n");
                          if (isBlock) {
                            if (lang === "mermaid") {
                              return <MermaidBlock code={raw.replace(/\n$/, "")} defaultPreview />;
                            }
                            return <CodeBlock code={raw.replace(/\n$/, "")} lang={lang} />;
                          }
                          return (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                        pre({ children }) {
                          return <>{children}</>;
                        },
                        a({ href, children, ...props }) {
                          delete props.node;
                          return isExternalMarkdownHref(href) ? (
                            <a href={href} {...props} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ) : (
                            <a href={href} {...props}>
                              {children}
                            </a>
                          );
                        },
                      }}
                    >
                      {markdownBody}
                    </ReactMarkdown>
                  </div>

                  {/* 底部跨章导航 */}
                  <div className="mt-14 pt-6 border-t border-[var(--border)] flex items-center justify-between text-xs serif-text text-[var(--text-muted)]">
                    <button
                      type="button"
                      disabled={selectedIndex <= 0}
                      onClick={() => handleSelectChapter(selectedIndex - 1)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>◀</span>
                      <span>上一章</span>
                    </button>

                    <span className="font-mono text-[11px]">
                      {selectedIndex + 1} / {chapters.length}
                    </span>

                    <button
                      type="button"
                      disabled={selectedIndex >= chapters.length - 1}
                      onClick={() => handleSelectChapter(selectedIndex + 1)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text)] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>下一章</span>
                      <span>▶</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
