/* Rooms 00-03: jq, data filters, workflow anatomy, operation states. */
(function (root) {
  "use strict";
  var S = root.SAMPLES;

  root.ROOMS_00_03 = [
  {
    n: 0, name: "The Loading Dock", tagline: "jq from first principles",
    location: "Ground floor, roller door open to the street. Crates arrive on pallets. A workbench, a crowbar, and a stack of empty crates with blank labels.",
    reused: "Nothing yet — this is the ground floor.",
    runnable: "jq",
    predict: [
      { q: "A CWM workflow renames a device. Of everything it does, how much is *reshaping JSON* versus *talking to the device*?",
        a: "Almost all of it is reshaping. The device conversation is two HTTP requests the adapter makes for you. Everything you **author** is reshaping — which is why this is the ground floor." },
      { q: "`jq` is often called \"sed for JSON\". Would you expect a jq filter to always return exactly one result?",
        a: "No, and this is the most common misconception. A filter can return zero, one, or many results. `.[]` exists purely to turn one array into many outputs." },
      { q: "This is real, from `set-hostname.sw.json`: `\"results\": \"${ if (.data) then .data else . end }\"`. Why a conditional instead of just `.data`?",
        a: "Because the adapter does not guarantee the shape it hands back. Sometimes the payload is wrapped in `.data`, sometimes it *is* the payload. That line normalises both so the next state can rely on one shape. You will run it in Drill 3." }
    ],
    teach: [
      { p: "You already know how a shell pipe works: `cat file | grep error | wc -l`. Text flows left to right, each program takes what the last produced, nobody stores anything." },
      { p: "`jq` is that exact idea with one substitution: **instead of lines of text flowing through, JSON values flow through.** That is the whole model. Everything else is vocabulary." },
      { h: "The vocabulary" },
      { p: "**`.`** is \"the thing I was just handed\". On its own it changes nothing." },
      { p: "**`.foo`** reaches inside. Hand it an object, get back what lives at that key." },
      { p: "**`|`** chains filters, identically to the shell. `.a | .b` means reach into `a`, then from there reach into `b`." },
      { p: "**A filter may produce more than one result.** This is the leap. `.[]` takes an array and emits each element *as a separate output* — not an array of three, but three results." },
      { p: "Once you accept that a filter is a stream rather than a function returning one value, two more stop needing memorisation. **`map(f)`** runs `f` on every element and collects the results back into one array. **`select(cond)`** emits its input if the condition is true and emits *nothing* if false — it is a gate, and being able to emit nothing is exactly what makes it work." },
      { p: "**`{ }`** builds something new. You are not editing the crate you were handed; you are labelling a fresh one." },
      { note: { tone: "accent", text: "In the next drill you will type `{ \"Cisco-IOS-XE-native:hostname\": .hostname }` — which is, character for character, the expression inside `set-hostname.sw.json`. The `${ ... }` wrapper is just CWM's marker meaning \"the thing inside is a jq filter\"." } }
    ],
    key: "Every `${ ... }` in a CWM workflow is a jq filter, and the workflow's data is what flows through the pipe.",
    palace: {
      story: [
        "The roller door rattles up. A pallet of crates is dropped on the concrete — that pallet is your **input JSON**, and it is the only material you have.",
        "You take one crate to the workbench. The **crowbar** is `.`: it does not change the crate, it just gets you looking inside. Reaching in for a single item is `.foo`.",
        "Now the important bit. Against the wall is a **tipping table**. Put a crate of many items on it and tip — the items come out and roll down the belt *one at a time, separately*. That is `.[]`. The crate did not become a smaller crate; it stopped being a crate at all.",
        "Further down the belt stands an **inspector with a gate**. Items she approves roll on. Items she rejects do not go into a reject bin — they simply cease to exist. Nothing downstream ever learns they were there.",
        "At the end is the **stack of empty crates and a label gun**. You never ship the crate that arrived. You build a new one, gun a fresh label onto it, and drop in the item you pulled out. That new crate is what leaves the dock.",
        "Remember the dock as **loud and physical**. Rooms above it get quieter and more abstract, and you will keep coming back down here whenever a filter confuses you."
      ],
      table: [
        ["Pallet of crates", "The input JSON — the only material available"],
        ["Crowbar", "`.` — look inside without changing anything"],
        ["Reaching in for one item", "`.foo`"],
        ["Tipping table", "`.[]` — one crate becomes many separate items"],
        ["Conveyor belt", "`|` — output of one step becomes input of the next"],
        ["Inspector with a gate", "`select(cond)` — rejected items cease to exist"],
        ["Doing the same job to every item", "`map(f)`"],
        ["Empty crate + label gun", "`{ }` — build something new, never edit the original"],
        ["The crate that leaves the dock", "What `${ ... }` evaluates to"]
      ]
    },
    drills: [
      { type: "jq", id: "d0-1", title: "Open the crate",
        prompt: "The job input for `set-hostname` is on the left. Write a filter that returns just the hostname.",
        input: S.hostnameInput, solution: ".hostname", expect: '"lab-asr1001"',
        hint: "One character, then the key name.",
        why: "Note the quotes: jq returned a JSON **string**, not bare text. Add `-r` (the Raw toggle) when you want the text without them. That distinction causes real bugs later, which is why you meet it in the first drill." },
      { type: "jq", id: "d0-2", title: "Build the crate that ships",
        prompt: "Now build the actual RESTCONF request body this workflow PATCHes to the device: an object whose single key is `Cisco-IOS-XE-native:hostname` and whose value is the hostname.",
        input: S.hostnameInput,
        solution: ".hostname",
        solution: "{ \"Cisco-IOS-XE-native:hostname\": .hostname }",
        expect: '{\n  "Cisco-IOS-XE-native:hostname": "lab-asr1001"\n}',
        hint: "Use `{ }` to build. The key contains a colon, so it has to be quoted.",
        why: "That is the real payload, not an approximation. You have written a line of production CWM." },
      { type: "jq", id: "d0-3", title: "Why that conditional exists",
        prompt: "This adapter response is wrapped in `.data`. Write the guard from `set-hostname.sw.json` that unwraps it — and that would also pass an already-unwrapped payload straight through.",
        input: { data: { "Cisco-IOS-XE-native:hostname": "lab-asr1001" }, status: 200 },
        solution: "if (.data) then .data else . end",
        expect: '{\n  "Cisco-IOS-XE-native:hostname": "lab-asr1001"\n}',
        hint: "`if ... then ... else ... end`. The condition is just `.data` — remember only `false` and `null` are falsy.",
        after: { input: { "Cisco-IOS-XE-native:hostname": "lab-asr1001" }, note: "Now switch the input to the bare payload (no `.data` wrapper) and run the same filter. Identical output — two different inputs, one predictable shape." },
        why: "Plain `.data` would have returned `null` for the bare payload, and the *next* state would have failed somewhere further along, with an error pointing at the wrong place. The conditional is not defensive clutter; it is the author refusing to depend on an unguaranteed shape." },
      { type: "jq", id: "d0-4", title: "One filter, many results",
        prompt: "The whole `set-hostname.sw.json` is loaded. Emit the name of each state as a separate result. Turn on Raw so you see lines rather than quoted strings.",
        input: S.setHostname, opts: { raw: true },
        solution: ".states[].name",
        expect: "SetHostname\nGetHostname",
        hint: "Reach into `.states`, tip it out with `[]`, then take `.name`.",
        why: "Two lines, because `.[]` produced two **separate results**, not one array. Wrap the whole thing in `[ ]` and you collect the stream back into a single array. Streams versus arrays is the distinction people trip over for months." },
      { type: "jq", id: "d0-5", title: "The gate and the label gun together",
        prompt: "Produce a single comma-separated string of the names of every state whose `type` is `operation`.",
        input: S.setHostname, opts: { raw: true },
        solution: "[.states[] | select(.type==\"operation\") | .name] | join(\", \")",
        expect: "SetHostname, GetHostname",
        hint: "Tip out the states, `select` on `.type`, take `.name`, collect with `[ ]`, then `join(\", \")`.",
        why: "Read it right to left as a sentence: tip the states out one at a time, let only the operation ones through the gate, take each name, collect what survives, join it. Five filters, one pipe." },
      { type: "predict", id: "d0-6", title: "Predict the count",
        prompt: "You run that same filter against `clear-vty-sessions.sw.json`, which has four states: `GetVtyPool` (operation), `PutEemApplet` (operation), `WaitForClear` (**sleep**), `DeleteEemApplet` (operation). How many names come back?",
        choices: ["Four — every state has a name", "Three — the sleep state is filtered out", "One — join only returns one string", "Zero — the filter would error"],
        answer: 1,
        why: "Three names survive the gate, and `join` then turns that stream-collected array into one string. The `sleep` state has a name too, but it never gets past `select(.type==\"operation\")`." }
    ],
    recall: [
      "Explain to someone who knows shell but not jq what `.[]` does, without using the word \"array\".",
      "`select` can return nothing at all. Why is that a feature rather than a bug, and what would break if it returned `null` instead?",
      "A colleague replaces `if (.data) then .data else . end` with plain `.data` because it is shorter. Describe the failure: when does it break, and — the harder part — *where* will the error appear to be coming from?"
    ],
    gate: "You can look at any `${ ... }` in `set-hostname.sw.json` and say out loud what flows in and what comes out, without running it.",
    sources: [
      "All expressions are quoted verbatim from `workflows/set-hostname.sw.json`.",
      "jq behaviour verified against jq-1.7.1; the portal's own engine is checked byte-for-byte against real jq (see Diagnostics).",
      "**[VERIFY]** No Cisco document in our set states which jq version the CWM engine embeds, so avoid very new builtins in real workflow expressions."
    ]
  },

  {
    n: 1, name: "The Mailroom", tagline: "where an action's result actually goes",
    location: "First floor, up the concrete stairs. Pigeonholes floor to ceiling, an in-tray, an out-tray, and a franking machine that stamps everything.",
    reused: "The crate and label gun from the Loading Dock. Every filter here is a jq filter you already know how to write.",
    runnable: "jq",
    predict: [
      { q: "An action runs successfully. Where does its result go?",
        a: "**Nowhere**, unless you say so. This is the surprise. A successful action's result is discarded unless a filter places it into workflow data." },
      { q: "CWM gives you *three* places to write a data filter around a single action. Why would one not be enough?",
        a: "Because there are three genuinely different moments needing different answers: what the state may see, what this action may see, and where the action's output lands." },
      { q: "A job finishes Succeeded, but its Result card is empty. What went wrong?",
        a: "Probably nothing. The Result card shows data written by `toStateData`. An action with no `toStateData` runs fine and contributes nothing visible." }
    ],
    teach: [
      { p: "In Room 00 you learned a workflow is data flowing through filters. Now the question that matters in practice: **whose data, and when?**" },
      { p: "A workflow carries one JSON value as it runs. Call it the **workflow data**. It starts as the job input and is the only thing that persists between states." },
      { p: "An action — one adapter call — is a stranger. It does not get the whole workflow data by default, it does not know your naming, and when it returns something it has no idea where you want it kept. So three questions are answered separately." },
      { h: "The three moments" },
      { p: "**What can this state see?** `stateDataFilter.input` narrows the workflow data on the way in." },
      { p: "**What arguments does this action get?** `actionDataFilter.fromStateData` selects the slice of state data made available to the action's arguments." },
      { p: "**Where does the answer go?** Two filters, because these are two different jobs. `actionDataFilter.results` reshapes the *raw thing the adapter returned*. `actionDataFilter.toStateData` decides *where in the workflow data* the reshaped value is written." },
      { p: "Both exist because adapters return envelopes, not answers. A RESTCONF GET does not return a hostname; it returns a response object that *contains* one, sometimes wrapped in `.data`. `results` opens the envelope, `toStateData` files the contents." },
      { code: '"actionDataFilter": {\n  "results": "${ if (.data) then .data else . end }",\n  "toStateData": "${ .currentHostname }"\n}' },
      { p: "Open the envelope however it arrives, then file it under `currentHostname`. Any later state can now say `.currentHostname` and rely on it." }
    ],
    key: "An action's result is discarded unless `toStateData` says where to keep it.",
    palace: {
      story: [
        "The in-tray on the left is `stateDataFilter.input` — the porter decides which of the day's post is even carried into this room.",
        "You are the clerk. You do not hand a courier the entire in-tray. You copy the two lines he needs onto a slip: that slip is `fromStateData`.",
        "The courier returns with a **padded envelope**, and this is the thing to remember: he always brings an envelope, never the bare object. Sometimes the envelope has another envelope inside it. Slitting it open until you reach the actual contents is `results`.",
        "Then you turn to the wall of **pigeonholes**, each with a handwritten name, and put the contents into exactly one: `toStateData`. Here is the room's whole lesson in one image — **if you never choose a pigeonhole, you drop the contents in the bin.** Not out of malice. There is simply nowhere else for them to go."
      ],
      table: [
        ["In-tray", "`stateDataFilter.input` — what this state may see"],
        ["Slip copied for the courier", "`actionDataFilter.fromStateData`"],
        ["Padded envelope he returns", "The adapter's raw response, always wrapped"],
        ["Slitting it open", "`actionDataFilter.results`"],
        ["Named pigeonhole", "`actionDataFilter.toStateData`"],
        ["The bin", "What happens with no `toStateData`"]
      ]
    },
    drills: [
      { type: "jq", id: "d1-1", title: "fromStateData: hand over only what is needed",
        prompt: "The state data has three fields. Produce an object containing **only** `hostname` — the slice this action actually needs.",
        input: { deviceIp: "192.0.2.10", hostname: "lab-asr1001", unrelated: "noise" },
        solution: "{ hostname }",
        expect: '{\n  "hostname": "lab-asr1001"\n}',
        hint: "`{ }` with one entry. jq has a shorthand when the key and the field have the same name.",
        why: "`{ hostname }` is shorthand for `{ hostname: .hostname }`. The other fields are not hidden — they were never handed over. Narrowing is not secrecy; it stops the action depending on fields you never promised it." },
      { type: "jq", id: "d1-2", title: "results: open a two-layer envelope",
        prompt: "This is an NSO response, from Cisco's own CreateL3VPN example. Reach the `result` string. Guard `.data` first, and return `null` if it is absent. Turn Raw on.",
        input: { data: { "tailf-ncs:output": { result: "in-sync" } } }, opts: { raw: true },
        solution: "if (.data) then .data | .\"tailf-ncs:output\".result else null end",
        expect: "in-sync",
        hint: 'The middle key contains a colon, so it needs quoting: `."tailf-ncs:output"`.',
        why: "Three layers peeled to reach one string. Quoting a colon key to *read* it is the same rule you used in Room 00 to *build* one. Without `results`, the next state would have to know NSO's response shape; with it, the next state just reads a string." },
      { type: "jq", id: "d1-3", title: "toStateData: file it in a pigeonhole",
        prompt: "Workflow data currently holds only `deviceIp`. Add `checkSyncResult0` with the value `\"in-sync\"`, **keeping** what was already there.",
        input: { deviceIp: "192.0.2.10" },
        solution: ". + { checkSyncResult0: \"in-sync\" }",
        expect: '{\n  "deviceIp": "192.0.2.10",\n  "checkSyncResult0": "in-sync"\n}',
        hint: "You can add two objects together with `+`. Start from `.`",
        why: "Drop the `. +` and you get *only* the new key — the workflow's memory of `deviceIp` gone. That is the shape of a whole class of \"the second state can't find the device\" bugs." },
      { type: "predict", id: "d1-4", title: "Watch a result hit the bin",
        prompt: "An action calls the device, succeeds, and returns `\"in-sync\"`. Its `actionDataFilter` has a `results` filter but **no** `toStateData`. What does the job report, and what does the next state see?",
        choices: [
          "The job fails, because the result had nowhere to go",
          "The job succeeds and the next state sees `\"in-sync\"` as its input",
          "The job succeeds, the Result card shows nothing new, and workflow data is unchanged",
          "The job warns that toStateData is missing"
        ],
        answer: 2,
        why: "**A successful action that changed nothing is the most confusing failure mode in CWM**, and it is invisible in the status column. Nothing warns you. The status is green and the data is untouched." },
      { type: "match", id: "d1-5", title: "Match the moment to the filter",
        prompt: "Pair each moment in an action's life with the filter that governs it.",
        pairs: [
          ["What the state may see on the way in", "stateDataFilter.input"],
          ["What the action's arguments may see", "actionDataFilter.fromStateData"],
          ["Reshaping the adapter's raw response", "actionDataFilter.results"],
          ["Choosing where the value is written", "actionDataFilter.toStateData"]
        ] }
    ],
    recall: [
      "Explain why `results` and `toStateData` are two filters and not one, using the envelope image but not the words \"results\" or \"toStateData\".",
      "A colleague says \"the action failed, the next state got null\". Give two explanations that have nothing to do with the action failing.",
      "Why does narrowing with `fromStateData` make a workflow *easier to change later*, even though it is more typing now?"
    ],
    gate: "You can point at any `actionDataFilter` in `workflows/` and say what the adapter returned, what survived the filter, and what name it now lives under.",
    sources: [
      "`actionDataFilter` blocks quoted verbatim from `workflows/set-hostname.sw.json` and `clear-vty-sessions.sw.json`.",
      "The `\"tailf-ncs:output\".result` expression is from the CWM Get Started Guide CreateL3VPN example.",
      "`fromStateData`, `results`, `toStateData` and `dataInputSchema` support confirmed via Tech Buddy, 2026-09-10."
    ]
  },

  {
    n: 2, name: "The Switchboard", tagline: "a definition is not a script",
    location: "Second floor. An old manual telephone switchboard: a panel of labelled jacks, a tangle of patch cables, and one jack marked with a red ring.",
    reused: "The pigeonholes from the Mailroom hold the data; this room is about the *cables* that decide what runs next.",
    runnable: "jq",
    predict: [
      { q: "A workflow file has five states. Which one runs first?",
        a: "Whichever one `start` names. **Not** the first in the array — position in `states[]` carries no meaning at all." },
      { q: "There is no `main` and no line numbering. So what stops a workflow?",
        a: "A state with `end: true`. Control is a chain of explicit hand-offs; when nobody hands off, the workflow is over." },
      { q: "`version` and `specVersion` are both top-level keys. Do they describe the same thing?",
        a: "No, and confusing them is common. `version` is *your* workflow's revision. `specVersion` is which Serverless Workflow release the definition claims to follow." }
    ],
    teach: [
      { p: "Here is the mental shift this room exists to force: **a workflow definition is not a script.**" },
      { p: "A script is a list of instructions with an implicit \"and then the next line\". A workflow definition is a **set of named states plus wiring**. Nothing is implied by order. Nothing runs because it appears next in the file." },
      { table: { headers: ["Key", "What it is for"], rows: [
        ["`id`", "The workflow's stable name. CWM builds its API paths from this"],
        ["`name`, `description`", "Human labels. `description` is the only place to leave notes"],
        ["`version`", "Your revision of this workflow, e.g. `1.0.0`"],
        ["`specVersion`", "Which Serverless Workflow release the definition claims to follow"],
        ["`start`", "Names the first state. **The only entry point**"],
        ["`states[]`", "The named states, in no meaningful order"],
        ["`functions[]`", "The catalogue of callable adapter operations (Room 03)"],
        ["`retries[]`", "Named retry policies, referenced by actions (Room 08)"],
        ["`dataInputSchema`", "JSON Schema validating job input before the workflow runs"]
      ] } },
      { h: "Two consequences worth internalising" },
      { p: "**Order in the file is meaningless; the wiring is everything.** You can shuffle `states[]` freely. To understand a workflow you must trace `start`, then follow each `transition`. The file's top-to-bottom reading order is a lie you have to learn to ignore." },
      { p: "**There is nowhere to put a comment.** JSON has no comments, and adding a non-schema key risks validation failure. The only sanctioned place for a note is `description`. Look at what `set-hostname.sw.json` does with it — it carries the warning that operation IDs and worker names are cluster-specific. That is `description` used properly: not decoration, but the one thing a future reader cannot deduce from the code." },
      { note: { tone: "accent", text: "This project uses `specVersion: \"0.8\"` (decision D-08). Cisco's public Workflow Creator Guide says CWM 2.1 corresponds to `0.9` — but 0.8 is what ran on a real cluster, the internal KB gives it as the engine baseline, and nothing documents the engine validating the field. You will meet Cisco's 0.9 examples; they are readable, just not our target." } }
    ],
    key: "`start` is the only entry point, `transition` is the only way forward, and `end: true` is the only way to stop — position in the file means nothing.",
    palace: {
      story: [
        "The panel of **labelled jacks** is `states[]`. Each has a name scratched on a brass plate, and the plates are in no particular order — whoever installed them just worked outward.",
        "One jack has a **red ring** painted round it. That is `start`. An operator arriving for a shift does not begin at the top left; she begins at the red ring, always.",
        "The **patch cables** are transitions. One end in a jack, the other end in the next jack along the path. Follow the cable, not the row.",
        "A few jacks have a **brass cap** screwed over them, no cable leaving. Those are `end: true`. The call is finished.",
        "And screwed to the frame is a **small enamel plate with the switchboard's own serial number and the year the standard was published**. Two different numbers that people constantly misread as one: `version` and `specVersion`."
      ],
      table: [
        ["Panel of labelled jacks, unordered", "`states[]`"],
        ["Jack with the red ring", "`start`"],
        ["Patch cable", "`transition`"],
        ["Brass cap, no cable", "`end: true`"],
        ["Serial number on the enamel plate", "`version` — your revision"],
        ["Year of the standard on the same plate", "`specVersion`"]
      ]
    },
    drills: [
      { type: "jq", id: "d2-1", title: "Read the skeleton, ignore the body",
        prompt: "Produce a one-object summary of this workflow with exactly these keys: `id`, `version`, `specVersion`, `start`, and `stateCount` (how many states there are).",
        input: S.setHostname,
        solution: "{id, version, specVersion, start, stateCount: (.states|length)}",
        expect: '{\n  "id": "set-hostname",\n  "version": "1.0.0",\n  "specVersion": "0.8",\n  "start": "SetHostname",\n  "stateCount": 2\n}',
        hint: "Object shorthand handles the first four. For the last: `stateCount: (.states|length)`.",
        why: "Five lines and you know what the workflow is, which revision, which spec it claims, where it begins and how big it is. This is the first thing to run against any unfamiliar workflow." },
      { type: "jq", id: "d2-2", title: "Follow the cables",
        prompt: "Emit one line per state in the form `Name --> NextState`, printing `END` where a state has no transition. Raw is on.",
        input: S.setHostname, opts: { raw: true },
        solution: ".states[] | \"\\(.name) --> \\(.transition // \"END\")\"",
        expect: "SetHostname --> GetHostname\nGetHostname --> END",
        hint: 'String interpolation is `"\\(.name)"`. The alternative operator `// "END"` supplies a default when the left side is null or false.',
        why: "You have just generated a control-flow graph from a declaration — which is exactly what the Designer's Graph view does." },
      { type: "jq", id: "d2-3", title: "Run it on the other workflow — and get surprised",
        prompt: "Same filter, different workflow. `clear-vty-sessions.sw.json` has four states and one of them is a `sleep`. Write the same `Name --> Next` filter and look carefully at the third line.",
        input: S.clearVty, opts: { raw: true },
        solution: ".states[] | \"\\(.name) --> \\(.transition // \"END\")\"",
        expect: 'GetVtyPool --> PutEemApplet\nPutEemApplet --> WaitForClear\nWaitForClear --> {"nextState":"DeleteEemApplet"}\nDeleteEemApplet --> END',
        hint: "Write exactly the same filter as the previous drill. The surprise is in the data, not your filter.",
        why: "`WaitForClear`'s transition is not a string — it is an **object** `{\"nextState\": \"DeleteEemApplet\"}`. `transition` accepts either form: the bare string is shorthand, the object is the long form and can carry extra fields such as `compensate` (Room 08). Tooling that assumes one shape silently mis-reads workflows written in the other." },
      { type: "jq", id: "d2-4", title: "Now handle both shapes",
        prompt: "Fix the filter so it prints `DeleteEemApplet` on that third line — handling both the string and object forms of `transition`.",
        input: S.clearVty, opts: { raw: true },
        solution: ".states[] | \"\\(.name) --> \\(if .transition|type==\"object\" then .transition.nextState else (.transition // \"END\") end)\"",
        expect: "GetVtyPool --> PutEemApplet\nPutEemApplet --> WaitForClear\nWaitForClear --> DeleteEemApplet\nDeleteEemApplet --> END",
        hint: 'Test the shape with `type == "object"` inside an `if`, and reach for `.transition.nextState` when it is.',
        why: "Shape-tolerant reading is the habit. Any tool you write against workflow JSON will meet both forms sooner or later." },
      { type: "order", id: "d2-5", title: "Trace the execution order",
        prompt: "Here are the four states of `clear-vty-sessions` in the order they appear in the file. Put them into **execution** order by following `start` and each `transition`.",
        items: ["GetVtyPool", "PutEemApplet", "WaitForClear", "DeleteEemApplet"],
        shuffled: ["DeleteEemApplet", "WaitForClear", "GetVtyPool", "PutEemApplet"],
        why: "In this file the two orders happen to coincide. That is luck, not a rule — and relying on it is how people misread workflows whose authors grouped states by theme instead." }
    ],
    recall: [
      "Someone reorders `states[]` alphabetically. What breaks? Justify your answer.",
      "Explain the difference between `version` and `specVersion` to someone who has confused them, and say which one you would change after fixing a bug in a state.",
      "You inherit a 30-state workflow. Describe the first three commands you would run, and what each tells you."
    ],
    gate: "Given any workflow file, you can produce its execution order without reading the actions.",
    sources: [
      "All structure quoted verbatim from `workflows/*.sw.json`, including the object-form `transition`.",
      "`specVersion` decision and its evidence: D-08 in `content-memory/01-decisions.md`."
    ]
  },

  {
    n: 3, name: "The Assembly Line", tagline: "operation states, actions and functions",
    location: "Third floor. A conveyor with numbered stations, and bolted to the wall a thick ring-bound machine catalogue listing every machine the factory owns.",
    reused: "The Mailroom clerk still handles data at every station; the Switchboard's cables still decide which floor you go to next.",
    runnable: "partly",
    predict: [
      { q: "`functions[]` and `actions[]` are separate top-level concepts. What is the difference?",
        a: "`functions[]` is a catalogue — what *may* be called. `actions[]` is an actual call. `functionRef.refName` ties a call back to its catalogue entry." },
      { q: "An `operation` state lists three actions. Do they run at the same time?",
        a: "No. The Serverless Workflow spec permits parallel actions, but **CWM runs operation-state actions in sequence only.** A real, documented deviation." },
      { q: "You copy a working workflow from a colleague's cluster to yours. It validates. Will it run?",
        a: "Probably not. Operation IDs and worker names are per-cluster. Validation checks shape, not whether that operation exists on *your* cluster." }
    ],
    teach: [
      { p: "An `operation` state exists to **do things**, and everything else follows from the fact that CWM cannot do those things itself. It has no idea how to speak RESTCONF or NETCONF. Adapters do. So there has to be a way to name a capability, and a way to invoke it — two separate jobs, so two separate structures." },
      { h: "functions[] — the catalogue" },
      { code: '{\n  "name": "REST.Patch",\n  "operation": "generic.rest.v2.0.0.request.Patch",\n  "metadata": { "worker": "cwm-solutions-generic.rest" }\n}' },
      { p: "Three separate facts in one entry: what you will call it, what it really is, and which **worker** process executes it." },
      { h: "actions[] — the calls" },
      { code: '{\n  "name": "patchHostname",\n  "retryRef": "Default",\n  "functionRef": {\n    "refName": "REST.Patch",\n    "arguments": {\n      "input":  { "path": "restconf/data/...", "data": "${ ... }" },\n      "config": { "resourceId": "${ .deviceIp }" }\n    }\n  }\n}' },
      { p: "Note the split inside `arguments`. **`input`** is the request itself — path, headers, body. **`config`** is *which device to send it to*, via `resourceId`. Two different kinds of information, deliberately not mixed: the same request can be aimed at any resource." },
      { note: { tone: "warn", text: "**Actions run in sequence.** Worth stating twice because the spec says otherwise and people carry that assumption in. If you need concurrency you need a `parallel` state (Room 07), not a longer action list. Four actions at 30 seconds each is two minutes, guaranteed, every run." } },
      { p: "Where does that operation string come from, what is a worker really, and why is a version number part of the name? All three are answered one floor up, in the Machine Shop. One thing to carry with you: **that string is a fact about a cluster, not a constant.**" }
    ],
    key: "`functions[]` names capabilities, `actions[]` invokes them, and the fully qualified operation ID belongs to the cluster — never to the file.",
    palace: {
      story: [
        "The **machine catalogue** bolted to the wall is `functions[]`. Each page: a nickname you shout on the floor (\"Patcher\"), the full model number stamped on the machine's plate, and which **operator** is certified to run it. The nickname is local slang; the model number is the truth; the operator is the worker.",
        "The **numbered stations** along the conveyor are `actions[]`. Station 1, then station 2, then station 3 — and here is the thing the room is built to teach: **there is exactly one conveyor.** A crate cannot be at two stations at once. That is sequential execution, and it is a property of the building, not of the crates.",
        "At each station the worker holds two clipboards. The left one is **`input`**: what to do. The right one is **`config`**: which machine on the factory floor to do it to. Same instructions, different machine, just by swapping the right clipboard."
      ],
      table: [
        ["Machine catalogue on the wall", "`functions[]`"],
        ["Nickname shouted on the floor", "`functions[].name`, used by `refName`"],
        ["Model number on the plate", "The fully qualified `operation`"],
        ["Certified operator", "`metadata.worker`"],
        ["Numbered stations, one conveyor", "`actions[]`, executed in sequence"],
        ["Left clipboard", "`arguments.input` — the request"],
        ["Right clipboard", "`arguments.config.resourceId` — the target"]
      ]
    },
    drills: [
      { type: "jq", id: "d3-1", title: "Print the catalogue",
        prompt: "For each function, emit `Name -> operation [worker]`. Exact format: the name, three spaces, `->`, three spaces, the operation, then a space and `[worker: NAME]`.",
        input: S.setHostname, opts: { raw: true },
        solution: ".functions[] | \"\\(.name)  ->  \\(.operation)   [worker: \\(.metadata.worker)]\"",
        expect: "REST.Patch  ->  generic.rest.v2.0.0.request.Patch   [worker: cwm-solutions-generic.rest]\nREST.Get  ->  generic.rest.v2.0.0.request.Get   [worker: cwm-solutions-generic.rest]",
        hint: 'Interpolate three fields: `"\\(.name)  ->  \\(.operation)   [worker: \\(.metadata.worker)]"`. The worker is nested under `metadata`.',
        why: "Two functions, one adapter version, one worker. They agree — but only since 2026-09-10, when `clear-vty-sessions` was moved to match the confirmed v2.0.0. Before that the two files in this repo disagreed." },
      { type: "jq", id: "d3-2", title: "Which worker runs what",
        prompt: "Collect the distinct worker names used anywhere in this workflow, as an array.",
        input: S.setHostname,
        solution: "[.functions[].metadata.worker] | unique",
        expect: '[\n  "cwm-solutions-generic.rest"\n]',
        hint: "Map the functions to their worker, collect with `[ ]`, then `unique`.",
        why: "One worker for this whole workflow. A workflow can spread its functions across several workers, and when an action fails mysteriously, \"which worker was meant to run this?\" is an early question worth being able to answer in one command." },
      { type: "predict", id: "d3-3", title: "Trace the request",
        prompt: "In `set-hostname`, action `patchHostname` has `refName: \"REST.Patch\"` and `config.resourceId: \"${ .deviceIp }\"`. The form submits `deviceIp = 192.0.2.10`. Which device does the request go to?",
        choices: [
          "The device at IP 192.0.2.10, resolved by DNS",
          "Whichever Generic REST resource has the ID `192.0.2.10`",
          "The default resource configured on the worker",
          "It is chosen by the adapter at runtime"
        ],
        answer: 1,
        why: "CWM does not resolve IPs. `resourceId` is a **literal name match** against your configured resources — so a Generic REST resource must already exist whose *ID* is the string `192.0.2.10`. Room 06 unpacks the consequences." },
      { type: "classify", id: "d3-4", title: "Which clipboard?",
        prompt: "Sort each piece of information into the argument block it belongs in.",
        buckets: ["input", "config"],
        items: [
          { text: "`restconf/data/Cisco-IOS-XE-native:native/hostname`", bucket: "input" },
          { text: "`resourceId`", bucket: "config" },
          { text: "`Content-Type: application/yang-data+json`", bucket: "input" },
          { text: "The JSON request body", bucket: "input" },
          { text: "Which device to send it to", bucket: "config" }
        ],
        why: "The split is what lets one request definition be aimed at any device. Mix them and you have hard-coded a target into a request." },
      { type: "predict", id: "d3-5", title: "Why sequence is required here",
        prompt: "`clear-vty-sessions` runs GET config, PUT an EEM applet, `sleep PT5S`, DELETE the applet. Why is sequential execution not merely convenient but **required**?",
        choices: [
          "It is not required; it is just how CWM happens to work",
          "Each step depends on the previous one having landed on the device — delete before the applet fires and the VTY lines never clear",
          "Because RESTCONF does not support concurrent requests",
          "Because the sleep state blocks the worker"
        ],
        answer: 1,
        why: "Run PUT and DELETE concurrently and you race the device. The `sleep` is there precisely because CWM cannot see whether the applet has fired — it can only wait a plausible interval. `PT5S` is an assumption about someone else's timing, which is why this workflow is the repo's best example of *and this is the part that could bite you*." }
    ],
    recall: [
      "Explain why `input` and `config` are separate, and what you would change to point the same request at a different device.",
      "A workflow validates but every job fails immediately at the first action. List three candidate causes from this room alone.",
      "Your colleague adds a fourth action to an operation state to \"speed things up by running it alongside the others\". Correct them, and say what they should do instead."
    ],
    gate: "You can read any action and state its method, path, target resource and result location without running it.",
    sources: [
      "`functions` and `actions` quoted verbatim from `workflows/`.",
      "The sequential-actions deviation: Tech Buddy, 2026-09-10, recorded in `content-memory/02-research.md`.",
      "`resourceId` semantics: decision D-02."
    ]
  }
  ];
})(typeof window !== "undefined" ? window : globalThis);
