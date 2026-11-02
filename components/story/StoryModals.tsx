"use client";

import React, { useState, useEffect } from "react";
import { StoryKanbanModal, type KanbanTab } from "./StoryKanbanModal";
import { BookshelfModal } from "./BookshelfModal";
import { NewBookModal } from "./NewBookModal";
import { ImportBookModal } from "./ImportBookModal";
import { StoryReaderModal } from "./StoryReaderModal";
import { useActiveBook } from "./useActiveBook";
import { uploadFiles } from "@/lib/file-upload-client";

interface StoryModalsProps {
  cwd?: string | null;
}

export function StoryModals({ cwd }: StoryModalsProps) {
  const { activeBook } = useActiveBook(cwd);
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [kanbanTab, setKanbanTab] = useState<KanbanTab>("outline");

  const [bookshelfOpen, setBookshelfOpen] = useState(false);
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [importBookOpen, setImportBookOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerChapterNum, setReaderChapterNum] = useState<number | undefined>(undefined);

  // 全局响应设为封面请求
  useEffect(() => {
    const handleSetAsCover = async (e: Event) => {
      const custom = e as CustomEvent<{ src: string }>;
      if (!custom.detail?.src || !activeBook || activeBook.isUninitialized) return;
      try {
        const src = custom.detail.src;
        const res = await fetch(src);
        const blob = await res.blob();
        const isShortFile = activeBook.path.endsWith(".txt") || activeBook.path.endsWith(".md");
        let targetDir = activeBook.path;
        let targetFileName = "cover.png";
        if (isShortFile) {
          const parts = activeBook.path.replace(/\\/g, "/").split("/");
          parts.pop();
          targetDir = parts.join("/");
          targetFileName = `${activeBook.fullTitle}.png`;
        } else {
          targetDir = `${activeBook.path.replace(/\\/g, "/")}/封面`;
        }
        const file = new File([blob], targetFileName, { type: blob.type || "image/png" });
        const upRes = await uploadFiles(targetDir, [file], "overwrite");
        if (upRes.status === 200) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("story-refresh"));
          }
        }
      } catch {}
    };
    window.addEventListener("set-as-book-cover", handleSetAsCover);
    return () => window.removeEventListener("set-as-book-cover", handleSetAsCover);
  }, [activeBook]);

  useEffect(() => {
    const handleOpenKanban = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: KanbanTab }>;
      if (customEvent.detail?.tab) {
        setKanbanTab(customEvent.detail.tab);
      }
      setKanbanOpen(true);
    };

    const handleOpenBookshelf = () => {
      setBookshelfOpen(true);
    };

    const handleOpenNewBook = () => {
      setNewBookOpen(true);
    };

    const handleOpenImportBook = () => {
      setImportBookOpen(true);
    };

    const handleOpenReader = (e: Event) => {
      const custom = e as CustomEvent<{ chapterNum?: number }>;
      setReaderChapterNum(custom.detail?.chapterNum);
      setReaderOpen(true);
    };

    window.addEventListener("open-story-kanban", handleOpenKanban);
    window.addEventListener("open-bookshelf", handleOpenBookshelf);
    window.addEventListener("open-new-book", handleOpenNewBook);
    window.addEventListener("open-story-new-book", handleOpenNewBook);
    window.addEventListener("open-import-book", handleOpenImportBook);

    window.addEventListener("open-story-reader", handleOpenReader);

    return () => {
      window.removeEventListener("open-story-kanban", handleOpenKanban);
      window.removeEventListener("open-bookshelf", handleOpenBookshelf);
      window.removeEventListener("open-new-book", handleOpenNewBook);
      window.removeEventListener("open-story-new-book", handleOpenNewBook);
      window.removeEventListener("open-import-book", handleOpenImportBook);

      window.removeEventListener("open-story-reader", handleOpenReader);
    };
  }, []);

  return (
    <>
      <StoryKanbanModal
        isOpen={kanbanOpen}
        onClose={() => setKanbanOpen(false)}
        initialTab={kanbanTab}
        cwd={cwd}
      />

      <BookshelfModal
        isOpen={bookshelfOpen}
        onClose={() => setBookshelfOpen(false)}
        onOpenNewBook={() => {
          setBookshelfOpen(false);
          setNewBookOpen(true);
        }}
        onOpenImportBook={() => {
          setBookshelfOpen(false);
          setImportBookOpen(true);
        }}
        cwd={cwd}
      />

      <NewBookModal
        isOpen={newBookOpen}
        onClose={() => setNewBookOpen(false)}
        cwd={cwd}
      />

      <ImportBookModal
        isOpen={importBookOpen}
        onClose={() => setImportBookOpen(false)}
        cwd={cwd}
      />

      <StoryReaderModal
        isOpen={readerOpen}
        onClose={() => setReaderOpen(false)}
        cwd={cwd}
        initialChapterNum={readerChapterNum}
      />
    </>
  );
}
