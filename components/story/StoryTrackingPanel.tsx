"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import {
  countShortOutlineSections,
  extractShortDetailSections,
  extractShortProseSections,
} from "@/lib/story-short-outline";
import { FileViewer } from "../FileViewer";

interface TrackingItem {
  fileName: string;
  fullPath: string;
  name: string;
  icon: string;
  priority: number;
}

function resolveBookPath(basePath: string, relPath: string): string {
  const normBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normBase}/${normRel}`;
}

export const StoryTrackingPanel = memo(function StoryTrackingPanel({
  cwd,
  isShort,
  onOpenFile,
}: {
  cwd?: string | null;
  isShort?: boolean;
  onOpenFile?: (filePath: string, fileName: string) => void;
}) {
  const { activeBook } = useActiveBook(cwd);
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<TrackingItem | null>(null);
  const [loading, setLoading] = useState(false);

  // 短篇专属进度指标
  const [shortStats, setShortStats] = useState<{
    emotion?: string;
    paywall?: string;
    totalSections: number;
    detailSections: number;
    proseSections: number;
  } | null>(null);

  const isActuallyShort = useMemo(() => {
    if (isShort !== undefined) return isShort;
    if (!activeBook) return false;
    return (
      activeBook.id?.startsWith("short:") ||
      activeBook.type?.includes("短篇") ||
      activeBook.path?.includes("/短篇/") ||
      activeBook.path?.includes("\\短篇\\")
    );
  }, [isShort, activeBook]);

  useEffect(() => {
    if (!activeBook || activeBook.isUninitialized) {
      setItems([]);
      setSelectedFile(null);
      setShortStats(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const basePath = activeBook.path.replace(/\\/g, "/");

    if (isActuallyShort) {
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

        // 解析指标
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
            icon: "📋",
            priority: 1,
          });
        }
        if (summaryExists) {
          collected.push({
            fileName: "已写小节摘要.md",
            fullPath: summaryPath,
            name: "已写小节摘要",
            icon: "📝",
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

    const trackingDir = resolveBookPath(basePath, "追踪");

    fetch(`/api/files/${encodeFilePathForApi(trackingDir)}?type=list`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (isCancelled) return;
        setLoading(false);

        const collected: TrackingItem[] = [];

        if (res && Array.isArray(res.entries)) {
          res.entries
            .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
            .forEach((e: { name: string }) => {
              const fName = e.name;
              let icon = "📄";
              let priority = 10;
              const cleanName = fName.replace(/\.md$/, "");

              if (fName.includes("全景看板") || fName.includes("工作台")) {
                icon = "📊";
                priority = 1;
              } else if (fName.includes("上下文")) {
                icon = "🧭";
                priority = 2;
              } else if (fName.includes("伏笔")) {
                icon = "🎯";
                priority = 3;
              } else if (fName.includes("时线")) {
                icon = "⏳";
                priority = 4;
              } else if (fName.includes("角色")) {
                icon = "👥";
                priority = 5;
              }

              collected.push({
                fileName: fName,
                fullPath: `${trackingDir}/${fName}`,
                name: cleanName,
                icon,
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
      })
      .catch(() => {
        if (!isCancelled) {
          setLoading(false);
          setItems([]);
          setSelectedFile(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeBook, isActuallyShort]);

  if (!activeBook || activeBook.isUninitialized) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-[var(--text-muted)]">
        <div className="text-3xl mb-2">{isActuallyShort ? "📋" : "📊"}</div>
        <div className="font-bold text-xs text-[var(--text)] serif-text mb-1">
          {isActuallyShort ? "尚未建立短篇大纲" : "尚未建立追踪看板"}
        </div>
        <div className="text-[11px] leading-relaxed max-w-xs">
          {isActuallyShort ? (
            <>当前短篇未检测到 <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded font-mono border border-[var(--border)]">小节大纲.md</code>。完成粗纲梳理后将在此查看全篇结构表与进度。</>
          ) : (
            <>当前工作区未检测到追踪数据。写作后将由系统自动在 <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded font-mono border border-[var(--border)]">追踪/</code> 下生成全景看板与伏笔状态。</>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)] select-none">
      {/* 短篇关键指标卡片 */}
      {isActuallyShort && shortStats && (
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
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg)] border border-[var(--border)] font-mono text-[var(--accent)] font-bold">
              细纲 {shortStats.detailSections}/{shortStats.totalSections || "?"} 节
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-selected)] border border-[var(--border)] font-mono text-[var(--accent)] font-bold">
              正文 {shortStats.proseSections}/{shortStats.totalSections || "?"} 节
            </span>
          </div>
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
              >
                <span className="text-[10px]">{item.icon}</span>
                <span className="truncate max-w-[130px]">{item.name}</span>
              </button>
            );
          })}
          {items.length === 0 && !loading && (
            <span className="text-[11px] text-[var(--text-dim)] py-0.5">
              {isActuallyShort ? "暂无大纲文档" : "暂无追踪文档"}
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
