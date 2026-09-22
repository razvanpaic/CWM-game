/* Progress, portability (export/import) and engine diagnostics. */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  function renderProgress() {
    var s = root.Store.get();
    var rooms = root.Data.rooms;
    var mastered = rooms.filter(function (r) { return root.Store.room(r.n).mastered; }).length;
    var sum = root.SRS.summary();
    var totalDrills = root.Data.counts.drills;
    var solved = rooms.reduce(function (n, r) {
      var st = root.Store.room(r.n);
      return n + r.drills.filter(function (d) { return st.drills[d.id]; }).length;
    }, 0);

    var rows = rooms.map(function (r) {
      var st = root.Store.room(r.n);
      var beats = root.Store.beatsDone(r.n);
      var ds = r.drills.filter(function (d) { return st.drills[d.id]; }).length;
      var per = root.SRS.byRoom()[r.n] || { learned: 0, total: 0 };
      return [
        el("a", { href: "#/room/" + r.n, text: (r.n < 10 ? "0" : "") + r.n + " " + r.name }),
        st.mastered ? root.UI.pill("mastered", "good") : root.Store.unlocked(r.n) ? root.UI.pill("open") : root.UI.pill("locked"),
        beats + "/5",
        ds + "/" + r.drills.length,
        st.mastered ? per.learned + "/" + per.total : "\u2014"
      ];
    });

    var exportArea = el("textarea", { rows: 6, spellcheck: "false", readonly: true, style: "width:100%",
      text: "" , "aria-label": "exported progress" });
    var importArea = el("textarea", { rows: 4, spellcheck: "false", style: "width:100%",
      placeholder: "paste an exported progress file here", "aria-label": "import progress" });

    function download() {
      var blob = new Blob([root.Store.exportJson()], { type: "application/json" });
      var a = el("a", { href: URL.createObjectURL(blob), download: "signal-tower-progress.json" });
      document.body.appendChild(a); a.click(); a.remove();
    }

    return el("div", { class: "stack" }, [
      el("h1", { text: "Progress" }),
      el("div", { class: "card" }, el("div", { class: "row", style: "gap:34px" }, [
        root.UI.stat(mastered + "/" + rooms.length, "Rooms mastered"),
        root.UI.stat(solved + "/" + totalDrills, "Drills solved"),
        root.UI.stat(sum.learned + "/" + sum.total, "Cards seen"),
        root.UI.stat(s.stats.reviews, "Reviews done"),
        root.UI.stat(s.xp, "XP"),
        root.UI.stat(s.streak.count, "Day streak")
      ])),

      root.Store.isMemoryOnly()
        ? el("div", { class: "note note-warn", html: rich(
            "**This browser is not letting the portal save progress.** That usually means it was opened " +
            "directly as a file. Progress will vanish when you close the tab. Either serve the folder " +
            "(`python3 -m http.server 8000`) or export your progress below before you finish.") })
        : null,

      el("h2", { text: "Room by room" }),
      root.UI.table(["Room", "State", "Beats", "Drills", "Cards seen"], rows),

      el("h2", { text: "Take your progress with you" }),
      el("div", { class: "card" }, [
        el("p", { class: "muted", html: rich(
          "Progress lives in this browser's local storage — it is not sent anywhere. Export it to move " +
          "between machines or browsers, or to keep a backup.") }),
        el("div", { class: "row row-tight" }, [
          el("button", { class: "btn btn-primary btn-sm", onclick: download, text: "Download progress file" }),
          el("button", { class: "btn btn-sm", onclick: function () {
            exportArea.value = root.Store.exportJson();
            exportArea.select();
          }, text: "Show as text" })
        ]),
        exportArea,
        el("hr"),
        importArea,
        el("div", { class: "row row-tight" }, [
          el("button", { class: "btn btn-sm", onclick: function () {
            try {
              root.Store.importJson(importArea.value);
              root.ViewReview.reset();
              root.UI.toast("Progress imported");
              root.App.render();
            } catch (e) { root.UI.toast("That is not a valid progress file"); }
          }, text: "Import" })
        ])
      ]),

      el("h2", { text: "Settings" }),
      el("div", { class: "card" }, [
        el("label", { class: "row row-tight", style: "cursor:pointer" }, [
          el("input", { type: "checkbox", checked: s.settings.unlockAll, onchange: function (e) {
            root.Store.setUnlockAll(e.target.checked);
            root.ViewReview.reset();
            root.App.render();
          } }),
          el("span", { html: rich("**Unlock every room and card now.** Off by default: the rooms compound, and the palace only works if you climb it in order.") })
        ]),
        el("hr"),
        el("button", { class: "btn btn-bad btn-sm", onclick: function () {
          if (confirm("Erase all progress in this browser? Export first if you want a copy.")) {
            root.Store.reset();
            root.ViewReview.reset();
            root.UI.toast("Progress reset");
            root.App.go("#/tower");
          }
        }, text: "Reset all progress" })
      ])
    ]);
  }

  function renderDiagnostics() {
    var res = root.JQTests.runAll();
    var ok = res.fails.length === 0;
    var problems = root.Data.problems;

    return el("div", { class: "stack" }, [
      el("h1", { text: "Diagnostics" }),
      el("p", { class: "lede", html: rich(
        "The portal ships its own jq engine so drills run offline. It is a **curriculum-scoped subset**, " +
        "not all of jq — and it refuses unsupported constructs explicitly rather than guessing. " +
        "These are the same assertions the repo runs against the real jq binary.") }),

      el("div", { class: "card" }, [
        el("div", { class: "spread" }, [
          el("div", {}, [
            el("div", { style: "font-weight:650", text: root.JQ.VERSION }),
            el("div", { class: "muted", text: res.pass + " of " + res.total + " assertions passing" })
          ]),
          ok ? root.UI.pill("engine healthy", "good") : root.UI.pill(res.fails.length + " failing", "bad")
        ]),
        root.UI.bar(res.pass / res.total, ok ? "good" : null),
        !ok ? el("div", { class: "note note-bad", style: "margin-top:12px" },
          el("ul", {}, res.fails.map(function (f) {
            return el("li", {}, [el("b", { text: f.name }), " \u2014 ", el("span", { text: f.why })]);
          }))) : null
      ]),

      el("div", { class: "card" }, [
        el("div", { class: "spread" }, [
          el("div", { style: "font-weight:650", text: "Content integrity" }),
          problems.length ? root.UI.pill(problems.length + " problems", "bad") : root.UI.pill("valid", "good")
        ]),
        el("div", { class: "row", style: "gap:30px;margin-top:8px" }, [
          root.UI.stat(root.Data.counts.rooms, "Rooms"),
          root.UI.stat(root.Data.counts.drills, "Drills"),
          root.UI.stat(root.Data.counts.cards, "Cards")
        ]),
        problems.length ? el("div", { class: "note note-bad" },
          el("ul", {}, problems.map(function (p) { return el("li", { text: p }); }))) : null
      ]),

      el("div", { class: "card" }, [
        el("h3", { text: "What the engine supports" }),
        el("p", { class: "muted", style: "font-size:13.5px", html: rich(
          "Paths and indexing, `|`, `,`, object and array construction with interpolation, `if/elif/else/end`, " +
          "`//`, `?`, comparison and arithmetic, and these builtins: `length keys values type not empty error " +
          "tostring tonumber tojson fromjson add any all range floor ceil round min max sort sort_by group_by " +
          "unique unique_by reverse flatten first last map map_values select recurse paths leaf_paths scalars " +
          "arrays objects strings numbers nulls getpath to_entries from_entries with_entries has in contains " +
          "startswith endswith ltrimstr rtrimstr split join test ascii_downcase ascii_upcase`.") }),
        el("p", { class: "muted", style: "font-size:13.5px", html: rich(
          "Not supported, and it will tell you so: `reduce`, `foreach`, `def`, variable bindings (`as`), " +
          "path assignment (`=`, `|=`, `del`), `@base64` and friends, and the module system. " +
          "Inline regex flags like `(?i)` **are** translated, because jq's Oniguruma accepts them.") })
      ]),

      el("div", { class: "card" }, [
        el("h3", { text: "Verify it yourself" }),
        el("p", { class: "muted", html: rich("From the repository root, with jq installed:") }),
        el("pre", {}, el("code", { text: "node portal/web/js/jq/tests.js            # engine self-tests\ncd portal/web && node tools/verify-drills.js  # every drill vs real jq" })),
        el("p", { class: "muted", style: "font-size:13px", html: rich(
          "`verify-drills.js` runs each drill's reference solution through both engines and fails if they " +
          "disagree with the stated expected output. That is what stops a drill teaching a wrong answer.") })
      ])
    ]);
  }

  root.ViewProgress = { render: renderProgress, renderDiagnostics: renderDiagnostics };
})(typeof window !== "undefined" ? window : globalThis);
