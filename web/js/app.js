/* Router and boot. Hash routing so the portal works from file:// with no server. */
(function (root) {
  "use strict";
  var el = root.UI.el;

  var NAV = [
    { href: "#/tower", label: "Tower" },
    { href: "#/review", label: "Review", badge: true },
    { href: "#/playground", label: "Playground" },
    { href: "#/progress", label: "Progress" },
    { href: "#/diagnostics", label: "Diagnostics" }
  ];

  function parse() {
    var h = (location.hash || "#/tower").replace(/^#\/?/, "");
    var parts = h.split("/").filter(function (x) { return x.length; });
    return { name: parts[0] || "tower", params: parts.slice(1) };
  }

  function go(hash, replace) {
    if (location.hash === hash) { render(); return; }
    // replaceState keeps beat-to-beat movement out of the back button, but some
    // browsers forbid it on file:// origins — fall back to a normal hash change.
    if (replace) {
      try { history.replaceState(null, "", hash); render(); return; }
      catch (e) { /* fall through */ }
    }
    location.hash = hash;
  }

  function drawNav(active) {
    var nav = document.getElementById("nav");
    root.UI.clear(nav);
    var due = root.SRS.summary().due;
    NAV.forEach(function (item) {
      var isOn = "#/" + active === item.href || (active === "room" && item.href === "#/tower");
      var kids = [item.label];
      if (item.badge) kids.push(el("span", { class: "count" + (due ? "" : " zero"), text: String(due) }));
      nav.appendChild(el("a", { href: item.href, class: isOn ? "on" : "", onclick: function () { } }, kids));
    });
  }

  function drawHud() {
    var s = root.Store.get();
    document.getElementById("hud-xp").textContent = String(s.xp);
    document.getElementById("hud-streak").textContent = String(s.streak.count);
    document.getElementById("foot-jq").textContent = root.JQ.VERSION;
  }

  function render() {
    var r = parse();
    var view = document.getElementById("view");
    root.UI.clear(view);

    var node;
    try {
      if (r.name === "room") node = root.RoomView.render(r.params);
      else if (r.name === "review") node = root.ViewReview.render();
      else if (r.name === "playground") node = root.ViewPlayground.render();
      else if (r.name === "progress") node = root.ViewProgress.render();
      else if (r.name === "diagnostics") node = root.ViewProgress.renderDiagnostics();
      else node = root.ViewTower.render();
    } catch (e) {
      node = el("div", { class: "note note-bad" }, [
        el("b", { text: "This view failed to render." }),
        el("pre", {}, el("code", { text: String(e && e.stack || e) }))
      ]);
      if (root.console) console.error(e);
    }

    view.appendChild(node);
    drawNav(r.name);
    drawHud();
    if (r.name !== "review") root.ViewReview.reset();
    view.focus();
    try { window.scrollTo(0, 0); } catch (e) { /* not available in every host */ }
  }

  function boot() {
    if (root.Data.problems.length && root.console) {
      console.warn("Content problems detected:\n - " + root.Data.problems.join("\n - "));
    }
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/tower";
    render();
  }

  root.App = { go: go, render: render };

  try { boot(); }
  catch (e) {
    document.getElementById("boot-error").hidden = false;
    if (root.console) console.error(e);
  }
})(typeof window !== "undefined" ? window : globalThis);
