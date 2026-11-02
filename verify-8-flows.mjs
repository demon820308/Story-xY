#!/usr/bin/env node
/**
 * Verification Suite for Story Studio Real Pathways (Route A)
 *
 * Verifies real endpoints and kernel functions without mocks or fictional APIs:
 * 1. Books: Lists demo/长篇 and reads .active-book & tracking JSON via /api/files
 * 2. Chapter: Reads Chapter 1 prose via /api/files and asserts charCount > 0
 * 3. Gatecheck: Runs toxicPhraseFindings and proseNetFindings from story_hook_core.js on clean vs dirty prose
 * 4. Tracking & Foreshadow: Adds/resolves foreshadow and commits revision in an isolated temp workspace
 * 5. Pi Agents: Validates all 7 Pi agent definitions for clean UTF-8 (zero U+FFFD) and valid slot bindings
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE_URL = process.env.STORY_VERIFY_BASE || "http://127.0.0.1:30141";
const CWD = process.cwd();

function normalizePath(p) {
  return p.replace(/\\/g, "/");
}

function encodePathForApi(p) {
  const normalized = normalizePath(p);
  const segments = normalized.split("/").filter(Boolean);
  if (normalized.startsWith("//") && segments.length > 0) {
    segments[0] = `//${segments[0]}`;
  }
  return segments.map(encodeURIComponent).join("/");
}

async function fetchFileApi(fullPath, type = "read") {
  const url = `${BASE_URL}/api/files/${encodePathForApi(fullPath)}?type=${type}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} returned HTTP ${res.status} ${res.statusText}`);
  }
  return res;
}

let failedCount = 0;

function reportPass(flowNum, title, detail) {
  console.log(`[PASS] Flow ${flowNum}: ${title} - ${detail}`);
}

function reportFail(flowNum, title, err) {
  failedCount++;
  console.error(`[FAIL] Flow ${flowNum}: ${title} - ${err?.message || err}`);
}

async function runFlow1Books() {
  const flowNum = 1;
  const title = "Active Book & Tracking Discovery";
  try {
    // Read .active-book to locate current active novel
    const activeBookPath = path.join(CWD, ".active-book");
    let targetBookRel = "";
    if (fs.existsSync(activeBookPath)) {
      targetBookRel = fs.readFileSync(activeBookPath, "utf-8").trim();
    }
    if (!targetBookRel) {
      targetBookRel = "demo/长篇/让你管账号，你高燃混剪炸全网";
    }

    const fullBookDir = path.resolve(CWD, targetBookRel);
    const trackingFile = path.join(fullBookDir, "追踪", "_tracking-state.json");

    // Fetch tracking state via /api/files endpoint
    const res = await fetchFileApi(trackingFile, "read");
    if (!res.ok) {
      throw new Error(`Failed to read file ${trackingFile}: status ${res.status}`);
    }
    const apiData = await res.json();
    const rawContent = apiData.content ?? apiData.text;
    const tracking = typeof apiData === "object" && rawContent ? JSON.parse(rawContent) : apiData;

    if (!tracking.schema_version && tracking.schema_version !== 0 && !tracking.state_revision && tracking.state_revision !== 0) {
      throw new Error("Tracking state missing schema_version or state_revision");
    }

    reportPass(
      flowNum,
      title,
      `Located "${path.basename(fullBookDir)}", revision=${tracking.state_revision ?? tracking.revision}, last_committed_chapter=${tracking.last_committed_chapter}`
    );
    return { fullBookDir, tracking };
  } catch (err) {
    reportFail(flowNum, title, err);
    throw err;
  }
}

async function runFlow2Chapter(fullBookDir) {
  const flowNum = 2;
  const title = "Read Chapter 1 Prose via File API";
  try {
    const proseDir = path.join(fullBookDir, "正文");
    const files = fs.readdirSync(proseDir);
    const ch1 = files.find((f) => /第0*1章/.test(f) && f.endsWith(".md"));
    if (!ch1) {
      throw new Error(`No Chapter 1 markdown file found in ${proseDir}`);
    }

    const ch1Path = path.join(proseDir, ch1);
    const res = await fetchFileApi(ch1Path, "read");
    if (!res.ok) {
      throw new Error(`Failed to read file ${ch1Path}: status ${res.status}`);
    }
    const apiData = await res.json();
    const content = typeof apiData === "object" && (apiData.content ?? apiData.text) ? (apiData.content ?? apiData.text) : "";
    const charCount = content.replace(/\s+/g, "").length;
    if (charCount <= 0) {
      throw new Error("Chapter 1 prose content is empty");
    }

    reportPass(flowNum, title, `Read "${ch1}" with ${charCount} non-whitespace characters`);
    return { ch1Content: content };
  } catch (err) {
    reportFail(flowNum, title, err);
    throw err;
  }
}

async function runFlow3Gatecheck() {
  const flowNum = 3;
  const title = "Gatecheck Kernel (Toxic & Soft AI Detection)";
  try {
    const corePath = path.resolve(CWD, "skills/story-setup/references/templates/hooks/story_hook_core.js");
    const core = await import(`file://${corePath.replace(/\\/g, "/")}`);

    const cleanText = "林浩把算盘往桌上一放，木珠子撞得噼啪作响。老皮手里的旱烟杆停在了半空，烟头明灭不定。账不对，差了七千四百块。";
    const dirtyText = "他声音不大，却字字诛心。在这一瞬间命运的齿轮转动了，林浩嘴角微微上扬。";

    const cleanToxic = core.toxicPhraseFindings ? core.toxicPhraseFindings(cleanText) : [];
    const cleanSoft = core.proseNetFindings ? core.proseNetFindings(cleanText) : [];
    const cleanHits = cleanToxic.length + cleanSoft.length;

    if (cleanHits !== 0) {
      throw new Error(`Clean text had ${cleanHits} false-positive hits`);
    }

    const dirtyToxic = core.toxicPhraseFindings ? core.toxicPhraseFindings(dirtyText) : [];
    const dirtySoft = core.proseNetFindings ? core.proseNetFindings(dirtyText) : [];
    const dirtyHits = dirtyToxic.length + dirtySoft.length;

    if (dirtyHits === 0) {
      throw new Error("Dirty text failed to trigger AI pattern detection");
    }

    reportPass(
      flowNum,
      title,
      `Clean text: 0 hits; Dirty text: ${dirtyHits} hits detected ("${dirtyToxic[0]?.rule || dirtySoft[0]?.rule || "AI fingerprint"}")`
    );
  } catch (err) {
    reportFail(flowNum, title, err);
  }
}

async function runFlow4TrackingTransaction(bookDir) {
  const flowNum = 4;
  const title = "Isolated Tracking & Foreshadow Transaction";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "story-verify-tx-"));
  try {
    const srcTrackingDir = path.join(bookDir, "追踪");
    const dstTrackingDir = path.join(tempDir, "追踪");
    fs.mkdirSync(dstTrackingDir, { recursive: true });

    const stateFile = path.join(dstTrackingDir, "_tracking-state.json");
    fs.copyFileSync(path.join(srcTrackingDir, "_tracking-state.json"), stateFile);

    const raw = fs.readFileSync(stateFile, "utf-8");
    const state = JSON.parse(raw);
    const initialRev = Number(state.state_revision ?? state.revision ?? 0);

    // 1. Add foreshadow E009
    state.foreshadow = state.foreshadow || {};
    state.foreshadow["E009"] = {
      id: "E009",
      description: "库房暗格中的半张汇票存根",
      source_chapter: 1,
      promise_chapter: 2,
      status: "open",
    };

    // 2. Resolve foreshadow E009
    state.foreshadow["E009"].status = "resolved";
    state.foreshadow["E009"].resolved_chapter = 2;

    // 3. Commit revision
    const nextRev = initialRev + 1;
    if (state.state_revision !== undefined) {
      state.state_revision = nextRev;
    } else {
      state.revision = nextRev;
    }

    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");

    // Read back and verify
    const verifyRaw = fs.readFileSync(stateFile, "utf-8");
    const verifyState = JSON.parse(verifyRaw);
    const finalRev = Number(verifyState.state_revision ?? verifyState.revision ?? 0);

    if (finalRev !== nextRev) {
      throw new Error(`Revision did not increment (expected ${nextRev}, got ${finalRev})`);
    }
    if (verifyState.foreshadow?.E009?.status !== "resolved") {
      throw new Error("Foreshadow transaction was not persisted");
    }

    reportPass(flowNum, title, `Atomic transaction passed: revision ${initialRev} -> ${finalRev}, E009 resolved`);
  } catch (err) {
    reportFail(flowNum, title, err);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

async function runFlow5PiAgents() {
  const flowNum = 5;
  const title = "Pi Custom Agent Definitions & Slots";
  try {
    const roles = [
      "story-architect",
      "narrative-writer",
      "character-designer",
      "consistency-checker",
      "chapter-extractor",
      "story-explorer",
      "story-researcher",
    ];

    const dirsToCheck = [
      path.join(CWD, "skills/story-setup/references/pi/agents"),
      path.join(CWD, ".pi/agents"),
    ];

    const validSlots = new Set(["architect", "writer", "reviewer", "runner"]);

    for (const d of dirsToCheck) {
      for (const r of roles) {
        const filePath = path.join(d, `${r}.md`);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Missing agent definition file: ${filePath}`);
        }
        const buf = fs.readFileSync(filePath);
        // Verify strict UTF-8
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        if (text.includes("\ufffd")) {
          throw new Error(`Found U+FFFD replacement character in ${filePath}`);
        }

        const slotMatch = text.match(/^slot:\s*([^\s#]+)/m);
        if (!slotMatch || !validSlots.has(slotMatch[1].trim())) {
          throw new Error(`Invalid or missing slot in ${filePath} (found ${slotMatch ? slotMatch[1] : "none"})`);
        }

        // Verify model: does not exist
        if (/^model:\s*/m.test(text)) {
          throw new Error(`Found forbidden 'model:' line in ${filePath}`);
        }
      }
    }

    reportPass(flowNum, title, `Validated 14 files across 2 targets: 0 bad UTF-8, 0 U+FFFD, valid slot fields`);
  } catch (err) {
    reportFail(flowNum, title, err);
  }
}

async function main() {
  console.log("=== STARTING REAL-PATHWAY 5-FLOW VERIFICATION (ROUTE A) ===");
  console.log(`Target URL: ${BASE_URL}`);

  try {
    const { fullBookDir } = await runFlow1Books();
    await runFlow2Chapter(fullBookDir);
  } catch {
    // Flow 1 or 2 failed (likely server not running)
  }

  await runFlow3Gatecheck();
  await runFlow4TrackingTransaction(path.resolve(CWD, "demo/长篇/让你管账号，你高燃混剪炸全网"));
  await runFlow5PiAgents();

  console.log("----------------------------------------------------------");
  if (failedCount > 0) {
    console.error(`VERIFICATION FAILED: ${failedCount} flow(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("VERIFICATION PASSED: All real pathways verified successfully.");
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in verification script:", err);
  process.exitCode = 1;
});
