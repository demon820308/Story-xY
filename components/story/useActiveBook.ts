"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { encodeFilePathForApi } from "@/lib/file-paths";

export interface BookInfo {
  id: string;
  title: string;
  fullTitle: string;
  type: string;
  status: string;
  statusColor: string;
  desc: string;
  path: string;
  currentChapter: string;
  words: string;
  coverUrl?: string;
  isUninitialized?: boolean;
}

export const INITIAL_BOOKS: BookInfo[] = [
  {
    id: "gouran-cut",
    title: "《让你管账号...》",
    fullTitle: "让你管账号，你高燃混剪炸全网",
    type: "长篇军宣 · 连载",
    status: "● 连载中",
    statusColor: "text-[#2e7a4c]",
    desc: "已写25章 · 7.4万字",
    path: "E:/story-app/demo/长篇/让你管账号，你高燃混剪炸全网",
    currentChapter: "第025章 别做成晚会",
    words: "74,800 字",
  },
  {
    id: "jiandao-duzun",
    title: "《剑道独尊》",
    fullTitle: "剑道独尊",
    type: "传统玄幻 · 连载",
    status: "● 连载中",
    statusColor: "text-[#2e7a4c]",
    desc: "已写218章 · 82.5万字",
    path: "E:/story-app/demo/长篇/剑道独尊",
    currentChapter: "第219章 天剑令现世",
    words: "825,000 字",
    coverUrl: `/api/files/${encodeFilePathForApi("E:/story-app/demo/封面-剑道独尊.png")}?type=read`,
  },
  {
    id: "love-secret",
    title: "《曾将爱意私藏》",
    fullTitle: "曾将爱意私藏",
    type: "都市言情 · 短篇精修",
    status: "● 精修中",
    statusColor: "text-[#0891b2]",
    desc: "全篇1.5万字 · 待三层去味",
    path: "E:/story-app/demo/短篇-曾将爱意私藏.txt",
    currentChapter: "第003节 机场告别",
    words: "15,200 字",
  },
];

function makePlaceholderBook(cwd: string | null | undefined): BookInfo {
  return {
    id: `workspace:${cwd || "none"}`,
    title: "暂未立项书籍",
    fullTitle: "暂未立项书籍",
    type: "当前工作区",
    status: "○ 待立项",
    statusColor: "text-[#8a8e9b]",
    desc: "点击立项新书开始创作",
    path: cwd || "",
    currentChapter: "未开始",
    words: "0 字",
    isUninitialized: true,
  };
}

