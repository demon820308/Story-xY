# Story xy Studio / Pi Web Architecture Overview

[中文版本](architecture.md)

Story xy Studio is a web-first creative workbench built on top of `@earendil-works/pi-coding-agent` SDK and Next.js, tailored for web novel serialized writing and short-story polishing.

---

## 1. System Architecture Overview

The system runs on an **In-Process Native Integration Architecture**. All 14 creative writing skills, 7 specialized editorial subagents, and writing guardrail extensions are loaded in memory directly from application assets without requiring copying to global directories (`~/.pi/agent/` or `~/.agents/`).

```mermaid
flowchart TD
    subgraph UI["1. Presentation Layer (Web UI / Next.js)"]
        AppShell["App Shell & Session Sidebar (AppShell / SessionSidebar)"]
        ChatWindow["Interactive Chat & Streaming Output (ChatWindow)"]
        StoryBar["Workbench Status Bar (StoryActionBar / ExtensionStatusBar)"]
        ReaderModal["Novel Reader & Manual Polisher (StoryReaderModal)"]
        BookShelf["Multi-Book Bookshelf & Project Wizard (BookshelfModal / NewBookModal)"]
        Panels["Panoramic Panels (StoryTrackingPanel / StoryWorldSettingsPanel)"]
    end

    subgraph API["2. Gateway & Route Handlers (/api)"]
        AgentApi["/api/agent (RPC Session Commands / SSE Event Streaming)"]
        FilesApi["/api/files (Segmented File Streaming & Write APIs)"]
        SkillsApi["/api/skills (Skill Registry, Markdown Inspection & Toggles)"]
        SubagentApi["/api/subagents (Agent Profiles & Execution Monitor)"]
        SecurityGate["Security Root Guard (getAllowedFileRoots / path-security)"]
    end

    subgraph Engine["3. Core Engine & Built-in Runtime (In-Process)"]
        RpcMgr["RPC Session Manager (lib/rpc-manager.ts)"]
        ResLoader["Default Resource Loader (DefaultResourceLoader)"]
        
        subgraph BuiltinSkills["14 Built-in Writing Skills (skills/)"]
            S_Write["story-long-write / story-short-write"]
            S_Analyze["story-long-analyze / story-short-analyze"]
            S_Deslop["story-deslop (Anti-AI Slop)"]
            S_Review["story-review (Adversarial Quality Review)"]
            S_Other["story-import / story-cover / story-scan..."]
        end

        subgraph BuiltinAgents["7 Specialized Subagents (references/pi/agents/)"]
            A_Writer["Prose Drafter (narrative-writer)"]
            A_Arch["Plot Architect (story-architect)"]
            A_Review["Quality Reviewer (consistency-checker)"]
            A_Char["Character Designer (character-designer)"]
            A_Exp["Information Explorer (story-explorer / story-researcher)"]
            A_Extract["Story Deconstruction (chapter-extractor)"]
        end

        subgraph BuiltinExts["In-Process Resident Extensions (references/pi/extensions/)"]
            Ext_Gates["Gatekeeper & State Machine (story-gates.ts)"]
            Ext_Guard["Sandbox Write Isolator (story-guard.ts)"]
            Ext_Lock["Single-Book Concurrency Lock (story-agents.ts)"]
        end
    end

    subgraph Storage["4. User Workspace & Clean State Ledger"]
        ActiveBook[".active-book (Active Book Relative Pointer)"]
        subgraph BookDir["长篇/{BookName}/ or 短篇/{Title}/"]
            Dir_Dagang["大纲/ (Volume & Chapter Outlines)"]
            Dir_Zhengwen["正文/ (Chapter Markdown Prose)"]
            Dir_Sheting["设定/ (Worldbuilding & Character Sheets)"]
            subgraph Tracking["追踪/ (File-First Tracking Ledger)"]
                TrackState["_tracking-state.json (Structured Source of Truth)"]
                ContextMd["上下文.md (7-Column Context Card)"]
                ChapterRec["逐章记录/ (Continuity Overlay)"]
                Foreshadow["伏笔.md (Foreshadowing Radar)"]
            end
        end
    end

    UI --> API
    API --> SecurityGate
    SecurityGate --> Engine
    Engine --> Storage

    ResLoader -.mounts.-> BuiltinSkills
    RpcMgr -.registers.-> BuiltinAgents
    RpcMgr -.wires.-> BuiltinExts
    Ext_Gates -.validates.-> Dir_Dagang
    Ext_Gates -.syncs.-> Tracking
    Ext_Guard -.restricts.-> BookDir
```

---

## 2. Interactive Flow Sequence

