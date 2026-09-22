/* End-to-end smoke test. Loads the real index.html in jsdom and drives every view,
   every room, every beat and every drill, then checks mastery, card release, review
   grading and progress export/import.

   Optional dependency. From portal/web:
     npm install jsdom          # or: npm install --no-save jsdom
     node tools/smoke.js .

   The portal itself has no dependencies; this is a development check only.
*/
const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");
const fs = require("fs");

const WEB = require("path").resolve(process.argv[2] || ".");
const errors = [];

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const m = (e.message || "");
  if (/Not implemented/.test(m)) return; // jsdom gaps, not portal bugs
  errors.push("jsdomError: " + (e.stack || m));
});
vc.on("error", (...a) => errors.push("console.error: " + a.map(String).join(" ")));
vc.on("warn", (...a) => { /* content warnings are surfaced separately */ });

const html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "file://" + path.join(WEB, "index.html") + "#/tower",
  runScripts: "dangerously",
  resources: {
    fetch(url) {
      const p = url.replace(/^file:\/\//, "").split("#")[0].split("?")[0];
      try { return Promise.resolve(Buffer.from(fs.readFileSync(decodeURIComponent(p)))); }
      catch (e) { return null; }
    }
  },
  virtualConsole: vc,
  pretendToBeVisual: true
});

const { window } = dom;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function textOf() { return window.document.getElementById("view").textContent || ""; }
function viewHtmlLen() { return (window.document.getElementById("view").innerHTML || "").length; }

function assert(cond, msg) { if (!cond) errors.push("ASSERT: " + msg); }

