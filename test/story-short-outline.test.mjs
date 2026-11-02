import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  countShortOutlineSections,
  extractShortDetailSections,
  extractShortProseSections,
} = await jiti.import("../lib/story-short-outline.ts");

const STANDARD_10_SECTIONS_OUTLINE = `# 小节大纲

| 结构段/五段功能 | 主事件 | 情节推进 | 情绪 | 人物/关系变化 | 因果/逻辑链 | 读者新获知什么 | 结尾承接/钩子 | 伏笔/物件 | 场景形态 | 对白作用 | 目标字数 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 起/引子 | 假千金回国 | 冲突爆发 | 压抑 | 决裂 | 父母偏心 | 婚约被夺 | 离开老宅 | 戒指 | 室内 | 交代 | 1500 |
| 起/递进 | 租下破旧公寓 | 安顿下来 | 凄凉 | 独处 | 资金受限 | 发现手稿 | 邻居敲门 | 手稿 | 走廊 | 试探 | 1500 |
| 承/展开 | 咖啡馆面试 | 偶遇男主 | 意外 | 结识 | 投递简历 | 身份误会 | 收到通知 | 简历 | 咖啡馆 | 试探 | 1500 |
| 承/深入 | 入职新公司 | 遭遇刁难 | 委屈 | 敌意 | 同事排挤 | 得知内幕 | 意外受赏 | 方案 | 办公区 | 争执 | 1500 |
| 承/转折 | 项目竞标突围 | 独当一面 | 紧张 | 认可 | 方案惊艳 | 赢得信任 | 对手反扑 | 优盘 | 会议室 | 辩论 | 1500 |
| 转/危机 | 商业机密泄漏 | 被诬陷 | 绝望 | 孤立 | 假千金构陷 | 证据缺失 | 停职调查 | 邮件 | 走廊 | 质问 | 1500 |
| 转/反击 | 寻找关键证人 | 追查线索 | 坚定 | 盟友 | 发现监控 | 查明真相 | 假千金慌张 | 视频 | 车库 | 谈判 | 1500 |
| 转/高潮 | 董事会自证 | 现场打脸 | 扬眉吐气 | 翻盘 | 证据确凿 | 父母震惊 | 假千金崩溃 | 录音 | 顶楼 | 决断 | 1500 |
| 合/结算 | 恢复名誉升职 | 彻底切割 | 释怀 | 蜕变 | 拒绝回豪门 | 自立门户 | 签约仪式 | 合同 | 礼堂 | 告白 | 1500 |
| 合/尾声 | 新生活启航 | 男主求婚 | 甜蜜 | 幸福 | 确定心意 | 圆满收尾 | 远方寄语 | 鲜花 | 海边 | 承诺 | 1500 |

## 第1节 细纲
情节点1...

## 第2节 细纲
情节点2...
`;

test("A19 Fixture 1: Standard 10-section outline counts exactly 10", () => {
  const count = countShortOutlineSections(STANDARD_10_SECTIONS_OUTLINE);
  assert.equal(count, 10);

  const details = extractShortDetailSections(STANDARD_10_SECTIONS_OUTLINE);
  assert.equal(details.size, 2);
  assert.ok(details.has(1));
  assert.ok(details.has(2));
});

test("A19 Fixture 2: Appending beat sheet table and anchor phrases keeps total sections at exactly 10", () => {
  const outlineWithExtraTables = `${STANDARD_10_SECTIONS_OUTLINE}

## 逐节情节点细化表
| 节序号 | 细化情节点 | 冲突点 | 道具 |
| :--- | :--- | :--- | :--- |
| 1-1 | 进门脱鞋 | 拖鞋被扔掉 | 拖鞋 |
| 1-2 | 养母摔碗 | 逼签断绝协议 | 瓷碗 |
| 1-3 | 假千金假哭 | 父亲怒斥 | 纸巾 |
| 1-4 | 撕毁婚约 | 夺走信物 | 玉佩 |
| 1-5 | 摔门而出 | 大雨倾盆 | 箱子 |
| 2-1 | 找中介看房 | 押一付三不够 | 钱包 |
| 2-2 | 入住城中村 | 窗外铁道轰鸣 | 行李 |
| 2-3 | 整理母亲遗物 | 找到加密手稿 | 铜锁 |
| 2-4 | 泡面充饥 | 收到嘲讽短信 | 手机 |
| 2-5 | 邻居敲门送伞 | 警惕对峙 | 雨伞 |

### 复沓锚句登记
| 原句 | 对应节号 | 出现状态 |
| :--- | :--- | :--- |
| 这个家容不下两个女儿 | 1 | 已落盘 |
| 走出去就别再回来 | 1 | 已落盘 |
`;

  // Total sections MUST remain 10 without being inflated by extra tables
  const count = countShortOutlineSections(outlineWithExtraTables);
  assert.equal(count, 10);
});

test("A19 Fixture 3: Prose section counting does not mistake in-body ordered list items for section headings", () => {
  const proseWithNumberedLists = `### 1.
林浩推开门，屋里很冷。

在整理房间时，他注意到了三件事：
1. 桌上的尘土很厚，显然很久没人来过。
2. 窗户裂了一条缝，夜风呼呼灌进来。
3. 墙角放着一个黑色皮箱，密码锁被撬开了。

### 2.
第二天清晨，老皮送来了新账本。
他说有两条规矩：
1. 账目不过夜。
2. 见人只说三分话。

### 3.
第3节正文内容...
`;

  const sections = extractShortProseSections(proseWithNumberedLists);
  // There are only 3 real sections (### 1., ### 2., ### 3.), NOT 8!
  assert.equal(sections.size, 3);
  assert.ok(sections.has(1));
  assert.ok(sections.has(2));
  assert.ok(sections.has(3));
});
