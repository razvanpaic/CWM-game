/* jqlite builtins. Scoped to what the CWM curriculum uses, plus common exploration verbs.
   Anything outside this set raises a clear "not supported" error rather than guessing. */
(function (root) {
  "use strict";
  var JQ = root.JQ;
  var H;

  function one(v) { return [v]; }

  function pathsOf(input, keepFn) {
    var out = [];
    (function walk(v, path) {
      if (path.length) {
        if (!keepFn || keepFn(v)) out.push(path.slice());
      }
      var t = H.typeName(v);
      if (t === "array") v.forEach(function (x, i) { walk(x, path.concat([i])); });
      else if (t === "object") Object.keys(v).forEach(function (k) { walk(v[k], path.concat([k])); });
    })(input, []);
    return out;
  }

  function isScalar(v) {
    var t = H.typeName(v);
    return t !== "object" && t !== "array";
  }

  /* jq uses Oniguruma, which accepts inline flag groups like (?i). JavaScript's RegExp
     does not, so leading flag groups are lifted into real RegExp flags. */
  function toRegex(pat, flags) {
    var f = flags || "";
    var src = String(pat);
    var m;
    while ((m = /^\(\?([a-zA-Z]+)\)/.exec(src))) {
      for (var i = 0; i < m[1].length; i++) {
        var c = m[1][i];
        if ("ims".indexOf(c) >= 0) { if (f.indexOf(c) < 0) f += c; }
        else H.rt("inline regex flag (?" + c + ") is not supported by the portal's regex engine");
      }
      src = src.slice(m[0].length);
    }
    try { return new RegExp(src, f); }
    catch (e) { H.rt("invalid regular expression: " + pat); }
  }

  function callBuiltin(node, input, ev) {
    H = JQ.helpers;
    var name = node.name;
    var args = node.args || [];
    var argc = args.length;

    function argStream(i) { return ev(args[i], input); }
    function arg1(i) {
      var s = argStream(i);
      if (!s.length) H.rt(name + " argument produced no value");
      return s[0];
    }
    function need(n) {
      if (argc !== n) H.rt(name + "/" + argc + " is not supported (expected " + name + "/" + n + ")");
    }

    switch (name) {
      case "empty": need(0); return [];
      case "error":
        if (argc === 0) H.rt(H.typeName(input) === "string" ? input : JQ.stringify(input));
        H.rt(String(arg1(0)));
        return [];
      case "not": need(0); return one(!H.truthy(input));
      case "type": need(0); return one(H.typeName(input));
      case "length": {
        need(0);
        var t = H.typeName(input);
        if (t === "null") return one(0);
        if (t === "string") return one(Array.from(input).length);
        if (t === "array") return one(input.length);
        if (t === "object") return one(Object.keys(input).length);
        if (t === "number") return one(Math.abs(input));
        H.rt(t + " has no length");
        break;
      }
      case "utf8bytelength": need(0); return one(unescape(encodeURIComponent(String(input))).length);
      case "keys":
      case "keys_unsorted": {
        need(0);
        var tk = H.typeName(input);
        if (tk === "object") {
          var ks = Object.keys(input);
          return one(name === "keys" ? ks.sort() : ks);
        }
        if (tk === "array") return one(input.map(function (_, i) { return i; }));
        H.rt(tk + " has no keys");
        break;
      }
      case "values": need(0); return H.truthy(input) ? one(input) : [];
      case "has": need(1); {
        var hk = arg1(0);
        var th = H.typeName(input);
        if (th === "object") return one(Object.prototype.hasOwnProperty.call(input, hk));
        if (th === "array") return one(hk >= 0 && hk < input.length);
        H.rt("cannot check whether " + th + " has a key");
        break;
      }
      case "in": need(1); return one(Object.prototype.hasOwnProperty.call(arg1(0), input));
      case "contains": need(1); {
        var cv = arg1(0);
        if (H.typeName(input) === "string" && H.typeName(cv) === "string") return one(input.indexOf(cv) >= 0);
        if (H.typeName(input) === "array") return one(cv.every(function (x) {
          return input.some(function (y) { return H.deepEqual(x, y); });
        }));
        H.rt("contains is only supported on strings and arrays here");
        break;
      }
      case "tostring": need(0); return one(H.typeName(input) === "string" ? input : JQ.compact(input));
      case "tonumber": {
        need(0);
        if (H.typeName(input) === "number") return one(input);
        var num = Number(input);
        if (isNaN(num)) H.rt("cannot parse " + JSON.stringify(input) + " as a number");
        return one(num);
      }
      case "tojson": need(0); return one(JQ.compact(input));
      case "fromjson": need(0); try { return one(JSON.parse(input)); } catch (e) { H.rt("invalid JSON text"); } break;
      case "ascii_downcase": need(0); return one(String(input).toLowerCase());
      case "ascii_upcase": need(0); return one(String(input).toUpperCase());
      case "ltrimstr": need(1); { var l = arg1(0); return one(typeof input === "string" && input.indexOf(l) === 0 ? input.slice(l.length) : input); }
      case "rtrimstr": need(1); { var r0 = arg1(0); return one(typeof input === "string" && input.slice(-r0.length) === r0 ? input.slice(0, -r0.length) : input); }
      case "startswith": need(1); return one(String(input).indexOf(arg1(0)) === 0);
      case "endswith": need(1); { var s1 = arg1(0); return one(String(input).slice(-s1.length) === s1); }
      case "split": need(1); {
        if (H.typeName(input) !== "string") H.rt("split input must be a string");
        return one(input.split(arg1(0)));
      }
      case "join": need(1); {
        var sep = arg1(0);
        if (H.typeName(input) !== "array") H.rt("join input must be an array");
        return one(input.map(function (v) {
          if (v === null || v === undefined) return "";
          return H.typeName(v) === "string" ? v : JQ.compact(v);
        }).join(sep));
      }
      case "test": {
        if (argc < 1 || argc > 2) H.rt("test expects 1 or 2 arguments");
        return one(toRegex(arg1(0), argc === 2 ? arg1(1) : "").test(String(input)));
      }
      case "add": {
        need(0);
        var items = H.typeName(input) === "object" ? H.iterate(input) : input;
        if (!Array.isArray(items)) H.rt("add input must be an array or object");
        if (!items.length) return one(null);
        return one(items.reduce(function (a, b) {
          return JQ.evalNode({ k: "Arith", op: "+", l: { k: "Lit", v: a }, r: { k: "Lit", v: b } }, null)[0];
        }));
      }
      case "any":
      case "all": {
        var vals;
        if (argc === 0) vals = input;
        else if (argc === 1) vals = input.map(function (x) { return ev(args[0], x); }).reduce(function (a, b) { return a.concat(b); }, []);
        else H.rt(name + "/2 is not supported");
        var pred = name === "any"
          ? vals.some(function (v) { return H.truthy(v); })
          : vals.every(function (v) { return H.truthy(v); });
        return one(pred);
      }
      case "range": {
        var from = 0, upto, by = 1;
        if (argc === 1) upto = arg1(0);
        else if (argc === 2) { from = arg1(0); upto = arg1(1); }
        else if (argc === 3) { from = arg1(0); upto = arg1(1); by = arg1(2); }
        else H.rt("range expects 1 to 3 arguments");
        var outr = [];
        if (by > 0) for (var i = from; i < upto; i += by) outr.push(i);
        else if (by < 0) for (var j = from; j > upto; j += by) outr.push(j);
        return outr;
      }
      case "floor": need(0); return one(Math.floor(input));
      case "ceil": need(0); return one(Math.ceil(input));
      case "round": need(0); return one(Math.round(input));
      case "fabs": need(0); return one(Math.abs(input));
      case "sqrt": need(0); return one(Math.sqrt(input));
      case "min": need(0); return one(!input.length ? null : input.slice().sort(H.compare)[0]);
      case "max": need(0); return one(!input.length ? null : input.slice().sort(H.compare)[input.length - 1]);
      case "sort": need(0); {
        if (H.typeName(input) !== "array") H.rt("sort input must be an array");
        return one(input.slice().sort(H.compare));
      }
      case "sort_by": need(1); {
        var keyed = input.map(function (x) { return { x: x, k: ev(args[0], x) }; });
        keyed.sort(function (a, b) { return H.compare(a.k, b.k); });
        return one(keyed.map(function (e) { return e.x; }));
      }
      case "group_by": need(1); {
        var kg = input.map(function (x) { return { x: x, k: ev(args[0], x)[0] }; });
        kg.sort(function (a, b) { return H.compare(a.k, b.k); });
        var groups = [], cur = null, curKey;
        kg.forEach(function (e) {
          if (cur === null || !H.deepEqual(e.k, curKey)) { cur = []; curKey = e.k; groups.push(cur); }
          cur.push(e.x);
        });
        return one(groups);
      }
      case "unique": need(0); {
        var su = input.slice().sort(H.compare), uo = [];
        su.forEach(function (v) { if (!uo.length || !H.deepEqual(uo[uo.length - 1], v)) uo.push(v); });
        return one(uo);
      }
      case "unique_by": need(1); {
        var ku = input.map(function (x) { return { x: x, k: ev(args[0], x)[0] }; });
        ku.sort(function (a, b) { return H.compare(a.k, b.k); });
        var res = [], lastK;
        ku.forEach(function (e, i) { if (i === 0 || !H.deepEqual(lastK, e.k)) { res.push(e.x); lastK = e.k; } });
        return one(res);
      }
      case "reverse": need(0); {
        if (H.typeName(input) === "string") return one(Array.from(input).reverse().join(""));
        return one((input || []).slice().reverse());
      }
      case "flatten": need(0); {
        var depth = 1e9;
        return one((function fl(a, d) {
          return a.reduce(function (acc, v) {
            return acc.concat(Array.isArray(v) && d > 0 ? fl(v, d - 1) : [v]);
          }, []);
        })(input, depth));
      }
      case "first": {
        if (argc === 0) return one(H.typeName(input) === "array" ? (input.length ? input[0] : null) : H.rt("first input must be an array"));
        var fs = ev(args[0], input);
        return fs.length ? [fs[0]] : [];
      }
      case "last": {
        if (argc === 0) return one(H.typeName(input) === "array" ? (input.length ? input[input.length - 1] : null) : H.rt("last input must be an array"));
        var ls = ev(args[0], input);
        return ls.length ? [ls[ls.length - 1]] : [];
      }
      case "map": need(1); {
        if (H.typeName(input) !== "array" && H.typeName(input) !== "object") H.rt("map input must be an array");
        var src = H.typeName(input) === "object" ? H.iterate(input) : input;
        var acc = [];
        src.forEach(function (x) { acc = acc.concat(ev(args[0], x)); });
        return one(acc);
      }
      case "map_values": need(1); {
        if (H.typeName(input) === "array") {
          return one(input.map(function (x) { return ev(args[0], x); })
            .filter(function (s) { return s.length; }).map(function (s) { return s[0]; }));
        }
        var mo = {};
        Object.keys(input).forEach(function (k) {
          var s = ev(args[0], input[k]);
          if (s.length) mo[k] = s[0];
        });
        return one(mo);
      }
      case "select": need(1); {
        var outSel = [];
        ev(args[0], input).forEach(function (c) { if (H.truthy(c)) outSel.push(input); });
        return outSel;
      }
      case "recurse": {
        if (argc === 0) return JQ.evalNode({ k: "Recurse" }, input);
        var accR = [];
        (function walk(v) {
          accR.push(v);
          var next = [];
          try { next = ev(args[0], v); } catch (e) { next = []; }
          next.forEach(function (x) { if (x !== null && x !== undefined) walk(x); });
        })(input);
        return accR;
      }
      case "paths": {
        if (argc === 0) return pathsOf(input, null);
        if (argc === 1) {
          return pathsOf(input, function (v) {
            var s = [];
            try { s = ev(args[0], v); } catch (e) { return false; }
            return s.some(function (x) { return H.truthy(x); });
          });
        }
        H.rt("paths expects 0 or 1 arguments");
        break;
      }
      case "leaf_paths": need(0); return pathsOf(input, isScalar);
      case "scalars": need(0); return isScalar(input) ? one(input) : [];
      case "arrays": need(0); return H.typeName(input) === "array" ? one(input) : [];
      case "objects": need(0); return H.typeName(input) === "object" ? one(input) : [];
      case "strings": need(0); return H.typeName(input) === "string" ? one(input) : [];
      case "numbers": need(0); return H.typeName(input) === "number" ? one(input) : [];
      case "nulls": need(0); return input === null ? one(null) : [];
      case "getpath": need(1); {
        var gp = arg1(0), cv2 = input;
        for (var gi = 0; gi < gp.length; gi++) {
          if (cv2 === null || cv2 === undefined) return one(null);
          cv2 = cv2[gp[gi]];
        }
        return one(cv2 === undefined ? null : cv2);
      }
      case "to_entries": need(0);
        return one(Object.keys(input).map(function (k) { return { key: k, value: input[k] }; }));
      case "from_entries": need(0); {
        var fo = {};
        input.forEach(function (e) {
          var k = e.key !== undefined ? e.key : (e.k !== undefined ? e.k : e.name);
          var v = e.value !== undefined ? e.value : (e.v !== undefined ? e.v : null);
          fo[H.typeName(k) === "string" ? k : JQ.compact(k)] = v;
        });
        return one(fo);
      }
      case "with_entries": need(1); {
        var ent = Object.keys(input).map(function (k) { return { key: k, value: input[k] }; });
        var mapped = [];
        ent.forEach(function (e) { mapped = mapped.concat(ev(args[0], e)); });
        var wo = {};
        mapped.forEach(function (e) { wo[e.key] = e.value; });
        return one(wo);
      }
      case "del": need(1); {
        var toDel = ev(args[0], input);
        H.rt("del is not supported in this portal's jq subset");
        return toDel;
      }
      case "env":
      case "input":
      case "inputs":
      case "debug":
      case "input_line_number":
        H.rt(name + " is not available in the portal (there is no input stream or environment)");
        break;
      default:
        H.rt('"' + name + '" is not part of the portal\'s jq subset. Supported: length, keys, type, select, map, add, join, split, test, tostring, tonumber, has, any, all, sort, sort_by, group_by, unique, reverse, flatten, first, last, range, floor, min, max, to_entries, from_entries, with_entries, paths, scalars, empty, not, recurse, contains, startswith, endswith, ascii_downcase, ascii_upcase.');
    }
    return [];
  }

  JQ.callBuiltin = callBuiltin;
})(typeof window !== "undefined" ? window : globalThis);
