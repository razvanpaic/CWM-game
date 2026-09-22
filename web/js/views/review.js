/* Spaced repetition session. Cards only appear once their room is mastered,
   so review always follows learning rather than front-running it. */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  var session = null;

  function start() {
    var due = root.SRS.dueList();
    // Interleave rooms so consecutive cards rarely come from the same topic.
    due.sort(function (a, b) {
      var sa = root.SRS.sched(a.id), sb = root.SRS.sched(b.id);
      if (sa.reps === 0 && sb.reps !== 0) return -1;
      if (sb.reps === 0 && sa.reps !== 0) return 1;
      return (a.room % 3) - (b.room % 3) || a.id.localeCompare(b.id);
    });
    session = { queue: due, shown: false, graded: 0, again: 0 };
  }

  function grade(g) {
    var card = session.queue[0];
    root.SRS.grade(card.id, g);
    session.graded += 1;
    if (g === "again") { session.again += 1; session.queue.push(card); }
    session.queue.shift();
    session.shown = false;
    root.App.render();
  }

  function render() {
    if (!session) start();

    var sum = root.SRS.summary();

    if (sum.released === 0) {
      return el("div", { class: "empty" }, [
        el("h2", { text: "No cards in rotation yet" }),
        el("p", { class: "muted", html: rich(
          "Cards are released when you **master a room** — all five beats complete. That way review " +
          "always tests something you have actually been taught.") }),
        el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/tower"); }, text: "Go to the tower" })
      ]);
    }

    if (!session.queue.length) {
      var doneMsg = session.graded
        ? "**" + session.graded + " reviewed** this session" + (session.again ? ", " + session.again + " needing another look." : ".")
        : "Nothing is due right now.";
      return el("div", { class: "stack" }, [
        el("h1", { text: "Review" }),
        el("div", { class: "card" }, [
          el("h3", { text: "Queue empty" }),
          el("p", { html: rich(doneMsg) }),
          el("p", { class: "muted", html: rich(
            sum.nextDue === null
              ? "Every released card has been seen. New cards arrive as you master more rooms."
              : "Next card is due in **" + sum.nextDue + " day" + (sum.nextDue === 1 ? "" : "s") + "**. " +
                "An empty queue is the system working — spacing is the point.") }),
          el("div", { class: "row row-tight" }, [
            el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/tower"); }, text: "Back to the tower" }),
            session.graded ? el("button", { class: "btn", onclick: function () { session = null; root.App.render(); }, text: "Check again" }) : null
          ])
        ]),
        statsCard(sum)
      ]);
    }

    var card = session.queue[0];
    var sc = root.SRS.sched(card.id);
    var room = root.Data.rooms.filter(function (r) { return r.n === card.room; })[0];

    var faceNodes = [
      el("div", { class: "spread" }, [
        el("div", { class: "row row-tight" }, [
          root.UI.pill("Room " + (card.room < 10 ? "0" : "") + card.room + " \u00b7 " + (room ? room.name : "")),
          sc.reps === 0 ? root.UI.pill("new", "gold") : root.UI.pill("seen " + sc.reps + "\u00d7"),
          (card.tags || []).indexOf("gotcha") >= 0 ? root.UI.pill("gotcha", "warn") : null
        ]),
        el("small", { text: session.queue.length + " left" })
      ]),
      el("div", { class: "review-front", html: rich(card.front) })
    ];

    if (!session.shown) {
      faceNodes.push(el("div", { class: "row", style: "margin-top:18px" }, [
        el("button", { class: "btn btn-primary", onclick: function () { session.shown = true; root.App.render(); }, text: "Show answer" }),
        el("small", { style: "margin-left:4px", text: "Try to reconstruct it first — that effort is the whole mechanism." })
      ]));
    } else {
      faceNodes.push(el("div", { class: "review-back", html: rich(card.back) }));
      faceNodes.push(el("div", { class: "grade-row" }, [
        el("button", { class: "btn btn-bad", onclick: function () { grade("again"); } },
          [el("span", { text: "Again" }), el("small", { text: "back to now" })]),
        el("button", { class: "btn btn-warn", onclick: function () { grade("hard"); } },
          [el("span", { text: "Hard" }), el("small", { text: "shorter gap" })]),
        el("button", { class: "btn btn-primary", onclick: function () { grade("good"); } },
          [el("span", { text: "Good" }), el("small", { text: nextGapLabel(sc, "good") })]),
        el("button", { class: "btn btn-good", onclick: function () { grade("easy"); } },
          [el("span", { text: "Easy" }), el("small", { text: nextGapLabel(sc, "easy") })])
      ]));
      if (room) {
        faceNodes.push(el("div", { style: "margin-top:14px" },
          el("a", { href: "#/room/" + card.room + "/palace", class: "muted", style: "font-size:13px",
            text: "Forgotten why? Re-walk " + room.name + " \u2192" })));
      }
    }

    return el("div", { class: "stack" }, [
      el("div", { class: "spread" }, [
        el("h1", { text: "Review" }),
        el("div", { class: "row row-tight" }, [
          root.UI.pill(sum.due + " due"),
          el("button", { class: "btn btn-ghost btn-sm", onclick: function () { root.App.go("#/tower"); }, text: "Stop" })
        ])
      ]),
      el("div", { class: "card review-card" }, faceNodes),
      statsCard(sum)
    ]);
  }

  function nextGapLabel(sc, g) {
    if (sc.reps === 0) return g === "easy" ? "in 2 days" : "in 1 day";
    var i = g === "easy" ? Math.max(2, Math.round(sc.i * sc.e * 1.3)) : Math.max(1, Math.round(sc.i * sc.e));
    return "in " + i + " day" + (i === 1 ? "" : "s");
  }

  function statsCard(sum) {
    var per = root.SRS.byRoom();
    var rows = root.Data.rooms
      .filter(function (r) { return per[r.n] && root.Store.room(r.n).mastered; })
      .map(function (r) {
        var p = per[r.n];
        return [
          "Room " + (r.n < 10 ? "0" : "") + r.n + " \u00b7 " + r.name,
          p.learned + "/" + p.total,
          p.due ? String(p.due) : "\u2014"
        ];
      });
    return el("div", { class: "card" }, [
      el("div", { class: "row", style: "gap:30px;margin-bottom:6px" }, [
        root.UI.stat(sum.released, "In rotation"),
        root.UI.stat(sum.learned, "Seen at least once"),
        root.UI.stat(sum.mature, "Mature (21d+)"),
        root.UI.stat(sum.total - sum.released, "Still locked")
      ]),
      rows.length ? root.UI.table(["Room", "Seen", "Due"], rows) : el("small", { text: "Master a room to release its cards." })
    ]);
  }

  root.ViewReview = { render: render, reset: function () { session = null; } };
})(typeof window !== "undefined" ? window : globalThis);
