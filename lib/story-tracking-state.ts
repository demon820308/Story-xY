/**
 * 结构化追踪状态解析引擎（M35.2 单一事实源）
 * 从 _tracking-state.json 提取看板关键指标：章号、修订号、活跃与超期伏笔、最新角色动态
 */

export interface ForeshadowRecord {
  id: string;
  summary?: string;
  planted_chapter?: number;
  planned_resolution_chapter?: number | null;
  status?: string;
  importance?: string;
  updated_chapter?: number;
}

export interface StructuredTrackingState {
  lastChapter: number;
  stateRevision: string;
  activeCount: number;
  overdueCount: number;
  activeForeshadows: ForeshadowRecord[];
  overdueForeshadows: ForeshadowRecord[];
  latestSummary?: string;
  recentCharacterState?: { name: string; state: string };
}

export function parseStructuredTrackingState(data: any): StructuredTrackingState {
  if (!data || typeof data !== "object") {
    return {
      lastChapter: 0,
      stateRevision: "0",
      activeCount: 0,
      overdueCount: 0,
      activeForeshadows: [],
      overdueForeshadows: [],
    };
  }

  const lastChapter = Number(data.last_committed_chapter) || 0;
  const stateRevision = String(data.state_revision ?? "1");

  const activeForeshadows: ForeshadowRecord[] = [];
  const overdueForeshadows: ForeshadowRecord[] = [];

  if (data.foreshadow && typeof data.foreshadow === "object") {
    const list = Object.values(data.foreshadow) as ForeshadowRecord[];
    list.forEach((f) => {
      if (!f || typeof f !== "object") return;
      const st = String(f.status || "").trim();
      const isResolved =
        st === "resolved" ||
        st === "abandoned" ||
        st === "已回收" ||
        st === "已放弃" ||
        st === "已关闭";

      if (!isResolved) {
        activeForeshadows.push(f);
        const planned = f.planned_resolution_chapter;
        if (planned !== undefined && planned !== null && !isNaN(Number(planned))) {
          const targetCh = Number(planned);
          if (targetCh <= lastChapter) {
            overdueForeshadows.push(f);
          }
        }
      }
    });
  }

  // 最新剧情与角色动态
  let latestSummary: string | undefined;
  if (Array.isArray(data.context?.recent_chapters) && data.context.recent_chapters.length > 0) {
    const lastRec = data.context.recent_chapters[data.context.recent_chapters.length - 1];
    if (lastRec?.summary) {
      latestSummary = `第${lastRec.chapter ?? lastChapter}章: ${lastRec.summary}`;
    }
  }

  let recentCharacterState: { name: string; state: string } | undefined;
  if (data.characters && typeof data.characters === "object") {
    const activeNames: string[] = Array.isArray(data.context?.active_character_names)
      ? data.context.active_character_names
      : Object.keys(data.characters);

    for (const name of activeNames) {
      const char = data.characters[name];
      if (char?.state) {
        recentCharacterState = { name, state: char.state };
        break;
      }
    }
  }

  return {
    lastChapter,
    stateRevision,
    activeCount: activeForeshadows.length,
    overdueCount: overdueForeshadows.length,
    activeForeshadows,
    overdueForeshadows,
    latestSummary,
    recentCharacterState,
  };
}
