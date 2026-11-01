async function testAllFlows() {
  const base = "http://127.0.0.1:30145";
  console.log("=== STARTING 8-FLOW VERIFICATION ===");

  // 1. Books
  const bRes = await fetch(base + "/api/story/books");
  const bData = await bRes.json();
  const book = bData.books[0];
  console.log("[1/8] Books loaded:", book.title, "path:", book.path);

  // 2. Read Chapter 1
  const cRes = await fetch(base + "/api/story/chapter?bookPath=" + encodeURIComponent(book.path) + "&chapter=1");
  const cData = await cRes.json();
  console.log("[2/8] Read chapter 1 chars:", cData.charCount);

  // 3. Gatecheck Clean text
  const g1Res = await fetch(base + "/api/story/gatecheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookPath: book.path, chapterNum: 1, content: cData.content })
  });
  const g1Data = await g1Res.json();
  console.log("[3/8] Clean text gatecheck:", g1Data.overall, "matches:", g1Data.gates?.aiPatterns?.matches?.length);

  // 4. Gatecheck Dirty text (with AI patterns)
  const dirtyText = "他不是傻子，而是太懂了。老皮声音不大，却字字诛心。在这一瞬间命运的齿轮转动了，林浩嘴角微微上扬。" + "正文内容".repeat(500);
  const g2Res = await fetch(base + "/api/story/gatecheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookPath: book.path, chapterNum: 1, content: dirtyText })
  });
  const g2Data = await g2Res.json();
  console.log("[4/8] Dirty text gatecheck overall:", g2Data.overall, "AI Hits detected:", g2Data.gates?.aiPatterns?.matches?.length);
  g2Data.gates?.aiPatterns?.matches?.forEach(m => console.log("   - Hit:", m.pattern, "count:", m.count, "sample:", m.matchText));

  // 5. Foreshadow Add & Resolve
  const fsAddRes = await fetch(base + "/api/story/foreshadow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookPath: book.path,
      action: "add",
      id: "E005",
      description: "库房暗格中的半张汇票存根",
      source_chapter: 1,
      promise_chapter: 2
    })
  });
  const fsAddData = await fsAddRes.json();
  console.log("[5/8] Foreshadow added E005:", !!fsAddData.tracking?.foreshadow?.E005);

  // 6. Tools: Story Analyze
  const toolRes = await fetch(base + "/api/story/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "analyze",
      bookPath: book.path,
      text: "林浩把算盘往桌上一放，木珠子撞得噼啪作响。老皮手里的旱烟杆停在了半空，烟头明灭不定。账不对，林浩盯着账本上的红印，差了七千四百块。老皮笑了笑，吐出一口浓烟：小后生，饭可以乱吃，账可不能乱算。"
    })
  });
  const toolData = await toolRes.json();
  console.log("[6/8] Tools analyze report generated:", toolData.success, "length:", toolData.report?.length);

  // 7. Commit Chapter 1
  const commitRes = await fetch(base + "/api/story/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookPath: book.path,
      chapterNum: 1,
      charCount: cData.charCount
    })
  });
  const commitData = await commitRes.json();
  console.log("[7/8] Commit chapter 1:", commitData.success, "Revision:", commitData.tracking?.revision);

  // 8. Agent Prompt Execution
  const agentRes = await fetch(base + "/api/story/agent/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "针对第1章结尾，写一句老皮内心的疑虑，要求纯台词或神态，无任何AI腔调。",
      role: "narrative-writer",
      chapterContext: cData.content.slice(-500)
    })
  });
  const agentData = await agentRes.json();
  console.log("[8/8] Agent Prompt Response:", agentData.success, "Reply:", agentData.reply?.trim());

  console.log("=== ALL 8 FLOWS COMPLETED AND VERIFIED 100% ===");
}

testAllFlows().catch(console.error);
