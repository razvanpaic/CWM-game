/* Room view. The five beats are a sequence, not tabs you can skim:
   predict before being taught, then teach, palace, drill, and free recall. */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  var BEAT_META = [
    { k: "predict", label: "1 Predict", blurb: "Commit to an answer before you are taught. A corrected wrong guess sticks far better than a handed-over right one." },
    { k: "learn", label: "2 Learn", blurb: "First principles, one idea at a time." },
    { k: "palace", label: "3 Palace", blurb: "The memory image. Concrete, physical, and mapped one-to-one onto the concepts." },
    { k: "drill", label: "4 Drill", blurb: "Do it. Predict each output before you run it." },
    { k: "recall", label: "5 Recall", blurb: "Say it out loud with nothing in front of you. Ninety seconds, and it is the strongest tool here." }
  ];

  function runnableBadge(r) {
    if (r.runnable === "jq") return root.UI.pill("runs here with jq", "good");
    if (r.runnable === "partly") return root.UI.pill("partly runnable", "accent");
    return root.UI.pill("read and reason", "warn");
  }

  function teachBlock(b) {
    if (b.h) return el("h3", { html: rich(b.h) });
    if (b.p) return root.UI.p(b.p);
    if (b.code) return el("pre", {}, el("code", { text: b.code }));
    if (b.note) return el("div", { class: "note note-" + (b.note.tone || "accent"), html: rich(b.note.text) });
    if (b.table) return root.UI.table(b.table.headers, b.table.rows);
    return null;
  }

  function beatPredict(r, done) {
    return el("div", { class: "stack" }, [
      el("p", { class: "lede", html: rich(
        "Answer these **out loud or on paper before opening them**. Being wrong here is the point — this is what makes the explanation land.") }),
      el("div", {}, r.predict.map(function (q) {
        return root.UI.disclosure(q.q, [el("div", { html: rich(q.a) })]);
      })),
      el("div", { class: "row", style: "margin-top:8px" }, [
        el("button", { class: "btn btn-primary", disabled: done,
          onclick: function () { root.RoomView.complete("predict"); },
          text: done ? "Done" : "I committed to my answers" })
      ])
    ]);
  }

  function beatLearn(r, done) {
    return el("div", { class: "stack" }, [
      el("div", { class: "prose" }, r.teach.map(teachBlock)),
      el("div", { class: "keysentence", html: rich("<b>Keep this one sentence:</b> " + r.key) }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-primary", disabled: done,
          onclick: function () { root.RoomView.complete("learn"); },
          text: done ? "Done" : "I have read this" })
      ])
    ]);
  }

  function beatPalace(r, done) {
    return el("div", { class: "stack" }, [
      el("p", { class: "muted", html: rich("**" + r.location + "**") }),
      el("p", { class: "muted", html: rich("*Furniture reused: " + r.reused + "*") }),
      el("div", { class: "palace-story prose" }, r.palace.story.map(function (s) { return root.UI.p(s); })),
      el("h3", { text: "What each object stands for" }),
      root.UI.table(["Object in the room", "Stands for"], r.palace.table),
      el("div", { class: "note", html: rich(
        "Walk the room once in your head before moving on: door, objects, in order. " +
        "The palace is the retention mechanism, not decoration — when a filter confuses you later, come back and look at the furniture.") }),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-primary", disabled: done,
          onclick: function () { root.RoomView.complete("palace"); },
          text: done ? "Done" : "I have walked the room" })
      ])
    ]);
  }

  function beatDrill(r, done, rerender) {
    var st = root.Store.room(r.n);
    var solvedCount = r.drills.filter(function (d) { return st.drills[d.id]; }).length;
    var all = solvedCount === r.drills.length;

    var head = el("div", { class: "spread", style: "margin-bottom:14px" }, [
      el("div", { class: "muted", html: rich(
        r.runnable === "reason"
          ? "Nothing here executes against CWM — there is no lab. These are reading and reasoning drills against the real definitions, which is the skill that actually prevents outages."
          : "These run for real. **Predict each output before you press Run.**") }),
      root.UI.pill(solvedCount + "/" + r.drills.length + " solved", all ? "good" : "accent")
    ]);

    var progress = root.UI.bar(solvedCount / r.drills.length, all ? "good" : null);

    return el("div", {}, [
      head, progress,
      el("div", { style: "margin-top:16px" }, r.drills.map(function (d) {
        return root.Drills.render(d, r.n, rerender);
      })),
      el("div", { class: "row", style: "margin-top:18px" }, [
        el("button", { class: "btn btn-primary", disabled: done || !all,
          onclick: function () { root.RoomView.complete("drill"); },
          text: done ? "Done" : all ? "Mark the drills complete" : "Solve every drill to continue" })
      ])
    ]);
  }

  function beatRecall(r, done) {
    return el("div", { class: "stack" }, [
      el("p", { class: "lede", html: rich(
        "Say these **out loud**, or write them without looking anything up. Free recall is the strongest retention tool available and it costs ninety seconds.") }),
      el("ol", {}, r.recall.map(function (q) { return el("li", { html: rich(q), style: "margin-bottom:9px" }); })),
      el("div", { class: "note note-good", html: rich("**You are ready to leave when:** " + r.gate) }),
      el("h3", { text: "Sources for this room" }),
      el("ul", { class: "muted", style: "font-size:13.5px" }, r.sources.map(function (s) { return el("li", { html: rich(s) }); })),
      el("div", { class: "row", style: "margin-top:8px" }, [
        el("button", { class: "btn btn-primary", disabled: done,
          onclick: function () { root.RoomView.complete("recall"); },
          text: done ? "Done" : "I answered all three from memory" })
      ])
    ]);
  }

  var currentRoom = null, currentBeat = null;

  function complete(beat) {
    var wasMastered = root.Store.room(currentRoom).mastered;
    root.Store.markBeat(currentRoom, beat);
    var nowMastered = root.Store.room(currentRoom).mastered;
    if (nowMastered && !wasMastered) {
      var n = root.Data.cards.filter(function (c) { return c.room === currentRoom; }).length;
      root.UI.toast("Room mastered. " + n + " cards released into review.");
    } else {
      root.UI.toast("+" + root.Store.XP.beat + " XP");
    }
    var idx = BEAT_META.map(function (b) { return b.k; }).indexOf(beat);
    var next = BEAT_META[idx + 1];
    root.App.go("#/room/" + currentRoom + (next ? "/" + next.k : ""), true);
  }

  function render(params) {
    var n = parseInt(params[0], 10);
    var r = root.Data.rooms.filter(function (x) { return x.n === n; })[0];
    if (!r) return el("div", { class: "empty" }, el("h2", { text: "No such room" }));
    if (!root.Store.unlocked(n)) {
      return el("div", { class: "empty" }, [
        el("h2", { text: "Room " + n + " is locked" }),
        el("p", { class: "muted", html: rich("Master **Room " + (n - 1) + "** first — each floor assumes the one below it. You can lift the gate in Progress if you would rather roam.") }),
        el("button", { class: "btn", onclick: function () { root.App.go("#/tower"); }, text: "Back to the tower" })
      ]);
    }

    currentRoom = n;
    var st = root.Store.room(n);
    var beat = params[1] || firstIncomplete(st);
    currentBeat = beat;

    var meta = BEAT_META.filter(function (b) { return b.k === beat; })[0] || BEAT_META[0];
    var done = !!st.beats[beat];
    var rerender = function () { root.App.render(); };

    var body;
    if (beat === "predict") body = beatPredict(r, done);
    else if (beat === "learn") body = beatLearn(r, done);
    else if (beat === "palace") body = beatPalace(r, done);
    else if (beat === "drill") body = beatDrill(r, done, rerender);
    else body = beatRecall(r, done);

    var nav = el("div", { class: "beatnav" }, BEAT_META.map(function (b) {
      return el("button", {
        class: b.k === beat ? "on" : "",
        onclick: function () { root.App.go("#/room/" + n + "/" + b.k); }
      }, [el("span", { text: b.label }), st.beats[b.k] ? el("span", { class: "tick", text: "\u2713" }) : null]);
    }));

    var nextRoom = root.Data.rooms.filter(function (x) { return x.n === n + 1; })[0];
    var footer = st.mastered
      ? el("div", { class: "card", style: "margin-top:22px" }, [
          el("div", { class: "spread" }, [
            el("div", {}, [
              el("div", { style: "font-weight:650", text: "Room " + n + " mastered" }),
              el("div", { class: "muted", html: rich(
                root.Data.cards.filter(function (c) { return c.room === n; }).length +
                " cards are in your review rotation. " + (nextRoom ? "Room " + (n + 1) + " is unlocked." : "That was the summit.")) })
            ]),
            el("div", { class: "row row-tight" }, [
              el("button", { class: "btn", onclick: function () { root.App.go("#/review"); }, text: "Review" }),
              nextRoom
                ? el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/room/" + (n + 1)); },
                    text: "Room " + (n + 1) + ": " + nextRoom.name })
                : el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/tower"); }, text: "Back to the tower" })
            ])
          ])
        ])
      : null;

    return el("div", {}, [
      el("div", { class: "spread", style: "margin-bottom:4px" }, [
        el("a", { href: "#/tower", class: "muted", style: "font-size:13px", text: "\u2190 the tower" }),
        el("div", { class: "row row-tight" }, [runnableBadge(r), st.mastered ? root.UI.pill("mastered", "good") : root.UI.pill(root.Store.beatsDone(n) + "/5 beats")])
      ]),
      el("h1", { text: "Room " + (n < 10 ? "0" : "") + n + " \u2014 " + r.name }),
      el("p", { class: "lede", html: rich(r.tagline) }),
      nav,
      el("div", { class: "note", style: "margin-bottom:18px", html: rich("**" + meta.label.replace(/^\d\s/, "") + ".** " + meta.blurb) }),
      body,
      footer
    ]);
  }

  function firstIncomplete(st) {
    for (var i = 0; i < BEAT_META.length; i++) if (!st.beats[BEAT_META[i].k]) return BEAT_META[i].k;
    return "recall";
  }

  root.RoomView = { render: render, complete: complete, BEAT_META: BEAT_META };
})(typeof window !== "undefined" ? window : globalThis);
