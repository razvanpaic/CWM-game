/* SM-2-lite scheduler. Intervals in days; due is an absolute day number.
   Cards only enter rotation once their room is mastered, so review always follows learning. */
(function (root) {
  "use strict";

  var NEW = { i: 0, e: 2.5, due: 0, s: 0, reps: 0, lapses: 0 };
  var EASE_MIN = 1.3, EASE_MAX = 3.0;

  function clampEase(e) { return Math.min(EASE_MAX, Math.max(EASE_MIN, e)); }

  function sched(id) {
    var srs = root.Store.get().srs;
    if (!srs[id]) srs[id] = Object.assign({}, NEW);
    return srs[id];
  }

  /* A card is available once its room is mastered (or everything is unlocked). */
  function released(card) {
    var s = root.Store.get();
    if (s.settings.unlockAll) return true;
    var r = s.rooms[String(card.room)];
    return !!(r && r.mastered);
  }

  function dueList() {
    var d = root.Store.today();
    return root.Data.cards.filter(function (c) {
      return released(c) && sched(c.id).due <= d;
    });
  }

  function releasedList() { return root.Data.cards.filter(released); }

  function nextDueInDays() {
    var d = root.Store.today();
    var future = releasedList()
      .map(function (c) { return sched(c.id).due; })
      .filter(function (x) { return x > d; });
    return future.length ? Math.min.apply(null, future) - d : null;
  }

  function grade(id, g) {
    var c = sched(id);
    var d = root.Store.today();
    var i = c.i, e = c.e, s = c.s;

    if (g === "again") { i = 0; e = clampEase(e - 0.20); s = 0; c.lapses += 1; }
    else if (g === "hard") { i = Math.max(1, Math.round(i * 1.2)); e = clampEase(e - 0.15); }
    else if (g === "good") { i = Math.max(1, Math.round(i * e)) || 1; s += 1; }
    else if (g === "easy") { i = Math.max(2, Math.round(i * e * 1.3)); e = clampEase(e + 0.15); s += 1; }
    else throw new Error("unknown grade " + g);

    // A brand-new card graded well should not jump straight to a long interval.
    if (c.reps === 0 && (g === "good" || g === "easy")) i = g === "easy" ? 2 : 1;

    c.i = i; c.e = e; c.s = s; c.due = d + i; c.reps += 1;
    root.Store.noteReview();
    return c;
  }

  function summary() {
    var rel = releasedList();
    var learned = rel.filter(function (c) { return sched(c.id).reps > 0; }).length;
    var mature = rel.filter(function (c) { return sched(c.id).i >= 21; }).length;
    return {
      total: root.Data.cards.length,
      released: rel.length,
      learned: learned,
      mature: mature,
      due: dueList().length,
      nextDue: nextDueInDays()
    };
  }

  function byRoom() {
    var out = {};
    root.Data.cards.forEach(function (c) {
      if (!out[c.room]) out[c.room] = { total: 0, learned: 0, due: 0 };
      out[c.room].total += 1;
      if (!released(c)) return;
      var s = sched(c.id);
      if (s.reps > 0) out[c.room].learned += 1;
      if (s.due <= root.Store.today()) out[c.room].due += 1;
    });
    return out;
  }

  root.SRS = {
    sched: sched, released: released, dueList: dueList, releasedList: releasedList,
    grade: grade, summary: summary, byRoom: byRoom, nextDueInDays: nextDueInDays
  };
})(typeof window !== "undefined" ? window : globalThis);
