import fs from "fs";
import path from "path";
import os from "os";
import { getStoryAgentsDir, getStorySkillsDir } from "./story-paths";

export interface StoryAgentProfile {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model?: string;
  filePath: string;
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "narrative-writer": "正文执笔 (narrative-writer)",
  "story-architect": "策划编辑/架构师 (story-architect)",
  "consistency-checker": "审稿质检/一致性检查 (consistency-checker)",
  "character-designer": "角色设计/对话专家 (character-designer)",
  "chapter-extractor": "章节提取/拆文专家 (chapter-extractor)",
  "story-explorer": "故事资料查询员 (story-explorer)",
  "story-researcher": "资料研究员 (story-researcher)",
  "quality-inspector": "审稿质检 (consistency-checker)",
  "foreshadow-notary": "伏笔公证人 (consistency-checker)"
};

/**
 * Dynamically resolves the canonical Story-xY agent definition directly from disk:
 * 1. ~/.pi/agent/agents/{role}.md
 * 2. <skills>/story-setup/references/templates/agents/{role}.md
 *
 * NO HARDCODED PROMPTS or fixed drive letters in TypeScript code!
 */
export function resolveStoryAgent(role: string): StoryAgentProfile {
  const normalizedRole = (role === "quality-inspector" || role === "foreshadow-notary")
    ? "consistency-checker"
    : role.trim().toLowerCase();

  const agentsDir = getStoryAgentsDir();
  const skillsDir = getStorySkillsDir();
  const homeDir = os.homedir();
  const candidates = [
    path.join(agentsDir, `${normalizedRole}.md`),
    path.join(skillsDir, "story-setup", "references", "templates", "agents", `${normalizedRole}.md`),
    path.resolve(process.cwd(), "skills", "story-setup", "references", "templates", "agents", `${normalizedRole}.md`),
    path.join(homeDir, ".pi", "agent", "agents", `${normalizedRole}.md`),
    path.resolve(process.cwd(), "..", "story-xy", "skills", "story-setup", "references", "templates", "agents", `${normalizedRole}.md`)
  ];

  let targetPath = "";
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      targetPath = c;
      break;
    }
  }

  if (!targetPath) {
    throw new Error(`找不到 Agent 契约文件: 未在 skills/ 或 ~/.pi/agent/agents/ 找到 ${normalizedRole}.md`);
  }

  const raw = fs.readFileSync(targetPath, "utf-8");
  const parts = raw.split(/^---\r?\n/m);

  let systemPrompt = raw.trim();
  let tools: string[] = ["Read", "Glob", "Grep", "Write", "Edit", "Bash"];
  let description = "";
  let model = "MiniMax-M3";

  if (parts.length >= 3) {
    const frontmatter = parts[1];
    systemPrompt = parts.slice(2).join("---").trim();

    // Extract tools from frontmatter
    const toolsMatch = frontmatter.match(/tools:\s*\[(.*?)\]/);
    if (toolsMatch && toolsMatch[1]) {
      tools = toolsMatch[1].split(",").map(t => t.trim().replace(/['"]/g, ""));
    }

    // Extract description
    const descMatch = frontmatter.match(/description:\s*([^\n\r]+)/);
    if (descMatch) description = descMatch[1].trim();

    // Extract model
    const modelMatch = frontmatter.match(/model:\s*([^\n\r]+)/);
    if (modelMatch) model = modelMatch[1].trim();
  }

  return {
    name: normalizedRole,
    displayName: AGENT_DISPLAY_NAMES[role] || normalizedRole,
    description,
    systemPrompt,
    tools,
    model,
    filePath: targetPath
  };
}
