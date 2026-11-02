"use client";

import React, { useState, memo } from "react";
import { useActiveBook, BookInfo } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { buildNewBookPrompt } from "@/lib/story-prompts";

interface NewBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  cwd?: string | null;
}

export const NewBookModal = memo(function NewBookModal({
  isOpen,
  onClose,
  cwd,
}: NewBookModalProps) {
  const { addBook, books } = useActiveBook(cwd);
  const [title, setTitle] = useState("");
  const [bookType, setBookType] = useState<"long" | "short">("long");
  const [genre, setGenre] = useState("custom");
  const [customGenre, setCustomGenre] = useState("");
  const [hook, setHook] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    if (/[\\/:*?"<>|]/.test(cleanTitle)) {
      alert("书名不得包含 \\ / : * ? \" < > | 等路径特殊字符，请修改书名。");
      return;
    }

    if (books.some((b) => b.fullTitle === cleanTitle)) {
      alert(`当前工作区已存在名为《${cleanTitle}》的书籍，请更换书名。`);
      return;
    }

    const isShort = bookType === "short";
    const finalGenre = genre === "custom" ? (customGenre.trim() || "自定义题材") : genre;
    const bookRel = isShort ? `短篇/${cleanTitle}` : `长篇/${cleanTitle}`;
    const normCwd = (cwd || "").replace(/\\/g, "/").replace(/\/+$/, "");
    const bookPath = normCwd ? `${normCwd}/${bookRel}` : `demo/${bookRel}`;

    setSubmitting(true);

    // M21 提交时先落盘最小骨架与标记，确保磁盘为单一事实源
    try {
      if (normCwd) {
        if (isShort) {
          await fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/.book-kind`)}?type=write`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "short\n" }),
          });
        } else {
          await Promise.all([
            fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/.book-kind`)}?type=write`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "long\n" }),
            }),
            fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/设定/.gitkeep`)}?type=write`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "" }),
            }),
            fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/大纲/.gitkeep`)}?type=write`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "" }),
            }),
            fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/正文/.gitkeep`)}?type=write`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "" }),
            }),
            fetch(`/api/files/${encodeFilePathForApi(`${bookPath}/追踪/.gitkeep`)}?type=write`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "" }),
            }),
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to create book scaffold on disk:", err);
    }

    const newBook: BookInfo = {
      id: isShort ? `short:${bookPath}` : `book:${bookPath}`,
      title: `《${cleanTitle}》`,
      fullTitle: cleanTitle,
      type: isShort ? `${finalGenre} · 短篇` : `${finalGenre} · 长篇`,
      status: isShort ? "○ 待构思" : "○ 刚刚立项",
      statusColor: "text-[#d97706]",
      desc: isShort ? "骨架已建 · 待出设定与小节大纲" : "骨架已建 · 待出第1卷卷纲与前3章细纲",
      path: bookPath,
      currentChapter: isShort ? "未开始" : "待起笔",
      words: "—",
      isUninitialized: false,
    };

    addBook(newBook);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("story-book-added", { detail: newBook }));
      window.dispatchEvent(new CustomEvent("story-refresh"));
      window.dispatchEvent(
        new CustomEvent("insert-story-prompt", {
          detail: {
            prompt: buildNewBookPrompt(isShort ? "short" : "long", cleanTitle, bookRel, finalGenre, hook),
          },
        })
      );
    }

    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1250] flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text)]">
        
        {/* 顶栏 */}
        <div className="p-4 px-6 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold serif-text">➕ 新书立项向导 (story-architect)</span>
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
              作品书名 *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：让你管账号，你高燃混剪炸全网"
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text)] serif-text mb-1">
                创作体裁
              </label>
              <select
                value={bookType}
                onChange={(e) => setBookType(e.target.value as "long" | "short")}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs"
              >
                <option value="long">长篇连载 (带卷纲与细纲)</option>
                <option value="short">短篇小说 (精修与小节纲)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text)] serif-text mb-1">
                题材赛道
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs"
              >
                <option value="custom">✍️ 自定义题材分类...</option>
                <option value="都市逆袭">都市逆袭 / 职场鉴宝</option>
                <option value="传统玄幻">传统玄幻 / 仙侠修真</option>
                <option value="科幻悬疑">科幻末日 / 规则怪谈</option>
                <option value="言情精修">现代言情 / 追妻火葬场</option>
                <option value="军工热血">军工热血 / 军旅主旋律</option>
              </select>
              {genre === "custom" && (
                <input
                  type="text"
                  required
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  placeholder="输入自定义题材，如：历史架空、无限流"
                  className="mt-2 w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-[var(--text)] serif-text mb-1">
              核心梗 / 核心设定卖点 (一句话)
            </label>
            <textarea
              rows={3}
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="例如：穿越到濒临倒闭的军区宣传处，利用全网顶流混剪系统将老兵故事与国之重器推向热搜第一..."
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-xs shadow-2xs resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs serif-text font-medium transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold serif-text hover:opacity-90 shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              {submitting ? "正在创建骨架..." : "立即立项并存入书架"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
});
