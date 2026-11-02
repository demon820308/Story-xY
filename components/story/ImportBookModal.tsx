"use client";

import React, { useState, memo } from "react";
import { useActiveBook, BookInfo } from "./useActiveBook";
import { buildImportBookPrompt } from "@/lib/story-prompts";

interface ImportBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  cwd?: string | null;
}

export const ImportBookModal = memo(function ImportBookModal({
  isOpen,
  onClose,
  cwd,
}: ImportBookModalProps) {
  const { addBook } = useActiveBook(cwd);
  const [filePath, setFilePath] = useState("");
  const [targetTitle, setTargetTitle] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPath = filePath.trim();
    if (!cleanPath) return;

    const fallbackTitle = cleanPath.split(/[/\\]/).filter(Boolean).pop()?.replace(/\.[^/.]+$/, "") || "导入作品";
    const cleanTitle = targetTitle.trim() || fallbackTitle;

    const importedBook: BookInfo = {
      id: `import-${Date.now()}`,
      title: `《${cleanTitle}》`,
      fullTitle: cleanTitle,
      type: "外部导入 · 拆文重构",
      status: "● 导入中",
      statusColor: "text-[#0891b2]",
      desc: "已指定源文件 · 正在提取事实与反推人物动机",
      path: cleanPath,
      currentChapter: "导入切分中",
      words: "正在统计",
    };
    addBook(importedBook);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("insert-story-prompt", {
          detail: {
            prompt: buildImportBookPrompt(cleanPath, cleanTitle),
          },
        })
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1250] flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)]">
        
        {/* 顶栏 */}
        <div className="p-4 px-6 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold serif-text">📥 导入已有小说 (story-import)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[var(--text)] serif-text mb-1">
              本地文本文件路径 (.txt / .md) *
            </label>
            <input
              type="text"
              required
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="例如：~/novels/斗破苍穹.txt 或 demo/短篇-曾将爱意私藏.txt"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs font-mono"
            />
            <p className="text-[10px] text-[var(--text-dim)] mt-1">
              支持长篇全本、短篇样章；将由 story-import 自动切章并结构化归档入库。
            </p>
          </div>

          <div>
            <label className="block font-bold text-[var(--text)] serif-text mb-1">
              书目命名（选填，留空则从文件名提取）
            </label>
            <input
              type="text"
              value={targetTitle}
              onChange={(e) => setTargetTitle(e.target.value)}
              placeholder="例如：曾将爱意私藏"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs"
            />
          </div>

          <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] space-y-1 text-[11px] text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text)] serif-text">💡 导入处理契约：</span>
            <p>1. 自动执行每章字数与情节点提取，不破坏原始文本；</p>
            <p>2. 反推前三卷大纲走向与关键人物动机弧线；</p>
            <p>3. 导入成功后自动同步写入书架并设为当前活跃书目。</p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs serif-text font-medium transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold serif-text hover:opacity-90 shadow-xs cursor-pointer transition"
            >
              开始导入并加入书架
            </button>
          </div>
        </form>

      </div>
    </div>
  );
});
