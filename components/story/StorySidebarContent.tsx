"use client";

import React, { memo, useState, useEffect } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";

interface StorySidebarContentProps {
  cwd?: string | null;
  onOpenFile?: (
    filePath: string,
    fileName: string,
    options?: { sourceSessionId?: string | null; modeHint?: "diff" }
  ) => void;
  children?: React.ReactNode;
}

interface ChapterItem {
  fileName: string;
  fullPath: string;
  title: string;
  chapterNum: string;
}

interface OutlineItem {
  fileName: string;
  fullPath: string;
  title: string;
  chapterNum: string;
}

function resolveBookPath(basePath: string, relPath: string): string {
  const normBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normBase}/${normRel}`;
}

export const StorySidebarContent = memo(function StorySidebarContent({
  cwd,
  onOpenFile,
  children,
}: StorySidebarContentProps) {
  const { activeBook, books } = useActiveBook(cwd);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [outlines, setOutlines] = useState<OutlineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSetup, setHasSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<"chapters" | "outlines">("chapters");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 监听全局刷新事件，实现章节/大纲实时感知
  useEffect(() => {
    const handleStoryRefresh = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("story-refresh", handleStoryRefresh);
    return () => window.removeEventListener("story-refresh", handleStoryRefresh);
  }, []);

  // 探测当前工作区是否已完成 story-setup 部署
  useEffect(() => {
    if (!cwd) {
      setHasSetup(false);
      return;
    }
    const normCwd = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
    fetch(`/api/files/${encodeFilePathForApi(normCwd + "/.story-deployed")}?type=read`)
      .then((r) => setHasSetup(r.ok))
      .catch(() => setHasSetup(false));
  }, [cwd]);

  // 动态扫描当前书目下的正文章节与各章细纲
  useEffect(() => {
    if (!activeBook || activeBook.isUninitialized) {
      setChapters([]);
      setOutlines([]);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const basePath = activeBook.path.replace(/\\/g, "/");
    const isSingleFileShort = basePath.endsWith(".txt") || basePath.endsWith(".md");

    if (isSingleFileShort) {
      setChapters([
        {
          fileName: activeBook.fullTitle,
          fullPath: basePath,
          title: "正文成稿",
          chapterNum: "全篇",
        },
      ]);
      setOutlines([
        {
          fileName: activeBook.fullTitle,
          fullPath: basePath,
          title: "短篇速览",
          chapterNum: "短篇",
        },
      ]);
      setLoading(false);
      return;
    }

    const zhengwenDir = resolveBookPath(basePath, "正文");
    const dagangDir = resolveBookPath(basePath, "大纲");

    Promise.all([
      // 1. 扫描正文章节
      fetch(`/api/files/${encodeFilePathForApi(zhengwenDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      // 2. 扫描各章细纲
      fetch(`/api/files/${encodeFilePathForApi(dagangDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      // 3. 兼容短篇可能存放在根目录的 正文.md 与 小节大纲.md
      fetch(`/api/files/${encodeFilePathForApi(basePath)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([zhengwenRes, dagangRes, rootRes]) => {
      if (isCancelled) return;
      setLoading(false);

      let parsedChapters: ChapterItem[] = [];
      if (zhengwenRes && Array.isArray(zhengwenRes.entries)) {
        parsedChapters = zhengwenRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .map((e: { name: string }) => {
            const raw = e.name.replace(/\.md$/, "");
            const parts = raw.split("_");
            const chapterNum = parts[0] || raw;
            const title = parts.slice(1).join(" ") || raw;
            return {
              fileName: e.name,
              fullPath: `${zhengwenDir}/${e.name}`,
              title,
              chapterNum,
            };
          })
          .sort((a: ChapterItem, b: ChapterItem) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
      } else if (rootRes && Array.isArray(rootRes.entries)) {
        const rootZw = rootRes.entries.find((e: { name?: string }) => e.name === "正文.md");
        if (rootZw) {
          parsedChapters = [
            {
              fileName: "正文.md",
              fullPath: `${basePath}/正文.md`,
              title: "成稿正文",
              chapterNum: "全篇",
            },
          ];
        }
      }
      setChapters(parsedChapters);

      let parsedOutlines: OutlineItem[] = [];
      if (dagangRes && Array.isArray(dagangRes.entries)) {
        parsedOutlines = dagangRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .map((e: { name: string }) => {
            const raw = e.name.replace(/\.md$/, "");
            const parts = raw.split("_");
            let chapterNum = parts[1] || parts[0] || raw;
            let title = parts.slice(2).join(" ") || parts.slice(1).join(" ") || raw;
            if (raw.startsWith("大纲")) {
              chapterNum = "卷纲";
              title = parts.slice(1).join(" ") || raw;
            }
            return {
              fileName: e.name,
              fullPath: `${dagangDir}/${e.name}`,
              title,
              chapterNum,
            };
          })
          .sort((a: OutlineItem, b: OutlineItem) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
      } else if (rootRes && Array.isArray(rootRes.entries)) {
        const shortFiles = ["设定.md", "小节大纲.md"];
        parsedOutlines = rootRes.entries
          .filter((e: { name?: string }) => e.name && shortFiles.includes(e.name))
          .map((e: { name: string }) => ({
            fileName: e.name,
            fullPath: `${basePath}/${e.name}`,
            title: e.name === "设定.md" ? "核心框架与人设" : "小节大纲与细纲",
            chapterNum: e.name === "设定.md" ? "设定" : "大纲",
          }))
          .sort((a: OutlineItem, b: OutlineItem) => (a.fileName === "设定.md" ? -1 : 1));
      }
      setOutlines(parsedOutlines);
    });

    return () => {
      isCancelled = true;
    };
  }, [activeBook, refreshTrigger]);

  const handleOpenFile = (fullPath: string, fName: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-story-file", {
          detail: {
            filePath: fullPath,
            fileName: fName,
          },
        })
      );
    }
    onOpenFile?.(fullPath, fName);
  };

  const isZeroState = !activeBook || activeBook.isUninitialized || books.length === 0;
  const isFreshBook = !isZeroState && chapters.length === 0 && outlines.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden text-xs select-none">
      {/* 顶部标题栏 */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-transparent">
        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider serif-text">
          剧情支点
        </span>
        <button
          type="button"
          onClick={() => {
            setRefreshTrigger((p) => p + 1);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("story-refresh"));
            }
          }}
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer p-0.5 rounded hover:bg-[var(--bg-hover)]"
          title="刷新章节与大纲"
        >
          🔄
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
        {/* 1. 纯空工作区状态（尚未立项） */}
        {isZeroState && !loading && (
          <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] text-center space-y-2.5 my-2 shadow-2xs">
            <div className="text-xl">📖</div>
            <div className="font-bold text-xs text-[var(--text)] serif-text">
              {hasSetup ? "暂未立项书籍" : "未部署写作环境"}
            </div>
            {hasSetup ? (
              <>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  当前工作区写作环境已就绪。
                  <br />
                  点击下方按钮立即立项新书开始创作。
                </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("open-new-book"));
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>➕</span>
                    <span>创建新书籍</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("open-import-book"));
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] border border-[var(--border)] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📥</span>
                    <span>导入已有小说</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  当前工作区暂未检测到小说章节结构。
                  <br />
                  点击下方按钮即可一键部署标准网文目录体系。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("insert-story-prompt", {
                        detail: {
                          prompt: "运行 /story-setup，为当前工作区部署 oh-story 网文写作系统与契约守卫，并初始化标准工程目录。",
                          autoFocus: true,
                        },
                      })
                    );
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  ✍️ 初始化小说项目 (/story-setup)
                </button>
              </>
            )}
          </div>
        )}

        {/* 2. 已立项新书筹备态（0章节，待出卷纲与开篇） */}
        {isFreshBook && !loading && (
          <div className="p-3.5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] space-y-3 my-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <span className="text-sm shrink-0">📐</span>
                <span className="font-bold text-xs text-[var(--text)] serif-text truncate">
                  {activeBook.title}
                </span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-medium shrink-0">
                ○ 筹备开篇中
              </span>
            </div>

            {activeBook.id?.startsWith("short:") || activeBook.type?.includes("短篇") || activeBook.path?.includes("/短篇/") ? (
              <>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  短篇新书已立项！建议先构思核心框架与小节大纲，再撰写开篇正文。
                </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("insert-story-prompt", {
                            detail: {
                              prompt: `/story-short-write 为《${activeBook.fullTitle}》完成构思：输出 设定.md 与 小节大纲.md（顶部 5 列全篇粗纲表 + 首批 ## 第1-3节 逐节细纲），完成后停下待确认。`,
                              autoFocus: true,
                            },
                          })
                        );
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>📐</span>
                    <span>构思设定与小节大纲</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("insert-story-prompt", {
                            detail: {
                              prompt: `/story-short-write 撰写《${activeBook.fullTitle}》导语与第1节正文：交代起因与核心冲突，执行短篇格式与去AI味规范并自检。`,
                              autoFocus: true,
                            },
                          })
                        );
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] border border-[var(--border)] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>✍️</span>
                    <span>撰写导语与第1节正文</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  新书已成功立项！建议先推演第1卷卷纲主线与前3章冲突，再撰写第001章开篇。
                </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("insert-story-prompt", {
                            detail: {
                              prompt: `/story-long-write 为《${activeBook.fullTitle}》推演第1卷卷纲：明确核心爽点与主线目标，规划前3章冲突节拍与金手指激活契机。`,
                              autoFocus: true,
                            },
                          })
                        );
                      }
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>📐</span>
                    <span>推演第1卷卷纲架构</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("insert-story-prompt", {
                            detail: {
                              prompt: `/story-long-write 撰写《${activeBook.fullTitle}》第001章正文：确立主角初始情境与核心冲突，执行去AI味三层规范并自检门禁。`,
                              autoFocus: true,
                            },
                          })
                        );
                      }
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] border border-[var(--border)] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>✍️</span>
                    <span>撰写第001章开篇正文</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. 双标签联动展示：左标签【正文章节】 ｜ 右标签【各章细纲】 */}
        {(chapters.length > 0 || outlines.length > 0) && (
          <div>
            <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] mb-2 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("chapters")}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 serif-text ${
                  activeTab === "chapters"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
                title="切换查看正文章节"
              >
                <span>✍️</span>
                <span>正文章节</span>
                <span className="text-[10px] opacity-80 font-mono">({chapters.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("outlines")}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 serif-text ${
                  activeTab === "outlines"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
                title="切换查看各章细纲"
              >
                <span>📋</span>
                <span>各章细纲</span>
                <span className="text-[10px] opacity-80 font-mono">({outlines.length})</span>
              </button>
            </div>

            {/* 当处于【正文章节】视图 */}
            {activeTab === "chapters" && (
              <div className="space-y-1 pl-0.5 animate-fade-in">
                {chapters.length > 0 ? (
                  <>
                    {/* 最新章高亮展示 */}
                    {(() => {
                      const latest = chapters[chapters.length - 1];
                      return (
                        <div
                          key={latest.fileName}
                          onClick={() => handleOpenFile(latest.fullPath, latest.fileName)}
                          className="p-1.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--accent)] hover:bg-[var(--bg-hover)] transition cursor-pointer flex items-center justify-between text-[var(--text)] shadow-2xs"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="font-bold text-[11px] serif-text truncate text-[var(--accent)] flex items-center gap-1">
                              <span>✍️</span>
                              <span>{latest.chapterNum} {latest.title}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate">
                              最新章节 · 点击在画板打开
                            </div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-contrast)] shrink-0 font-medium">
                            最新
                          </span>
                        </div>
                      );
                    })()}

                    {/* 历史倒序最近章节 */}
                    {chapters.slice(-8, -1).reverse().map((ch) => (
                      <div
                        key={ch.fileName}
                        onClick={() => handleOpenFile(ch.fullPath, ch.fileName)}
                        className="p-1.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] transition cursor-pointer flex items-center justify-between text-[var(--text)]"
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-bold text-[11px] serif-text truncate">
                            {ch.chapterNum} {ch.title}
                          </div>
                        </div>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] shrink-0 font-mono">
                          已落盘
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-4 text-xs text-[var(--text-muted)]">暂无正文章节</div>
                )}
              </div>
            )}

            {/* 当处于【各章细纲】视图 */}
            {activeTab === "outlines" && (
              <div className="space-y-1 pl-0.5 animate-fade-in">
                {outlines.length > 0 ? (
                  <>
                    {/* 最新细纲高亮展示 */}
                    {(() => {
                      const latest = outlines[outlines.length - 1];
                      return (
                        <div
                          key={latest.fileName}
                          onClick={() => handleOpenFile(latest.fullPath, latest.fileName)}
                          className="p-1.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--accent)] hover:bg-[var(--bg-hover)] transition cursor-pointer flex items-center justify-between text-[var(--text)] shadow-2xs"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="font-bold text-[11px] serif-text truncate text-[var(--accent)] flex items-center gap-1">
                              <span>📋</span>
                              <span>{latest.chapterNum} {latest.title}</span>
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate">
                              最新细纲 · 点击在画板打开
                            </div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-contrast)] shrink-0 font-medium">
                            最新
                          </span>
                        </div>
                      );
                    })()}

                    {/* 历史倒序最近细纲 */}
                    {outlines.slice(-8, -1).reverse().map((out) => (
                      <div
                        key={out.fileName}
                        onClick={() => handleOpenFile(out.fullPath, out.fileName)}
                        className="p-1.5 px-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] transition cursor-pointer flex items-center justify-between text-[var(--text)]"
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-bold text-[11px] serif-text truncate">
                            {out.chapterNum} {out.title}
                          </div>
                        </div>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] shrink-0 font-mono">
                          细纲
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-4 text-xs text-[var(--text-muted)]">大纲目录下暂无细纲文件</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 会话历史树 */}
        <div className="pt-2 border-t border-[var(--border)]">
          <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider serif-text px-1 pb-1">
            创作会话记录
          </div>
          {children}
        </div>
      </div>
    </div>
  );
});
