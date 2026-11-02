import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let coreInstance: any = null;
function getCore(root?: string): any {
  if (coreInstance) return coreInstance;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    // 1. 相对本扩展自身的相对路径
    path.resolve(__dirname, "../../skills/story-setup/references/templates/hooks/story_hook_core.js"),
    path.resolve(__dirname, "../skills/story-setup/references/templates/hooks/story_hook_core.js"),
    path.resolve(__dirname, "../../.agents/hooks/story_hook_core.js"),
    // 2. 当前工作区相对路径
    root ? path.join(root, "skills/story-setup/references/templates/hooks/story_hook_core.js") : null,
    root ? path.join(root, ".agents/hooks/story_hook_core.js") : null,
    // 3. 用户主目录技能与 hooks 路径
    path.join(home, ".pi/agent/skills/story-setup/references/templates/hooks/story_hook_core.js"),
    path.join(home, ".agents/skills/story-setup/references/templates/hooks/story_hook_core.js"),
    path.join(home, ".agents/hooks/story_hook_core.js"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        coreInstance = require(c);
        return coreInstance;
      } catch {}
    }
  }
  return null;
}

function getSettingsFile(root?: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (root) {
    const projectFile = path.join(root, ".pi", "story-workbench.json");
    if (fs.existsSync(projectFile)) return projectFile;
  }
  return path.join(home, ".pi", "story-workbench.json");
}

function getWorkbenchSettings(root?: string): { confirmDialog: boolean } {
  try {
    const file = getSettingsFile(root);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.confirmDialog === "boolean") {
        return parsed;
      }
    }
  } catch {}
  return { confirmDialog: true }; // 默认开启弹窗确认
}

function saveWorkbenchSettings(settings: { confirmDialog: boolean }, root?: string) {
  try {
    const file = getSettingsFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2), "utf8");
  } catch (e) {
    console.error("[story-gates] 无法保存工作台设置:", e);
  }
}

function checkOutlineExists(bookDir: string, nextChapter: number): boolean {
  const dagangDir = path.join(bookDir, "大纲");
  if (!fs.existsSync(dagangDir)) return false;
  try {
    const files = fs.readdirSync(dagangDir);
    const pad3 = String(nextChapter).padStart(3, "0");
    const pad2 = String(nextChapter).padStart(2, "0");
    const numStr = String(nextChapter);
    return files.some((f) => {
      if (!f.endsWith(".md")) return false;
      return (
        f.includes(`第${pad3}章`) ||
        f.includes(`第${pad2}章`) ||
        f.includes(`第${numStr}章`) ||
        f.includes(`_${pad3}`) ||
        f.includes(`_${numStr}`)
      );
    });
  } catch {
    return false;
  }
}

