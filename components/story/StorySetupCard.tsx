"use client";

import React from "react";

interface StorySetupCardProps {
  workspacePath?: string;
  onRunSetup?: () => void;
}

export function StorySetupCard({
  workspacePath = "当前工作区",
  onRunSetup,
}: StorySetupCardProps) {
  // 一键直接立项新书
  const handleOpenNewBook = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-story-new-book"));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center my-auto">
      <div className="max-w-md w-full bg-[var(--bg-panel)] border border-[var(--border)] p-8 rounded-3xl shadow-lg space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-3xl mx-auto shadow-inner">
          🖋️
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-bold text-[var(--text)] serif-text">
            创作引擎已就绪 · 工作区待立项
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            当前工作区{" "}
            <code className="bg-[var(--bg)] border border-[var(--border)] px-1 py-0.5 rounded font-mono text-[var(--text)]">
              {workspacePath}
            </code>{" "}
            暂无已立项的小说书籍。
          </p>
        </div>

        <div className="p-3.5 bg-[var(--bg)] rounded-2xl text-left text-xs text-[var(--text-muted)] space-y-2 border border-[var(--border)]">
          <div className="font-bold text-[var(--text)] serif-text flex items-center gap-1.5">
            <span className="text-[var(--accent)]">⚡</span>
            <span>Story Studio 内置引擎状态：</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--accent)] font-bold">✔</span>
            <span>14 个网文创作专业技能（长篇/短篇/大纲/去AI味）内置就绪</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--accent)] font-bold">✔</span>
            <span>7 位编辑部智能子代理（写手/审稿/架构师/检索员）原生挂载</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--accent)] font-bold">✔</span>
            <span>智能门禁与伏笔状态账本引擎常驻保护</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            onClick={handleOpenNewBook}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-medium text-xs hover:opacity-90 shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>✍️</span>
            <span>立即立项第一本小说 (长篇 / 短篇)</span>
          </button>
          {onRunSetup && (
            <button
              onClick={onRunSetup}
              className="w-full py-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] font-medium text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>⚙️</span>
              <span>运行工程目录环境初始化 (/story-setup)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
