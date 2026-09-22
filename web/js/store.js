/* Progress store. localStorage when available, memory otherwise (some browsers block
   storage on file://), plus JSON export/import so progress is portable between machines. */
(function (root) {
  "use strict";

  var KEY = "cwm-signal-tower.v1";
  var BEATS = ["predict", "learn", "palace", "drill", "recall"];
  var XP = { beat: 10, drill: 25, drillRetry: 8, master: 60, review: 3 };

  var memoryOnly = false;
  var state = null;

  function today() { return Math.floor(Date.now() / 86400000); }

  function blank() {
    return { v: 1, xp: 0, streak: { count: 0, lastDay: null }, rooms: {}, srs: {},
             stats: { reviews: 0, drillsRight: 0, drillsTried: 0 }, settings: { unlockAll: false } };
  }

  function read() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (!raw) return blank();
      var parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) {
      memoryOnly = true;
      return blank();
    }
  }

  function migrate(s) {
    var b = blank();
    if (!s || typeof s !== "object") return b;
    return {
      v: 1,
      xp: typeof s.xp === "number" ? s.xp : 0,
      streak: s.streak && typeof s.streak === "object" ? s.streak : b.streak,
      rooms: s.rooms && typeof s.rooms === "object" ? s.rooms : {},
      srs: s.srs && typeof s.srs === "object" ? s.srs : {},
      stats: s.stats && typeof s.stats === "object" ? Object.assign(b.stats, s.stats) : b.stats,
      settings: s.settings && typeof s.settings === "object" ? Object.assign(b.settings, s.settings) : b.settings
    };
  }

  function save() {
    if (memoryOnly) return;
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { memoryOnly = true; }
  }

  function get() { if (!state) state = read(); return state; }

  function room(n) {
    var s = get();
    var k = String(n);
    if (!s.rooms[k]) s.rooms[k] = { beats: {}, drills: {}, mastered: false };
    return s.rooms[k];
  }

  function addXp(n) { get().xp += n; save(); }

  /* One streak tick per calendar day of activity; a gap of more than a day resets it. */
  function touchStreak() {
    var s = get();
    var d = today();
    if (s.streak.lastDay === d) return;
    s.streak.count = s.streak.lastDay === d - 1 ? s.streak.count + 1 : 1;
    s.streak.lastDay = d;
    save();
  }

  function markBeat(n, beat) {
    var r = room(n);
    if (r.beats[beat]) return false;
    r.beats[beat] = true;
    addXp(XP.beat);
    touchStreak();
    checkMastery(n);
    save();
    return true;
  }

  function beatsDone(n) {
    var r = room(n);
    return BEATS.filter(function (b) { return !!r.beats[b]; }).length;
  }

  function checkMastery(n) {
    var r = room(n);
    if (r.mastered) return false;
    if (beatsDone(n) < BEATS.length) return false;
    r.mastered = true;
    addXp(XP.master);
    save();
    return true;
  }

  function markDrill(n, id, firstTry) {
    var r = room(n);
    var s = get();
    s.stats.drillsTried += 1;
    if (!r.drills[id]) {
      r.drills[id] = true;
      s.stats.drillsRight += 1;
      addXp(firstTry ? XP.drill : XP.drillRetry);
      touchStreak();
    }
    save();
  }

  function unlocked(n) {
    var s = get();
    if (n === 0 || s.settings.unlockAll) return true;
    var prev = s.rooms[String(n - 1)];
    return !!(prev && prev.mastered);
  }

  function highestUnlocked(total) {
    var last = 0;
    for (var i = 0; i < total; i++) if (unlocked(i)) last = i;
    return last;
  }

  function setUnlockAll(v) { get().settings.unlockAll = !!v; save(); }

  function noteReview() {
    var s = get();
    s.stats.reviews += 1;
    addXp(XP.review);
    touchStreak();
    save();
  }

  function exportJson() { return JSON.stringify(get(), null, 2); }

  function importJson(text) {
    var parsed = JSON.parse(text);
    state = migrate(parsed);
    save();
  }

  function reset() { state = blank(); save(); }

  root.Store = {
    BEATS: BEATS, XP: XP, today: today,
    get: get, save: save, room: room,
    markBeat: markBeat, beatsDone: beatsDone, markDrill: markDrill,
    unlocked: unlocked, highestUnlocked: highestUnlocked, setUnlockAll: setUnlockAll,
    noteReview: noteReview, addXp: addXp, touchStreak: touchStreak,
    exportJson: exportJson, importJson: importJson, reset: reset,
    isMemoryOnly: function () { get(); return memoryOnly; }
  };
})(typeof window !== "undefined" ? window : globalThis);
