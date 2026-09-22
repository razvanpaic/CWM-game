/* jqlite lexer. Classic script so the portal runs from file:// with no build step. */
(function (root) {
  "use strict";

  var PUNCT3 = [];
  var PUNCT2 = ["//", "==", "!=", "<=", ">=", ".."];
  var PUNCT1 = "|()[]{},:;?<>+-*/%.".split("");
  var WORDS = ["if", "then", "elif", "else", "end", "and", "or", "true", "false", "null", "try", "catch"];

  function isIdentStart(c) { return /[A-Za-z_]/.test(c); }
  function isIdent(c) { return /[A-Za-z0-9_]/.test(c); }
  function isDigit(c) { return c >= "0" && c <= "9"; }

  function err(msg, pos) {
    var e = new Error(msg);
    e.jqPos = pos;
    e.jqKind = "syntax";
    throw e;
  }

  /* Reads a double-quoted string, splitting it into literal and \(...) parts.
     Interpolation bodies are kept as raw source and parsed later. */
  function readString(src, i) {
    var parts = [];
    var lit = "";
    i++;
    while (i < src.length) {
      var c = src[i];
      if (c === '"') {
        if (lit) parts.push({ lit: lit });
        return { parts: parts, next: i + 1 };
      }
      if (c === "\\") {
        var n = src[i + 1];
        if (n === "(") {
          if (lit) { parts.push({ lit: lit }); lit = ""; }
          var depth = 1, j = i + 2, body = "", inStr = false;
          while (j < src.length && depth > 0) {
            var d = src[j];
            if (inStr) {
              if (d === "\\") { body += d + src[j + 1]; j += 2; continue; }
              if (d === '"') inStr = false;
            } else if (d === '"') inStr = true;
            else if (d === "(") depth++;
            else if (d === ")") { depth--; if (depth === 0) break; }
            body += d;
            j++;
          }
          if (depth !== 0) err("unterminated string interpolation", i);
          parts.push({ expr: body });
          i = j + 1;
          continue;
        }
        var map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f" };
        if (n === "u") {
          lit += String.fromCharCode(parseInt(src.substr(i + 2, 4), 16));
          i += 6;
          continue;
        }
        if (map[n] === undefined) err("unsupported escape \\" + n, i);
        lit += map[n];
        i += 2;
        continue;
      }
      lit += c;
      i++;
    }
    err("unterminated string", i);
  }

  function tokenize(src) {
    var toks = [];
    var i = 0;
    while (i < src.length) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === '"') {
        var s = readString(src, i);
        toks.push({ t: "str", parts: s.parts, pos: i });
        i = s.next;
        continue;
      }
      if (isDigit(c)) {
        var m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
        toks.push({ t: "num", v: parseFloat(m[0]), pos: i });
        i += m[0].length;
        continue;
      }
      if (isIdentStart(c)) {
        var j = i;
        while (j < src.length && isIdent(src[j])) j++;
        var w = src.slice(i, j);
        toks.push({ t: WORDS.indexOf(w) >= 0 ? w : "ident", v: w, pos: i });
        i = j;
        continue;
      }
      var two = src.substr(i, 2);
      if (PUNCT2.indexOf(two) >= 0) { toks.push({ t: two, pos: i }); i += 2; continue; }
      if (PUNCT1.indexOf(c) >= 0) { toks.push({ t: c, pos: i }); i++; continue; }
      err("unexpected character " + JSON.stringify(c), i);
    }
    toks.push({ t: "eof", pos: src.length });
    return toks;
  }

  root.JQ = root.JQ || {};
  root.JQ.tokenize = tokenize;
  root.JQ.lexError = err;
})(typeof window !== "undefined" ? window : globalThis);
