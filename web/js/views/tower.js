/* The Memory Palace itself: a tower elevation you climb, plus the room ladder. */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function elevation() {
    var rooms = root.Data.rooms;
    var W = 330, pitch = 36, floorH = 29, mast = 52;
    var H = mast + rooms.length * pitch + 22;
    var kids = [];

    // Mast and dishes: the Antenna Deck reaching above the roofline.
    kids.push(s("line", { x1: W / 2, y1: 8, x2: W / 2, y2: mast, stroke: "#3a4551", "stroke-width": 2 }));
    kids.push(s("circle", { cx: W / 2, cy: 8, r: 3.2, fill: "#5ac8fa" }));
    [18, 28, 38].forEach(function (y, i) {
      kids.push(s("line", {
        x1: W / 2 - (6 + i * 4), y1: y, x2: W / 2 + (6 + i * 4), y2: y,
        stroke: "#2b3541", "stroke-width": 1.6
      }));
    });

    rooms.forEach(function (r) {
      var idx = rooms.length - 1 - r.n;             // room 0 at the bottom
      var y = mast + idx * pitch;
      var width = 262 - r.n * 5;                    // gentle taper toward the summit
      var x = (W - width) / 2;
      var st = root.Store.room(r.n);
      var open = root.Store.unlocked(r.n);
      var done = root.Store.beatsDone(r.n);
      var cls = "floor" + (open ? "" : " locked") + (st.mastered ? " mastered" : "");

      var fill = st.mastered ? "#1c6b8a" : open ? "#1a2029" : "#141a21";
      var stroke = st.mastered ? "#5ac8fa" : open ? "#2b3541" : "#1e252d";
      var ink = st.mastered ? "#eaf8ff" : open ? "#e7ecf3" : "#4a545f";

      var g = s("g", {
        class: cls,
        onclick: function () { if (open) root.App.go("#/room/" + r.n); }
      }, [
        s("rect", { class: "plate", x: x, y: y, width: width, height: floorH, rx: 3, fill: fill, stroke: stroke, "stroke-width": 1 }),
        s("text", { class: "floor-num", x: x + 9, y: y + floorH / 2 + 3.5, fill: st.mastered ? "#bfe9fa" : "#68727e", text: (r.n < 10 ? "0" : "") + r.n }),
        s("text", { class: "floor-name", x: x + 30, y: y + floorH / 2 + 3.5, fill: ink, text: r.name })
      ]);

      // Progress ticks inside the plate: one per completed beat.
      for (var b = 0; b < 5; b++) {
        g.appendChild(s("rect", {
          x: x + width - 12 - (4 - b) * 6, y: y + floorH / 2 - 2.5, width: 4, height: 5, rx: 1,
          fill: b < done ? (st.mastered ? "#bfe9fa" : "#3ddc97") : (open ? "#2b3541" : "#1e252d")
        }));
      }
      if (!open) {
        g.appendChild(s("text", { x: x + width - 4, y: y + floorH / 2 + 3.5, "text-anchor": "end", "font-size": 9, fill: "#4a545f", text: "\u2014" }));
      }
      kids.push(g);
    });

    kids.push(s("rect", { x: 14, y: mast + rooms.length * pitch + 3, width: W - 28, height: 5, rx: 2, fill: "#1e252d" }));

    return s("svg", { class: "tower-svg", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Signal Tower elevation, twelve floors, ground floor at the bottom" }, kids);
  }

  function roomRow(r) {
    var st = root.Store.room(r.n);
    var open = root.Store.unlocked(r.n);
    var done = root.Store.beatsDone(r.n);
    var beats = el("div", { class: "beats" }, root.Store.BEATS.map(function (b) {
      return el("i", { class: st.beats[b] ? "done" : "" });
    }));
    return el("button", {
      class: "roomrow" + (open ? "" : " locked") + (st.mastered ? " mastered" : ""),
      type: "button",
      disabled: !open,
      title: open ? "Enter " + r.name : "Master room " + (r.n - 1) + " to unlock",
      onclick: function () { if (open) root.App.go("#/room/" + r.n); }
    }, [
      el("span", { class: "n", text: (r.n < 10 ? "0" : "") + r.n }),
      el("span", {}, [
        el("div", { class: "nm", text: r.name }),
        el("div", { class: "tc", html: rich(r.tagline) })
      ]),
      el("span", { class: "row row-tight" }, [
        st.mastered ? root.UI.pill("mastered", "good") : (done ? root.UI.pill(done + "/5", "accent") : null),
        beats
      ])
    ]);
  }

  function render() {
    var rooms = root.Data.rooms;
    var mastered = rooms.filter(function (r) { return root.Store.room(r.n).mastered; }).length;
    var sum = root.SRS.summary();
    var next = rooms.filter(function (r) { return root.Store.unlocked(r.n) && !root.Store.room(r.n).mastered; })[0];

    var head = el("div", { class: "stack" }, [
      el("h1", { text: "The Signal Tower" }),
      el("p", { class: "lede", html: rich(
        "Twelve rooms, ground floor to summit, for **Cisco Crosswork Workflow Manager 2.1**. " +
        "Each room reuses the previous room's furniture, so what you learn compounds instead of stacking. " +
        "Climb in order — every floor assumes the one below it.") })
    ]);

    var stats = el("div", { class: "card" }, el("div", { class: "row", style: "gap:34px" }, [
      root.UI.stat(mastered + "/" + rooms.length, "Rooms mastered", mastered === rooms.length ? "" : null),
      root.UI.stat(sum.due, "Cards due now"),
      root.UI.stat(sum.learned + "/" + sum.released, "Cards in rotation"),
      root.UI.stat(root.Store.get().xp, "XP"),
      root.UI.stat(root.Store.get().streak.count, "Day streak")
    ]));

    var cta = null;
    if (next) {
      cta = el("div", { class: "card" }, [
        el("div", { class: "spread" }, [
          el("div", {}, [
            el("div", { class: "muted", style: "font-size:12px;text-transform:uppercase;letter-spacing:.06em", text: root.Store.beatsDone(next.n) ? "Continue" : "Next room" }),
            el("div", { style: "font-size:17px;font-weight:650", text: "Room " + (next.n < 10 ? "0" : "") + next.n + " \u2014 " + next.name }),
            el("div", { class: "muted", html: rich(next.tagline) })
          ]),
          el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/room/" + next.n); },
            text: root.Store.beatsDone(next.n) ? "Resume" : "Enter the room" })
        ])
      ]);
    } else {
      cta = el("div", { class: "card" }, [
        el("h3", { text: "Every room mastered" }),
        el("p", { class: "muted", html: rich(
          "The climb is done. What keeps it is **review** — the deck is now the whole point. " +
          "Come back to any room to re-read the palace whenever a card stops making sense.") }),
        el("button", { class: "btn btn-primary", onclick: function () { root.App.go("#/review"); }, text: "Review " + sum.due + " due" })
      ]);
    }

    var dueNudge = sum.due > 0 && mastered > 0
      ? el("div", { class: "note note-accent", html: rich(
          "**" + sum.due + " card" + (sum.due === 1 ? "" : "s") + " due.** Review before new content — retrieval is what makes the next room stick. " +
          "<a href='#/review'>Start review</a>") })
      : null;

    return el("div", { class: "stack" }, [
      head,
      stats,
      dueNudge,
      el("div", { class: "tower-wrap", style: "margin-top:8px" }, [
        el("div", { class: "stack" }, [
          elevation(),
          el("div", { class: "legend", style: "justify-content:center" }, [
            el("span", {}, [el("i", { style: "background:#1c6b8a" }), "mastered"]),
            el("span", {}, [el("i", { style: "background:#1a2029;border:1px solid #2b3541" }), "open"]),
            el("span", {}, [el("i", { style: "background:#141a21" }), "locked"])
          ]),
          el("small", { class: "center", style: "display:block", html: rich("Ground floor is `jq`. The summit is MOPs. Click a floor to enter.") })
        ]),
        el("div", { class: "stack" }, [cta, el("div", { class: "roomlist" }, rooms.map(roomRow))])
      ])
    ]);
  }

  root.ViewTower = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
