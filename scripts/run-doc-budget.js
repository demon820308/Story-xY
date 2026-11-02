const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(".");
const manifestPath = path.resolve("scripts/doc-budget.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const fail = [];
const note = [];
const strip = (text) => text.replace(/\s/g, "").length;

// 取「文件#小节」：从标题行到下一个同级或更高级标题（跳过代码围栏里的行）。
const sectionOf = (text, anchor) => {
  const lines = text.split("\n");
  let fence = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (start >= 0 && m[1].length <= level) return lines.slice(start, i).join("\n");
    if (start < 0 && m[2].trim().startsWith(anchor)) { start = i; level = m[1].length; }
  }
  return start >= 0 ? lines.slice(start).join("\n") : null;
};

// 读数：null = 文件不存在；undefined = 小节找不到（两种都报错，不静默当 0）。
const cache = new Map();
const weigh = (entry) => {
  if (cache.has(entry)) return cache.get(entry);
  const hash = entry.indexOf("#");
  const rel = hash >= 0 ? entry.slice(0, hash) : entry;
  const abs = path.join(repoRoot, rel);
  let value = null;
  if (fs.existsSync(abs)) {
    const text = fs.readFileSync(abs, "utf8");
    if (hash < 0) value = strip(text);
    else {
      const body = sectionOf(text, entry.slice(hash + 1));
      value = body === null ? undefined : strip(body);
    }
  }
  cache.set(entry, value);
  return value;
};

let python = null;
const findPython = () => {
  if (python) return python;
  for (const [cmd, pre] of [["python3", []], ["python", []], ["py", ["-3"]]]) {
    const probe = spawnSync(cmd, [...pre, "--version"], { encoding: "utf8" });
    if (probe.status === 0) { python = [cmd, pre]; return python; }
  }
  return null;
};

// 由脚本拼出的任务包：跑一次拿 chars；拼包失败或输出不认得都报错。
const generatedWeight = (gen) => {
  const key = `gen:${gen.script} ${(gen.args || []).join(" ")}`;
  if (cache.has(key)) return cache.get(key);
  let value;
  const py = findPython();
  const script = path.join(repoRoot, gen.script);
  if (!py) value = { error: "找不到 Python 3（依次试 python3、python、py -3）" };
  else if (!fs.existsSync(script)) value = { error: `拼包脚本不存在：${gen.script}` };
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doc-budget-"));
    const run = spawnSync(py[0], [...py[1], script, "--project", tmp, ...(gen.args || [])], { encoding: "utf8" });
    const last = (run.stdout || "").trim().split("\n").pop() || "";
    let chars = null;
    try {
      const out = JSON.parse(last);
      chars = out.chars;
      if (Number.isInteger(chars) && out.brief && fs.existsSync(out.brief)) {
        chars = strip(fs.readFileSync(out.brief, "utf8").split(repoRoot + path.sep).join(""));
      }
    } catch (e) { chars = null; }
    fs.rmSync(tmp, { recursive: true, force: true });
    value = run.status === 0 && Number.isInteger(chars) ? chars
      : { error: `拼包脚本 ${gen.script} ${(gen.args || []).join(" ")} 没给出 chars（退出码 ${run.status}）：${(run.stderr || last).trim().slice(0, 200)}` };
  }
  cache.set(key, value);
  return value;
};

for (const entry of manifest.files || []) {
  const used = weigh(entry.path);
  if (used === null || used === undefined) {
    fail.push(`预算登记的文件不存在：${entry.path}`);
    continue;
  }
  const left = entry.budget - used;
  if (left < 0) {
    fail.push(`${entry.path} 超预算 ${-left} 字（${used} > ${entry.budget}）：${entry.why}`);
  }
}

const ceiling = manifest.path_ceiling || null;
const ceilingOn = ceiling && Number.isFinite(ceiling.limit) && ceiling.limit > 0;
const exemptGroups = new Set((ceiling && ceiling.exempt) || []);

const total = (entries, generated, label) => {
  const set = [...new Set(entries)];
  const whole = new Set(set.filter((e) => !e.includes("#")));
  let sum = 0;
  let broken = false;
  for (const entry of set) {
    const hash = entry.indexOf("#");
    if (hash >= 0 && whole.has(entry.slice(0, hash))) continue;
    const used = weigh(entry);
    if (used === null) { fail.push(`路径「${label}」登记的文件不存在：${entry.split("#")[0]}`); broken = true; continue; }
    if (used === undefined) { fail.push(`路径「${label}」登记的小节找不到：${entry}`); broken = true; continue; }
    sum += used;
  }
  for (const gen of generated) {
    const used = generatedWeight(gen);
    if (typeof used !== "number") { fail.push(`路径「${label}」：${used.error}`); broken = true; continue; }
    sum += used;
  }
  return broken ? null : sum;
};

