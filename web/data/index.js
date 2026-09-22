/* Assembles the content bundle and validates its shape at load time.
   A content mistake should surface immediately, not halfway through a lesson. */
(function (root) {
  "use strict";

  var rooms = []
    .concat(root.ROOMS_00_03 || [])
    .concat(root.ROOMS_04_07 || [])
    .concat(root.ROOMS_08_11 || []);

  rooms.sort(function (a, b) { return a.n - b.n; });

  var problems = [];

  rooms.forEach(function (r, i) {
    if (r.n !== i) problems.push("room numbering is not contiguous at index " + i + " (found " + r.n + ")");
    ["name", "tagline", "location", "key", "gate"].forEach(function (f) {
      if (!r[f]) problems.push("room " + r.n + " is missing " + f);
    });
    if (!(r.predict || []).length) problems.push("room " + r.n + " has no predict questions");
    if (!(r.teach || []).length) problems.push("room " + r.n + " has no teaching blocks");
    if (!r.palace || !(r.palace.story || []).length) problems.push("room " + r.n + " has no palace story");
    if (!(r.drills || []).length) problems.push("room " + r.n + " has no drills");
    if (!(r.recall || []).length) problems.push("room " + r.n + " has no recall prompts");
    (r.drills || []).forEach(function (d) {
      if (!d.id) problems.push("room " + r.n + " has a drill with no id");
      if (!d.type) problems.push("room " + r.n + " drill " + d.id + " has no type");
      if (d.type === "jq" && !d.solution) problems.push("room " + r.n + " drill " + d.id + " has no reference solution");
      if (d.type === "jq" && d.expect === undefined) problems.push("room " + r.n + " drill " + d.id + " has no expected output");
      if (d.type === "predict" && (!d.choices || d.answer === undefined)) problems.push("room " + r.n + " drill " + d.id + " is an incomplete predict drill");
      if (d.type === "order" && (!d.items || !d.shuffled)) problems.push("room " + r.n + " drill " + d.id + " is an incomplete order drill");
      if (d.type === "match" && !d.pairs) problems.push("room " + r.n + " drill " + d.id + " has no pairs");
      if (d.type === "classify" && (!d.buckets || !d.items)) problems.push("room " + r.n + " drill " + d.id + " is an incomplete classify drill");
    });
  });

  var cards = root.CARDS || [];
  var ids = {};
  cards.forEach(function (c) {
    if (ids[c.id]) problems.push("duplicate card id " + c.id);
    ids[c.id] = true;
    if (c.room === undefined || !c.front || !c.back) problems.push("card " + c.id + " is incomplete");
    if (c.id.indexOf("r" + c.room + "-") !== 0) problems.push("card " + c.id + " does not match its room " + c.room);
    if (!rooms.some(function (r) { return r.n === c.room; })) problems.push("card " + c.id + " belongs to a room that does not exist");
  });

  var drillCount = rooms.reduce(function (n, r) { return n + r.drills.length; }, 0);

  root.Data = {
    rooms: rooms,
    cards: cards,
    samples: root.SAMPLES || {},
    problems: problems,
    counts: { rooms: rooms.length, cards: cards.length, drills: drillCount }
  };
})(typeof window !== "undefined" ? window : globalThis);
