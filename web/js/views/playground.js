/* Free jq playground, preloaded with the repo's real workflow definitions. */
(function (root) {
  "use strict";
  var el = root.UI.el, rich = root.UI.rich;

  var state = { filter: ".states[].name", sample: "setHostname", raw: true, compact: false, input: null };

  var SAMPLE_LABELS = {
    setHostname: "set-hostname.sw.json",
    clearVty: "clear-vty-sessions.sw.json",
    hostnameForm: "set-hostname.form.json",
    hostnameInput: "set-hostname input example",
    vtyInput: "clear-vty input example"
  };

  var RECIPES = [
    ["Skeleton of any workflow", "{id, version, specVersion, start, stateCount: (.states|length)}", false],
    ["Execution order", '.states[] | "\\(.name) --> \\(.transition // "END")"', true],
    ["Shape-tolerant execution order", '.states[] | "\\(.name) --> \\(if .transition|type=="object" then .transition.nextState else (.transition // "END") end)"', true],
    ["State types", '.states[] | "\\(.name): \\(.type)"', true],
    ["Adapter operations required", "[.functions[].operation] | unique", false],
    ["Workers referenced", "[.functions[].metadata.worker] | unique", false],
    ["Every jq expression in the file", '[paths(scalars) as $p | getpath($p) | select(type=="string" and test("\\\\$\\\\{"))] | unique', false],
    ["Credential-shaped keys (should be empty)", '[paths(scalars) | map(tostring) | join(".")] | map(select(test("(?i)password|secret|token")))', false],
    ["Retry policies", ".retries", false],
    ["All leaf paths", "[paths(scalars) | map(tostring) | join(\".\")]", false]
  ];

  function render() {
    var input = state.input === null ? JSON.stringify(root.Data.samples[state.sample], null, 2) : state.input;

    var filterBox = el("textarea", { rows: 3, spellcheck: "false", text: state.filter, "aria-label": "jq filter" });
    var inputBox = el("textarea", { rows: 20, spellcheck: "false", text: input, "aria-label": "JSON input" });
    var outBox = el("pre", { text: "" });

    function run() {
      state.filter = filterBox.value;
      state.input = inputBox.value;
      var parsed = root.JQ.parseInput(inputBox.value);
      if (!parsed.ok) { outBox.className = "err"; outBox.textContent = parsed.error; return; }
      if (!state.filter.trim()) { outBox.className = ""; outBox.textContent = ""; return; }
      var r = root.JQ.run(state.filter, parsed.value, { raw: state.raw, compact: state.compact });
      if (!r.ok) {
        outBox.className = "err";
        outBox.textContent = (r.kind === "syntax" ? "syntax error: " : "error: ") + r.error;
        return;
      }
      outBox.className = "ok";
      outBox.textContent = r.text === "" ? "(no output)" :
        r.text + "\n\n" + "\u2014 " + r.values.length + " result" + (r.values.length === 1 ? "" : "s");
    }

    filterBox.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    });

    var sampleSelect = el("select", {
      class: "btn btn-sm",
      onchange: function (e) { state.sample = e.target.value; state.input = null; root.App.render(); }
    }, Object.keys(SAMPLE_LABELS).map(function (k) {
      return el("option", { value: k, selected: k === state.sample, text: SAMPLE_LABELS[k] });
    }));

    var rawCb = el("input", { type: "checkbox", checked: state.raw, onchange: function (e) { state.raw = e.target.checked; run(); } });
    var compactCb = el("input", { type: "checkbox", checked: state.compact, onchange: function (e) { state.compact = e.target.checked; run(); } });

    var recipeList = el("div", { class: "stack", style: "gap:5px" }, RECIPES.map(function (r) {
      return el("button", {
        class: "choice", type: "button",
        onclick: function () { filterBox.value = r[1]; state.raw = r[2]; rawCb.checked = r[2]; run(); }
      }, [
        el("div", { style: "font-weight:600;font-size:13px", text: r[0] }),
        el("code", { style: "font-size:11.5px;display:block;margin-top:3px;white-space:pre-wrap", text: r[1] })
      ]);
    }));

    setTimeout(run, 0);

    return el("div", { class: "stack" }, [
      el("h1", { text: "jq playground" }),
      el("p", { class: "lede", html: rich(
        "The real workflow definitions from this repo, and a real jq engine. Nothing leaves your machine. " +
        "Press <kbd>\u2318</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run.") }),
      el("div", { class: "grid", style: "grid-template-columns:1fr 320px;gap:18px;align-items:start" }, [
        el("div", { class: "stack" }, [
          el("div", { class: "row row-tight" }, [
            el("span", { class: "muted", style: "font-size:12px", text: "sample:" }), sampleSelect,
            el("button", { class: "btn btn-sm", onclick: function () { state.input = null; root.App.render(); }, text: "Reset input" }),
            el("span", { style: "flex:1" }),
            el("label", { class: "muted", style: "font-size:12px;display:flex;gap:5px;align-items:center" }, [rawCb, "raw"]),
            el("label", { class: "muted", style: "font-size:12px;display:flex;gap:5px;align-items:center" }, [compactCb, "compact"])
          ]),
          el("div", { class: "term" }, [el("div", { class: "term-label" }, ["filter"]), filterBox]),
          el("div", { class: "row row-tight" }, [
            el("button", { class: "btn btn-primary btn-sm", onclick: run, text: "Run" }),
            el("small", { text: root.JQ.VERSION })
          ]),
          el("div", { class: "term" }, [el("div", { class: "term-label" }, ["output"]), outBox]),
          el("div", { class: "term" }, [el("div", { class: "term-label" }, ["input JSON (editable)"]), inputBox])
        ]),
        el("div", { class: "stack" }, [
          el("h3", { text: "Recipes worth knowing" }),
          el("small", { text: "Click to load. These are the commands worth running against any unfamiliar workflow." }),
          recipeList,
          el("div", { class: "note", style: "font-size:13px", html: rich(
            "This engine is a **curriculum-scoped subset** of jq, verified byte-for-byte against real jq on every " +
            "drill in the tower. Anything outside the subset says so explicitly rather than guessing — " +
            "see <a href='#/diagnostics'>Diagnostics</a>.") })
        ])
      ])
    ]);
  }

  root.ViewPlayground = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