const checkPath = (label, budget, entries, generated, group) => {
  const sum = total(entries, generated, label);
  if (sum === null) return;
  const left = budget - sum;
  const exempt = ceilingOn && exemptGroups.has(group);
  if (left < 0) {
    fail.push(`路径「${label}」超预算 ${-left} 字（${sum} > ${budget}）`);
  }
  if (ceilingOn && !exempt && (sum > ceiling.limit || budget > ceiling.limit)) {
    fail.push(`路径「${label}」超过硬上限 ${ceiling.limit} 字（实际 ${sum}，预算 ${budget}）：${ceiling.why}`);
  }
};

const AGENT_DIR = "skills/story-setup/references/templates/agents";
const preloads = (rel) => {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return null;
  const head = fs.readFileSync(abs, "utf8").split(/^---\s*$/m)[1] || "";
  const inline = head.match(/^skills:[ \t]*\[([^\]]*)\]/m);
  if (inline) return inline[1].split(",").map((s) => s.trim()).filter(Boolean);
  const block = head.match(/^skills:[ \t]*\r?\n((?:[ \t]+-[^\n]*\n?)+)/m);
  if (block) return block[1].split("\n").map((s) => s.replace(/^[ \t]+-[ \t]*/, "").trim()).filter(Boolean);
  if (/^skills:/m.test(head)) fail.push(`${rel} 的 skills 预加载写法认不出，改成 skills: [a, b] 或逐行 - a`);
  return [];
};

const MAX_COMBOS = 4096;
const agentPaths = new Set();
for (const group of manifest.paths || []) {
  let files = group.files || [];
  const generated = group.generated || [];
  if (group.agent) {
    agentPaths.add(group.agent);
    const skills = preloads(group.agent);
    if (skills === null) { fail.push(`路径「${group.label}」登记的 agent 不存在：${group.agent}`); continue; }
    files = [group.agent, ...files, ...skills.map((name) => `skills/${name}/SKILL.md`)];
  }
  if (group.branches) {
    for (const branch of group.branches) {
      checkPath(`${group.label}（${branch.label}）`, branch.budget, [...files, ...branch.files], generated, group.label);
    }
  } else {
    checkPath(group.label, group.budget, files, generated, group.label);
  }
  if (!group.stacking) continue;

  const byLabel = new Map((group.branches || []).map((b) => [b.label, b]));
  const slots = group.stacking.slots || [];
  const seen = new Set();
  let bad = false;
  for (const slot of slots) {
    for (const name of slot) {
      if (!byLabel.has(name)) { fail.push(`路径「${group.label}」stacking 列了不存在的分支：${name}`); bad = true; }
      if (seen.has(name)) { fail.push(`路径「${group.label}」stacking 里分支「${name}」出现在两个槽里（一个槽内互斥，同一分支只能属于一个槽）`); bad = true; }
      seen.add(name);
    }
  }
  if (!Number.isFinite(group.stacking.budget)) { fail.push(`路径「${group.label}」stacking 缺 budget`); bad = true; }
  const combos = slots.reduce((n, slot) => n * (slot.length + 1), 1);
  if (combos > MAX_COMBOS) { fail.push(`路径「${group.label}」stacking 组合数 ${combos} 超过 ${MAX_COMBOS}，拆小槽位`); bad = true; }
  if (bad || slots.length === 0) continue;
  let worst = null;
  const walk = (i, chosen) => {
    if (i === slots.length) {
      const sum = total([...files, ...chosen.flatMap((name) => byLabel.get(name).files)], generated, group.label);
      if (sum !== null && (worst === null || sum > worst.sum || (sum === worst.sum && chosen.length > worst.chosen.length))) worst = { sum, chosen: [...chosen] };
      return;
    }
    walk(i + 1, chosen);
    for (const name of slots[i]) walk(i + 1, [...chosen, name]);
  };
  walk(0, []);
  if (worst === null) continue;
  const label = `${group.label}（最坏叠加：${worst.chosen.join("＋") || "无"}）`;
  const left = group.stacking.budget - worst.sum;
  const exempt = ceilingOn && exemptGroups.has(group.label);
  if (left < 0) fail.push(`路径「${label}」超预算 ${-left} 字（${worst.sum} > ${group.stacking.budget}）`);
  if (ceilingOn && !exempt && (worst.sum > ceiling.limit || group.stacking.budget > ceiling.limit)) {
    fail.push(`路径「${label}」超过硬上限 ${ceiling.limit} 字（实际 ${worst.sum}，预算 ${group.stacking.budget}）：${ceiling.why}`);
  }
}

console.log(`TOTAL FAILURES: ${fail.length}`);
fail.forEach(f => console.log(" - " + f));
if (fail.length > 0) process.exit(1);
console.log("OK: All budgets within bounds!");
