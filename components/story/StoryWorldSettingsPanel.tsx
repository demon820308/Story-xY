"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { FileViewer } from "../FileViewer";

interface SettingItem {
  fileName: string;
  fullPath: string;
  name: string;
  category: "character" | "world" | "system";
}

function resolveBookPath(basePath: string, relPath: string): string {
  const normBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normBase}/${normRel}`;
}

export const StoryWorldSettingsPanel = memo(function StoryWorldSettingsPanel({
  cwd,
  isShort,
  onOpenFile,
}: {
  cwd?: string | null;
  isShort?: boolean;
  onOpenFile?: (filePath: string, fileName: string) => void;
}) {
  const { activeBook } = useActiveBook(cwd);
  const [items, setItems] = useState<SettingItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<SettingItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "character" | "world" | "system">("all");
  const [loading, setLoading] = useState(false);

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
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const basePath = activeBook.path.replace(/\\/g, "/");

    if (isActuallyShort) {
      // 短篇模式：直接加载根目录 设定.md，以及可选的 对标/ 目录文件
      const settingPath = resolveBookPath(basePath, "设定.md");
      const benchDir = resolveBookPath(basePath, "对标");

      Promise.all([
        fetch(`/api/files/${encodeFilePathForApi(settingPath)}?type=read`)
          .then((r) => (r.ok ? true : false))
          .catch(() => false),
        fetch(`/api/files/${encodeFilePathForApi(benchDir)}?type=list`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]).then(([settingOk, benchRes]) => {
        if (isCancelled) return;
        setLoading(false);

        const collected: SettingItem[] = [];
        if (settingOk) {
          collected.push({
            fileName: "设定.md",
            fullPath: settingPath,
            name: "🎯 核心设定与人设",
            category: "character",
          });
        }
        if (benchRes && Array.isArray(benchRes.entries)) {
          benchRes.entries
            .filter((e: { name?: string }) => e.name && (e.name.endsWith(".md") || e.name.endsWith(".txt")))
            .forEach((e: { name: string }) => {
              collected.push({
                fileName: e.name,
                fullPath: `${benchDir}/${e.name}`,
                name: `📌 对标: ${e.name.replace(/\.(md|txt)$/, "")}`,
                category: "world",
              });
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

    const baseDir = resolveBookPath(basePath, "设定");
    const charDir = resolveBookPath(basePath, "设定/角色");
    const worldDir = resolveBookPath(basePath, "设定/世界观");

    Promise.all([
      // 1. 扫描设定根目录
      fetch(`/api/files/${encodeFilePathForApi(baseDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      // 2. 扫描角色设定
      fetch(`/api/files/${encodeFilePathForApi(charDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      // 3. 扫描世界观设定
      fetch(`/api/files/${encodeFilePathForApi(worldDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([baseRes, charRes, worldRes]) => {
      if (isCancelled) return;
      setLoading(false);

      const collected: SettingItem[] = [];

      // 角色设定
      if (charRes && Array.isArray(charRes.entries)) {
        charRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .forEach((e: { name: string }) => {
            collected.push({
              fileName: e.name,
              fullPath: `${charDir}/${e.name}`,
              name: e.name.replace(/\.md$/, ""),
              category: "character",
            });
          });
      }

      // 世界观设定
      if (worldRes && Array.isArray(worldRes.entries)) {
        worldRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .forEach((e: { name: string }) => {
            collected.push({
              fileName: e.name,
              fullPath: `${worldDir}/${e.name}`,
              name: e.name.replace(/\.md$/, ""),
              category: "world",
            });
          });
      }

      // 根目录设定体系文件
      if (baseRes && Array.isArray(baseRes.entries)) {
        baseRes.entries
          .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
          .forEach((e: { name: string }) => {
            collected.push({
              fileName: e.name,
              fullPath: `${baseDir}/${e.name}`,
              name: e.name.replace(/\.md$/, ""),
              category: "system",
            });
          });
      }

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
  }, [activeBook, isActuallyShort]);

  const filteredItems = useMemo(() => {
    if (isActuallyShort) return items;
    if (selectedCategory === "all") return items;
    return items.filter((i) => i.category === selectedCategory);
  }, [items, selectedCategory, isActuallyShort]);

  if (!activeBook || activeBook.isUninitialized) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-[var(--text-muted)]">
        <div className="text-3xl mb-2">{isActuallyShort ? "🎯" : "🌐"}</div>
        <div className="font-bold text-xs text-[var(--text)] serif-text mb-1">
          {isActuallyShort ? "尚未建立短篇核心设定" : "尚未建立核心设定库"}
        </div>
        <div className="text-[11px] leading-relaxed max-w-xs">
          {isActuallyShort ? (
            <>当前短篇未检测到 <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded font-mono border border-[var(--border)]">设定.md</code>。请先执行 Phase 1 构思核心支点与人设速写。</>
          ) : (
            <>当前工作区未检测到设定文件。创建 <code className="bg-[var(--bg-panel)] px-1 py-0.5 rounded font-mono border border-[var(--border)]">设定/</code> 目录并编写 Markdown 即可在此速查。</>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)] select-none">
      {/* 顶部分类与文件切换条 */}
      <div className="shrink-0 p-2 border-b border-[var(--border)] bg-[var(--bg-panel)] space-y-1.5">
        <div className="flex items-center justify-between">
          {isActuallyShort ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)] serif-text">
              <span>🎯</span>
              <span>短篇核心设定与参考</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer shrink-0 serif-text ${
                  selectedCategory === "all"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                全部 ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("character")}
                className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer shrink-0 serif-text ${
                  selectedCategory === "character"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                👤 人设 ({items.filter((i) => i.category === "character").length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("world")}
                className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer shrink-0 serif-text ${
                  selectedCategory === "world"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                🎪 世界观 ({items.filter((i) => i.category === "world").length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("system")}
                className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer shrink-0 serif-text ${
                  selectedCategory === "system"
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-2xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                📑 体系 ({items.filter((i) => i.category === "system").length})
              </button>
            </div>
          )}

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

        {/* 文件列表水平胶囊滚动栏 */}
        {filteredItems.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin text-xs">
            {filteredItems.map((item) => {
              const isSelected = selectedFile?.fullPath === item.fullPath;
              const icon = item.category === "character" ? "👤" : item.category === "world" ? "🎪" : "📑";
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
                  <span className="text-[10px]">{icon}</span>
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-dim)] py-0.5">该分类下暂无设定文件</div>
        )}
      </div>

      {/* 设定内容预览区 */}
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
            {loading ? "正在加载设定库..." : "请在上方选择一个设定文件"}
          </div>
        )}
      </div>
    </div>
  );
});
