/* jqlite public API. jqlite is a deliberately small subset of jq, sized to this curriculum.
   It never guesses: an unsupported construct raises an explicit error. */
(function (root) {
  "use strict";
  var JQ = root.JQ;

  /* jq-compatible pretty printer: 2-space indent, keys in insertion order. */
  function stringify(v, indent) {
    if (v === undefined) v = null;
    return render(v, "", indent === undefined ? 2 : indent);
  }

  function render(v, pad, step) {
    if (v === null) return "null";
    var t = typeof v;
    if (t === "boolean" || t === "number") return String(v);
    if (t === "string") return JSON.stringify(v);
    var inner = pad + " ".repeat(step);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      var items = v.map(function (x) { return inner + render(x, inner, step); });
      return "[\n" + items.join(",\n") + "\n" + pad + "]";
    }
    var keys = Object.keys(v);
    if (!keys.length) return "{}";
    var entries = keys.map(function (k) {
      return inner + JSON.stringify(k) + ": " + render(v[k], inner, step);
    });
    return "{\n" + entries.join(",\n") + "\n" + pad + "}";
  }

  function compact(v) {
    if (v === undefined) v = null;
    return JSON.stringify(v);
  }

  /* Formats a result stream the way the jq CLI would print it. */
  function format(values, opts) {
    opts = opts || {};
    return values.map(function (v) {
      if (opts.raw && typeof v === "string") return v;
      return opts.compact ? compact(v) : stringify(v);
    }).join("\n");
  }

  /* run(filter, input, opts) -> { ok, values, text } | { ok:false, error, kind } */
  function run(filter, input, opts) {
    opts = opts || {};
    var ast;
    try { ast = JQ.parse(filter); }
    catch (e) { return { ok: false, error: e.message, kind: "syntax" }; }
    try {
      var values = JQ.evalNode(ast, input === undefined ? null : input);
      return { ok: true, values: values, text: format(values, opts) };
    } catch (e) {
      return { ok: false, error: e.message, kind: e.jqKind || "runtime" };
    }
  }

  /* Parses the text a learner typed into the input pane. */
  function parseInput(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(trimmed) }; }
    catch (e) { return { ok: false, error: "Input is not valid JSON: " + e.message }; }
  }

  JQ.stringify = stringify;
  JQ.compact = compact;
  JQ.format = format;
  JQ.run = run;
  JQ.parseInput = parseInput;
  JQ.VERSION = "jqlite 1.0 (curriculum subset)";
})(typeof window !== "undefined" ? window : globalThis);
