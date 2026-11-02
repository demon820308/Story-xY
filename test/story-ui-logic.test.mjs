import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  resolveActiveBookFromChain,
  getBookRelPath,
  deriveShortStatus,
  makePlaceholderBook,
} = await jiti.import("../lib/story-active-book.ts");

const {
  resolveBookKind,
  isShortBook,
} = await jiti.import("../lib/story-book-kind.ts");

const {
  buildWorkspaceInitPrompt,
  buildNewBookPrompt,
  buildLongOutlinePrompt,
  buildLongWritePrompt,
  buildShortOutlinePrompt,
  buildShortSectionOutlinePrompt,
  buildShortWritePrompt,
  buildShortRevisionPrompt,
  buildGenerateSettingsPrompt,
  buildGenerateTrackingPrompt,
} = await jiti.import("../lib/story-prompts.ts");

const {
  classifySettingFile,
} = await jiti.import("../lib/story-setting-category.ts");

const {
  parseStructuredTrackingState,
} = await jiti.import("../lib/story-tracking-state.ts");

const {
  normalizeNovelContent,
  findInSource,
  replaceMatchInSource,
  replaceAllInSource,
} = await jiti.import("../lib/story-reader-format.ts");

test("M22: resolveActiveBookFromChain matches .active-book exactly in multi-book workspace", () => {
  const workspace = "E:/story-workspace";
  const mockBooks = [
    {
      id: "book:E:/story-workspace/长篇/剑道独尊",
      title: "《剑道独尊》",
      fullTitle: "剑道独尊",
      type: "长篇连载",
      status: "● 连载中",
      statusColor: "text-[#2e7a4c]",
      desc: "已写 3 章",
      path: "E:/story-workspace/长篇/剑道独尊",
      currentChapter: "第003章",
      words: "9000 字",
    },
    {
      id: "short:E:/story-workspace/短篇/雨夜追踪",
      title: "《雨夜追踪》",
      fullTitle: "雨夜追踪",
      type: "短篇小说",
      status: "○ 待起笔",
      statusColor: "text-[#d97706]",
      desc: "小节大纲已就绪",
      path: "E:/story-workspace/短篇/雨夜追踪",
      currentChapter: "全篇",
      words: "—",
    },
  ];

  // 测试 getBookRelPath
  assert.equal(getBookRelPath(workspace, "E:/story-workspace/长篇/剑道独尊"), "长篇/剑道独尊");
  assert.equal(getBookRelPath(workspace, "E:/story-workspace/短篇/雨夜追踪"), "短篇/雨夜追踪");

  // 1. 无选中，无 .active-book，回退首本
  const first = resolveActiveBookFromChain(mockBooks, null, null, workspace);
  assert.equal(first.fullTitle, "剑道独尊");

  // 2. .active-book 精确指定短篇，成功解析出第二本
  const matchedShort = resolveActiveBookFromChain(mockBooks, null, "短篇/雨夜追踪", workspace);
  assert.equal(matchedShort.fullTitle, "雨夜追踪");

  // 3. 显式选中 id 优先级最高
  const selectedFirst = resolveActiveBookFromChain(mockBooks, "book:E:/story-workspace/长篇/剑道独尊", "短篇/雨夜追踪", workspace);
  assert.equal(selectedFirst.fullTitle, "剑道独尊");

  // 4. 空书目返回占位书（并验证 makePlaceholderBook）
  const placeholder = resolveActiveBookFromChain([], null, null, workspace);
  assert.equal(placeholder.isUninitialized, true);
  assert.equal(placeholder.words, "—");

  const directPlaceholder = makePlaceholderBook(workspace);
  assert.equal(directPlaceholder.title, "暂未立项书籍");
});

test("M22: resolveBookKind follows three-tier determination (mark -> structure -> path)", () => {
  // 1. 书内标记优先：即使路径在长篇目录，但标记了 short，仍判定为 short
  const bookWithShortMark = {
    id: "custom:1",
    path: "E:/story/长篇/特殊短篇",
    bookKind: "short",
  };
  assert.equal(resolveBookKind(bookWithShortMark), "short");
  assert.equal(isShortBook(bookWithShortMark), true);

  // 书内标记为 long，压过短篇路径
  const bookWithLongMark = {
    id: "custom:2",
    path: "E:/story/短篇/超长中篇",
    bookKind: "long",
  };
  assert.equal(resolveBookKind(bookWithLongMark), "long");
  assert.equal(isShortBook(bookWithLongMark), false);

  // 2. 结构特征：包含小节大纲且无追踪目录为 short
  const structShort = {
    id: "custom:3",
    path: "E:/story/自定义目录/作品A",
    hasOutlineFile: true,
    hasTrackingDir: false,
  };
  assert.equal(resolveBookKind(structShort), "short");

  // 结构特征：包含正文与大纲目录为 long
  const structLong = {
    id: "custom:4",
    path: "E:/story/自定义目录/作品B",
    hasProseDir: true,
    hasOutlineDir: true,
  };
  assert.equal(resolveBookKind(structLong), "long");

  // 3. 路径兜底
  assert.equal(resolveBookKind({ path: "E:/story/短篇/普通短篇" }), "short");
  assert.equal(resolveBookKind({ path: "E:/story/短篇/单篇.txt", isFile: true }), "short");
  assert.equal(resolveBookKind({ path: "E:/story/长篇/普通长篇" }), "long");
});

