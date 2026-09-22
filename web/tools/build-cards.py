#!/usr/bin/env python3
"""Regenerate portal/web/data/cards.js from portal/srs/cards.json.

cards.json is the source of record; the portal needs the same deck as a plain script
so it loads without fetch() and therefore works from file:// with no server.
"""
import json
import pathlib

repo = pathlib.Path(__file__).resolve().parents[3]
src = repo / "portal" / "srs" / "cards.json"
dst = repo / "portal" / "web" / "data" / "cards.js"

cards = json.loads(src.read_text(encoding="utf-8"))["cards"]
out = [
    "/* SRS deck. Generated from portal/srs/cards.json, which stays the source of record.",
    "   Regenerate with: python3 portal/web/tools/build-cards.py */",
    "(function (root) {",
    '  "use strict";',
    "  root.CARDS = [",
]
for c in cards:
    keep = {"id": c["id"], "room": c["room"], "front": c["front"], "back": c["back"], "tags": c["tags"]}
    out.append("    " + json.dumps(keep, ensure_ascii=False) + ",")
out[-1] = out[-1].rstrip(",")
out += ["  ];", '})(typeof window !== "undefined" ? window : globalThis);', ""]
dst.write_text("\n".join(out), encoding="utf-8")
print(f"wrote {dst.relative_to(repo)} with {len(cards)} cards")