export function useActiveBook(cwd?: string | null) {
  const normCwd = useMemo(() => {
    if (!cwd) return "";
    return cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  }, [cwd]);

  const isDemoCwd = useMemo(() => {
    return normCwd.toLowerCase().includes("/demo/长篇/") || normCwd.toLowerCase().endsWith("/demo");
  }, [normCwd]);

  const [scannedBooks, setScannedBooks] = useState<BookInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 动态扫描当前工作区的所有书籍
  useEffect(() => {
    if (!normCwd) {
      setScannedBooks([]);
      return;
    }

    if (isDemoCwd) {
      setScannedBooks(INITIAL_BOOKS);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    async function scan() {
      const results: BookInfo[] = [];

      // 1. 读取 .active-book 记录的相对路径
      let activeBookRel = "";
      try {
        const abRes = await fetch(`/api/files/${encodeFilePathForApi(normCwd + "/.active-book")}?type=read`);
        if (abRes.ok) {
          const abData = await abRes.json();
          if (abData?.content && typeof abData.content === "string") {
            activeBookRel = abData.content.trim().replace(/\\/g, "/");
          }
        }
      } catch {}

      // 2. 扫描长篇目录
      try {
        const lpRes = await fetch(`/api/files/${encodeFilePathForApi(normCwd + "/长篇")}?type=list`);
        if (lpRes.ok) {
          const lpData = await lpRes.json();
          if (Array.isArray(lpData?.entries)) {
            for (const entry of lpData.entries) {
              if (entry.isDir) {
                const bookName = entry.name;
                const bookPath = `${normCwd}/长篇/${bookName}`;

                let chapterCount = 0;
                let currentChapter = "待开篇";
                let words = "0 字";
                let status = "○ 待起笔";
                let statusColor = "text-[#d97706]";
                let desc = "0 章 · 待出细纲起笔";

                // 读取追踪状态
                try {
                  const trackRes = await fetch(`/api/files/${encodeFilePathForApi(bookPath + "/追踪/_tracking-state.json")}?type=read`);
                  if (trackRes.ok) {
                    const trackData = await trackRes.json();
                    const state = typeof trackData.content === "string" ? JSON.parse(trackData.content) : trackData.content;
                    if (state) {
                      const lastChap = state.last_committed_chapter || 0;
                      chapterCount = lastChap;
                      if (lastChap > 0) {
                        currentChapter = `第${String(lastChap).padStart(3, "0")}章`;
                        status = "● 连载中";
                        statusColor = "text-[#2e7a4c]";
                        desc = `已写 ${lastChap} 章`;
                      }
                      if (state.wordcount_records && typeof state.wordcount_records === "object") {
                        const total = Object.values(state.wordcount_records).reduce((acc: number, v: unknown) => acc + (Number(v) || 0), 0);
                        if (total > 0) words = `${total.toLocaleString()} 字`;
                      }
                    }
                  }
                } catch {}

                // 如果追踪状态没有章节，检查正文文件夹
                if (chapterCount === 0) {
                  try {
                    const zwRes = await fetch(`/api/files/${encodeURIComponent(bookPath + "/正文")}?type=list`);
                    if (zwRes.ok) {
                      const zwData = await zwRes.json();
                      if (Array.isArray(zwData?.entries)) {
                        const mdFiles = zwData.entries.filter((e: { name?: string }) => e.name && e.name.endsWith(".md"));
                        if (mdFiles.length > 0) {
                          chapterCount = mdFiles.length;
                          currentChapter = mdFiles[mdFiles.length - 1].name.replace(/\.md$/, "");
                          status = "● 连载中";
                          statusColor = "text-[#2e7a4c]";
                          desc = `已写 ${chapterCount} 章`;
                          words = `约 ${(chapterCount * 3000).toLocaleString()} 字`;
                        }
                      }
                    }
                  } catch {}
                }

                // 扫描封面图片
                let coverUrl: string | undefined;
                try {
                  const cvRes = await fetch(`/api/files/${encodeURIComponent(bookPath + "/封面")}?type=list`);
                  if (cvRes.ok) {
                    const cvData = await cvRes.json();
                    if (Array.isArray(cvData?.entries)) {
                      const imgFiles = cvData.entries.filter((e: { name: string; isDir?: boolean }) => !e.isDir && /\.(png|jpe?g|webp)$/i.test(e.name));
                      if (imgFiles.length > 0) {
                        const preferred = imgFiles.find((e: { name: string }) => /^cover\./i.test(e.name) || /^封面\./i.test(e.name)) || imgFiles[imgFiles.length - 1];
                        coverUrl = `/api/files/${encodeFilePathForApi(bookPath + "/封面/" + preferred.name)}?type=read`;
                      }
                    }
                  }
                } catch {}

                // 过滤脚手架遗留的无正文未立项占位目录（如名为“新书”且章节为0）
                const isDummyPlaceholder = (bookName === "新书" || bookName === "未命名") && chapterCount === 0;
                if (!isDummyPlaceholder) {
                  results.push({
                    id: `book:${bookPath}`,
                    title: `《${bookName}》`,
                    fullTitle: bookName,
                    type: "长篇连载",
                    status,
                    statusColor,
                    desc,
                    path: bookPath,
                    currentChapter,
                    words,
                    coverUrl,
                    isUninitialized: false,
                  });
                }
              }
            }
          }
        }
      } catch {}

      // 3. 扫描短篇目录
      try {
        const spRes = await fetch(`/api/files/${encodeFilePathForApi(normCwd + "/短篇")}?type=list`);
        if (spRes.ok) {
          const spData = await spRes.json();
          if (Array.isArray(spData?.entries)) {
            for (const entry of spData.entries) {
              const isFile = !entry.isDir && (entry.name.endsWith(".txt") || entry.name.endsWith(".md"));
              const isDir = entry.isDir;
              if (isFile || isDir) {
                const shortName = entry.name.replace(/\.(txt|md)$/, "");
                const shortPath = `${normCwd}/短篇/${entry.name}`;

                let shortCoverUrl: string | undefined;
                try {
                  if (isDir) {
                    const scRes = await fetch(`/api/files/${encodeFilePathForApi(shortPath + "/封面")}?type=list`);
                    if (scRes.ok) {
                      const scData = await scRes.json();
                      const img = scData?.entries?.find((e: { name: string; isDir?: boolean }) => !e.isDir && /\.(png|jpe?g|webp)$/i.test(e.name));
                      if (img) shortCoverUrl = `/api/files/${encodeFilePathForApi(shortPath + "/封面/" + img.name)}?type=read`;
                    }
                  } else {
                    const candidateImg = `${normCwd}/短篇/${shortName}.png`;
                    const checkRes = await fetch(`/api/files/${encodeFilePathForApi(candidateImg)}?type=meta`);
                    if (checkRes.ok) {
                      shortCoverUrl = `/api/files/${encodeFilePathForApi(candidateImg)}?type=read`;
                    }
                  }
                } catch {}

                results.push({
                  id: `short:${shortPath}`,
                  title: `《${shortName}》`,
                  fullTitle: shortName,
                  type: "短篇小说",
                  status: "● 精修中",
                  statusColor: "text-[#0891b2]",
                  desc: "短篇作品",
                  path: shortPath,
                  currentChapter: "全篇",
                  words: "短篇",
                  coverUrl: shortCoverUrl,
                });
              }
            }
          }
        }
      } catch {}

      if (!isCancelled) {
        if (activeBookRel) {
          const matchedIdx = results.findIndex((b) => b.path.endsWith(activeBookRel) || b.path.includes(activeBookRel));
          if (matchedIdx > 0) {
            const [matched] = results.splice(matchedIdx, 1);
            results.unshift(matched);
          }
        }
        setScannedBooks(results);
        setLoading(false);
      }
    }

    scan();
    return () => {
      isCancelled = true;
    };
  }, [normCwd, isDemoCwd, refreshTrigger]);

  // 跨组件响应书籍添加与刷新事件，避免状态不同步
  useEffect(() => {
    const handleStoryRefresh = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    const handleStoryBookAdded = (e: Event) => {
      const custom = e as CustomEvent<BookInfo>;
      if (custom.detail) {
        setScannedBooks((prev) => [custom.detail, ...prev.filter((b) => b.id !== custom.detail.id)]);
        setSelectedBookId(custom.detail.id);
      }
    };
    const handleStoryBookChanged = (e: Event) => {
      const custom = e as CustomEvent<BookInfo>;
      if (custom.detail?.id) {
        setSelectedBookId(custom.detail.id);
      }
    };
    window.addEventListener("story-refresh", handleStoryRefresh);
    window.addEventListener("story-book-added", handleStoryBookAdded);
    window.addEventListener("story-book-changed", handleStoryBookChanged);
    return () => {
      window.removeEventListener("story-refresh", handleStoryRefresh);
      window.removeEventListener("story-book-added", handleStoryBookAdded);
      window.removeEventListener("story-book-changed", handleStoryBookChanged);
    };
  }, []);

  const books = useMemo(() => {
    if (isDemoCwd) return INITIAL_BOOKS;
    return scannedBooks;
  }, [isDemoCwd, scannedBooks]);

  const demoBooks = useMemo(() => INITIAL_BOOKS, []);

  // 决定当前活跃的书籍
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const activeBook = useMemo(() => {
    if (isDemoCwd) {
      const match = INITIAL_BOOKS.find((b) => normCwd.toLowerCase().includes(b.path.toLowerCase()));
      return match || INITIAL_BOOKS[0];
    }

    if (books.length === 0) {
      return makePlaceholderBook(normCwd);
    }

    if (selectedBookId) {
      const found = books.find((b) => b.id === selectedBookId || b.path === selectedBookId || b.fullTitle === selectedBookId);
      if (found) return found;
    }

    // 尝试匹配 normCwd
    const cwdMatch = books.find((b) => normCwd.includes(b.path) || b.path.includes(normCwd));
    if (cwdMatch) return cwdMatch;

    return books[0];
  }, [isDemoCwd, normCwd, books, selectedBookId]);

  const selectBook = useCallback((bookIdOrTitle: string) => {
    setSelectedBookId(bookIdOrTitle);
    const target = books.find((b) => b.id === bookIdOrTitle || b.fullTitle === bookIdOrTitle || b.path === bookIdOrTitle);
    if (target) {
      try {
        window.dispatchEvent(new CustomEvent("story-book-changed", { detail: target }));
      } catch {}
    }
  }, [books]);

  const addBook = useCallback((book: BookInfo) => {
    setScannedBooks((prev) => [book, ...prev.filter((b) => b.id !== book.id)]);
    setSelectedBookId(book.id);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("story-book-added", { detail: book }));
    }
  }, []);

  const removeBook = useCallback((bookId: string) => {
    setScannedBooks((prev) => prev.filter((b) => b.id !== bookId));
  }, []);

  const refresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    activeBook,
    books,
    demoBooks,
    selectBook,
    addBook,
    removeBook,
    refresh,
    loading,
  };
}
