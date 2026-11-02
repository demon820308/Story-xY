"use client";

import React, { useState, useEffect, memo } from "react";
import { useActiveBook } from "./useActiveBook";
import { buildWorkspaceInitPrompt } from "@/lib/story-prompts";

export type KanbanTab = "outline" | "characters" | "relations" | "world" | "foreshadow";

export interface StoryKanbanModalProps {
  isOpen: boolean;
  initialTab?: KanbanTab;
  onClose: () => void;
  cwd?: string | null;
}

export const StoryKanbanModal = memo(function StoryKanbanModal({
  isOpen,
  initialTab = "outline",
  onClose,
  cwd,
}: StoryKanbanModalProps) {
  const { activeBook } = useActiveBook(cwd);
  const [activeTab, setActiveTab] = useState<KanbanTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1200] flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-4xl bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[88vh] text-[var(--text)]">
        
        {/* 看板顶栏 */}
        <div className="p-4 px-6 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="zs-mark" aria-hidden="true">板</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text)] serif-text">
                  本书核心看板 · <span>{activeBook.title}</span>
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 font-medium">
                  本书看板 · Story Kanban
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                全景呈现本书写作状态、章节细纲、核心人设、阵营网络、世界观规则与伏笔闭环
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 快速过滤看板卡片..."
                className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] w-48 shadow-2xs placeholder-[var(--text-dim)]"
              />
            </div>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 若未绑定小说或空工程：显示空状态引导 */}
        {activeBook.isUninitialized ? (
          <div className="p-12 text-center space-y-4 my-auto">
            <div className="text-4xl">📖</div>
            <h3 className="text-base font-bold text-[var(--text)] serif-text">
              {activeBook.title} · 尚未建立核心设定库
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
              核心看板用于全景速查章节细纲、人设档案、世界观规则与伏笔闭环。<br />
              检测到当前工作区暂无对应设定文件，请在对话区使用 <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded font-mono border border-[var(--border)]">/story-setup</code> 建立工程，或通过书架切换到已有作品。
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(
                    new CustomEvent("insert-story-prompt", {
                      detail: {
                        prompt: buildWorkspaceInitPrompt(),
                        autoFocus: true,
                      },
                    })
                  );
                }}
                className="py-2 px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text hover:opacity-90 transition cursor-pointer shadow-xs"
              >
                ✍️ 一键初始化工作区 (/story-setup)
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent("open-bookshelf"));
                }}
                className="py-2 px-4 rounded-xl bg-[var(--bg-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-medium serif-text hover:bg-[var(--bg-selected)] transition cursor-pointer shadow-xs"
              >
                📚 打开书架切换作品
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 本书关键指标看板条 */}
            <div className="px-6 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-dim)] text-[11px]">创作进度：</span>
                <span className="font-bold text-[var(--text)] serif-text">{activeBook.currentChapter}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-dim)] text-[11px]">字数统计：</span>
                <span className="font-medium text-[var(--text)]">{activeBook.words}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-dim)] text-[11px]">作品体裁：</span>
                <span className="font-medium text-[var(--text)]">{activeBook.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-dim)] text-[11px]">连载状态：</span>
                <span className={`font-medium ${activeBook.statusColor || "text-[var(--accent)]"}`}>{activeBook.status}</span>
              </div>
            </div>

            {/* 顶部分段切换器 */}
            <div className="p-2 px-6 bg-[var(--bg)] border-b border-[var(--border)] shrink-0">
              <div className="grid grid-cols-5 p-0.5 bg-[var(--bg-panel)] rounded-xl border border-[var(--border)] text-xs">
                <button
                  onClick={() => setActiveTab("outline")}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition serif-text cursor-pointer ${
                    activeTab === "outline"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span>📋</span><span>剧情与细纲</span>
                </button>
                <button
                  onClick={() => setActiveTab("characters")}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition serif-text cursor-pointer ${
                    activeTab === "characters"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span>👤</span><span>角色人设卡</span>
                </button>
                <button
                  onClick={() => setActiveTab("relations")}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition serif-text cursor-pointer ${
                    activeTab === "relations"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span>🕸️</span><span>阵营关系网</span>
                </button>
                <button
                  onClick={() => setActiveTab("world")}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition serif-text cursor-pointer ${
                    activeTab === "world"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span>🌍</span><span>世界观规则</span>
                </button>
                <button
                  onClick={() => setActiveTab("foreshadow")}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition serif-text cursor-pointer ${
                    activeTab === "foreshadow"
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-medium shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  <span>🧵</span><span>伏笔与追踪</span>
                </button>
              </div>
            </div>

            {/* 标签页主体内容区 */}
            <div className="flex-1 overflow-y-auto p-6 text-xs bg-[var(--bg-subtle)] space-y-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div>
                    <span className="text-sm font-bold text-[var(--text)] serif-text">
                      {activeBook.title} · 当前创作蓝图
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block font-mono">
                      目录路径：{activeBook.path}
                    </span>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-medium border border-[var(--accent)]/30">
                    {activeBook.status}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  当前处于【{activeBook.type}】创作周期。点击左侧栏的【正文章节】可直接打开对应章节定稿及修改记录；点击【核心设定】可查阅具体人设卡与世界观规则。
                </p>
              </div>
            </div>

            {/* 看板底栏 */}
            <div className="p-3.5 px-6 bg-[var(--bg)] border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)] shrink-0">
              <span>数据源：<code className="font-mono bg-[var(--bg-panel)] px-1 py-0.2 rounded text-[var(--text)] border border-[var(--border)]">{activeBook.path}</code> · 纯净看板阅览</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium serif-text shadow-xs cursor-pointer hover:opacity-90 transition"
              >
                关闭看板
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
});
