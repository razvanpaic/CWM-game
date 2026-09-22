/* jqlite self-tests. Every expectation here was verified against real jq-1.7.1.
   Runs in Node (node js/jq/tests.js) and in the browser on the Diagnostics page. */
(function (root) {
  "use strict";

  var HOSTNAME_INPUT = { deviceIp: "192.0.2.10", hostname: "lab-asr1001" };
  var SET_HOSTNAME = {
    id: "set-hostname", version: "1.0.0", specVersion: "0.8", start: "SetHostname",
    functions: [
      { name: "REST.Patch", operation: "generic.rest.v2.0.0.request.Patch", metadata: { worker: "cwm-solutions-generic.rest" } },
      { name: "REST.Get", operation: "generic.rest.v2.0.0.request.Get", metadata: { worker: "cwm-solutions-generic.rest" } }
    ],
    retries: [{ name: "Default", delay: "PT3S", maxAttempts: 3, multiplier: 1.2, maxDelay: "PT15S" }],
    states: [
      { name: "SetHostname", type: "operation", transition: "GetHostname" },
      { name: "GetHostname", type: "operation", end: true }
    ]
  };
  var CLEAR_VTY = {
    specVersion: "0.8",
    states: [
      { name: "GetVtyPool", type: "operation", transition: "PutEemApplet", actions: [1] },
      { name: "PutEemApplet", type: "operation", transition: "WaitForClear", actions: [1] },
      { name: "WaitForClear", type: "sleep", duration: "PT5S", transition: { nextState: "DeleteEemApplet" } },
      { name: "DeleteEemApplet", type: "operation", end: true, actions: [1] }
    ]
  };

  // [name, filter, input, expected text, opts]
  var CASES = [
    // Room 00 — jq foundations
    ["identity", ".", { hostname: "x" }, '{\n  "hostname": "x"\n}'],
    ["field", ".hostname", HOSTNAME_INPUT, '"lab-asr1001"'],
    ["field raw", ".hostname", HOSTNAME_INPUT, "lab-asr1001", { raw: true }],
    ["build colon key", '{ "Cisco-IOS-XE-native:hostname": .hostname }', HOSTNAME_INPUT,
      '{\n  "Cisco-IOS-XE-native:hostname": "lab-asr1001"\n}'],
    ["results guard wrapped", "if (.data) then .data else . end",
      { data: { "Cisco-IOS-XE-native:hostname": "lab-asr1001" }, status: 200 },
      '{\n  "Cisco-IOS-XE-native:hostname": "lab-asr1001"\n}'],
    ["results guard bare", "if (.data) then .data else . end",
      { "Cisco-IOS-XE-native:hostname": "lab-asr1001" },
      '{\n  "Cisco-IOS-XE-native:hostname": "lab-asr1001"\n}'],
    ["iterate streams", ".states[].name", SET_HOSTNAME, "SetHostname\nGetHostname", { raw: true }],
    ["iterate is not an array", "[.states[].name]", SET_HOSTNAME, '[\n  "SetHostname",\n  "GetHostname"\n]'],
    ["select + join", '[.states[] | select(.type=="operation") | .name] | join(", ")',
      SET_HOSTNAME, "SetHostname, GetHostname", { raw: true }],

    // Room 01 — data filters
    ["shorthand object", "{ hostname }", HOSTNAME_INPUT, '{\n  "hostname": "lab-asr1001"\n}'],
    ["nested colon key", 'if (.data) then .data | ."tailf-ncs:output".result else null end',
      { data: { "tailf-ncs:output": { result: "in-sync" } } }, "in-sync", { raw: true }],
    ["merge new key", '. + { checkSyncResult0: "in-sync" }', { deviceIp: "192.0.2.10" },
      '{\n  "deviceIp": "192.0.2.10",\n  "checkSyncResult0": "in-sync"\n}'],

    // Room 02 — anatomy
    ["skeleton", "{id, version, specVersion, start, stateCount: (.states|length)}", SET_HOSTNAME,
      '{\n  "id": "set-hostname",\n  "version": "1.0.0",\n  "specVersion": "0.8",\n  "start": "SetHostname",\n  "stateCount": 2\n}'],
    ["transition map", '.states[] | "\\(.name) --> \\(.transition // "END")"', SET_HOSTNAME,
      "SetHostname --> GetHostname\nGetHostname --> END", { raw: true }],
    ["object-form transition prints raw", '.states[] | "\\(.name) --> \\(.transition // "END")"', CLEAR_VTY,
      'GetVtyPool --> PutEemApplet\nPutEemApplet --> WaitForClear\nWaitForClear --> {"nextState":"DeleteEemApplet"}\nDeleteEemApplet --> END',
      { raw: true }],
    ["shape-tolerant transition", '.states[] | "\\(.name) --> \\(if .transition|type=="object" then .transition.nextState else (.transition // "END") end)"',
      CLEAR_VTY, "GetVtyPool --> PutEemApplet\nPutEemApplet --> WaitForClear\nWaitForClear --> DeleteEemApplet\nDeleteEemApplet --> END",
      { raw: true }],
    ["optional length", '.states[] | "\\(.name): type=\\(.type), actions=\\(.actions|length? // 0)"', CLEAR_VTY,
      "GetVtyPool: type=operation, actions=1\nPutEemApplet: type=operation, actions=1\nWaitForClear: type=sleep, actions=0\nDeleteEemApplet: type=operation, actions=1",
      { raw: true }],

    // Room 04 — adapters
    ["function catalogue", '.functions[] | "\\(.name)  ->  \\(.operation)   [worker: \\(.metadata.worker)]"', SET_HOSTNAME,
      "REST.Patch  ->  generic.rest.v2.0.0.request.Patch   [worker: cwm-solutions-generic.rest]\nREST.Get  ->  generic.rest.v2.0.0.request.Get   [worker: cwm-solutions-generic.rest]",
      { raw: true }],

    // Room 05 — truthiness and guards
    ["truthy null", "if . then \"T\" else \"F\" end", null, "F", { raw: true }],
    ["truthy false", "if . then \"T\" else \"F\" end", false, "F", { raw: true }],
    ["truthy zero", "if . then \"T\" else \"F\" end", 0, "T", { raw: true }],
    ["truthy empty string", "if . then \"T\" else \"F\" end", "", "T", { raw: true }],
    ["truthy empty array", "if . then \"T\" else \"F\" end", [], "T", { raw: true }],
    ["truthy empty object", "if . then \"T\" else \"F\" end", {}, "T", { raw: true }],
    ["missing compares true", '.checkSyncResult0 != "in-sync"', {}, "true"],
    ["guarded missing is null", 'if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end', {}, "null"],
    ["guarded in-sync", 'if (.checkSyncResult0) then .checkSyncResult0 == "in-sync" else null end',
      { checkSyncResult0: "in-sync" }, "true"],

    // Room 06 — credential scan
    ["paths(scalars) finds no credential keys",
      '[paths(scalars) | map(tostring) | join(".")] | map(select(test("(?i)password|secret|token"))) | length',
      SET_HOSTNAME, "0"],
    ["paths(scalars) does find a planted one",
      '[paths(scalars) | map(tostring) | join(".")] | map(select(test("(?i)password"))) | length',
      { config: { password: "nope" } }, "1"],

    // Room 07 — collections
    ["naive guard passes empty", 'if (.devices) then "RUN" else "SKIP" end', { devices: [] }, "RUN", { raw: true }],
    ["sized guard skips empty", 'if ((.devices // []) | length) > 0 then "RUN" else "SKIP" end', { devices: [] }, "SKIP", { raw: true }],
    ["sized guard runs when populated", 'if ((.devices // []) | length) > 0 then "RUN" else "SKIP" end', { devices: ["a", "b"] }, "RUN", { raw: true }],
    ["sized guard skips missing", 'if ((.devices // []) | length) > 0 then "RUN" else "SKIP" end', {}, "SKIP", { raw: true }],

    // Room 08 — retries
    ["retry policy", '.retries[] | "\\(.name) delay=\\(.delay) mult=\\(.multiplier) max=\\(.maxAttempts)"', SET_HOSTNAME,
      "Default delay=PT3S mult=1.2 max=3", { raw: true }],

    // Room 09 — CloudEvents
    ["cloudevent required fields", "{required: {specversion, id, type, source}, payload: .data}",
      { specversion: "1.0", id: "a1b2c3", type: "router-alarm-consume", source: "/lab/asr1001", data: { deviceIp: "192.0.2.10", severity: "critical" } },
      '{"required":{"specversion":"1.0","id":"a1b2c3","type":"router-alarm-consume","source":"/lab/asr1001"},"payload":{"deviceIp":"192.0.2.10","severity":"critical"}}',
      { compact: true }],
    ["correlation key present", "if (.data.deviceIp) then .data.deviceIp else \"UNCORRELATED\" end",
      { data: { deviceIp: "192.0.2.10" } }, "192.0.2.10", { raw: true }],
    ["correlation key missing", "if (.data.deviceIp) then .data.deviceIp else \"UNCORRELATED\" end",
      { data: {} }, "UNCORRELATED", { raw: true }],

    // Engine semantics
    ["select emits nothing", "[.[] | select(. > 2)]", [1, 2, 3, 4], "[\n  3,\n  4\n]"],
    ["map", "map(. * 2)", [1, 2, 3], "[\n  2,\n  4,\n  6\n]"],
    ["keys sorted", "keys", { b: 1, a: 2 }, '[\n  "a",\n  "b"\n]'],
    ["length of string", "length", "hello", "5"],
    ["length of null", "length", null, "0"],
    ["add", "add", [1, 2, 3], "6"],
    ["alternative on null", ".missing // \"fallback\"", {}, "fallback", { raw: true }],
    ["comma streams both", "(1, 2)", null, "1\n2"],
    ["arith string concat", '"a" + "b"', null, '"ab"'],
    ["object merge", '{a:1} + {b:2}', null, '{\n  "a": 1,\n  "b": 2\n}'],
    ["nested pipe in array", "[.[] | .n]", [{ n: 1 }, { n: 2 }], "[\n  1,\n  2\n]"],
    ["tostring on object is compact", "tostring", { a: 1 }, '"{\\"a\\":1}"'],
    ["type", "type", [], '"array"'],
    ["not", "false | not", null, "true"],
    ["empty yields nothing", "empty", null, ""],
    ["sort_by", "sort_by(.n) | map(.n)", [{ n: 3 }, { n: 1 }], "[\n  1,\n  3\n]"],
    ["to_entries", "to_entries", { a: 1 }, '[\n  {\n    "key": "a",\n    "value": 1\n  }\n]'],
    ["range", "[range(3)]", null, "[\n  0,\n  1,\n  2\n]"],
    ["index array", ".[1]", [10, 20, 30], "20"],
    ["negative index", ".[-1]", [10, 20, 30], "30"]
  ];

  var ERROR_CASES = [
    ["unknown builtin is explicit", "frobnicate", null, /not part of the portal/],
    ["index string errors", ".foo", "a string", /cannot index string/],
    ["iterate number errors", ".[]", 5, /cannot iterate over number/],
    ["syntax error is reported", ".foo |", null, /unexpected end of filter/],
    ["unclosed paren", "(.a", null, /expected/],
    ["del is refused clearly", "del(.a)", { a: 1 }, /not supported/]
  ];

  function runAll() {
    var JQ = root.JQ;
    var pass = 0, fails = [];
    CASES.forEach(function (c) {
      var name = c[0], filter = c[1], input = c[2], expected = c[3], opts = c[4] || {};
      var r;
      try { r = JQ.run(filter, input, opts); }
      catch (e) { fails.push({ name: name, why: "threw: " + e.message }); return; }
      if (!r.ok) { fails.push({ name: name, why: "error: " + r.error, filter: filter }); return; }
      if (r.text !== expected) {
        fails.push({ name: name, why: "got " + JSON.stringify(r.text) + " expected " + JSON.stringify(expected), filter: filter });
        return;
      }
      pass++;
    });
    ERROR_CASES.forEach(function (c) {
      var name = c[0], filter = c[1], input = c[2], re = c[3];
      var r = JQ.run(filter, input);
      if (r.ok) { fails.push({ name: name, why: "expected an error, got " + JSON.stringify(r.text) }); return; }
      if (!re.test(r.error)) { fails.push({ name: name, why: "error did not match: " + r.error }); return; }
      pass++;
    });
    return { total: CASES.length + ERROR_CASES.length, pass: pass, fails: fails };
  }

  root.JQTests = { runAll: runAll, cases: CASES, errorCases: ERROR_CASES };

  if (typeof module !== "undefined" && module.exports) module.exports = { runAll: runAll };
})(typeof window !== "undefined" ? window : globalThis);