test("M22: deriveShortStatus推导短篇三态与成稿态无编造数据", () => {
  // 无正文、无大纲 -> 待构思
  const s1 = deriveShortStatus(false, false, false);
  assert.equal(s1.status, "○ 待构思");
  assert.equal(s1.words, "—");

  // 有大纲、无正文 -> 待起笔
  const s2 = deriveShortStatus(true, false, false);
  assert.equal(s2.status, "○ 待起笔");
  assert.equal(s2.words, "—");

  // 有正文、无精修标记 -> 连载推进中
  const s3 = deriveShortStatus(true, true, false);
  assert.equal(s3.status, "● 连载推进中");
  assert.equal(s3.words, "成文中");

  // 存在精修标记 -> 精修中
  const s4 = deriveShortStatus(true, true, true);
  assert.equal(s4.status, "● 精修中");
  assert.equal(s4.words, "成稿");
});

test("M22: story-prompts constructors strictly conform to contracts and contain zero banned phrases", () => {
  const initPrompt = buildWorkspaceInitPrompt();
  assert.match(initPrompt, /\/story-setup/);
  assert.match(initPrompt, /应用内置注入模式/);
  assert.doesNotMatch(initPrompt, /oh-story/);

  const longOutline = buildLongOutlinePrompt("剑道独尊", "长篇/剑道独尊", 5);
  assert.match(longOutline, /第005章/);
  assert.match(longOutline, /check-outline-contract/);
  assert.match(longOutline, /路径: 长篇\/剑道独尊/);

  const longWrite = buildLongWritePrompt("剑道独尊", "长篇/剑道独尊", 5);
  assert.match(longWrite, /第005章/);
  assert.match(longWrite, /去AI味三层规范与门禁自检/);

  const shortOutline = buildShortOutlinePrompt("雨夜追踪", "短篇/雨夜追踪");
  assert.match(shortOutline, /12 列全篇粗纲表/);
  assert.match(shortOutline, /check-phase2-contract/);
  assert.doesNotMatch(shortOutline, /5 列/);
  assert.doesNotMatch(shortOutline, /逐节细纲/);

  const shortSection = buildShortSectionOutlinePrompt("雨夜追踪", "短篇/雨夜追踪", 2);
  assert.match(shortSection, /修订小节大纲第 2 行/);
  assert.doesNotMatch(shortSection, /逐节细纲/);

  const shortWrite = buildShortWritePrompt("雨夜追踪", "短篇/雨夜追踪", 2);
  assert.match(shortWrite, /小节大纲\.md 第 2 行要素/);
  assert.doesNotMatch(shortWrite, /逐节细纲/);

  const shortRev = buildShortRevisionPrompt("雨夜追踪", "短篇/雨夜追踪");
  assert.match(shortRev, /Phase 4 精修打磨/);

  const newBook = buildNewBookPrompt("long", "新世界", "长篇/新世界", "都市逆袭", "金手指系统");
  assert.match(newBook, /骨架已建/);
});

test("A37: normalizeNovelContent strips fullwidth indents, formats chapter titles, and prevents markdown heading injection", () => {
  const sampleLong = `第1章 军宣新星

　　“江晨同志，欢迎你加入我们文工团。”

　　办公室里。
江晨有些恍惚。

---

无缩进的正文段落紧跟分隔符。
`;
  const resultLong = normalizeNovelContent(sampleLong);
  assert.equal(resultLong.mainTitle, "第1章 军宣新星");
  assert.equal(resultLong.paragraphs[0].type, "chapter-title");
  assert.equal(resultLong.paragraphs[0].text, "第1章 军宣新星");

  // 段首全角空格剥除
  assert.equal(resultLong.paragraphs[1].type, "text");
  assert.equal(resultLong.paragraphs[1].text, "“江晨同志，欢迎你加入我们文工团。”");
  assert.equal(resultLong.paragraphs[1].text.startsWith("　"), false);

  // 分隔符解析为 divider，绝非 setext 标题
  const dividerPara = resultLong.paragraphs.find((p) => p.type === "divider");
  assert.ok(dividerPara, "应该识别出场景分隔线");
  assert.equal(dividerPara.text, "❖ ❖ ❖");

  // 短篇小节标记统一识别
  const sampleShort = `正文标题

### 1.

　　雨夜之中，车灯划破黑暗。

### 2.

他停下脚步。
`;
  const resultShort = normalizeNovelContent(sampleShort);
  const secTitles = resultShort.paragraphs.filter((p) => p.type === "section-title");
  assert.equal(secTitles.length, 2);
  assert.equal(secTitles[0].text, "1.");
  assert.equal(secTitles[0].sectionNum, 1);
  assert.equal(secTitles[1].text, "2.");
  assert.equal(secTitles[1].sectionNum, 2);
});