The diagram below illustrates a full turn of drafting a new chapter with pre-write outline gates, specialist agent execution, slop checks, and transactional state synchronization:

```mermaid
sequenceDiagram
    autonumber
    actor Author as Novel Author
    participant UI as Web UI (StoryActionBar / ReaderModal)
    participant RPC as Backend RPC (rpc-manager.ts)
    participant Gates as Gatekeeper (story-gates.ts)
    participant Agent as Drafting Subagent (narrative-writer)
    participant Disk as Local Workspace (Prose & Tracking)

    Author->>UI: Click [✍️ 推进最新章正文] or submit writing prompt
    UI->>RPC: POST /api/agent/[id] with prompt command
    RPC->>Gates: Trigger tool_call hook (write / edit)
    
    rect rgb(240, 248, 255)
    Note over Gates,Disk: Pre-Write Outline Verification Gate
    Gates->>Disk: Check if 大纲/细纲_第N章*.md exists
    alt Outline is missing
        Gates-->>RPC: Block execution (block: true, outline required)
        RPC-->>UI: Advise author to formulate outline first
    else Outline verified
        Gates-->>RPC: Allow execution (block: false)
    end
    end

    RPC->>Agent: Spawn narrative-writer specialist subagent
    Agent->>Disk: Read 追踪/上下文.md and current chapter outline
    Agent->>Agent: Execute sensory beats, pacing & anti-AI slop crafting
    Agent->>Disk: Write completed prose to 正文/第XXX章_章名.md
    
    rect rgb(255, 250, 240)
    Note over Gates,Disk: Post-Write Ledger Transaction
    Gates->>Disk: Update 追踪/_tracking-state.json (wordcount, chapter, foreshadowing)
    Gates->>Disk: Regenerate 追踪/上下文.md for next chapter
    end

    RPC-->>UI: SSE streaming finish, emit story-refresh event
    UI->>Disk: GET /api/files/... to refresh chapter catalog
    UI-->>Author: Status bar advances to next chapter, [📖 看全书] ready for reading
```

---

## 3. Key Evolution: Legacy Copy vs Native In-Process

| Dimension | Legacy Global Copy | Native Built-in Architecture |
| :--- | :--- | :--- |
| **Asset Location** | Files copied to `~/.pi/agent/` and `~/.agents/` on boot | **100% self-contained** within `story-app/skills/` and `story-app/lib/` |
| **Startup Overhead** | `bootstrap-story.js` performed recursive copies on startup | **Instant startup**; 0 file copy overhead |
| **Skill Discovery** | Relied on global `~/.agents/skills/` lookup | `DefaultResourceLoader` receives `additionalSkillPaths` |
| **Subagent Loading** | Copied `.md` to `~/.pi/agent/agents/` | `subagents.ts` scans internal `references/pi/agents/` dynamically |
| **Guardrails & Hooks** | `story-gates.ts` searched external drive paths for hook engine | Modular relative import; no hardcoded paths |
| **File API Encoding** | `encodeURIComponent` collapsed Windows slash segments | `encodeFilePathForApi` safely encodes multi-segment paths |
| **Workspace Purity** | Novel directory cluttered with external setup scripts | **Pure author files**: only outlines, prose, settings & tracking |

---

## 4. Developer Code Map

- [`lib/story-paths.ts`](file:///E:/story-app/lib/story-paths.ts): Dynamic resolver for built-in skills, agents, extensions, and app root.
- [`lib/rpc-manager.ts`](file:///E:/story-app/lib/rpc-manager.ts): Session factory. Injects `additionalSkillPaths`, `story-gates.ts`, `story-guard.ts`, and `story-agents.ts`.
- [`lib/subagents.ts`](file:///E:/story-app/lib/subagents.ts): Subagent controller. Discovers the 7 built-in writing subagents in `profileDirectories`.
- [`lib/subagent-runtime.ts`](file:///E:/story-app/lib/subagent-runtime.ts): Subagent runtime. Passes built-in skills to child subagents.
- [`lib/skills-service.ts`](file:///E:/story-app/lib/skills-service.ts): Skill API service powering Settings -> Skills.
- [`lib/allowed-roots.ts`](file:///E:/story-app/lib/allowed-roots.ts): Allowed file roots security whitelist.
- [`components/story/StoryReaderModal.tsx`](file:///E:/story-app/components/story/StoryReaderModal.tsx): Novel full-text reader & manual editor modal with debounced auto-save and quality triggers.
- [`components/story/useActiveBook.ts`](file:///E:/story-app/components/story/useActiveBook.ts): Multi-book directory scanner and reactive book state hook.
