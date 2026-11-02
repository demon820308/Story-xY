import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { resolveStoryAgent, readStorySlotBinding } = await jiti.import("../lib/story-agent-resolver.ts");

test("resolveStoryAgent throws clear error when slot is not bound", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "story-resolver-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  assert.throws(
    () => resolveStoryAgent("narrative-writer", { cwd: dir }),
    (err) => {
      assert.match(err.message, /未绑定槽位模型/);
      assert.match(err.message, /narrative-writer/);
      assert.match(err.message, /writer/);
      return true;
    }
  );
});

test("resolveStoryAgent returns undefined model with allowUnbound=true", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "story-resolver-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const profile = resolveStoryAgent("narrative-writer", { cwd: dir, allowUnbound: true });
  assert.equal(profile.name, "narrative-writer");
  assert.equal(profile.slot, "writer");
  assert.equal(profile.model, undefined);
  assert.ok(profile.tools.includes("read"));
  assert.ok(profile.tools.includes("write"));
  assert.ok(profile.tools.includes("bash"));
});

test("resolveStoryAgent resolves model when slot is configured in workspace settings", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "story-resolver-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const piDir = join(dir, ".pi");
  await mkdir(piDir, { recursive: true });
  await writeFile(
    join(piDir, "settings.json"),
    JSON.stringify({
      storySlots: {
        writer: "custom-writer-v1",
        reviewer: "custom-reviewer-v1",
      },
    })
  );

  const profile = resolveStoryAgent("narrative-writer", { cwd: dir });
  assert.equal(profile.name, "narrative-writer");
  assert.equal(profile.slot, "writer");
  assert.equal(profile.model, "custom-writer-v1");

  const binding = readStorySlotBinding("reviewer", { cwd: dir });
  assert.equal(binding, "custom-reviewer-v1");
});