function getStoryInfo(root: string) {
  const core = getCore(root);
  if (!core) return null;
  const bookDir = core.discoverActiveBook(root);
  if (!bookDir) return null;
  const bookName = path.basename(bookDir);

  const normBookDir = bookDir.replace(/\\/g, "/");
  const isShort =
    normBookDir.includes("/短篇/") ||
    (fs.existsSync(path.join(bookDir, "小节大纲.md")) && !fs.existsSync(path.join(bookDir, "追踪")));

  if (isShort) {
    let emotion = "待定";
    let paywall = "待定";
    const settingPath = path.join(bookDir, "设定.md");
    if (fs.existsSync(settingPath)) {
      try {
        const text = fs.readFileSync(settingPath, "utf8");
        const em = text.match(/(?:目标情绪|核心情绪|情绪)[：:]\s*([^\r\n]+)/);
        if (em) emotion = em[1].trim();
        const pw = text.match(/(?:付费点|卡点)[：:]\s*([^\r\n]+)/);
        if (pw) paywall = pw[1].trim();
      } catch {}
    }

    let totalSections = 0;
    let detailSections = 0;
    let nextDetailExists = false;
    const outlinePath = path.join(bookDir, "小节大纲.md");
    if (fs.existsSync(outlinePath)) {
      try {
        const text = fs.readFileSync(outlinePath, "utf8");
        const lines = text.split("\n");
        for (const line of lines) {
          const tr = line.trim();
          if (tr.startsWith("|") && !tr.includes("---") && !tr.includes("结构段") && !tr.includes("小节序号")) {
            totalSections++;
          }
        }
        const detailMatches = text.match(/^##\s*第\s*\d+\s*节/gm);
        detailSections = detailMatches ? detailMatches.length : 0;
      } catch {}
    }

    let proseSections = 0;
    const prosePath = path.join(bookDir, "正文.md");
    if (fs.existsSync(prosePath)) {
      try {
        const text = fs.readFileSync(prosePath, "utf8");
        const proseMatches = text.match(/(?:^|\n)(?:###\s*\d+\.|\d+\.\s+[^\r\n]+|###\s*第\s*\d+\s*[章节])/g);
        proseSections = proseMatches ? proseMatches.length : 0;
      } catch {}
    }

    const nextSec = proseSections + 1;
    if (fs.existsSync(outlinePath)) {
      try {
        const text = fs.readFileSync(outlinePath, "utf8");
        const reg = new RegExp(`^##\\s*第\\s*0*${nextSec}\\s*节`, "m");
        nextDetailExists = reg.test(text);
      } catch {}
    }

    return {
      isShort: true,
      bookDir,
      bookName,
      emotion,
      paywall,
      totalSections,
      detailSections,
      proseSections,
      nextSec,
      nextDetailExists,
      lastChapter: proseSections,
      nextChapter: nextSec,
      hasNextOutline: nextDetailExists,
      rev: "1",
      activeForeshadow: 0,
      scene: "",
    };
  }

  const statePath = path.join(bookDir, "追踪", "_tracking-state.json");
  let lastChapter = 0;
  let rev = "1";
  let activeForeshadow = 0;
  let scene = "";

  if (fs.existsSync(statePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
      lastChapter = Number(data.last_committed_chapter) || 0;
      rev = String(data.state_revision ?? "1");
      if (data.context?.position?.scene) {
        scene = String(data.context.position.scene);
      }
      if (data.foreshadow && typeof data.foreshadow === "object") {
        activeForeshadow = Object.values(data.foreshadow).filter(
          (f: any) => f && f.status !== "resolved" && f.status !== "abandoned"
        ).length;
      }
    } catch {}
  }

  const nextChapter = lastChapter + 1;
  const hasNextOutline = checkOutlineExists(bookDir, nextChapter);

  return {
    isShort: false,
    bookDir,
    bookName,
    lastChapter,
    nextChapter,
    hasNextOutline,
    rev,
    activeForeshadow,
    scene,
  };
}

function generateStoryDashboardFile(root: string): string | null {
  const core = getCore(root);
  if (!core) return null;
  const bookDir = core.discoverActiveBook(root);
  if (!bookDir) return null;

  const statePath = path.join(bookDir, "追踪", "_tracking-state.json");
  const contextPath = path.join(bookDir, "追踪", "上下文.md");
  if (!fs.existsSync(statePath)) return null;

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const contextText = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, "utf8") : "";

    const lastChapter = Number(state.last_committed_chapter) || 0;
    const nextChapter = lastChapter + 1;
    const rev = state.state_revision ?? "1";

    // 1. 角色解析
    const roleLines: { name: string; identity: string; state: string; goal: string }[] = [];
    const charMatch = contextText.match(/## 核心角色状态\s+([\s\S]*?)(?=\n##|$)/);
    if (charMatch) {
      charMatch[1]
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .forEach((line) => {
          const parts = line.slice(2).split("｜");
          if (parts.length >= 3) {
            roleLines.push({
              name: parts[0].trim(),
              identity: parts[1].trim(),
              state: parts[2].trim(),
              goal: (parts[3] || "").trim().replace(/^目标：/, ""),
            });
          }
        });
    }

    // 2. 下一章承诺解析
    const commitments: string[] = [];
    const commitMatch = contextText.match(/## 下一章承诺\s+([\s\S]*?)(?=\n##|$)/);
    if (commitMatch) {
      commitMatch[1]
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .forEach((line) => {
          commitments.push(line.slice(2).trim());
        });
    }

    // 3. 伏笔分类
    const allForeshadows = Object.values(state.foreshadow || {}).filter(
      (f: any) => f && f.status !== "resolved" && f.status !== "abandoned"
    ) as any[];

    const urgent: any[] = [];
    const near: any[] = [];
    const longTerm: any[] = [];

    allForeshadows.forEach((f) => {
      const target = Number(f.planned_resolution_chapter);
      if (target === nextChapter || target === lastChapter) {
        urgent.push(f);
      } else if (target > nextChapter && target <= nextChapter + 3) {
        near.push(f);
      } else {
        longTerm.push(f);
      }
    });

    // 4. 字数记录
    const wcRecords: { chapter: string; target: number; actual: number; diff: string; status: string }[] = [];
    if (state.wordcount_records) {
      Object.keys(state.wordcount_records)
        .sort((a, b) => Number(a) - Number(b))
        .slice(-5)
        .forEach((ch) => {
          const rec = state.wordcount_records[ch];
          const diff = rec.actual - rec.target;
          const diffPct = Math.round((diff / rec.target) * 100);
          wcRecords.push({
            chapter: ch,
            target: rec.target,
            actual: rec.actual,
            diff: `${diff >= 0 ? "+" : ""}${diff} (${diffPct >= 0 ? "+" : ""}${diffPct}%)`,
            status: rec.status === "internal_pass" ? "✅ 合规达标" : rec.status,
          });
        });
    }

    const pos = state.context?.position || {};

    let md = `# 📊 《${state.book_title || path.basename(bookDir)}》创作工作台全景看板\n\n`;
    md += `> 🔄 状态修订：rev.${rev} ｜ 🚀 写作坐标：第 ${lastChapter} 章已落盘 ➔ 待写第 ${nextChapter} 章 ｜ 🛡️ 门禁状态：细纲守卫 + AI指纹双重在线\n\n`;
    md += `---\n\n`;

    md += `## 🧭 一、创作坐标与主线倒计时\n\n`;
    md += `| 维度 | 当前设定与状态 |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **所属分卷** | ${pos.volume || "第一卷"} |\n`;
    md += `| **当前进度** | **第 ${lastChapter} 章已完结** ➔ **准备起草第 ${nextChapter} 章** |\n`;
    md += `| **故事时间** | ${pos.story_time || "待定"} |\n`;
    md += `| **当前场景** | ${pos.scene || "待定"} |\n`;
    md += `| **主线目标** | 任务三：离别主题作品、开放日热度 1000 万+、限时 14 天（当前倒计时剩余 11 天） |\n\n`;

    if (commitments.length > 0) {
      md += `### 📌 第 ${nextChapter} 章剧情承诺清单\n`;
      commitments.forEach((c) => {
        md += `- ${c}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
    md += `## 🎯 二、伏笔演进雷达 (Foreshadowing Kanban)\n\n`;

    md += `\`\`\`mermaid\n`;
    md += `flowchart TD\n`;
    md += `  subgraph U["🔴 紧迫推进 (第 ${nextChapter} 章)"]\n`;
    urgent.forEach((f) => {
      const summaryText = f.summary ? f.summary.slice(0, 18).replace(/["']/g, "") : "";
      md += `    ${f.id}["${f.id}: ${summaryText}..."]\n`;
    });
    if (urgent.length === 0) md += `    noneU["暂无本章到期伏笔"]\n`;
    md += `  end\n`;

    md += `  subgraph N["🟡 近期推进 (第 ${nextChapter + 1}-${nextChapter + 3} 章)"]\n`;
    near.forEach((f) => {
      const summaryText = f.summary ? f.summary.slice(0, 18).replace(/["']/g, "") : "";
      md += `    ${f.id}["${f.id}: ${summaryText}..."]\n`;
    });
    if (near.length === 0) md += `    noneN["暂无近期回收"]\n`;
    md += `  end\n`;

    md += `  subgraph L["🟢 长期主线与暗线"]\n`;
    longTerm.slice(0, 5).forEach((f) => {
      const summaryText = f.summary ? f.summary.slice(0, 18).replace(/["']/g, "") : "";
      md += `    ${f.id}["${f.id}: ${summaryText}..."]\n`;
    });
    md += `  end\n`;
    md += `\`\`\`\n\n`;

    md += `### 📋 活跃伏笔状态明细\n\n`;
    md += `| 编号 | 伏笔核心内容 | 埋设章 | 计划回收 | 重要性 | 状态 |\n`;
    md += `| :---: | :--- | :---: | :---: | :---: | :---: |\n`;
    urgent
      .concat(near)
      .concat(longTerm)
      .forEach((f) => {
        md += `| **${f.id}** | ${f.summary} | 第${f.planted_chapter}章 | ${
          f.planned_resolution_chapter ? "第" + f.planned_resolution_chapter + "章" : "长期/待定"
        } | ${f.importance === "高" ? "🔴 高" : "🟡 中"} | ${f.status || "活跃"} |\n`;
      });
    md += `\n---\n\n`;

    md += `## 👥 三、在场核心角色状态卡\n\n`;
    md += `| 角色 | 身份与定位 | 当前心境与动向 | 关键目标与悬念 |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    roleLines.forEach((r) => {
      md += `| **${r.name}** | ${r.identity} | ${r.state} | ${r.goal} |\n`;
    });
    md += `\n---\n\n`;

    md += `## 📈 四、章节字数与健康度监控\n\n`;
    md += `| 章节 | 规划目标 | 实际落盘 | 偏离度 | 质检判定 |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: |\n`;
    wcRecords.forEach((w) => {
      md += `| 第 ${w.chapter} 章 | ${w.target} 字 | **${w.actual} 字** | ${w.diff} | ${w.status} |\n`;
    });

    const outPath = path.join(bookDir, "追踪", "工作台全景看板.md");
    fs.writeFileSync(outPath, md, "utf8");
    return outPath;
  } catch (err) {
    console.error("[story-gates] 生成工作台全景看板失败:", err);
    return null;
  }
}

async function handleCreateNewBook(ctx: ExtensionContext, root: string, pi: ExtensionAPI) {
  if (!ctx.ui) return;

  // 1. 书名输入
  const bookTitleInput = await ctx.ui.input("📚 创建新书籍 (1/3)", "请输入新书书名（例如：我在镇抚司斩神）");
  if (!bookTitleInput || !bookTitleInput.trim()) {
    ctx.ui.notify("已取消创建新书籍", "info");
    return;
  }
  const bookTitle = bookTitleInput.trim().replace(/[<>:"/\\|?*]/g, "");

  // 2. 题材与体裁选择
  const genreChoice = await ctx.ui.select("📚 选择作品题材与体裁 (2/3)", [
    "长篇 ｜ 都市异能 / 职场高燃",
    "长篇 ｜ 玄幻仙侠 / 爽点无敌",
    "长篇 ｜ 科幻无限 / 悬疑惊悚",
    "长篇 ｜ 军旅热血 / 强国强军",
    "短篇 ｜ 知乎反转 / 脑洞爆款",
    "其他 ｜ 自定义长篇题材",
  ]);
  if (!genreChoice) {
    ctx.ui.notify("已取消创建新书籍", "info");
    return;
  }

  // 3. 核心梗与主角设定
  const premiseInput = await ctx.ui.input(
    "📚 核心设定与金手指 (3/3)",
    "请输入一句话核心梗或主角金手指（例如：主角觉醒推演系统，每次推理案件都能提取凶手技能）"
  );
  const premise = (premiseInput || "").trim();

  // 4. 判断长篇还是短篇
  const isShort = genreChoice.startsWith("短篇");
  const relDir = isShort ? `短篇/${bookTitle}` : `长篇/${bookTitle}`;
  const bookDir = path.resolve(root, relDir);

  if (fs.existsSync(bookDir)) {
    ctx.ui.notify(`目录已存在：《${bookTitle}》，已自动切换至该书`, "warning");
    fs.writeFileSync(path.join(root, ".active-book"), relDir + "\n", "utf8");
    updateStoryDashboard(ctx);
    return;
  }

  // 5. 脚手架落盘
  try {
    if (isShort) {
      fs.mkdirSync(bookDir, { recursive: true });
      fs.writeFileSync(
        path.join(bookDir, "设定.md"),
        `# 设定：《${bookTitle}》\n\n- **题材类型**：${genreChoice}\n- **核心梗/金手指**：${premise || "暂定"}\n- **主角人设**：待定\n- **情绪弧线与反转**：待定\n`,
        "utf8"
      );
      fs.writeFileSync(
        path.join(bookDir, "小节大纲.md"),
        `# 小节大纲：《${bookTitle}》\n\n- **核心悬念**：\n- **第一节**：开端钩子\n- **第二节**：危机升级\n- **第三节**：高潮反转\n- **第四节**：收尾余韵\n`,
        "utf8"
      );
      fs.writeFileSync(path.join(bookDir, "正文.md"), "", "utf8");
    } else {
      fs.mkdirSync(path.join(bookDir, "设定"), { recursive: true });
      fs.mkdirSync(path.join(bookDir, "大纲"), { recursive: true });
      fs.mkdirSync(path.join(bookDir, "正文"), { recursive: true });
      fs.mkdirSync(path.join(bookDir, "追踪"), { recursive: true });

      fs.writeFileSync(
        path.join(bookDir, "设定", "题材定位.md"),
        `# 题材定位：《${bookTitle}》\n\n## 基本信息\n- **书名**：${bookTitle}\n- **题材**：${genreChoice}\n- **核心梗/金手指**：${premise || "暂定"}\n- **创建日期**：${new Date().toISOString().split("T")[0]}\n\n## 核心设定\n- 主角：待定\n- 世界观基底：待定\n`,
        "utf8"
      );

      const initialTrackingState = {
        schema_version: 4,
        book_title: bookTitle,
        last_committed_chapter: 0,
        imported_through_chapter: 0,
        state_revision: 0,
        context: {
          position: {
            volume: "第一卷",
            scene: "初始开篇场景",
            story_time: "故事开篇第一天",
            volume_start_chapter: 1,
          },
          current_situation: `新书《${bookTitle}》筹备开篇中。`,
          next_chapter_commitments: [
            "确立主角核心身份与出场情境",
            "抛出首个核心冲突/金手指觉醒",
          ],
        },
        characters: {},
        foreshadow: {},
        timeline: {},
        wordcount_records: {},
      };
      fs.writeFileSync(
        path.join(bookDir, "追踪", "_tracking-state.json"),
        JSON.stringify(initialTrackingState, null, 2),
        "utf8"
      );

      fs.writeFileSync(
        path.join(bookDir, "追踪", "上下文.md"),
        `# 追踪上下文：《${bookTitle}》\n\n> 状态修订：0 ｜ 最近提交章节：第 0 章 ｜ 待写章节：第 1 章\n\n## 创作坐标\n- **当前卷**：第一卷\n- **场景**：初始开篇场景\n- **故事时间**：故事开篇第一天\n\n## 当前局势\n新书《${bookTitle}》筹备开篇中，准备编写第 1 章细纲。\n\n## 下一章承诺\n- 确立主角核心身份与出场情境\n- 抛出首个核心冲突/金手指觉醒\n\n## 核心角色状态\n- 主角 ｜ 身份定位待定 ｜ 状态正常 ｜ 目标：完成初始开篇主线\n`,
        "utf8"
      );
    }

    // 6. 切换活跃书指针
    fs.writeFileSync(path.join(root, ".active-book"), relDir + "\n", "utf8");

    // 7. 即时刷新工作台状态（状态机流转）
    updateStoryDashboard(ctx);
    ctx.ui.notify(`🎉 《${bookTitle}》新书创建成功！工作台已自动就绪。`, "info");

    // 8. 会话中发送引导消息
    if (isShort) {
      await pi.sendUserMessage(
        `短篇新书《${bookTitle}》已成功创建在目录 \`${relDir}\`，当前活跃书籍指针已指向本书。\n` +
          `已建立标准化短篇三件套（设定.md、小节大纲.md、正文.md）。请启动 \`story-short-write\` 进行 Phase 1-2 核心设定构思与小节粗纲规划。`
      );
    } else {
      await pi.sendUserMessage(
        `新书《${bookTitle}》已成功创建在目录 \`${relDir}\`，当前活跃书籍指针已指向本书。\n` +
          `已建立标准化工程骨架（设定、大纲、正文、追踪账本）。请读取设定并为第 1 章做规划准备。`
      );
    }
  } catch (e: any) {
    console.error("[story-gates] 创建新书籍失败:", e);
    ctx.ui.notify(`创建新书籍失败: ${e?.message || e}`, "error");
  }
}

async function handleImportBook(ctx: ExtensionContext, root: string, pi: ExtensionAPI) {
  if (!ctx.ui) return;

  // 1. 输入文件路径
  const rawPath = await ctx.ui.input(
    "📥 导入外部作品 (1/2)",
    "请输入本地 TXT 文件路径（例如：D:/my_book.txt 或 ./raw.txt）"
  );
  if (!rawPath || !rawPath.trim()) {
    ctx.ui.notify("已取消导入书籍", "info");
    return;
  }
  const cleanPath = rawPath.trim().replace(/^["']|["']$/g, "");
  const resolvedPath = path.isAbsolute(cleanPath) ? cleanPath : path.resolve(root, cleanPath);

  if (!fs.existsSync(resolvedPath)) {
    ctx.ui.notify(`未找到指定文件，请核实路径：${resolvedPath}`, "error");
    return;
  }

  // 2. 确认书名
  const defaultTitle = path.basename(resolvedPath, path.extname(resolvedPath));
  const titleInput = await ctx.ui.input(
    "📥 确认书名 (2/2)",
    `请输入书籍在工作区中的命名（留空默认为：${defaultTitle}）`
  );
  const bookTitle = (titleInput && titleInput.trim()) || defaultTitle;
  const sanitizedTitle = bookTitle.replace(/[<>:"/\\|?*]/g, "");

  const relDir = `长篇/${sanitizedTitle}`;
  const bookDir = path.resolve(root, relDir);

  // 3. 设置活跃书指针与初始目录
  fs.mkdirSync(bookDir, { recursive: true });
  fs.writeFileSync(path.join(root, ".active-book"), relDir + "\n", "utf8");

  // 4. 触发导入流程
  ctx.ui.notify(`正在启动《${sanitizedTitle}》导入流程...`, "info");
  updateStoryDashboard(ctx);

  await pi.sendUserMessage(
    `请执行 /story-import 流程，将外部文件 "${resolvedPath}" 导入到活跃书籍目录 "${relDir}"，自动进行章节拆分与初始追踪状态建档。`
  );
}

function updateStoryDashboard(ctx: ExtensionContext) {
  if (!ctx.ui) return;
  const root = ctx.cwd || process.cwd();
  const info = getStoryInfo(root);

  // 清除全部旧版与当前 widget，不占用上方卡片面板空间（确保单行图1形态）
  ctx.ui.setWidget("story_dashboard", undefined);
  ctx.ui.setWidget("书箱控制台", undefined);
  ctx.ui.setWidget("Story状态", undefined);

  // 清空所有一键操作按键，状态栏不留任何 command 按钮
  ctx.ui.setStatus("command:/story:dashboard", undefined);
  ctx.ui.setStatus("command:/story:outline", undefined);
  ctx.ui.setStatus("command:/story:write", undefined);
  ctx.ui.setStatus("command:/story:check", undefined);
  ctx.ui.setStatus("command:/story:refresh", undefined);
  ctx.ui.setStatus("command:/story:settings", undefined);
  ctx.ui.setStatus("command:/story:new_book", undefined);
  ctx.ui.setStatus("command:/story:import_book", undefined);

  if (!info) {
    // 空工作区状态：未检测到活跃书籍
    ctx.ui.setStatus("00_story_label", "Story状态");
    ctx.ui.setStatus("01_story_info", "📖 当前工作区未检测到活跃书籍 | 请在左侧栏创建新书籍或导入已有小说");
    return;
  }

  // 短篇专属状态栏渲染分支
  if (info.isShort) {
    const total = info.totalSections || 0;
    const prose = info.proseSections || 0;
    const detail = info.detailSections || 0;
    const emotion = info.emotion || "待定";
    const paywall = info.paywall || "待定";

    let statusText = "";
    if (total === 0) {
      statusText = `📖 短篇进度: 筹备立项中 ➔ 待出设定与小节粗纲 🎯 情绪: ${emotion} | 付费点: ${paywall}`;
    } else if (prose < total) {
      const nextTarget = info.nextDetailExists
        ? `待写第 ${info.nextSec} 节正文`
        : `待补第 ${info.nextSec} 节细纲`;
      statusText = `📖 短篇进度: 已写 ${prose}/${total} 节 (细纲 ${detail}/${total}) ➔ ${nextTarget} 🎯 情绪: ${emotion} | 付费点: ${paywall}`;
    } else {
      statusText = `📖 短篇进度: 正文 ${prose}/${total} 节已落盘 ➔ 待全篇精修验收 🎯 情绪: ${emotion} | 付费点: ${paywall}`;
    }

    ctx.ui.setStatus("00_story_label", "Story状态");
    ctx.ui.setStatus("01_story_info", statusText);
    return;
  }

  // 1. 同步生成最新的工作台全景看板 Markdown 文档
  generateStoryDashboardFile(root);

  // 2. 严格文案分支规则（细纲存在与否）
  const sceneText = info.scene
    ? (info.scene.length > 20 ? `${info.scene.slice(0, 20)}...` : info.scene)
    : "待定";
  const nextTarget = info.hasNextOutline
    ? `待写第 ${info.nextChapter} 章 正文`
    : `待写第 ${info.nextChapter} 章 细纲`;

  const statusText = `📖 进度: 第 ${info.lastChapter} 章落盘 ➔ ${nextTarget} 🎯 场景: ${sceneText} | 活跃伏笔: ${info.activeForeshadow} 条`;

  // 3. 以纯单行状态项输出（图1样式：左标签 Story状态 | 右状态文本）
  ctx.ui.setStatus("00_story_label", "Story状态");
  ctx.ui.setStatus("01_story_info", statusText);
}

export default function (pi: ExtensionAPI) {

  // 会话启动或切换时刷新小说看板
  pi.on("session_start", async (_event, ctx) => {
    updateStoryDashboard(ctx);
  });

  // Agent 结束每一轮时自动刷新小说看板
  pi.on("agent_end", async (_event, ctx) => {
    updateStoryDashboard(ctx);
  });

  // 注册快捷命令：全景看板（暗色图表视窗弹窗呈现，零会话污染）
  pi.registerCommand("story:dashboard", {
    description: "查看小说工作台全景看板（含伏笔雷达与剧情拓扑）",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const dashboardPath = generateStoryDashboardFile(root);
      updateStoryDashboard(ctx);
      if (!ctx.ui) return;
      if (dashboardPath && fs.existsSync(dashboardPath)) {
        const content = fs.readFileSync(dashboardPath, "utf8");
        const info = getStoryInfo(root);
        const title = `📊 《${info?.bookName || "小说"}》工作台全景看板（按 ESC 或点击底部即可关闭）`;
        await ctx.ui.confirm(title, content);
      }
    },
  });

  // 注册快捷命令：创建新书籍
  pi.registerCommand("story:new_book", {
    description: "向导式交互创建新书籍（长篇或短篇）",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      await handleCreateNewBook(ctx, root, pi);
    },
  });

  // 注册快捷命令：导入外部书籍
  pi.registerCommand("story:import_book", {
    description: "从外部 TXT 文件导入书籍并建档",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      await handleImportBook(ctx, root, pi);
    },
  });

  // 注册快捷命令：刷新看板（免弹窗，即时同步）
  pi.registerCommand("story:refresh", {
    description: "手动刷新小说工作台看板数据",
    handler: async (_args, ctx) => {
      updateStoryDashboard(ctx);
      if (Boolean(ctx.ui)) {
        ctx.ui.notify("小说看板已更新至最新状态", "info");
      }
    },
  });

  // 注册快捷命令：工作台设置（弹窗开关与书籍管理）
  pi.registerCommand("story:settings", {
    description: "小说工作台偏好设置及书籍管理",
    handler: async (_args, ctx) => {
      if (!ctx.ui) return;
      const root = ctx.cwd || process.cwd();
      const current = getWorkbenchSettings(root);
      const info = getStoryInfo(root);
      const core = getCore(root);
      const allBooks = (core?.discoverAllBooks(root) || []) as string[];

      const options = [
        `Story面板弹窗：开启 ${current.confirmDialog ? "✓ (当前)" : ""}`,
        `Story面板弹窗：关闭 ${!current.confirmDialog ? "✓ (当前)" : ""}`,
      ];

      if (allBooks.length > 1) {
        options.push(`📚 切换活跃书籍 (${allBooks.length} 本)...`);
      }
      if (info) {
        options.push(`📖 章节阅读（阅读已完结章节）...`);
      }
      options.push(`➕ 创建新书籍...`);
      options.push(`📥 导入外部书籍 (TXT)...`);

      const choice = await ctx.ui.select("⚙️ 小说工作台设置与书籍管理", options);
      if (!choice) return;

      if (choice.startsWith("Story面板弹窗：开启")) {
        saveWorkbenchSettings({ confirmDialog: true }, root);
        ctx.ui.notify("Story面板弹窗已设置为：开启", "info");
      } else if (choice.startsWith("Story面板弹窗：关闭")) {
        saveWorkbenchSettings({ confirmDialog: false }, root);
        ctx.ui.notify("Story面板弹窗已设置为：关闭", "info");
      } else if (choice.startsWith("📚 切换活跃书籍")) {
        const currentActive = core.discoverActiveBook(root);
        const bookOptions = allBooks.map((b) => {
          const rel = path.relative(root, b).replace(/\\/g, "/");
          const isCur = b === currentActive;
          return `${path.basename(b)} [${rel}] ${isCur ? "✓ (当前活跃)" : ""}`;
        });
        const chosenBook = await ctx.ui.select("📚 请选择要切换的活跃书籍", bookOptions);
        if (chosenBook) {
          const selectedRel = chosenBook.split(" [")[1].split("]")[0];
          fs.writeFileSync(path.join(root, ".active-book"), selectedRel + "\n", "utf8");
          updateStoryDashboard(ctx);
          ctx.ui.notify(`已成功切换当前书籍为：${selectedRel}`, "info");
        }
      } else if (choice.startsWith("📖 章节阅读")) {
        if (!info) return;
        const proseDir = path.join(info.bookDir, "正文");
        if (!fs.existsSync(proseDir)) {
          ctx.ui.notify("当前书籍暂无正文目录", "warning");
          return;
        }
        const files = fs.readdirSync(proseDir).filter((f) => f.endsWith(".md")).sort();
        if (files.length === 0) {
          ctx.ui.notify("当前书籍暂无已写正文章节", "warning");
          return;
        }
        const selectedChapter = await ctx.ui.select("📖 选择要阅读的章节", files.slice().reverse());
        if (selectedChapter) {
          const fullPath = path.join(proseDir, selectedChapter);
          const content = fs.readFileSync(fullPath, "utf8");
          await ctx.ui.confirm(`📖 阅读：${selectedChapter}（按 ESC 关闭）`, content);
        }
      } else if (choice.startsWith("➕ 创建新书籍")) {
        await handleCreateNewBook(ctx, root, pi);
      } else if (choice.startsWith("📥 导入外部书籍")) {
        await handleImportBook(ctx, root, pi);
      }
    },
  });

  // 注入子代理调用契约，优先走 Pi Web 原生 Agent 工具
  pi.on("before_agent_start", async (event, ctx) => {
    updateStoryDashboard(ctx);
    const base = event.systemPrompt || "";
    const agentRule = `
## 子代理调用协议（Pi Web 宿主）：
当需要调用子代理（如 narrative-writer, consistency-checker, story-architect, character-designer, story-explorer, story-researcher, chapter-extractor）处理任务时：
必须直接调用内置的 \`Agent\` 工具，严禁使用 bash 执行命令行子进程调用。
- \`subagent_type\`: 对应的子代理名称（例如 "narrative-writer"）
- \`description\`: 简短明了的任务说明（例如 "撰写第025章正文"，会在网页端卡片展示并支持作者点击查看实时进度）
- \`prompt\`: 完整的任务指令与输入内容
`;
    return { systemPrompt: `${base}\n\n${agentRule}` };
  });

  // 注册快捷命令：出细纲（支持弹窗确认）
  pi.registerCommand("story:outline", {
    description: "按照 Story-xY 规划流程为下一章出细纲",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const settings = getWorkbenchSettings(root);
      const info = getStoryInfo(root);
      const targetChapter = info ? info.nextChapter : "下";
      const targetChapterStr = String(targetChapter).padStart(3, "0");

      if (settings.confirmDialog && Boolean(ctx.ui)) {
        const confirmed = await ctx.ui.confirm(
          `📋 确认执行：第 ${targetChapter} 章出细纲`,
          `### 📋 任务详情：编写最新章节细纲\n\n- **目标章节**：第 ${targetChapter} 章\n- **参考依据**：\`追踪/上下文.md\`（当前状态：第 ${info ? info.lastChapter : "?"} 章已落盘）\n- **产出路径**：\`大纲/细纲_第${targetChapterStr}章.md\`\n- **工作流规则**：严格消费阅读体验字段，规划续接与连贯性对标\n\n> 💡 点击【确认】后将由 Agent 读取上下文并编制细纲；点击【取消】中止。`
        );
        if (!confirmed) {
          ctx.ui.notify("已取消出细纲操作", "info");
          return;
        }
      }
      await pi.sendUserMessage(`请读取活跃书目的追踪/上下文.md，按照 story-long-write 流程为下一章（第${targetChapter}章）编写细纲并保存到大纲/细纲_第${targetChapterStr}章.md。`);
    },
  });

  // 注册快捷命令：写正文（支持弹窗确认）
  pi.registerCommand("story:write", {
    description: "调用 narrative-writer 写手为本章正文落笔",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const settings = getWorkbenchSettings(root);
      const info = getStoryInfo(root);
      const targetChapter = info ? info.nextChapter : "最新";
      const targetChapterStr = String(targetChapter).padStart(3, "0");

      if (settings.confirmDialog && Boolean(ctx.ui)) {
        const confirmed = await ctx.ui.confirm(
          `✍️ 确认执行：第 ${targetChapter} 章正文起草`,
          `### ✍️ 任务详情：调用子代理起草正文\n\n- **目标章节**：第 ${targetChapter} 章正文\n- **派发写手**：\`narrative-writer\`（叙事写手子代理）\n- **依据蓝图**：\`大纲/细纲_第${targetChapterStr}章.md\`\n- **门禁约束**：遵守字数带（±15%），执行三层去 AI 腔，不违背设定\n- **实时监控**：开始后可在右侧分栏点击查看器同屏监督实时输出\n\n> 💡 点击【确认】后将启动子代理起草正文；点击【取消】中止。`
        );
        if (!confirmed) {
          ctx.ui.notify("已取消正文写作", "info");
          return;
        }
      }
      await pi.sendUserMessage(`请使用 Agent 工具调用 narrative-writer 子代理（description 设为「起草第${targetChapter}章正文」），按照大纲/细纲完成正文写作，注意严格遵守字数带并杜绝 AI 烂梗，写完保存到 正文/第${targetChapterStr}章_章名.md。`);
    },
  });

  // 注册快捷命令：门禁质检（支持弹窗确认）
  pi.registerCommand("story:check", {
    description: "对当前最新章节执行字数、AI味及契约检查",
    handler: async (_args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const settings = getWorkbenchSettings(root);
      const info = getStoryInfo(root);
      const checkChapter = info ? info.lastChapter : "最新";

      if (settings.confirmDialog && Boolean(ctx.ui)) {
        const confirmed = await ctx.ui.confirm(
          `🔍 确认执行：第 ${checkChapter} 章门禁质检`,
          `### 🔍 任务详情：执行契约与门禁全量扫描\n\n- **检查目标**：第 ${checkChapter} 章正文及追踪事务\n- **核心工具**：\`storyctl.py chapter check\`\n- **质检项目**：字数带合规、AI 指纹腔调、未闭合标点、时间线与设定一致性\n- **预期结果**：返回质检结论（ready / blocked / needs_decision）\n\n> 💡 点击【确认】后开始质检扫描；点击【取消】中止。`
        );
        if (!confirmed) {
          ctx.ui.notify("已取消门禁质检", "info");
          return;
        }
      }
      await pi.sendUserMessage("请运行 storyctl chapter check 检查最新章节的字数带与契约质量，并汇报检查结果。");
    },
  });

  // 1. 写前拦截：细纲守卫 与 bash 裸调子代理拦截
  pi.on("tool_call", async (event, ctx) => {
    // 拦截使用 bash / powershell 裸调 pi 子进程，引导使用原生 Agent 工具
    if (event.toolName === "bash" || event.toolName === "powershell") {
      const cmd = (event.input as any)?.command;
      if (typeof cmd === "string" && /pi\s+.*--mode\s+json|pi\s+.*task_.*\.md/i.test(cmd)) {
        return {
          block: true,
          reason: `[Story Gate 提示] 检测到尝试通过命令行执行子代理。在 Pi Web 网页端中，请直接调用内置的 Agent 工具，参数：subagent_type: "narrative-writer", description: "任务标题（如：撰写第XXX章正文）", prompt: "任务要求与输入"。这样可以在网页端实时显示子任务卡片并供作者在侧边栏点击查看实时进度。`,
        };
      }
    }

    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    const targetPath = (event.input as any)?.path;
    if (typeof targetPath !== "string" || !targetPath) {
      return undefined;
    }

    const root = ctx.cwd || process.cwd();
    const absolute = path.resolve(root, targetPath);

    // 细纲缺失硬阻断
    const core = getCore(root);
    const reason = core ? core.proseBlockReason(root, absolute) : null;
    if (reason) {
      if (Boolean(ctx.ui)) {
        ctx.ui.notify(reason, "error");
      }
      return {
        block: true,
        reason: `[Story Gate 写前拦截] ${reason}`,
      };
    }

    return undefined;
  });

  // 2. 写后门禁：AI 指纹、标点未封闭、退化与字数检查
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    const targetPath = (event.input as any)?.path;
    if (typeof targetPath !== "string" || !targetPath) {
      return undefined;
    }

    const root = ctx.cwd || process.cwd();
    const absolute = path.resolve(root, targetPath);

    const core = getCore(root);
    if (!core || !core.isProsePath(absolute) || !fs.existsSync(absolute)) {
      return undefined;
    }

    // 发生正文变动后刷新面板
    updateStoryDashboard(ctx);

    const finding = core.proseAfterWrite(root, absolute);
    if (finding) {
      if (Boolean(ctx.ui)) {
        ctx.ui.notify("正文未通过 Story Gate 门禁，已打回要求局部修补", "warning");
      }

      // 将违规提示作为工具报错回喂给模型，触发局部 edit 修补
      return {
        isError: true,
        content: [
          ...event.content,
          {
            type: "text" as const,
            text: `\n\n🚨 [Story Gate 门禁质检未通过 - 请局部修补]\n${finding}\n⚠️ 铁律：请使用 edit 工具对上述违规句子或标点做精准局部替换修补，严禁整章重写！`,
          },
        ],
      };
    }

    return undefined;
  });
}
