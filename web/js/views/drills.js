/* Drill renderers. Each returns a card and reports success back through onSolved(). */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  function shell(d, bodyNodes, solvedAlready) {
    var head = el("div", { class: "drill-head" }, [
      el("div", { class: "spread" }, [
        el("div", { class: "t", html: rich(d.title) }),
        solvedAlready ? root.UI.pill("solved", "good") : root.UI.pill(LABEL[d.type] || d.type)
      ]),
      d.prompt ? el("div", { class: "muted", style: "margin-top:5px;font-size:14px", html: rich(d.prompt) }) : null
    ]);
    return el("div", { class: "drill" + (solvedAlready ? " solved" : ""), "data-drill": d.id },
      [head, el("div", { class: "drill-body" }, bodyNodes)]);
  }

  var LABEL = { jq: "run it", predict: "predict", order: "sequence", match: "match", classify: "sort" };

  function verdict(node, ok, msg) {
    node.className = "verdict " + (ok ? "ok" : "no");
    node.innerHTML = rich(msg);
  }

  function whyBlock(d) {
    return d.why ? el("div", { class: "note note-accent", style: "margin:14px 0 0", html: rich(d.why) }) : null;
  }

  /* ---------- live jq drill ---------- */
  function jqDrill(d, solved, onSolved) {
    var tries = 0;
    var inputText = JSON.stringify(d.input === undefined ? null : d.input, null, 2);
    var opts = d.opts || {};

    var filterBox = el("textarea", { rows: 2, spellcheck: "false", placeholder: "your filter, e.g.  .hostname",
      "aria-label": "jq filter" });
    var outBox = el("pre", { class: "" , text: "" });
    var vNode = el("div", { class: "verdict", hidden: true });
    var whyNode = whyBlock(d);
    if (whyNode) whyNode.hidden = !solved;

    var rawToggle = el("label", { class: "muted", style: "font-size:11px;display:flex;gap:5px;align-items:center;cursor:pointer" }, [
      el("input", { type: "checkbox", checked: !!opts.raw, onchange: function () { run(); } }), "raw (-r)"
    ]);
    var compactToggle = el("label", { class: "muted", style: "font-size:11px;display:flex;gap:5px;align-items:center;cursor:pointer" }, [
      el("input", { type: "checkbox", checked: !!opts.compact, onchange: function () { run(); } }), "compact (-c)"
    ]);

    function currentOpts() {
      return { raw: rawToggle.querySelector("input").checked, compact: compactToggle.querySelector("input").checked };
    }

    function run() {
      var filter = filterBox.value.trim();
      if (!filter) { outBox.textContent = ""; outBox.className = ""; return null; }
      var parsed = root.JQ.parseInput(inputBox.value);
      if (!parsed.ok) { outBox.className = "err"; outBox.textContent = parsed.error; return null; }
      var r = root.JQ.run(filter, parsed.value, currentOpts());
      if (!r.ok) {
        outBox.className = "err";
        outBox.textContent = (r.kind === "syntax" ? "syntax error: " : "error: ") + r.error;
        return null;
      }
      outBox.className = "ok";
      outBox.textContent = r.text === "" ? "(no output)" : r.text;
      return r.text;
    }

    function check() {
      var text = run();
      if (text === null) {
        vNode.hidden = false;
        verdict(vNode, false, "Fix the filter first — the output pane shows what went wrong.");
        return;
      }
      tries++;
      vNode.hidden = false;
      if (text === d.expect) {
        verdict(vNode, true, "**Correct.** That is exactly the expected output.");
        if (whyNode) whyNode.hidden = false;
        onSolved(tries === 1);
      } else {
        verdict(vNode, false, "Not yet. Your output differs from the target — compare them line by line." +
          (tries >= 2 ? " Try the hint, or reveal the solution." : ""));
      }
    }

    var inputBox = el("textarea", { rows: Math.min(14, inputText.split("\n").length), spellcheck: "false",
      "aria-label": "JSON input", text: inputText });

    var hintNode = d.hint ? el("div", { class: "note", hidden: true, html: rich("**Hint.** " + d.hint) }) : null;
    var solNode = el("div", { class: "note note-good", hidden: true });

    var controls = el("div", { class: "row row-tight", style: "margin-top:12px" }, [
      el("button", { class: "btn btn-primary btn-sm", onclick: check, text: "Run and check" }),
      el("button", { class: "btn btn-sm", onclick: run, text: "Run only" }),
      hintNode ? el("button", { class: "btn btn-ghost btn-sm", onclick: function () { hintNode.hidden = !hintNode.hidden; }, text: "Hint" }) : null,
      el("button", { class: "btn btn-ghost btn-sm", onclick: function () {
        solNode.hidden = false;
        solNode.innerHTML = rich("**Reference solution.** `" + d.solution + "`");
        filterBox.value = d.solution;
        run();
      }, text: "Reveal solution" }),
      el("span", { style: "flex:1" }),
      rawToggle, compactToggle
    ]);

    var body = [
      el("div", { class: "grid grid-2" }, [
        el("div", { class: "term" }, [el("div", { class: "term-label" }, ["input (editable)"]), inputBox]),
        el("div", { class: "term" }, [
          el("div", { class: "term-label" }, ["target output"]),
          el("pre", { text: d.expect })
        ])
      ]),
      el("div", { class: "term", style: "margin-top:12px" }, [
        el("div", { class: "term-label" }, ["filter"]), filterBox
      ]),
      el("div", { class: "term", style: "margin-top:10px" }, [
        el("div", { class: "term-label" }, ["your output"]), outBox
      ]),
      controls,
      hintNode, solNode, vNode, whyNode
    ];

    if (d.after) {
      body.push(el("div", { class: "note", style: "margin-top:12px" }, [
        el("span", { html: rich("**Then try this.** " + d.after.note + " ") }),
        el("button", { class: "btn btn-sm", style: "margin-left:6px", onclick: function () {
          inputBox.value = JSON.stringify(d.after.input, null, 2);
          run();
        }, text: "Swap the input" })
      ]));
    }

    filterBox.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); check(); }
    });

    if (solved) { filterBox.value = d.solution; run(); }
    return shell(d, body, solved);
  }

  /* ---------- multiple choice ---------- */
  function predictDrill(d, solved, onSolved) {
    var vNode = el("div", { class: "verdict", hidden: true });
    var whyNode = whyBlock(d);
    if (whyNode) whyNode.hidden = !solved;
    var tries = 0;
    var buttons = [];

    d.choices.forEach(function (c, i) {
      var b = el("button", { class: "choice", type: "button", html: rich(c), onclick: function () {
        if (b.disabled) return;
        tries++;
        if (i === d.answer) {
          b.classList.add("right");
          buttons.forEach(function (x) { x.disabled = true; });
          vNode.hidden = false;
          verdict(vNode, true, tries === 1 ? "**Correct, first time.**" : "**Correct.**");
          if (whyNode) whyNode.hidden = false;
          onSolved(tries === 1);
        } else {
          b.classList.add("wrong");
          b.disabled = true;
          vNode.hidden = false;
          verdict(vNode, false, "Not that one. Read the remaining options again — one of them is doing something the others are not.");
        }
      } });
      buttons.push(b);
    });

    if (solved) {
      buttons.forEach(function (b, i) { b.disabled = true; if (i === d.answer) b.classList.add("right"); });
    }
    return shell(d, [el("div", {}, buttons), vNode, whyNode], solved);
  }

  /* ---------- put in order ---------- */
  function orderDrill(d, solved, onSolved) {
    var current = solved ? d.items.slice() : d.shuffled.slice();
    var vNode = el("div", { class: "verdict", hidden: true });
    var whyNode = whyBlock(d);
    if (whyNode) whyNode.hidden = !solved;
    var list = el("div", { class: "order-list" });
    var tries = 0;

    function move(i, delta) {
      var j = i + delta;
      if (j < 0 || j >= current.length) return;
      var t = current[i]; current[i] = current[j]; current[j] = t;
      draw();
    }

    function draw() {
      root.UI.clear(list);
      current.forEach(function (item, i) {
        list.appendChild(el("div", { class: "order-item" }, [
          el("span", { class: "ix", text: String(i + 1) }),
          el("span", { html: rich(item) }),
          el("span", { class: "mv" }, [
            el("button", { class: "btn btn-sm btn-ghost", disabled: i === 0 || solved, title: "Move up",
              onclick: function () { move(i, -1); }, text: "\u2191" }),
            el("button", { class: "btn btn-sm btn-ghost", disabled: i === current.length - 1 || solved, title: "Move down",
              onclick: function () { move(i, 1); }, text: "\u2193" })
          ]),
          el("span", {})
        ]));
      });
    }
    draw();

    function check() {
      tries++;
      var ok = current.every(function (x, i) { return x === d.items[i]; });
      vNode.hidden = false;
      if (ok) {
        verdict(vNode, true, "**Correct order.**");
        if (whyNode) whyNode.hidden = false;
        onSolved(tries === 1);
      } else {
        var right = current.filter(function (x, i) { return x === d.items[i]; }).length;
        verdict(vNode, false, right + " of " + current.length + " are in the right position.");
      }
    }

    return shell(d, [
      list,
      solved ? null : el("div", { class: "row row-tight", style: "margin-top:12px" },
        el("button", { class: "btn btn-primary btn-sm", onclick: check, text: "Check order" })),
      vNode, whyNode
    ], solved);
  }

  /* ---------- match pairs ---------- */
  function matchDrill(d, solved, onSolved) {
    var vNode = el("div", { class: "verdict", hidden: true });
    var whyNode = whyBlock(d);
    if (whyNode) whyNode.hidden = !solved;
    var lefts = d.pairs.map(function (p) { return p[0]; });
    var rights = d.pairs.map(function (p) { return p[1]; });
    var shuffledRights = rights.slice().sort(function (a, b) { return a.length === b.length ? (a < b ? -1 : 1) : a.length - b.length; });
    var pickedLeft = null, done = 0, mistakes = 0;
    var leftBtns = {}, rightBtns = {};

    function nodeFor(text, side) {
      var b = el("button", { class: "match-item", type: "button", html: rich(text), onclick: function () {
        if (b.classList.contains("done")) return;
        if (side === "l") {
          Object.keys(leftBtns).forEach(function (k) { leftBtns[k].classList.remove("sel"); });
          pickedLeft = text; b.classList.add("sel");
          return;
        }
        if (pickedLeft === null) return;
        var want = d.pairs.filter(function (p) { return p[0] === pickedLeft; })[0][1];
        if (want === text) {
          leftBtns[pickedLeft].classList.remove("sel");
          leftBtns[pickedLeft].classList.add("done");
          b.classList.add("done");
          pickedLeft = null;
          done++;
          if (done === d.pairs.length) {
            vNode.hidden = false;
            verdict(vNode, true, mistakes === 0 ? "**All matched, no mistakes.**" : "**All matched.**");
            if (whyNode) whyNode.hidden = false;
            onSolved(mistakes === 0);
          }
        } else {
          mistakes++;
          b.classList.add("nope");
          setTimeout(function () { b.classList.remove("nope"); }, 550);
          vNode.hidden = false;
          verdict(vNode, false, "Not a pair. Try again.");
        }
      } });
      return b;
    }

    lefts.forEach(function (t) { leftBtns[t] = nodeFor(t, "l"); });
    shuffledRights.forEach(function (t) { rightBtns[t] = nodeFor(t, "r"); });

    if (solved) {
      Object.keys(leftBtns).forEach(function (k) { leftBtns[k].classList.add("done"); });
      Object.keys(rightBtns).forEach(function (k) { rightBtns[k].classList.add("done"); });
    }

    return shell(d, [
      el("div", { class: "match-grid" }, [
        el("div", { class: "match-col" }, lefts.map(function (t) { return leftBtns[t]; })),
        el("div", { class: "match-col" }, shuffledRights.map(function (t) { return rightBtns[t]; }))
      ]),
      el("small", { style: "display:block;margin-top:9px", text: "Click one on the left, then its partner on the right." }),
      vNode, whyNode
    ], solved);
  }

  /* ---------- sort into buckets ---------- */
  function classifyDrill(d, solved, onSolved) {
    var vNode = el("div", { class: "verdict", hidden: true });
    var whyNode = whyBlock(d);
    if (whyNode) whyNode.hidden = !solved;
    var placed = {}, mistakes = 0, done = 0;
    var rows = [];

    d.items.forEach(function (item, i) {
      var btns = d.buckets.map(function (bucket) {
        return el("button", { class: "btn btn-sm", type: "button", text: bucket, onclick: function () {
          if (placed[i]) return;
          if (bucket === item.bucket) {
            placed[i] = true;
            done++;
            row.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
            row.classList.add("solved-row");
            tag.textContent = bucket;
            tag.className = "pill pill-good";
            if (done === d.items.length) {
              vNode.hidden = false;
              verdict(vNode, true, mistakes === 0 ? "**All sorted, no mistakes.**" : "**All sorted.**");
              if (whyNode) whyNode.hidden = false;
              onSolved(mistakes === 0);
            }
          } else {
            mistakes++;
            vNode.hidden = false;
            verdict(vNode, false, "Not that bucket.");
          }
        } });
      });
      var tag = solved ? el("span", { class: "pill pill-good", text: item.bucket }) : el("span", {});
      var row = el("div", { class: "order-item", style: "grid-template-columns:1fr auto auto" }, [
        el("span", { html: rich(item.text) }),
        el("span", { class: "row row-tight" }, solved ? [] : btns),
        tag
      ]);
      rows.push(row);
    });

    return shell(d, [
      el("div", { class: "order-list" }, rows),
      el("small", { style: "display:block;margin-top:9px", text: "Pick the bucket each item belongs in." }),
      vNode, whyNode
    ], solved);
  }

  var RENDER = { jq: jqDrill, predict: predictDrill, order: orderDrill, match: matchDrill, classify: classifyDrill };

  function render(d, roomN, onProgress) {
    var st = root.Store.room(roomN);
    var solved = !!st.drills[d.id];
    var fn = RENDER[d.type];
    if (!fn) return el("div", { class: "note note-bad", text: "Unknown drill type: " + d.type });
    return fn(d, solved, function (firstTry) {
      root.Store.markDrill(roomN, d.id, firstTry);
      if (onProgress) onProgress();
    });
  }

  root.Drills = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
