/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useRef, useEffect, memo } from "react";
import { useActiveBook } from "./useActiveBook";

interface ActiveBookCardProps {
  cwd?: string | null;
}

export const ActiveBookCard = memo(function ActiveBookCard({ cwd }: ActiveBookCardProps) {
  const { activeBook, books, selectBook } = useActiveBook(cwd);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenBookshelf = () => {
    setDropdownOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-bookshelf"));
    }
  };

  return (
    <div ref={cardRef} className="relative p-2.5 border-b border-[var(--border)] bg-transparent select-none">
      {/* 活跃书籍卡片主框 */}
      <div
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="p-2.5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] hover:border-[var(--accent)] transition shadow-2xs cursor-pointer flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {activeBook.coverUrl ? (
            <img
              src={activeBook.coverUrl}
              alt={activeBook.fullTitle}
              className="w-8 h-11 rounded-lg object-cover border border-[var(--border)] shrink-0 shadow-2xs"
            />
          ) : (
            <div className="w-8 h-11 rounded-lg bg-[var(--bg)] border border-[var(--border)] shrink-0 flex items-center justify-center text-[10px] text-[var(--text-muted)] serif-text font-bold shadow-2xs">
              书
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-[var(--text)] serif-text truncate">
                {activeBook.title}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">▾</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
              <span className={`font-medium ${activeBook.statusColor}`}>
                {activeBook.status}
              </span>
              <span className="text-[var(--text-dim)] truncate">{activeBook.desc}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenBookshelf();
          }}
          className="p-1 px-2 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] text-[var(--text)] text-[10px] font-medium serif-text transition shrink-0 border border-[var(--border)]"
          title="打开全局书架管理"
        >
          📚 书架
        </button>
      </div>

      {/* 快捷切书下拉浮窗 */}
      {dropdownOpen && (
        <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-xl p-2 z-50 space-y-1.5 animate-fade-in text-xs">
          <div className="text-[10px] text-[var(--text-muted)] px-2 py-0.5 serif-text font-bold">
            快速切换活跃作品
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {books.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-[var(--text-dim)]">
                当前工作区暂未立项作品
              </div>
            ) : (
              books.map((b) => {
                const isSelected = activeBook.id === b.id || activeBook.path === b.path;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      selectBook(b.id);
                      setDropdownOpen(false);
                    }}
                    className={`p-2 rounded-xl cursor-pointer transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                        : "hover:bg-[var(--bg-hover)] text-[var(--text)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {b.coverUrl && (
                        <img
                          src={b.coverUrl}
                          alt={b.fullTitle}
                          className="w-6 h-8 rounded object-cover border border-black/10 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold serif-text truncate">{b.title}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? "opacity-90" : "text-[var(--text-muted)]"
                          }`}
                        >
                          {b.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold shrink-0">✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[var(--border)] pt-1.5 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-new-book"));
                }
              }}
              className="text-[10px] text-[var(--accent)] font-medium hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>➕</span>
              <span>开新书</span>
            </button>
            <button
              type="button"
              onClick={handleOpenBookshelf}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] hover:underline cursor-pointer"
            >
              进入书架 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
