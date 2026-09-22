/* Tiny DOM helpers. Deliberately no framework: the portal must run from a bare folder. */
(function (root) {
  "use strict";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined || children === false) return;
    if (Array.isArray(children)) { children.forEach(function (c) { append(node, c); }); return; }
    if (children instanceof Node) { node.appendChild(children); return; }
    node.appendChild(document.createTextNode(String(children)));
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* Escapes text, then re-enables a small inline vocabulary the content files rely on:
     `code`, **bold**, *italic*. Content is authored in this repo, never user input. */
  function rich(s) {
    var out = String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
    return out;
  }

  function p(s, cls) { return el("p", { class: cls, html: rich(s) }); }

  function pill(text, tone) { return el("span", { class: "pill" + (tone ? " pill-" + tone : ""), text: text }); }

  function stat(value, label, cls) {
    return el("div", { class: "stat" }, [el("b", { class: cls, text: String(value) }), el("span", { text: label })]);
  }

  function bar(fraction, tone) {
    var pct = Math.max(0, Math.min(1, fraction || 0)) * 100;
    return el("div", { class: "bar" + (tone ? " bar-" + tone : "") }, el("i", { style: "width:" + pct.toFixed(1) + "%" }));
  }

  function table(headers, rows) {
    return el("table", {}, [
      el("thead", {}, el("tr", {}, headers.map(function (h) { return el("th", { html: rich(h) }); }))),
      el("tbody", {}, rows.map(function (r) {
        return el("tr", {}, r.map(function (c) {
          return c instanceof Node ? el("td", {}, c) : el("td", { html: rich(c) });
        }));
      }))
    ]);
  }

  /* Collapsible question/answer used by the Predict beat and drill reveals. */
  function disclosure(question, answerNodes, opts) {
    opts = opts || {};
    var body = el("div", { class: "ans", hidden: true }, answerNodes);
    var arrow = el("span", { class: "arrow", text: "\u25B8" });
    var btn = el("button", {
      type: "button",
      onclick: function () {
        var open = body.hasAttribute("hidden");
        if (open) { body.removeAttribute("hidden"); arrow.textContent = "\u25BE"; }
        else { body.setAttribute("hidden", ""); arrow.textContent = "\u25B8"; }
        if (open && opts.onOpen) opts.onOpen();
      }
    }, [arrow, el("span", { html: rich(question) })]);
    return el("div", { class: "qa" }, [btn, body]);
  }

  function toast(msg) {
    var t = el("div", {
      text: msg,
      style: "position:fixed;left:50%;transform:translateX(-50%);bottom:26px;z-index:99;" +
        "background:#1a2029;border:1px solid #2c7a5a;color:#bff3dd;padding:9px 16px;" +
        "border-radius:8px;font-size:14px;font-weight:600"
    });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  root.UI = { el: el, clear: clear, rich: rich, p: p, pill: pill, stat: stat, bar: bar, table: table, disclosure: disclosure, toast: toast };
})(typeof window !== "undefined" ? window : globalThis);
