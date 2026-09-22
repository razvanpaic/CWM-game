/* jqlite evaluator. Every filter maps one input value to a stream (array) of outputs. */
(function (root) {
  "use strict";
  var JQ = root.JQ;

  function rt(msg) {
    var e = new Error(msg);
    e.jqKind = "runtime";
    throw e;
  }
  function typeName(v) {
    if (v === null || v === undefined) return "null";
    if (Array.isArray(v)) return "array";
    var t = typeof v;
    if (t === "object") return "object";
    if (t === "number") return "number";
    if (t === "string") return "string";
    if (t === "boolean") return "boolean";
    return t;
  }
  function truthy(v) { return !(v === false || v === null || v === undefined); }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeName(a) !== typeName(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    if (typeName(a) === "object") {
      var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) {
        if (ka[j] !== kb[j]) return false;
        if (!deepEqual(a[ka[j]], b[ka[j]])) return false;
      }
      return true;
    }
    return false;
  }

  var ORDER = { null: 0, "false": 1, "true": 2, number: 3, string: 4, array: 5, object: 6 };
  function rank(v) {
    var t = typeName(v);
    if (t === "boolean") return v ? ORDER["true"] : ORDER["false"];
    return ORDER[t];
  }
  function compare(a, b) {
    var ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    var t = typeName(a);
    if (t === "number") return a < b ? -1 : a > b ? 1 : 0;
    if (t === "string") return a < b ? -1 : a > b ? 1 : 0;
    if (t === "array") {
      for (var i = 0; i < Math.min(a.length, b.length); i++) {
        var c = compare(a[i], b[i]);
        if (c) return c;
      }
      return a.length - b.length;
    }
    if (t === "object") {
      var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      var ck = compare(ka, kb);
      if (ck) return ck;
      for (var j = 0; j < ka.length; j++) {
        var cv = compare(a[ka[j]], b[ka[j]]);
        if (cv) return cv;
      }
      return 0;
    }
    return 0;
  }

  function getField(v, name) {
    var t = typeName(v);
    if (t === "null") return null;
    if (t !== "object") rt('cannot index ' + t + ' with "' + name + '"');
    return v[name] === undefined ? null : v[name];
  }

  function getIndex(v, idx) {
    var tv = typeName(v), ti = typeName(idx);
    if (tv === "null") return null;
    if (tv === "array") {
      if (ti !== "number") rt("cannot index array with " + ti);
      var i = idx < 0 ? v.length + idx : idx;
      return v[i] === undefined ? null : v[i];
    }
    if (tv === "object") {
      if (ti !== "string") rt("cannot index object with " + ti);
      return v[idx] === undefined ? null : v[idx];
    }
    rt("cannot index " + tv);
  }

  function iterate(v) {
    var t = typeName(v);
    if (t === "array") return v.slice();
    if (t === "object") return Object.keys(v).map(function (k) { return v[k]; });
    rt("cannot iterate over " + t);
  }

  function arith(op, a, b) {
    var ta = typeName(a), tb = typeName(b);
    if (op === "+") {
      if (ta === "null") return b;
      if (tb === "null") return a;
      if (ta === "number" && tb === "number") return a + b;
      if (ta === "string" && tb === "string") return a + b;
      if (ta === "array" && tb === "array") return a.concat(b);
      if (ta === "object" && tb === "object") {
        var o = {};
        Object.keys(a).forEach(function (k) { o[k] = a[k]; });
        Object.keys(b).forEach(function (k) { o[k] = b[k]; });
        return o;
      }
      rt(ta + " and " + tb + " cannot be added");
    }
    if (op === "-") {
      if (ta === "number" && tb === "number") return a - b;
      if (ta === "array" && tb === "array") {
        return a.filter(function (x) { return !b.some(function (y) { return deepEqual(x, y); }); });
      }
      rt(ta + " and " + tb + " cannot be subtracted");
    }
    if (ta !== "number" || tb !== "number") {
      if (op === "*" && ta === "string" && tb === "number") return b <= 0 ? null : a.repeat(b);
      if (op === "/" && ta === "string" && tb === "string") return a.split(b);
      rt(ta + " and " + tb + " cannot be combined with " + op);
    }
    if (op === "*") return a * b;
    if ((op === "/" || op === "%") && b === 0) rt(ta + " (" + JSON.stringify(a) + ") and " + tb + " (0) cannot be divided because the divisor is zero");
    if (op === "/") return a / b;
    if (op === "%") return Math.trunc(a) % Math.trunc(b);
    rt("unknown operator " + op);
  }

  /* Cartesian product across a list of streams, preserving jq's right-most-varies-fastest order. */
  function product(streams, build) {
    var out = [];
    (function walk(i, acc) {
      if (i === streams.length) { out.push(build(acc)); return; }
      for (var j = 0; j < streams[i].length; j++) walk(i + 1, acc.concat([streams[i][j]]));
    })(0, []);
    return out;
  }

  function evalNode(n, input) {
    switch (n.k) {
      case "Identity": return [input];
      case "Lit": return [n.v];
      case "Recurse": {
        var acc = [];
        (function walk(v) {
          acc.push(v);
          var t = typeName(v);
          if (t === "array") v.forEach(walk);
          else if (t === "object") Object.keys(v).forEach(function (k) { walk(v[k]); });
        })(input);
        return acc;
      }
      case "Str": {
        if (!n.parts.length) return [""];
        var streams = n.parts.map(function (part) {
          if (part.lit !== undefined) return [part.lit];
          if (!part.ast) part.ast = JQ.parse(part.expr);
          // jq interpolates non-strings as compact JSON, not pretty-printed.
          return evalNode(part.ast, input).map(function (v) {
            return typeName(v) === "string" ? v : JQ.compact(v);
          });
        });
        return product(streams, function (vals) { return vals.join(""); });
      }
      case "Field":
        return evalNode(n.of, input).map(function (v) { return getField(v, n.name); });
      case "FieldExpr": {
        var keys = evalNode(n.key, input);
        var bases = evalNode(n.of, input);
        var out = [];
        bases.forEach(function (b) { keys.forEach(function (k) { out.push(getIndex(b, k)); }); });
        return out;
      }
      case "IndexExpr": {
        var idxs = evalNode(n.idx, input);
        var bs = evalNode(n.of, input);
        var res = [];
        bs.forEach(function (b) { idxs.forEach(function (k) { res.push(getIndex(b, k)); }); });
        return res;
      }
      case "Iterate": {
        var r = [];
        evalNode(n.of, input).forEach(function (v) { r = r.concat(iterate(v)); });
        return r;
      }
      case "Pipe": {
        var o = [];
        evalNode(n.l, input).forEach(function (v) { o = o.concat(evalNode(n.r, v)); });
        return o;
      }
      case "Comma": return evalNode(n.l, input).concat(evalNode(n.r, input));
      case "Alt": {
        var keep = [];
        try { keep = evalNode(n.l, input).filter(truthy); } catch (e) { keep = []; }
        return keep.length ? keep : evalNode(n.r, input);
      }
      case "Or": {
        var res2 = [];
        evalNode(n.l, input).forEach(function (a) {
          if (truthy(a)) { res2.push(true); return; }
          evalNode(n.r, input).forEach(function (b) { res2.push(truthy(b)); });
        });
        return res2;
      }
      case "And": {
        var res3 = [];
        evalNode(n.l, input).forEach(function (a) {
          if (!truthy(a)) { res3.push(false); return; }
          evalNode(n.r, input).forEach(function (b) { res3.push(truthy(b)); });
        });
        return res3;
      }
      case "Cmp": {
        var ls = evalNode(n.l, input), rs = evalNode(n.r, input);
        var outc = [];
        ls.forEach(function (a) {
          rs.forEach(function (b) {
            if (n.op === "==") outc.push(deepEqual(a, b));
            else if (n.op === "!=") outc.push(!deepEqual(a, b));
            else {
              var c = compare(a, b);
              outc.push(n.op === "<" ? c < 0 : n.op === "<=" ? c <= 0 : n.op === ">" ? c > 0 : c >= 0);
            }
          });
        });
        return outc;
      }
      case "Arith": {
        var la = evalNode(n.l, input), ra2 = evalNode(n.r, input);
        var oa = [];
        la.forEach(function (a) { ra2.forEach(function (b) { oa.push(arith(n.op, a, b)); }); });
        return oa;
      }
      case "Neg":
        return evalNode(n.e, input).map(function (v) {
          if (typeName(v) !== "number") rt(typeName(v) + " cannot be negated");
          return -v;
        });
      case "Array": {
        if (!n.e) return [[]];
        return [evalNode(n.e, input)];
      }
      case "Object": {
        var streams2 = [];
        n.entries.forEach(function (en) {
          streams2.push(evalNode(en.key, input));
          streams2.push(evalNode(en.val, input));
        });
        return product(streams2, function (vals) {
          var o = {};
          for (var i = 0; i < vals.length; i += 2) {
            var k = vals[i];
            if (typeName(k) !== "string") rt("object keys must be strings, got " + typeName(k));
            o[k] = vals[i + 1];
          }
          return o;
        });
      }
      case "If": {
        var branches = [{ cond: n.cond, then: n.then }].concat(n.elifs);
        var outi = [];
        (function run(idx, val) {
          if (idx >= branches.length) {
            outi = outi.concat(n.else ? evalNode(n.else, val) : [val]);
            return;
          }
          evalNode(branches[idx].cond, val).forEach(function (c) {
            if (truthy(c)) outi = outi.concat(evalNode(branches[idx].then, val));
            else run(idx + 1, val);
          });
        })(0, input);
        return outi;
      }
      case "Try": {
        try { return evalNode(n.body, input); }
        catch (e) {
          if (e.jqKind === "syntax") throw e;
          if (n.handler) return evalNode(n.handler, e.message);
          return [];
        }
      }
      case "Call": return JQ.callBuiltin(n, input, evalNode);
      default: rt("unsupported expression " + n.k);
    }
  }

  JQ.evalNode = evalNode;
  JQ.helpers = {
    typeName: typeName, truthy: truthy, deepEqual: deepEqual,
    compare: compare, iterate: iterate, rt: rt, product: product
  };
})(typeof window !== "undefined" ? window : globalThis);