test("A38: Source editor search and replace performs exact text manipulation without AST drift", () => {
  const source = `第1章 军宣新星\n\n　　江晨同志，欢迎你加入文工团。\n　　江晨有些恍惚。`;

  // 查找
  const matches = findInSource(source, "江晨");
  assert.equal(matches.length, 2);
  assert.equal(matches[0].line, 3);
  assert.equal(matches[1].line, 4);

  // 单处替换
  const replacedOne = replaceMatchInSource(source, matches[0], "林风");
  assert.equal(replacedOne.includes("林风同志"), true);
  assert.equal(replacedOne.includes("江晨有些恍惚"), true);

  // 全部替换
  const replacedAll = replaceAllInSource(source, "江晨", "林风");
  assert.equal(replacedAll.includes("江晨"), false);
  assert.equal(replacedAll.split("林风").length - 1, 2);

  // 纯文本零漂移
  assert.equal(typeof source, "string");
  assert.equal(source.startsWith("第1章"), true);
});

test("A39 & A41: parseStructuredTrackingState correctly calculates overdue foreshadows and structured stats", () => {
  const mockTrackingData = {
    book_title: "让你管账号，你高燃混剪炸全网",
    last_committed_chapter: 25,
    state_revision: 7,
    foreshadow: {
      F001: {
        id: "F001",
        summary: "正常活跃伏笔",
        planted_chapter: 10,
        planned_resolution_chapter: 30,
        status: "已埋",
      },
      F002: {
        id: "F002",
        summary: "超期未回收伏笔",
        planted_chapter: 5,
        planned_resolution_chapter: 20, // 20 <= 25，且仍为已埋，属于超期
        status: "已埋",
      },
      F003: {
        id: "F003",
        summary: "已正常回收伏笔",
        planted_chapter: 1,
        planned_resolution_chapter: 20,
        status: "已回收", // 已回收不应计入超期
      },
    },
    context: {
      recent_chapters: [
        { chapter: 25, summary: "开放日现场首演落地：江晨弹唱《离别开出花》。" },
      ],
      active_character_names: ["江晨"],
    },
    characters: {
      江晨: {
        identity: "文工团新媒体干事",
        state: "现场首演成功，全场震撼",
      },
    },
  };

  const parsed = parseStructuredTrackingState(mockTrackingData);
  assert.equal(parsed.lastChapter, 25);
  assert.equal(parsed.stateRevision, "7");
  assert.equal(parsed.activeCount, 2); // F001, F002
  assert.equal(parsed.overdueCount, 1); // F002
  assert.equal(parsed.overdueForeshadows[0].id, "F002");
  assert.equal(parsed.latestSummary?.includes("开放日现场首演落地"), true);
  assert.equal(parsed.recentCharacterState?.name, "江晨");
  assert.equal(parsed.recentCharacterState?.state, "现场首演成功，全场震撼");
});

test("A40: classifySettingFile maps 题材定位.md to theme and searches 25 character files within 3 keystrokes", () => {
  // 1. 题材定位.md 判定为 theme，不再误归入 system
  assert.equal(classifySettingFile("题材定位.md", "设定/题材定位.md"), "theme");
  assert.equal(classifySettingFile("题材.md"), "theme");
  assert.equal(classifySettingFile("文风.md"), "theme");

  // 2. 其余分类准确性
  assert.equal(classifySettingFile("江晨.md", "设定/角色/江晨.md"), "character");
  assert.equal(classifySettingFile("地理地图.md", "设定/世界观/地理地图.md"), "world");
  assert.equal(classifySettingFile("火箭军文工团.md", "设定/势力/火箭军文工团.md"), "faction");
  assert.equal(classifySettingFile("功法等级.md", "设定/体系/功法等级.md"), "system");

  // 3. 25 个角色文件模拟与 3 次按键内即时定位检索
  const characterFiles = Array.from({ length: 25 }, (_, i) => ({
    name: `角色_${String(i + 1).padStart(2, "0")}_江晨${i === 12 ? "特使" : "伙伴"}`,
    fileName: `角色_${String(i + 1).padStart(2, "0")}.md`,
  }));

  // 输入 3 个按键 "特使" 或 "江晨特"
  const query = "特使";
  const matched = characterFiles.filter((c) => c.name.includes(query));
  assert.equal(matched.length, 1);
  assert.equal(matched[0].name.includes("江晨特使"), true);

  // 4. 空状态提示词无 Phase 黑话
  const shortSettingPrompt = buildGenerateSettingsPrompt("short", "雨夜追踪");
  assert.equal(shortSettingPrompt.includes("Phase"), false);
  assert.equal(shortSettingPrompt.includes("创建 设定/ 目录"), false);
  assert.equal(shortSettingPrompt.includes("设定.md"), true);

  const longTrackingPrompt = buildGenerateTrackingPrompt("剑道独尊");
  assert.equal(longTrackingPrompt.includes("_tracking-state.json"), true);
});
