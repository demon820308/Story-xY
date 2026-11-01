"use client";

import React, { memo } from "react";

interface TextSelectionBubbleProps {
  selectedText: string;
  position: { top: number; left: number };
  onClose: () => void;
  onApplyDeslop: (text: string) => void;
  onApplyReview: (text: string) => void;
}

export const TextSelectionBubble = memo(function TextSelectionBubble({
  selectedText,
  position,
  onClose,
  onApplyDeslop,
  onApplyReview,
}: TextSelectionBubbleProps) {
  if (!selectedText) return null;

  const count = selectedText.length;

  return (
    <div
      style={{
        position: "fixed",
        top: Math.max(10, position.top - 46),
        left: Math.max(10, position.left),
        zIndex: 9999,
      }}
      className="bg-[var(--bg-panel)] text-[var(--text)] rounded-xl shadow-2xl p-1.5 px-3 flex items-center gap-2 text-xs serif-text border border-[var(--border)] animate-fade-in select-none"
    >
      <span className="text-[10px] text-[var(--accent)] font-mono">
        选中 {count} 字：
      </span>
      <button
        type="button"
        onClick={() => onApplyDeslop(selectedText)}
        className="px-2 py-0.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] text-[var(--text)] font-medium transition text-[11px] cursor-pointer border border-[var(--border)]"
        title="仅对选中段落执行三层去AI味与口癖清洗"
      >
        🧹 划词去味
      </button>
      <button
        type="button"
        onClick={() => onApplyReview(selectedText)}
        className="px-2 py-0.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] text-[var(--text)] font-medium transition text-[11px] cursor-pointer border border-[var(--border)]"
        title="核验该段落与《追踪/上下文.md》的因果与伏笔一致性"
      >
        🛡️ 校验矛盾
      </button>
      <button
        type="button"
        onClick={onClose}
        className="text-[var(--text-muted)] hover:text-[var(--text)] px-1 text-xs cursor-pointer ml-1"
        title="关闭气泡"
      >
        ✕
      </button>
    </div>
  );
});