(async () => {
  await wait(400);

  if (!window.App) { console.log("FAIL: App never booted"); errors.forEach((e) => console.log("  " + e)); process.exit(1); }

  const D = window.Data;
  console.log(`  booted. rooms=${D.counts.rooms} drills=${D.counts.drills} cards=${D.counts.cards}`);
  assert(D.problems.length === 0, "content problems: " + D.problems.join("; "));

  // --- every top-level view renders something substantial ---
  const EXPECT = {
    "#/tower": "The Signal Tower",
    "#/review": "No cards in rotation yet",   // correct state on a fresh profile
    "#/playground": "jq playground",
    "#/progress": "Progress",
    "#/diagnostics": "Diagnostics"
  };
  for (const route of Object.keys(EXPECT)) {
    window.location.hash = route;
    window.App.render();
    await wait(30);
    assert(!textOf().includes("failed to render"), `${route} threw during render`);
    assert(textOf().includes(EXPECT[route]), `${route} did not render its expected content ("${EXPECT[route]}")`);
  }
  console.log("  all 5 top-level views render");

  // --- diagnostics must report a healthy engine ---
  window.location.hash = "#/diagnostics";
  window.App.render();
  await wait(20);
  const diag = textOf();
  assert(diag.includes("engine healthy"), "diagnostics does not report a healthy jq engine");
  assert(diag.includes("valid"), "diagnostics does not report valid content");
  console.log("  diagnostics reports engine healthy + content valid");

  // --- unlock everything so we can walk all rooms ---
  window.Store.setUnlockAll(true);

  const BEATS = ["predict", "learn", "palace", "drill", "recall"];
  let drillsRendered = 0;

  for (const room of D.rooms) {
    for (const beat of BEATS) {
      window.location.hash = `#/room/${room.n}/${beat}`;
      window.App.render();
      await wait(10);
      const t = textOf();
      assert(!t.includes("failed to render"), `room ${room.n} beat ${beat} threw`);
      assert(viewHtmlLen() > 300, `room ${room.n} beat ${beat} rendered almost nothing`);
      if (beat === "drill") {
        const cards = window.document.querySelectorAll("[data-drill]");
        assert(cards.length === room.drills.length,
          `room ${room.n}: ${cards.length} drill cards rendered, expected ${room.drills.length}`);
        drillsRendered += cards.length;
        assert(!t.includes("Unknown drill type"), `room ${room.n} has an unknown drill type`);
      }
    }
  }
  console.log(`  all 12 rooms x 5 beats render; ${drillsRendered} drill cards rendered`);

  // --- exercise a live jq drill end to end: type the solution, click check ---
  window.location.hash = "#/room/0/drill";
  window.App.render();
  await wait(20);
  const firstCard = window.document.querySelector('[data-drill="d0-1"]');
  assert(!!firstCard, "could not find drill d0-1");
  if (firstCard) {
    const areas = firstCard.querySelectorAll("textarea");
    const filterBox = areas[areas.length - 1];
    filterBox.value = ".hostname";
    const runBtn = Array.from(firstCard.querySelectorAll("button")).find((b) => b.textContent === "Run and check");
    assert(!!runBtn, "no 'Run and check' button on d0-1");
    runBtn.click();
    await wait(20);
    const v = firstCard.querySelector(".verdict");
    assert(v && /Correct/.test(v.textContent), "solving d0-1 did not produce a Correct verdict, got: " + (v && v.textContent));
    assert(window.Store.room(0).drills["d0-1"] === true, "solving d0-1 was not recorded in the store");
    console.log("  live jq drill solved and recorded");
  }

  // --- predict drill: click the right choice ---
  const predictRoom = D.rooms.find((r) => r.drills.some((d) => d.type === "predict"));
  const pd = predictRoom.drills.find((d) => d.type === "predict");
  window.location.hash = `#/room/${predictRoom.n}/drill`;
  window.App.render();
  await wait(20);
  const pcard = window.document.querySelector(`[data-drill="${pd.id}"]`);
  assert(!!pcard, "predict drill card not found");
  if (pcard) {
    pcard.querySelectorAll(".choice")[pd.answer].click();
    await wait(20);
    assert(window.Store.room(predictRoom.n).drills[pd.id] === true, "predict drill not recorded");
    console.log("  predict drill solved and recorded");
  }

  // --- beat completion, mastery and card release ---
  window.Store.reset();
  window.ViewReview.reset();
  for (const beat of BEATS) {
    window.location.hash = `#/room/0/${beat}`;
    window.App.render();
    await wait(10);
    if (beat === "drill") {
      // mark every drill solved directly, then complete the beat
      for (const d of D.rooms[0].drills) window.Store.markDrill(0, d.id, true);
      window.App.render();
      await wait(10);
    }
    window.RoomView.complete(beat);
    await wait(10);
  }
  assert(window.Store.room(0).mastered === true, "room 0 did not reach mastery after all five beats");
  const released = window.SRS.releasedList().length;
  const room0cards = D.cards.filter((c) => c.room === 0).length;
  assert(released === room0cards, `mastering room 0 released ${released} cards, expected ${room0cards}`);
  assert(window.Store.unlocked(1) === true, "mastering room 0 did not unlock room 1");
  console.log(`  mastery works: room 0 mastered, ${released} cards released, room 1 unlocked`);

  // --- review session: show answer then grade, and check scheduling moved ---
  window.location.hash = "#/review";
  window.App.render();
  await wait(20);
  let showBtn = Array.from(window.document.querySelectorAll("button")).find((b) => b.textContent === "Show answer");
  assert(!!showBtn, "review has no Show answer button");
  showBtn.click();
  await wait(20);
  const goodBtn = Array.from(window.document.querySelectorAll("button")).find((b) => /^Good/.test(b.textContent));
  assert(!!goodBtn, "review has no Good button after revealing");
  const beforeReviews = window.Store.get().stats.reviews;
  goodBtn.click();
  await wait(20);
  assert(window.Store.get().stats.reviews === beforeReviews + 1, "grading did not increment the review count");
  const anyScheduled = Object.values(window.Store.get().srs).some((s) => s.due > window.Store.today());
  assert(anyScheduled, "grading Good did not schedule the card into the future");
  console.log("  review session grades and reschedules");

  // --- playground runs ---
  window.location.hash = "#/playground";
  window.App.render();
  await wait(60);
  const pgOut = window.document.querySelector("#view .term pre");
  assert(pgOut && pgOut.textContent.length > 0, "playground produced no output on load");
  console.log("  playground renders and evaluates");

  // --- export / import round trip ---
  const snapshot = window.Store.exportJson();
  window.Store.reset();
  assert(window.Store.room(0).mastered === false, "reset did not clear mastery");
  window.Store.importJson(snapshot);
  assert(window.Store.room(0).mastered === true, "import did not restore mastery");
  console.log("  progress export/import round-trips");

  if (errors.length) {
    console.log("\n  FAILURES (" + errors.length + "):");
    errors.forEach((e) => console.log("   - " + e));
    process.exit(1);
  }
  console.log("\n  SMOKE TEST PASSED");
  process.exit(0);
})().catch((e) => { console.log("harness crashed: " + (e.stack || e)); process.exit(1); });
