/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, memo, useMemo, useRef, useEffect } from "react";
import { useActiveBook, BookInfo } from "./useActiveBook";
import { uploadFiles } from "@/lib/file-upload-client";
import { encodeFilePathForApi } from "@/lib/file-paths";

interface BookshelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewBook: () => void;
  onOpenImportBook: () => void;
  cwd?: string | null;
}

/** 单本书籍封面展示与容错组件（黄金比例放大 + 优雅降级） */
const BookCover = memo(function BookCover({
  coverUrl,
  fullTitle,
  onUpload,
  onPick,
  onGenerate,
}: {
  coverUrl?: string;
  fullTitle: string;
  onUpload: () => void;
  onPick: () => void;
  onGenerate: () => void;
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const showImg = Boolean(coverUrl && !loadFailed);

  return (
    <div className="w-18 h-25 sm:w-20 sm:h-28 rounded-xl bg-[var(--bg)] text-[var(--text)] shrink-0 flex flex-col items-center justify-center p-1 text-center border border-[var(--border)] relative group shadow-sm overflow-hidden select-none">
      {showImg ? (
        <img
          src={coverUrl}
          alt={fullTitle}
          onError={() => setLoadFailed(true)}
          className="w-full h-full object-cover rounded-xl"
        />
      ) : (
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-[var(--bg)] to-[var(--bg-hover)] flex flex-col items-center justify-center p-1.5 text-center">
          <span className="text-xl mb-1 opacity-70">📖</span>
          <span className="text-[10px] font-bold serif-text line-clamp-2 px-0.5 leading-snug text-[var(--text-muted)]">
            {fullTitle.slice(0, 8)}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/75 rounded-xl opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-1">
        <button
          type="button"
          onClick={onUpload}
          className="text-[10px] text-white hover:text-[var(--accent)] font-medium cursor-pointer whitespace-nowrap"
          title="手动上传本地图片作为封面"
        >
          📁 上传
        </button>
        <button
          type="button"
          onClick={onPick}
          className="text-[10px] text-white hover:text-[var(--accent)] font-medium cursor-pointer whitespace-nowrap"
          title="从已生成的封面中挑选"
        >
          🖼️ 挑选
        </button>
        <button
          type="button"
          onClick={onGenerate}
          className="text-[9px] text-[var(--accent)] font-bold hover:underline cursor-pointer whitespace-nowrap"
          title="调用 story-cover 构思并生成新封面"
        >
          ✨ 生图
        </button>
      </div>
    </div>
  );
});

export const BookshelfModal = memo(function BookshelfModal({
  isOpen,
  onClose,
  onOpenNewBook,
  onOpenImportBook,
  cwd,
}: BookshelfModalProps) {
  const { activeBook, books, selectBook } = useActiveBook(cwd);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 封面上传与挑选状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverActionBook, setCoverActionBook] = useState<BookInfo | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverPickerLoading, setCoverPickerLoading] = useState(false);
  const [availableCovers, setAvailableCovers] = useState<{ name: string; url: string }[]>([]);

  const folderName = useMemo(() => {
    if (!cwd) return "未指定工作区";
    return cwd.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "当前工作区";
  }, [cwd]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleTriggerCover = (bookTitle: string) => {
    showToast(`🎨 已调用 story-cover：为《${bookTitle}》构思并生成高质量竖版封面！`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("insert-story-prompt", {
          detail: {
            prompt: `/story-cover 为《${bookTitle}》构思并生成高质量竖版小说封面插图。`,
          },
        })
      );
    }
  };

  const handleOpenUpload = (b: BookInfo) => {
    setCoverActionBook(b);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverActionBook) return;
    try {
      showToast(`正在上传封面《${coverActionBook.fullTitle}》...`);
      const isShortFile = coverActionBook.path.endsWith(".txt") || coverActionBook.path.endsWith(".md");
      let targetDir = coverActionBook.path;
      let targetFileName = "cover.png";
      if (isShortFile) {
        const parts = coverActionBook.path.replace(/\\/g, "/").split("/");
        parts.pop();
        targetDir = parts.join("/");
        targetFileName = `${coverActionBook.fullTitle}.png`;
      } else {
        targetDir = `${coverActionBook.path.replace(/\\/g, "/")}/封面`;
      }
      const renamedFile = new File([file], targetFileName, { type: file.type });
      const res = await uploadFiles(targetDir, [renamedFile], "overwrite");
      if (res.status === 200) {
        showToast(`🎉 成功更新《${coverActionBook.fullTitle}》封面！`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("story-refresh"));
        }
      } else {
        showToast(`上传失败：${res.data?.error || "请重试"}`);
      }
    } catch (err) {
      showToast(`上传出错：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setCoverActionBook(null);
    }
  };

  const handleOpenCoverPicker = async (b: BookInfo) => {
    setCoverActionBook(b);
    setCoverPickerOpen(true);
    setCoverPickerLoading(true);
    setAvailableCovers([]);
    const isShortFile = b.path.endsWith(".txt") || b.path.endsWith(".md");
    const coverDir = isShortFile
      ? b.path.replace(/\\/g, "/").split("/").slice(0, -1).join("/")
      : `${b.path.replace(/\\/g, "/")}/封面`;
    try {
      const res = await fetch(`/api/files/${encodeFilePathForApi(coverDir)}?type=list`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.entries)) {
          const imgs = data.entries
            .filter((entry: { name: string; isDir?: boolean }) => !entry.isDir && /\.(png|jpe?g|webp)$/i.test(entry.name))
            .map((entry: { name: string }) => ({
              name: entry.name,
              url: `/api/files/${encodeFilePathForApi(coverDir + "/" + entry.name)}?type=read`,
            }));
          setAvailableCovers(imgs);
        }
      }
    } catch {}
    setCoverPickerLoading(false);
  };

  const handleApplyCover = async (coverItem: { name: string; url: string }) => {
    if (!coverActionBook) return;
    try {
      showToast(`正在将 ${coverItem.name} 设为当前封面...`);
      const res = await fetch(coverItem.url);
      const blob = await res.blob();
      const isShortFile = coverActionBook.path.endsWith(".txt") || coverActionBook.path.endsWith(".md");
      let targetDir = coverActionBook.path;
      let targetFileName = "cover.png";
      if (isShortFile) {
        const parts = coverActionBook.path.replace(/\\/g, "/").split("/");
        parts.pop();
        targetDir = parts.join("/");
        targetFileName = `${coverActionBook.fullTitle}.png`;
      } else {
        targetDir = `${coverActionBook.path.replace(/\\/g, "/")}/封面`;
      }
      const file = new File([blob], targetFileName, { type: blob.type || "image/png" });
      const upRes = await uploadFiles(targetDir, [file], "overwrite");
      if (upRes.status === 200) {
        showToast(`🎉 成功将 ${coverItem.name} 设为《${coverActionBook.fullTitle}》封面！`);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("story-refresh"));
        }
        setCoverPickerOpen(false);
        setCoverActionBook(null);
      } else {
        showToast(`设置失败：${upRes.data?.error || "请重试"}`);
      }
    } catch (err) {
      showToast(`设置出错：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 监听大图预览中的“设为本书封面”快捷事件
  useEffect(() => {
    const handleSetAsCover = async (e: Event) => {
      const custom = e as CustomEvent<{ src: string }>;
      if (!custom.detail?.src || !activeBook || activeBook.isUninitialized) return;
      try {
        const src = custom.detail.src;
        const res = await fetch(src);
        const blob = await res.blob();
        const isShortFile = activeBook.path.endsWith(".txt") || activeBook.path.endsWith(".md");
        let targetDir = activeBook.path;
        let targetFileName = "cover.png";
        if (isShortFile) {
          const parts = activeBook.path.replace(/\\/g, "/").split("/");
          parts.pop();
          targetDir = parts.join("/");
          targetFileName = `${activeBook.fullTitle}.png`;
        } else {
          targetDir = `${activeBook.path.replace(/\\/g, "/")}/封面`;
        }
        const file = new File([blob], targetFileName, { type: blob.type || "image/png" });
        const upRes = await uploadFiles(targetDir, [file], "overwrite");
        if (upRes.status === 200) {
          showToast(`🎉 已将该图片设为《${activeBook.fullTitle}》封面！`);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("story-refresh"));
          }
        }
      } catch {}
    };
    window.addEventListener("set-as-book-cover", handleSetAsCover);
    return () => window.removeEventListener("set-as-book-cover", handleSetAsCover);
  }, [activeBook]);

  const handleSwitchBook = (b: BookInfo) => {
    selectBook(b.id);
    onClose();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("story-switch-cwd", { detail: { cwd: b.path } }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1200] flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-6xl xl:max-w-7xl bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] text-[var(--text)] transition-all duration-200">
        
        {/* 书架顶栏 */}
        <div className="p-4 px-6 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="zs-mark" aria-hidden="true">架</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text)] serif-text">
                  我的书架 · 作品管理
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 font-medium">
                  {folderName}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                管理当前工作区作品，支持换封面 (story-cover)、立项新书与导入拆书
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 书架操作与状态栏 */}
        <div className="px-6 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">当前工作区：</span>
            <span className="font-mono text-[var(--text)] text-[11px] bg-[var(--bg-panel)] px-2 py-0.5 rounded border border-[var(--border)]">
              {cwd || "默认目录"}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">· 共收录</span>
            <span className="font-bold text-[var(--text)] font-mono">{books.length}</span>
            <span className="text-[11px] text-[var(--text-muted)]">部作品</span>
            {books.length > 0 && (
              <>
                <span className="text-[11px] text-[var(--text-muted)]">· 活跃书目：</span>
                <span className="font-bold text-[var(--accent)] serif-text">{activeBook?.title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenNewBook();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-1.5 transition"
            >
              <span>➕</span>
              <span>新建长篇/短篇</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenImportBook();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] border border-[var(--border)] shadow-2xs cursor-pointer flex items-center gap-1.5 transition"
            >
              <span>📥</span>
              <span>导入已有小说</span>
            </button>
          </div>
        </div>

        {/* 书籍矩阵卡片列表 */}
        <div className="flex-1 overflow-y-auto p-6 text-xs bg-[var(--bg-subtle)] space-y-4">
          {books.length === 0 ? (
            <div className="py-12 px-6 text-center border-2 border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-panel)] space-y-3">
              <div className="text-4xl">📖</div>
              <h3 className="text-sm font-bold text-[var(--text)] serif-text">
                当前工作区暂无小说作品
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                当前工作区尚未建立已写正文的小说工程。你可以点击下方按钮立即立项新书，或导入已有小说开始写作与管理。
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    onClose();
                    onOpenNewBook();
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>➕</span>
                  <span>新建立项新书</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenImportBook();
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] border border-[var(--border)] shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>📥</span>
                  <span>导入已有小说</span>
                </button>
              </div>
            </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {books.map((b) => {
                  const isActive = activeBook?.id === b.id || activeBook?.path === b.path;
                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl bg-[var(--bg-panel)] border transition flex flex-col justify-between shadow-2xs relative ${
                        isActive
                          ? "border-2 border-[var(--accent)] shadow-sm"
                          : "border-[var(--border)] hover:border-[var(--accent)]/50"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border)] font-medium">
                            {b.type}
                          </span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-bold border border-[var(--accent)]/30">
                              ● 当前创作中
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3.5 items-start">
                          <BookCover
                            coverUrl={b.coverUrl}
                            fullTitle={b.fullTitle}
                            onUpload={() => handleOpenUpload(b)}
                            onPick={() => handleOpenCoverPicker(b)}
                            onGenerate={() => handleTriggerCover(b.fullTitle)}
                          />

                          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                            <h3 className="font-bold text-sm text-[var(--text)] serif-text truncate" title={b.fullTitle}>
                              {b.fullTitle}
                            </h3>
                            <p className="text-[11px] text-[var(--text-muted)] truncate" title={b.currentChapter}>
                              进度：{b.currentChapter}
                            </p>
                            <p className="text-[11px] text-[var(--text-dim)] truncate">
                              字数：{b.words}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenUpload(b)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] serif-text cursor-pointer whitespace-nowrap shrink-0 transition"
                            title="上传本地图片作为封面"
                          >
                            📁 上传
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCoverPicker(b)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] serif-text cursor-pointer whitespace-nowrap shrink-0 transition"
                            title="从已生成的图片中挑选封面"
                          >
                            🖼️ 挑选
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerCover(b.fullTitle)}
                            className="text-[11px] text-[var(--accent)] hover:underline serif-text cursor-pointer whitespace-nowrap shrink-0 transition font-medium"
                            title="调用 story-cover 生成新封面"
                          >
                            🎨 生图
                          </button>
                        </div>
                        <div className="shrink-0">
                          {isActive ? (
                            <span className="text-xs text-[var(--accent)] font-medium serif-text whitespace-nowrap">
                              正在会话中
                            </span>
                          ) : b.isUninitialized ? (
                            <button
                              type="button"
                              onClick={() => handleSwitchBook(b)}
                              className="px-3 py-1 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 shadow-xs cursor-pointer whitespace-nowrap"
                            >
                              ✍️ 开始创作
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchBook(b)}
                              className="px-3 py-1 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] hover:bg-[var(--bg-selected)] border border-[var(--border)] text-xs font-medium serif-text shadow-xs cursor-pointer whitespace-nowrap"
                            >
                              切换到此书 →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {/* 隐藏的本地封面文件上传 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* 挑选已有生成封面弹层 */}
        {coverPickerOpen && coverActionBook && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[1300] flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl p-4 flex flex-col max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div>
                  <h3 className="font-bold text-sm serif-text text-[var(--text)]">
                    挑选封面 · 《{coverActionBook.fullTitle}》
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    点击将已生成的图片设置为书籍主封面
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCoverPickerOpen(false);
                    setCoverActionBook(null);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] text-sm font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3">
                {coverPickerLoading ? (
                  <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                    正在读取封面目录...
                  </div>
                ) : availableCovers.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">
                      封面目录暂无可用图片文件
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverPickerOpen(false);
                          handleOpenUpload(coverActionBook);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs serif-text font-medium cursor-pointer"
                      >
                        📁 本地上传封面
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverPickerOpen(false);
                          handleTriggerCover(coverActionBook.fullTitle);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] text-xs serif-text font-medium border border-[var(--border)] cursor-pointer"
                      >
                        🎨 调用 AI 生图
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableCovers.map((cov) => (
                      <div
                        key={cov.name}
                        className="group relative rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg)] flex flex-col hover:border-[var(--accent)] transition shadow-2xs"
                      >
                        <div className="w-full aspect-[3/4] relative overflow-hidden bg-black/10">
                          <img
                            src={cov.url}
                            alt={cov.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        </div>
                        <div className="p-2 flex items-center justify-between bg-[var(--bg-panel)]">
                          <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[100px]" title={cov.name}>
                            {cov.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApplyCover(cov)}
                            className="px-2 py-0.5 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-[10px] font-bold serif-text hover:opacity-90 shadow-2xs cursor-pointer"
                          >
                            设为封面
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setCoverPickerOpen(false);
                    handleOpenUpload(coverActionBook);
                  }}
                  className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                >
                  ➕ 本地上传新图片
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCoverPickerOpen(false);
                    setCoverActionBook(null);
                  }}
                  className="px-3 py-1 rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast 提示浮窗 */}
        {toastMessage && (
          <div className="p-2 px-4 bg-[var(--bg)] text-[var(--text)] text-xs text-center border-t border-[var(--border)] animate-fade-in serif-text">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
});
