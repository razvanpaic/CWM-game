// jqlite parser. Precedence, lowest first:
//   pipe, comma, alternative, or, and, comparison, additive, multiplicative, unary, postfix.
(function (root) {
  "use strict";
  var JQ = root.JQ;

  function parse(src) {
    var toks = JQ.tokenize(src);
    var p = 0;

    function peek() { return toks[p]; }
    function at(t) { return toks[p].t === t; }
    function eat(t) { if (at(t)) { return toks[p++]; } return null; }
    function expect(t, what) {
      if (at(t)) return toks[p++];
      fail("expected " + (what || t) + " but found " + describe(toks[p]));
    }
    function describe(tk) {
      if (tk.t === "eof") return "end of filter";
      if (tk.t === "ident" || tk.t === "num") return String(tk.v);
      if (tk.t === "str") return "a string";
      return "'" + tk.t + "'";
    }
    function fail(msg) {
      var e = new Error(msg);
      e.jqKind = "syntax";
      e.jqPos = toks[p] ? toks[p].pos : 0;
      throw e;
    }

    function parsePipe() {
      var l = parseComma();
      while (eat("|")) l = { k: "Pipe", l: l, r: parseComma() };
      return l;
    }
    function parseComma() {
      var l = parseAlt();
      while (eat(",")) l = { k: "Comma", l: l, r: parseAlt() };
      return l;
    }
    function parseAlt() {
      var l = parseOr();
      while (eat("//")) l = { k: "Alt", l: l, r: parseOr() };
      return l;
    }
    function parseOr() {
      var l = parseAnd();
      while (eat("or")) l = { k: "Or", l: l, r: parseAnd() };
      return l;
    }
    function parseAnd() {
      var l = parseCmp();
      while (eat("and")) l = { k: "And", l: l, r: parseCmp() };
      return l;
    }
    function parseCmp() {
      var l = parseAdd();
      var ops = ["==", "!=", "<", "<=", ">", ">="];
      while (ops.indexOf(peek().t) >= 0) {
        var op = toks[p++].t;
        l = { k: "Cmp", op: op, l: l, r: parseAdd() };
      }
      return l;
    }
    function parseAdd() {
      var l = parseMul();
      while (at("+") || at("-")) {
        var op = toks[p++].t;
        l = { k: "Arith", op: op, l: l, r: parseMul() };
      }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (at("*") || at("/") || at("%")) {
        var op = toks[p++].t;
        l = { k: "Arith", op: op, l: l, r: parseUnary() };
      }
      return l;
    }
    function parseUnary() {
      if (eat("-")) return { k: "Neg", e: parseUnary() };
      return parsePostfix();
    }

    function parsePostfix() {
      var e = parsePrimary();
      for (;;) {
        if (at(".") && toks[p + 1] && toks[p + 1].t === "ident") {
          p++;
          e = { k: "Field", name: toks[p++].v, of: e };
        } else if (at(".") && toks[p + 1] && toks[p + 1].t === "str") {
          p++;
          e = { k: "FieldExpr", key: { k: "Str", parts: toks[p++].parts }, of: e };
        } else if (at("[")) {
          p++;
          if (eat("]")) { e = { k: "Iterate", of: e }; }
          else {
            var idx = parsePipe();
            expect("]");
            e = { k: "IndexExpr", idx: idx, of: e };
          }
        } else if (at("?")) {
          p++;
          e = { k: "Try", body: e, handler: null };
        } else break;
      }
      return e;
    }

    function parseObject() {
      var entries = [];
      if (eat("}")) return { k: "Object", entries: entries };
      do {
        var keyNode = null, valNode = null;
        if (at("ident")) {
          var name = toks[p++].v;
          keyNode = { k: "Lit", v: name };
          if (eat(":")) valNode = parseAlt();
          else valNode = { k: "Field", name: name, of: { k: "Identity" } };
        } else if (at("str")) {
          var parts = toks[p++].parts;
          keyNode = { k: "Str", parts: parts };
          if (eat(":")) valNode = parseAlt();
          else valNode = { k: "FieldExpr", key: { k: "Str", parts: parts }, of: { k: "Identity" } };
        } else if (at("(")) {
          p++;
          keyNode = parsePipe();
          expect(")");
          expect(":");
          valNode = parseAlt();
        } else fail("expected an object key but found " + describe(peek()));
        entries.push({ key: keyNode, val: valNode });
      } while (eat(","));
      expect("}");
      return { k: "Object", entries: entries };
    }

    function parsePrimary() {
      var tk = peek();
      if (tk.t === ".") {
        p++;
        if (at("ident")) return { k: "Field", name: toks[p++].v, of: { k: "Identity" } };
        if (at("str")) return { k: "FieldExpr", key: { k: "Str", parts: toks[p++].parts }, of: { k: "Identity" } };
        if (at("[")) {
          p++;
          if (eat("]")) return { k: "Iterate", of: { k: "Identity" } };
          var ix = parsePipe();
          expect("]");
          return { k: "IndexExpr", idx: ix, of: { k: "Identity" } };
        }
        return { k: "Identity" };
      }
      if (tk.t === "..") { p++; return { k: "Recurse" }; }
      if (tk.t === "num") { p++; return { k: "Lit", v: tk.v }; }
      if (tk.t === "str") { p++; return { k: "Str", parts: tk.parts }; }
      if (tk.t === "true") { p++; return { k: "Lit", v: true }; }
      if (tk.t === "false") { p++; return { k: "Lit", v: false }; }
      if (tk.t === "null") { p++; return { k: "Lit", v: null }; }
      if (tk.t === "(") { p++; var e = parsePipe(); expect(")"); return e; }
      if (tk.t === "[") {
        p++;
        if (eat("]")) return { k: "Array", e: null };
        var inner = parsePipe();
        expect("]");
        return { k: "Array", e: inner };
      }
      if (tk.t === "{") { p++; return parseObject(); }
      if (tk.t === "if") {
        p++;
        var cond = parsePipe();
        expect("then");
        var thenE = parsePipe();
        var elifs = [];
        while (at("elif")) {
          p++;
          var c2 = parsePipe();
          expect("then");
          elifs.push({ cond: c2, then: parsePipe() });
        }
        var elseE = null;
        if (eat("else")) elseE = parsePipe();
        expect("end");
        return { k: "If", cond: cond, then: thenE, elifs: elifs, else: elseE };
      }
      if (tk.t === "try") {
        p++;
        var body = parsePostfix();
        var handler = null;
        if (eat("catch")) handler = parsePostfix();
        return { k: "Try", body: body, handler: handler };
      }
      if (tk.t === "ident") {
        p++;
        var args = [];
        if (eat("(")) {
          do { args.push(parsePipe()); } while (eat(";") || eat(","));
          expect(")");
        }
        return { k: "Call", name: tk.v, args: args };
      }
      fail("unexpected " + describe(tk));
    }

    var ast = parsePipe();
    if (!at("eof")) fail("unexpected " + describe(peek()));
    return ast;
  }

  JQ.parse = parse;
  JQ.parseInterp = function (src) { return parse(src); };
})(typeof window !== "undefined" ? window : globalThis);
