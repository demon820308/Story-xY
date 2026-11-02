#!/usr/bin/env node
/**
 * verify-demo-baseline.mjs
 * M14 Demo 书冻结回归基线与结构一致性探针
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const DEMO_ROOT = path.join(REPO_ROOT, 'demo');

function findDemoBookPath() {
  if (!fs.existsSync(DEMO_ROOT)) return null;
  const entries = fs.readdirSync(DEMO_ROOT);
  for (const entry of entries) {
    if (entry.includes('长篇')) {
      const longDir = path.join(DEMO_ROOT, entry);
      for (const sub of fs.readdirSync(longDir)) {
        if (sub.includes('让你管')) {
          return path.join(longDir, sub);
        }
      }
    }
  }
  return null;
}

const bookPath = findDemoBookPath();
if (!bookPath) {
  console.error('FAIL: demo book path not found under demo/长篇/');
  process.exit(1);
}

console.log(`[M14 Probe] Target demo book: ${path.relative(REPO_ROOT, bookPath)}`);

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    failures++;
  } else {
    console.log(`  [PASS] ${message}`);
  }
}

// 1. 验证冻结元数据与无旧宿主残留
const freezePath = path.join(bookPath, '_baseline_freeze.json');
assert(fs.existsSync(freezePath), 'Baseline freeze manifest _baseline_freeze.json exists');

const claudePath = path.join(bookPath, '.claude');
assert(!fs.existsSync(claudePath), 'Legacy .claude directory completely removed');

const sentinelPath = path.join(bookPath, '.story-deployed');
assert(fs.existsSync(sentinelPath), '.story-deployed sentinel exists');
if (fs.existsSync(sentinelPath)) {
  const sentinelContent = fs.readFileSync(sentinelPath, 'utf-8');
  assert(sentinelContent.includes('target_cli: pi,antigravity'), 'sentinel targets converged to pi,antigravity');
}

// 2. 验证正文与大纲连续性
function findDirWithKeyword(parent, kw) {
  for (const name of fs.readdirSync(parent)) {
    if (name.includes(kw) && fs.statSync(path.join(parent, name)).isDirectory()) {
      return path.join(parent, name);
    }
  }
  return null;
}

const proseDir = findDirWithKeyword(bookPath, '正文');
const outlineDir = findDirWithKeyword(bookPath, '大纲');
const trackingDir = findDirWithKeyword(bookPath, '追踪');

assert(proseDir && fs.existsSync(proseDir), 'Prose directory exists');
assert(outlineDir && fs.existsSync(outlineDir), 'Outline directory exists');
assert(trackingDir && fs.existsSync(trackingDir), 'Tracking directory exists');

if (proseDir) {
  const proseFiles = fs.readdirSync(proseDir).filter(f => f.endsWith('.md'));
  assert(proseFiles.length >= 25, `Prose chapters count >= 25 (found ${proseFiles.length})`);
}

if (outlineDir) {
  const outlineFiles = fs.readdirSync(outlineDir).filter(f => f.endsWith('.md'));
  assert(outlineFiles.length >= 26, `Outlines count >= 26 including chapter 26 outline (found ${outlineFiles.length})`);
}

if (trackingDir) {
  const ctxPath = path.join(trackingDir, '上下文.md');
  assert(fs.existsSync(ctxPath), 'Tracking context file 上下文.md exists');
}

if (failures > 0) {
  console.error(`\nResult: ${failures} failure(s) in demo baseline probe`);
  process.exitCode = 1;
} else {
  console.log('\nResult: M14 demo baseline probe ALL PASS');
  process.exitCode = 0;
}
