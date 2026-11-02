"use client";

import React, { useState, useEffect } from "react";
import { encodeFilePathForApi } from "@/lib/file-paths";

interface StorySetupCardProps {
  workspacePath?: string;
  onRunSetup?: () => void;
  isInitialized?: boolean;
}

export function StorySetupCard({
  workspacePath = "当前工作区",
  onRunSetup,
  isInitialized: initialIsInitialized,
}: StorySetupCardProps) {
  const [initialized, setInitialized] = useState<boolean>(initialIsInitialized ?? false);

  // 探测当前工作区是否已完成环境初始化部署
  useEffect(() => {
    if (initialIsInitialized !== undefined) {
      setInitialized(initialIsInitialized);
      return;
    }
    if (!workspacePath || workspacePath === "当前工作区") {
      setInitialized(false);
      return;
    }
    let cancelled = false;
    const norm = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
    Promise.all([
      fetch(`/api/files/${encodeFilePathForApi(norm + "/.story-deployed")}?type=meta`),
      fetch(`/api/files/${encodeFilePathForApi(norm + "/长篇")}?type=list`),
      fetch(`/api/files/${encodeFilePathForApi(norm + "/短篇")}?type=list`),
      fetch(`/api/files/${encodeFilePathForApi(norm + "/AGENTS.md")}?type=meta`),
      fetch(`/api/files/${encodeFilePathForApi(norm + "/.pi")}?type=list`),
      fetch(`/api/files/${encodeFilePathForApi(norm + "/.agents")}?type=list`),
    ])
      .then((responses) => {
        if (!cancelled) {
          setInitialized(responses.some((r) => r.ok));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInitialized(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, initialIsInitialized]);

  // 一键直接立项新书
  const handleOpenNewBook = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-new-book"));
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
          {initialized ? (
            <button
              disabled
              className="w-full py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] opacity-60 font-medium text-xs flex items-center justify-center gap-2 cursor-not-allowed select-none"
            >
              <span>⚙️</span>
              <span>本工作区已初始化</span>
            </button>
          ) : (
            onRunSetup && (
              <button
                onClick={onRunSetup}
                className="w-full py-2 rounded-xl bg-[var(--bg)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] font-medium text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <span>⚙️</span>
                <span>运行工程目录环境初始化 (/story-setup)</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
