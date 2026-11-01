import path from "path";
import fs from "fs";
import os from "os";

/**
 * 获取当前 story-app 运行时的程序根目录
 */
export function getStoryAppRoot(): string {
  if (typeof __dirname !== "undefined") {
    return path.resolve(__dirname, "..");
  }
  return process.cwd();
}

/**
 * 动态探测 Story skills 根目录（优先使用应用内内置的 skills/）
 */
export function getStorySkillsDir(): string {
  if (process.env.STORY_SKILLS_PATH && fs.existsSync(process.env.STORY_SKILLS_PATH)) {
    return path.resolve(process.env.STORY_SKILLS_PATH);
  }

  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(process.cwd(), "..", "story-xy", "skills"),
    path.join(os.homedir(), ".agents", "skills"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  return path.resolve(appRoot, "skills");
}

/**
 * 获取 Story Studio 内置 7 位写手子代理配置目录
 */
export function getStoryAgentsDir(): string {
  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills", "story-setup", "references", "pi", "agents"),
    path.resolve(process.cwd(), "skills", "story-setup", "references", "pi", "agents"),
    path.resolve(process.cwd(), "..", "story-xy", "skills", "story-setup", "references", "pi", "agents"),
    path.join(os.homedir(), ".pi", "agent", "agents"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  return path.resolve(appRoot, "skills", "story-setup", "references", "pi", "agents");
}

/**
 * 获取 Story Studio 内置扩展目录 (story-gates, story-guard, story-agents)
 */
export function getStoryExtensionsDir(): string {
  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills", "story-setup", "references", "pi", "extensions"),
    path.resolve(process.cwd(), "skills", "story-setup", "references", "pi", "extensions"),
    path.resolve(process.cwd(), "..", "story-xy", "skills", "story-setup", "references", "pi", "extensions"),
    path.join(os.homedir(), ".pi", "agent", "extensions"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  return path.resolve(appRoot, "skills", "story-setup", "references", "pi", "extensions");
}

/**
 * 动态定位特定技能下的脚本文件 (如 story-long-write/scripts/storyctl.py)
 */
export function getStoryScriptPath(skillName: string, scriptName: string): string {
  const skillsDir = getStorySkillsDir();
  const target = path.join(skillsDir, skillName, "scripts", scriptName);
  if (fs.existsSync(target)) {
    return target;
  }

  // Sibling fallback
  const sibling = path.resolve(process.cwd(), "..", "story-xy", "skills", skillName, "scripts", scriptName);
  if (fs.existsSync(sibling)) {
    return sibling;
  }

  return target;
}
