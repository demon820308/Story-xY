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
export function getStorySkillsDir(cwd: string = process.cwd()): string {
  if (process.env.STORY_SKILLS_PATH && fs.existsSync(process.env.STORY_SKILLS_PATH)) {
    return path.resolve(process.env.STORY_SKILLS_PATH);
  }

  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills"),
    path.resolve(cwd, "skills"),
    path.join(os.homedir(), ".pi", "agent", "skills"),
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
export function getStoryAgentsDir(cwd: string = process.cwd()): string {
  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills", "story-setup", "references", "pi", "agents"),
    path.resolve(cwd, "skills", "story-setup", "references", "pi", "agents"),
    path.resolve(appRoot, ".pi", "agents"),
    path.resolve(cwd, ".pi", "agents"),
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
export function getStoryExtensionsDir(cwd: string = process.cwd()): string {
  const appRoot = getStoryAppRoot();
  const candidates = [
    path.resolve(appRoot, "skills", "story-setup", "references", "pi", "extensions"),
    path.resolve(cwd, "skills", "story-setup", "references", "pi", "extensions"),
    path.resolve(appRoot, ".pi", "extensions"),
    path.resolve(cwd, ".pi", "extensions"),
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
export function getStoryScriptPath(skillName: string, scriptName: string, cwd: string = process.cwd()): string {
  const skillsDir = getStorySkillsDir(cwd);
  const target = path.join(skillsDir, skillName, "scripts", scriptName);
  return target;
}
