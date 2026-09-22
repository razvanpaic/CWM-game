/* Verifies every jq drill: does its stored `solution` produce its stated `expect`?
   Checks against the portal's own engine AND against the real jq binary when available.
   Run: node tools/verify-drills.js  (from portal/web) */
globalThis.window = undefined;
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const here = path.resolve(__dirname, "..");
const load = (f) => eval(fs.readFileSync(path.join(here, f), "utf8"));

["js/jq/lex.js", "js/jq/parse.js", "js/jq/eval.js", "js/jq/builtins.js", "js/jq/index.js",
 "data/samples.js", "data/cards.js",
 "data/rooms-00-03.js", "data/rooms-04-07.js", "data/rooms-08-11.js", "data/index.js"
].forEach((f) => { if (fs.existsSync(path.join(here, f))) load(f); });

let hasRealJq = true;
try { execFileSync("jq", ["--version"], { stdio: "ignore" }); } catch (e) { hasRealJq = false; }

const rooms = globalThis.Data ? globalThis.Data.rooms : [].concat(
  globalThis.ROOMS_00_03 || [], globalThis.ROOMS_04_07 || [], globalThis.ROOMS_08_11 || []);

let checked = 0, engineOk = 0, realOk = 0;
const problems = [];

for (const room of rooms) {
  for (const d of (room.drills || [])) {
    if (d.type !== "jq") continue;
    checked++;
    if (!d.solution) { problems.push(`room ${room.n} ${d.id}: no solution recorded`); continue; }
    const opts = d.opts || {};
    const r = globalThis.JQ.run(d.solution, d.input, opts);
    if (!r.ok) { problems.push(`room ${room.n} ${d.id}: engine error: ${r.error}`); continue; }
    if (r.text !== d.expect) {
      problems.push(`room ${room.n} ${d.id}: engine output != expect\n      solution: ${d.solution}\n      got:    ${JSON.stringify(r.text)}\n      expect: ${JSON.stringify(d.expect)}`);
      continue;
    }
    engineOk++;
    if (hasRealJq) {
      const args = [];
      if (opts.raw) args.push("-r");
      if (opts.compact) args.push("-c");
      args.push(d.solution);
      let real;
      try {
        real = execFileSync("jq", args, { input: JSON.stringify(d.input === undefined ? null : d.input), encoding: "utf8" }).replace(/\n$/, "");
      } catch (e) {
        problems.push(`room ${room.n} ${d.id}: real jq rejected the solution`);
        continue;
      }
      if (real !== d.expect) {
        problems.push(`room ${room.n} ${d.id}: REAL JQ disagrees\n      got:    ${JSON.stringify(real)}\n      expect: ${JSON.stringify(d.expect)}`);
        continue;
      }
      realOk++;
    }
  }
}

console.log(`  jq drills checked:      ${checked}`);
console.log(`  portal engine matches:  ${engineOk}/${checked}`);
console.log(hasRealJq ? `  real jq also matches:   ${realOk}/${checked}` : "  real jq: not installed, skipped");
if (problems.length) { console.log("\n  PROBLEMS:"); problems.forEach((p) => console.log("   - " + p)); process.exit(1); }
