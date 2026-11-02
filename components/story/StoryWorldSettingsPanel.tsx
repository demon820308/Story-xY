"use client";

import React, { memo, useState, useEffect, useMemo } from "react";
import { useActiveBook } from "./useActiveBook";
import { encodeFilePathForApi } from "@/lib/file-paths";
import { FileViewer } from "../FileViewer";
import { isShortBook } from "@/lib/story-book-kind";
import {
  classifySettingFile,
  SETTING_CATEGORIES,
  type SettingCategory,
} from "@/lib/story-setting-category";
import { buildGenerateSettingsPrompt } from "@/lib/story-prompts";
import {
  WorldIcon,
  CharacterIcon,
  ThemeIcon,
  FactionIcon,
  SystemIcon,
  SettingIcon,
  DocumentIcon,
} from "./StoryIcons";

interface SettingItem {
  fileName: string;
  fullPath: string;
  name: string;
  category: Exclude<SettingCategory, "all">;
  group?: "core" | "benchmark";
}

function resolveBookPath(basePath: string, relPath: string): string {
  const normBase = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${normBase}/${normRel}`;
}

function CategoryIcon({ category, size = 13 }: { category: string; size?: number }) {
  switch (category) {
    case "theme":
      return <ThemeIcon size={size} />;
    case "character":
      return <CharacterIcon size={size} />;
    case "world":
      return <WorldIcon size={size} />;
    case "faction":
      return <FactionIcon size={size} />;
    case "system":
      return <SystemIcon size={size} />;
    default:
      return <DocumentIcon size={size} />;
  }
}

export const StoryWorldSettingsPanel = memo(function StoryWorldSettingsPanel({
  cwd,
  onOpenFile,
}: {
  cwd?: string | null;
  onOpenFile?: (filePath: string, fileName: string) => void;
}) {
  const { activeBook } = useActiveBook(cwd);
  const [items, setItems] = useState<SettingItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<SettingItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SettingCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const isShort = useMemo(() => isShortBook(activeBook), [activeBook]);

  useEffect(() => {
    if (!activeBook || activeBook.isUninitialized) {
      setItems([]);
      setSelectedFile(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const basePath = activeBook.path.replace(/\\/g, "/");

    if (isShort) {
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
            name: "核心设定与人设",
            category: "character",
            group: "core",
          });
        }
        if (benchRes && Array.isArray(benchRes.entries)) {
          benchRes.entries
            .filter((e: { name?: string }) => e.name && (e.name.endsWith(".md") || e.name.endsWith(".txt")))
            .forEach((e: { name: string }) => {
              collected.push({
                fileName: e.name,
                fullPath: `${benchDir}/${e.name}`,
                name: e.name.replace(/\.(md|txt)$/, ""),
                category: "theme",
                group: "benchmark",
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

    // 长篇模式：扫描 设定/ 根目录及其子目录（角色、世界观、势力、体系）
    const baseDir = resolveBookPath(basePath, "设定");
    const charDir = resolveBookPath(basePath, "设定/角色");
    const worldDir = resolveBookPath(basePath, "设定/世界观");
    const factionDir = resolveBookPath(basePath, "设定/势力");
    const systemDir = resolveBookPath(basePath, "设定/体系");

    Promise.all([
      fetch(`/api/files/${encodeFilePathForApi(baseDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(charDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(worldDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(factionDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/files/${encodeFilePathForApi(systemDir)}?type=list`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([baseRes, charRes, worldRes, factionRes, systemRes]) => {
      if (isCancelled) return;
      setLoading(false);

      const collected: SettingItem[] = [];
      const seen = new Set<string>();

      const addItems = (res: any, dirPath: string, relPrefix: string) => {
        if (res && Array.isArray(res.entries)) {
          res.entries
            .filter((e: { name?: string }) => e.name && e.name.endsWith(".md"))
            .forEach((e: { name: string }) => {
              const fullPath = `${dirPath}/${e.name}`;
              if (!seen.has(fullPath)) {
                seen.add(fullPath);
                const category = classifySettingFile(e.name, `${relPrefix}/${e.name}`);
                collected.push({
                  fileName: e.name,
                  fullPath,
                  name: e.name.replace(/\.md$/, ""),
                  category,
                });
              }
            });
        }
      };

      // 1. 角色设定
      addItems(charRes, charDir, "角色");
      // 2. 世界观设定
      addItems(worldRes, worldDir, "世界观");
      // 3. 势力组织
      addItems(factionRes, factionDir, "势力");
      // 4. 体系设定
      addItems(systemRes, systemDir, "体系");
      // 5. 设定根目录（智能分类，题材定位.md 判定为 theme 题材）
      addItems(baseRes, baseDir, "");

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

  // 过滤项（分类 + 搜索过滤）
  const filteredItems = useMemo(() => {
    let list = items;
    if (!isShort && selectedCategory !== "all") {
      list = list.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.fileName.toLowerCase().includes(q));
    }
    return list;
  }, [items, selectedCategory, searchQuery, isShort]);

  // 筛选与预览同步：当过滤结果改变且当前选中项不在结果中时，自动选中第一项
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!selectedFile || !filteredItems.some((i) => i.fullPath === selectedFile.fullPath)) {
        setSelectedFile(filteredItems[0]);
      }
    } else if (items.length > 0 && searchQuery.trim()) {
      setSelectedFile(null);
    }
  }, [filteredItems, selectedFile, items.length, searchQuery]);

  const handleGenerateSettings = () => {
    if (!activeBook) return;
    const prompt = buildGenerateSettingsPrompt(isShort ? "short" : "long", activeBook.title, activeBook.path);
    window.dispatchEvent(new CustomEvent("insert-story-prompt", { detail: { prompt } }));
  };

  // 空状态处理
  if (!activeBook || activeBook.isUninitialized || (items.length === 0 && !loading)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-[var(--text-muted)] bg-[var(--bg)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] mb-3 shadow-2xs">
          <SettingIcon size={24} />
        </div>
        <div className="font-bold text-sm text-[var(--text)] serif-text mb-1.5">
          {isShort ? "尚未建立短篇核心设定" : "尚未建立核心设定库"}
        </div>
        <div className="text-xs leading-relaxed max-w-xs mb-4 text-[var(--text-dim)]">
          {isShort
            ? "当前书籍尚未检测到设定文件。点击下方按钮让智能体为您构思核心人设速写、情绪支点与反转设计。"
            : "当前书籍尚未建立设定文件。点击下方按钮让智能体为您构建世界观架构、力量体系与核心角色人设。"}
        </div>
        <button
          type="button"
          onClick={handleGenerateSettings}
          className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <span>🪄</span>
          <span>生成核心设定</span>
        </button>
      </div>
    );
  }

  // 短篇分组视图
  const shortCoreItems = items.filter((i) => i.group === "core");
  const shortBenchItems = items.filter((i) => i.group === "benchmark");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg)] select-none">
      {/* 顶部控制与分类条 */}
      <div className="shrink-0 p-2 border-b border-[var(--border)] bg-[var(--bg-panel)] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)] serif-text">
            <SettingIcon size={14} className="text-[var(--accent)]" />
            <span>{isShort ? "短篇核心设定与对标" : "世界观与设定库"}</span>
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

        {/* 长篇模式分类胶囊栏 */}
        {!isShort && (
          <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-0.5 scrollbar-thin">
            {SETTING_CATEGORIES.map((cat) => {
              const count = cat.key === "all" ? items.length : items.filter((i) => i.category === cat.key).length;
              if (cat.key !== "all" && count === 0) return null;
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-2 py-0.5 rounded-lg font-medium transition cursor-pointer shrink-0 serif-text flex items-center gap-1 ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] font-bold shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] border border-transparent"
                  }`}
                >
                  <CategoryIcon category={cat.key} size={11} />
                  <span>{cat.label} ({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 搜索框（长篇或多文件时支持即时过滤） */}
        {!isShort && items.length > 5 && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索设定与角色..."
              className="w-full px-2.5 py-1 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 文件列表区域 */}
        {isShort ? (
          // 短篇模式：核心设定与对标参考双分组
          <div className="space-y-1.5 text-xs">
            {shortCoreItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-[var(--text-dim)] px-1">核心设定</div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                  {shortCoreItems.map((item) => {
                    const isSelected = selectedFile?.fullPath === item.fullPath;
                    return (
                      <button
                        key={item.fullPath}
                        type="button"
                        onClick={() => setSelectedFile(item)}
                        className={`px-2.5 py-1 rounded-xl shrink-0 transition flex items-center gap-1.5 text-[11px] font-medium serif-text cursor-pointer ${
                          isSelected
                            ? "bg-[var(--bg-selected)] text-[var(--accent)] border border-[var(--accent)] shadow-2xs font-bold"
                            : "bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                        title={item.name}
                      >
                        <SettingIcon size={12} />
                        <span className="truncate max-w-[160px]">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {shortBenchItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-[var(--text-dim)] px-1">对标参考</div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                  {shortBenchItems.map((item) => {
                    const isSelected = selectedFile?.fullPath === item.fullPath;
                    return (
                      <button
                        key={item.fullPath}
                        type="button"
                        onClick={() => setSelectedFile(item)}
                        className={`px-2.5 py-1 rounded-xl shrink-0 transition flex items-center gap-1.5 text-[11px] font-medium serif-text cursor-pointer ${
                          isSelected
                            ? "bg-[var(--bg-selected)] text-[var(--accent)] border border-[var(--accent)] shadow-2xs font-bold"
                            : "bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                        title={item.name}
                      >
                        <ThemeIcon size={12} />
                        <span className="truncate max-w-[160px]">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          // 长篇模式：可搜索过滤的文件列表
          filteredItems.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin text-xs">
              {filteredItems.map((item) => {
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
                    <CategoryIcon category={item.category} size={11} />
                    <span className="truncate max-w-[180px]">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--text-dim)] py-0.5">未找到匹配的设定文件</div>
          )
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
