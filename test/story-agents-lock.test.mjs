import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { checkAndAcquireBookWriteLock, releaseBookWriteLock } = await jiti.import(
  "../.pi/extensions/story-agents.ts"
);

test("book write lock prevents concurrent prose writes and releases only for holder", () => {
  const bookKey = "/mock/workspace/book-1";

  // Task 1 attempts to write prose
  const res1 = checkAndAcquireBookWriteLock(bookKey, "正文/第001章_开篇.md", "task-1-call");
  assert.equal(res1.success, true);

  // Task 2 attempts to write prose to the same book simultaneously -> MUST BE BLOCKED
  const res2 = checkAndAcquireBookWriteLock(bookKey, "正文/第002章_冲突.md", "task-2-call");
  assert.equal(res2.success, false);
  assert.match(res2.reason, /并发写锁拦截/);

  // An unrelated tool_result from another task (task-3) should NOT release Task 1's lock
  const releaseUnrelated = releaseBookWriteLock(bookKey, "task-3-call");
  assert.equal(releaseUnrelated, false);

  // Task 2 still blocked
  const res2Retry = checkAndAcquireBookWriteLock(bookKey, "正文/第002章_冲突.md", "task-2-call");
  assert.equal(res2Retry.success, false);

  // Task 1 completes and emits its tool_result
  const releaseHolder = releaseBookWriteLock(bookKey, "task-1-call");
  assert.equal(releaseHolder, true);

  // Now Task 2 can acquire the lock
  const res2AfterRelease = checkAndAcquireBookWriteLock(bookKey, "正文/第002章_冲突.md", "task-2-call");
  assert.equal(res2AfterRelease.success, true);

  // Cleanup
  releaseBookWriteLock(bookKey, "task-2-call");
});
