import fs from "fs";
import path from "path";
import os from "os";
import { getStoryAgentsDir, getStorySkillsDir } from "./story-paths";

export type StorySlot = "architect" | "writer" | "reviewer" | "runner";

export interface StoryAgentProfile {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  slot: StorySlot;
  model?: string;
  filePath: string;
}

export interface ResolveStoryAgentOptions {
  cwd?: string;
  allowUnbound?: boolean;
}

const DEFAULT_SLOTS: Record<string, StorySlot> = {
  "story-architect": "architect",
  "narrative-writer": "writer",
  "character-designer": "architect",
  "consistency-checker": "reviewer",
  "chapter-extractor": "runner",
  "story-explorer": "runner",
  "story-researcher": "runner",
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "narrative-writer": "正文执笔 (narrative-writer)",
  "story-architect": "策划编辑/架构师 (story-architect)",
  "consistency-checker": "审稿质检/一致性检查 (consistency-checker)",
  "character-designer": "角色设计/对话专家 (character-designer)",
  "chapter-extractor": "章节提取/拆文专家 (chapter-extractor)",
  "story-explorer": "故事资料查询员 (story-explorer)",
  "story-researcher": "资料研究员 (story-researcher)",
  "quality-inspector": "审稿质检 (consistency-checker)",
  "foreshadow-notary": "伏笔公证人 (consistency-checker)",
};

/**
 * Reads slot bindings from project or global settings.
 * Priority: <cwd>/.pi/settings.json -> ~/.pi/agent/settings.json -> ~/.pi/agent/story-slots.json
 */
export function readStorySlotBinding(slot: StorySlot, cwdOrOptions?: string | { cwd?: string }): string | undefined {
  const cwd = typeof cwdOrOptions === "string" ? cwdOrOptions : cwdOrOptions?.cwd;
  const candidates: string[] = [];
  if (cwd) {
    candidates.push(path.join(cwd, ".pi", "settings.json"));
  }
  const home = os.homedir();
  candidates.push(path.join(home, ".pi", "agent", "settings.json"));
  candidates.push(path.join(home, ".pi", "agent", "story-slots.json"));

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const raw = fs.readFileSync(candidate, "utf-8");
      const parsed = JSON.parse(raw);
      const slotModel = parsed.storySlots?.[slot] || (candidate.endsWith("story-slots.json") ? parsed[slot] : undefined);
      if (typeof slotModel === "string" && slotModel.trim()) {
        return slotModel.trim();
      }
    } catch {
      // Ignore invalid JSON in settings candidate and continue fallback
    }
  }

  return undefined;
}

/**
 * Resolves a Story-xY agent definition dynamically from disk.
 * Model is resolved strictly from slot bindings: no hardcoded models or drive letters.
 */
export function resolveStoryAgent(role: string, options: ResolveStoryAgentOptions = {}): StoryAgentProfile {
  const normalizedRole = (role === "quality-inspector" || role === "foreshadow-notary")
    ? "consistency-checker"
    : role.trim().toLowerCase();

  const cwd = options.cwd || process.cwd();
  const agentsDir = getStoryAgentsDir(cwd);
  const skillsDir = getStorySkillsDir(cwd);

  const candidates = [
    path.join(agentsDir, `${normalizedRole}.md`),
    path.join(skillsDir, "story-setup", "references", "pi", "agents", `${normalizedRole}.md`),
    path.join(skillsDir, "story-setup", "references", "templates", "agents", `${normalizedRole}.md`),
    path.join(cwd, ".pi", "agents", `${normalizedRole}.md`),
    path.join(os.homedir(), ".pi", "agent", "agents", `${normalizedRole}.md`),
  ];

  let targetPath = "";
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      targetPath = c;
      break;
    }
  }

  if (!targetPath) {
    throw new Error(`找不到 Agent 契约文件: 未找到 ${normalizedRole}.md (检索了 skills/ 与 ~/.pi/agent/agents/)`);
  }

  const raw = fs.readFileSync(targetPath, "utf-8");
  const parts = raw.split(/^---\r?\n/m);

  let systemPrompt = raw.trim();
  let tools: string[] = ["read", "bash"];
  let description = "";
  let slot: StorySlot = DEFAULT_SLOTS[normalizedRole] || "runner";

  if (parts.length >= 3) {
    const frontmatter = parts[1];
    systemPrompt = parts.slice(2).join("---").trim();

    // Extract slot
    const slotMatch = frontmatter.match(/^slot:\s*([^\s#]+)/m);
    if (slotMatch && slotMatch[1]) {
      const parsedSlot = slotMatch[1].trim() as StorySlot;
      if (["architect", "writer", "reviewer", "runner"].includes(parsedSlot)) {
        slot = parsedSlot;
      }
    }

    // Extract tools (supports inline [a, b] and yaml block list)
    const inlineToolsMatch = frontmatter.match(/^tools:\s*\[(.*?)\]/m);
    if (inlineToolsMatch && inlineToolsMatch[1]) {
      tools = inlineToolsMatch[1].split(",").map(t => t.trim().replace(/['"]/g, "").toLowerCase());
    } else {
      const blockToolsMatch = frontmatter.match(/^tools:\s*\n((?:\s*-\s*[^\n]+\n?)+)/m);
      if (blockToolsMatch && blockToolsMatch[1]) {
        tools = blockToolsMatch[1]
          .split("\n")
          .map(line => line.replace(/^\s*-\s*/, "").trim().replace(/['"]/g, "").toLowerCase())
          .filter(Boolean);
      }
    }

    // Extract description
    const descBlockMatch = frontmatter.match(/^description:\s*\|\r?\n((?:[ \t]+[^\n]*\r?\n?)+)/m);
    if (descBlockMatch && descBlockMatch[1]) {
      description = descBlockMatch[1]
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join(" ");
    } else {
      const descMatch = frontmatter.match(/^description:\s*([^\n\r]+)/m);
      if (descMatch) description = descMatch[1].trim();
    }
  }

  // Resolve model via slot binding
  const boundModel = readStorySlotBinding(slot, cwd);
  if (!boundModel && !options.allowUnbound) {
    throw new Error(
      `未绑定槽位模型: 角色 "${normalizedRole}" 绑定到槽位 "${slot}"，但未在设置中配置对应的模型，请前往设置配置该槽位模型。`
    );
  }

  return {
    name: normalizedRole,
    displayName: AGENT_DISPLAY_NAMES[role] || normalizedRole,
    description,
    systemPrompt,
    tools,
    slot,
    model: boundModel,
    filePath: targetPath,
  };
}
