#!/usr/bin/env python3
"""Regenerate portal/web/data/samples.js from the real workflow definitions.

The drills run against the genuine files in workflows/, not paraphrases, so this is
generated rather than hand-copied. Regenerate after editing any workflow.
"""
import json
import pathlib

repo = pathlib.Path(__file__).resolve().parents[3]
wf = repo / "workflows"
dst = repo / "portal" / "web" / "data" / "samples.js"

def load(name):
    return json.loads((wf / name).read_text(encoding="utf-8"))

samples = {
    "setHostname": load("set-hostname.sw.json"),
    "clearVty": load("clear-vty-sessions.sw.json"),
    "hostnameInput": load("set-hostname.input.example.json"),
    "vtyInput": load("clear-vty-sessions.input.example.json"),
    "hostnameForm": load("set-hostname.form.json"),
}

body = ",\n".join(
    "    " + k + ": " + json.dumps(v, ensure_ascii=False, indent=6)[1:].replace("\n", "\n  ").rjust(0)
    if False else "    " + k + ": " + json.dumps(v, ensure_ascii=False)
    for k, v in samples.items()
)

out = f"""/* Sample data for drills. Generated from workflows/ so drills use the real definitions.
   Regenerate with: python3 portal/web/tools/build-samples.py */
(function (root) {{
  "use strict";
  root.SAMPLES = {{
{body}
  }};
}})(typeof window !== "undefined" ? window : globalThis);
"""
dst.write_text(out, encoding="utf-8")
print(f"wrote {dst.relative_to(repo)} with {len(samples)} samples")
