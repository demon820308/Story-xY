"use client";

import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import {
  countShortOutlineSections,
  extractShortDetailSections,
  extractShortProseSections,
} from "@/lib/story-short-outline";
import { FileViewer } from "../FileViewer";
import { isShortBook } from "@/lib/story-book-kind";
import {
  parseStructuredTrackingState,
  type StructuredTrackingState,
} from "@/lib/story-tracking-state";
import { buildGenerateTrackingPrompt } from "@/lib/story-prompts";
import {
  KanbanIcon,
  ContextIcon,
  ForeshadowIcon,
  TimelineIcon,
  CharacterIcon,
  DocumentIcon,
} from "./StoryIcons";

interface TrackingItem {
  fileName: string;
  fullPath: string;
  name: string;
  typeKey: "kanban" | "context" | "foreshadow" | "timeline" | "character" | "other";
  priority: number;
}

function resolveBookPath(basePath: string, relPath: string): string {
  const normBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normBase}/${normRel}`;
}

function TrackingItemIcon({ typeKey, size = 13 }: { typeKey: string; size?: number }) {
  switch (typeKey) {
    case "kanban":
      return <KanbanIcon size={size} />;
    case "context":
      return <ContextIcon size={size} />;
    case "foreshadow":
      return <ForeshadowIcon size={size} />;
    case "timeline":
      return <TimelineIcon size={size} />;
    case "character":
      return <CharacterIcon size={size} />;
    default:
      return <DocumentIcon size={size} />;
  }
}

export const StoryTrackingPanel = memo(function StoryTrackingPanel({
  cwd,
  onOpenFile,
}: {
  cwd?: string | null;
  onOpenFile?: (filePath: string, fileName: string) => void;
}) {
  const { activeBook } = useActiveBook(cwd);
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<TrackingItem | null>(null);
  const [loading, setLoading] = useState(false);

  // 长篇专属结构化指标（M35.2, A41）
  const [longStats, setLongStats] = useState<StructuredTrackingState | null>(null);

  // 短篇专属进度指标
  const [shortStats, setShortStats] = useState<{
    emotion?: string;
    paywall?: string;
    totalSections: number;
    detailSections: number;
    proseSections: number;
  } | null>(null);

  const isShort = useMemo(() => isShortBook(activeBook), [activeBook]);

  useEffect(() => {
    if (!activeBook || activeBook.isUninitialized) {
      setItems([]);
      setSelectedFile(null);
      setShortStats(null);
      setLongStats(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const basePath = activeBook.path.replace(/\\/g, "/");

    if (isShort) {
      // 短篇模式：小节大纲.md，设定.md，以及 .story/work/已写小节摘要.md
      const outlinePath = resolveBookPath(basePath, "小节大纲.md");
      const settingPath = resolveBookPath(basePath, "设定.md");
      const prosePath = resolveBookPath(basePath, "正文.md");
      const summaryPath = resolveBookPath(basePath, ".story/work/已写小节摘要.md");

      Promise.all([
        fetch(`/api/files/${encodeFilePathForApi(outlinePath)}?type=read`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (typeof d?.content === "string" ? d.content : ""))
          .catch(() => ""),
        fetch(`/api/files/${encodeFilePathForApi(settingPath)}?type=read`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (typeof d?.content === "string" ? d.content : ""))
          .catch(() => ""),
        fetch(`/api/files/${encodeFilePathForApi(prosePath)}?type=read`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => (typeof d?.content === "string" ? d.content : ""))
          .catch(() => ""),
        fetch(`/api/files/${encodeFilePathForApi(summaryPath)}?type=read`)
          .then((r) => (r.ok ? true : false))
          .catch(() => false),
      ]).then(([outlineText, settingText, proseText, summaryExists]) => {
        if (isCancelled) return;
        setLoading(false);

        let emotion = "待定";
        let paywall = "待定";
        if (settingText) {
          const em = settingText.match(/(?:目标情绪|核心情绪|情绪)[：:]\s*([^\r\n]+)/);
          if (em) emotion = em[1].trim();
          const pw = settingText.match(/(?:付费点|卡点)[：:]\s*([^\r\n]+)/);
          if (pw) paywall = pw[1].trim();
        }

        const totalSections = outlineText ? countShortOutlineSections(outlineText) : 0;
        const detailSections = outlineText ? extractShortDetailSections(outlineText).size : 0;
        const proseSections = proseText ? extractShortProseSections(proseText).size : 0;

        setShortStats({
          emotion,
          paywall,
          totalSections,
          detailSections,
          proseSections,
        });

        const collected: TrackingItem[] = [];
        if (outlineText) {
          collected.push({
            fileName: "小节大纲.md",
            fullPath: outlinePath,
            name: "小节大纲与结构表",
            typeKey: "kanban",
            priority: 1,
          });
        }
        if (summaryExists) {
          collected.push({
            fileName: "已写小节摘要.md",
            fullPath: summaryPath,
            name: "已写小节摘要",
            typeKey: "context",
            priority: 2,
          });
        }

        setItems(collected);
        if (collected.length > 0) {
          setSelectedFile(collected[0]);
        } else {
          setSelectedFile(null);
        }
      });

      return () => {
        isCancelled = true;
      };
    }

    // 长篇模式：同时读取 _tracking-state.json 结构化数据与 追踪/ 目录文档
    const trackingDir = resolveBookPath(basePath, "追踪");
    const statePath = resolveBookPath(basePath, "追踪/_tracking-state.json");

    Promise.all([
      fetch(`/api/files/${encodeFilePathForApi(statePath)}?type=read`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(trackingDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([stateRes, listRes]) => {
      if (isCancelled) return;
      setLoading(false);

      if (stateRes?.content) {
        try {
          const parsed = JSON.parse(stateRes.content);
          setLongStats(parseStructuredTrackingState(parsed));
        } catch {
          setLongStats(null);
        }
      } else {
        setLongStats(null);
      }

      const collected: TrackingItem[] = [];

      if (listRes && Array.isArray(listRes.entries)) {
        listRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .forEach((e: { name: string }) => {
            const fName = e.name;
            let typeKey: TrackingItem["typeKey"] = "other";
            let priority = 10;
            const cleanName = fName.replace(/\.md$/, "");

            if (fName.includes("全景看板") || fName.includes("工作台")) {
              typeKey = "kanban";
              priority = 1;
            } else if (fName.includes("上下文")) {
              typeKey = "context";
              priority = 2;
            } else if (fName.includes("伏笔")) {
              typeKey = "foreshadow";
              priority = 3;
            } else if (fName.includes("时线")) {
              typeKey = "timeline";
              priority = 4;
            } else if (fName.includes("角色")) {
              typeKey = "character";
              priority = 5;
            }

            collected.push({
              fileName: fName,
              fullPath: `${trackingDir}/${fName}`,
              name: cleanName,
              typeKey,
              priority,
            });
          });
      }

      collected.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
      setItems(collected);

      if (collected.length > 0) {
        setSelectedFile((prev) => {
          if (prev && collected.some((i) => i.fullPath === prev.fullPath)) {
            return prev;
          }
          return collected[0];
        });
      } else {
        setSelectedFile(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeBook, isShort]);

  // 点超期伏笔警示直跳伏笔文档（A41 契约）
  const handleJumpToForeshadow = useCallback(() => {
    const fDoc = items.find((i) => i.typeKey === "foreshadow" || i.fileName.includes("伏笔") || i.name.includes("伏笔"));
    if (fDoc) {
      setSelectedFile(fDoc);
    }
  }, [items]);

  const handleGenerateTracking = () => {
    if (!activeBook) return;
    const prompt = buildGenerateTrackingPrompt(activeBook.title, activeBook.path);
    window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
  };

  // 空状态
  if (!activeBook || activeBook.isUninitialized || (items.length === 0 && !loading && !longStats)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-[var(--text-muted)] bg-[var(--bg)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] mb-3 shadow-2xs">
          <KanbanIcon size={24} />
        </div>
        <div className="font-bold text-sm text-[var(--text)] serif-text mb-1.5">
          {isShort ? "尚未建立短篇大纲与进度" : "尚未建立追踪看板"}
        </div>
        <div className="text-xs leading-relaxed max-w-xs mb-4 text-[var(--text-dim)]">
          {isShort
            ? "当前短篇尚未检测到小节大纲文档。完成构思后将在此查看全篇结构节拍与推进看板。"
            : "当前书籍尚未建立追踪数据。点击下方按钮让智能体为您初始化追踪骨架（全景看板、伏笔雷达与上下文状态）。"}
        </div>
        {!isShort && (
          <button
            type="button"
            onClick={handleGenerateTracking}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <span>🪄</span>
            <span>初始化追踪骨架</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)] select-none">
      {/* 短篇关键指标卡片 */}
      {isShort && shortStats && (
        <div className="shrink-0 p-2.5 border-b border-[var(--border)] bg-[var(--bg-hover)] flex items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0" title={shortStats.emotion}>
              <span className="text-[var(--text-muted)] shrink-0 font-medium">情绪:</span>
              <span className="font-bold text-[var(--text)] truncate max-w-[200px]">{shortStats.emotion || "待定"}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0" title={shortStats.paywall}>
              <span className="text-[var(--text-muted)] shrink-0 font-medium">付费点:</span>
              <span className="font-bold text-[var(--text)] truncate max-w-[160px]">{shortStats.paywall || "待定"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-selected)] border border-[var(--border)] font-mono text-[var(--accent)] font-bold">
              正文 {shortStats.proseSections}/{shortStats.totalSections || "?"} 节
            </span>
          </div>
        </div>
      )}

      {/* 长篇结构化指标卡片（M35.2, A41） */}
      {!isShort && longStats && (
        <div className="shrink-0 p-2.5 border-b border-[var(--border)] bg-[var(--bg-hover)] text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-bold text-[var(--text)] serif-text">
              <span className="text-[var(--text-muted)] font-normal text-[11px]">进度:</span>
              <span>第 {longStats.lastChapter} 章落盘</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-muted)] text-[11px]">伏笔:</span>
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono">
                活跃 {longStats.activeCount}
              </span>
              {longStats.overdueCount > 0 ? (
                <button
                  type="button"
                  onClick={handleJumpToForeshadow}
                  className="px-2 py-0.5 rounded-full text-[11px] bg-red-500/15 text-red-600 dark:text-red-400 font-bold border border-red-500/30 hover:bg-red-500/25 transition cursor-pointer flex items-center gap-1"
                  title="点击直达伏笔状态表"
                >
                  <span>⚠️</span>
                  <span>超期 {longStats.overdueCount} 条 ↗</span>
                </button>
              ) : (
                <span className="text-[10px] text-[#2e7a4c] dark:text-[#4ade80] font-medium">
                  无超期
                </span>
              )}
            </div>
          </div>

          {(longStats.latestSummary || longStats.recentCharacterState) && (
            <div
              className="text-[11px] text-[var(--text-dim)] truncate max-w-[280px]"
              title={longStats.latestSummary || (longStats.recentCharacterState ? `${longStats.recentCharacterState.name}: ${longStats.recentCharacterState.state}` : "")}
            >
              {longStats.recentCharacterState
                ? `角色: ${longStats.recentCharacterState.name} - ${longStats.recentCharacterState.state}`
                : longStats.latestSummary}
            </div>
          )}
        </div>
      )}

      {/* 顶部追踪文档切换胶囊条 */}
      <div className="shrink-0 p-2 border-b border-[var(--border)] bg-[var(--bg-panel)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin text-xs flex-1">
          {items.map((item) => {
            const isSelected = selectedFile?.fullPath === item.fullPath;
            return (
              <button
                key={item.fullPath}
                type="button"
                onClick={() => setSelectedFile(item)}
                className={`px-2.5 py-1 rounded-xl shrink-0 transition flex items-center gap-1 text-[11px] font-medium serif-text cursor-pointer ${
                  isSelected
                    ? "bg-[var(--bg-selected)] text-[var(--accent)] border border-[var(--accent)] shadow-2xs font-bold"
                    : "bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
                }`}
                title={item.name}
              >
                <TrackingItemIcon typeKey={item.typeKey} size={11} />
                <span className="truncate max-w-[160px]">{item.name}</span>
              </button>
            );
          })}
          {items.length === 0 && !loading && (
            <span className="text-[11px] text-[var(--text-dim)] py-0.5">
              {isShort ? "暂无大纲文档" : "暂无追踪文档"}
            </span>
          )}
        </div>

        {selectedFile && onOpenFile && (
          <button
            type="button"
            onClick={() => onOpenFile(selectedFile.fullPath, selectedFile.fileName)}
            className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer shrink-0 ml-2"
            title="在【文件查看器】独立标签页中打开"
          >
            在文件页打开 ↗
          </button>
        )}
      </div>

      {/* 追踪内容看板预览区 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {selectedFile ? (
          <FileViewer
            key={selectedFile.fullPath}
            filePath={selectedFile.fullPath}
            cwd={cwd ?? undefined}
            watchEnabled={true}
            onOpenFile={(fp) => onOpenFile?.(fp, fp.split("/").pop() || fp)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
            {loading ? "正在加载追踪数据..." : "请在上方选择一个追踪文档"}
          </div>
        )}
      </div>
    </div>
  );
});
