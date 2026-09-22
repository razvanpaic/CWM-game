/* Rooms 04-07: adapters, switch, secrets and resources, loops. */
(function (root) {
  "use strict";
  var S = root.SAMPLES;

  root.ROOMS_04_07 = [
  {
    n: 4, name: "The Machine Shop", tagline: "adapters, workers and operation IDs",
    location: "Fourth floor, and the noisiest room in the building. Crates of machinery arrive shrink-wrapped, a foreman checks each maker's seal before anything is unbolted, and a board on the wall lists which operators are certified on which machine.",
    reused: "The machine catalogue from the Assembly Line one floor down. Room 03 taught you to *read* that catalogue; this room is where the machines are installed and the catalogue gets written.",
    runnable: "partly",
    predict: [
      { q: "CWM cannot speak RESTCONF, NETCONF or SSH on its own. So what actually does?",
        a: "An **adapter** — a plugin carrying the protocol knowledge — plus a **worker** process that executes its activities. CWM orchestrates; adapters do the talking." },
      { q: "You upload an adapter. Can workflows call it immediately?",
        a: "Not necessarily. An adapter with no worker assigned to its activities is installed but unusable — and the failure looks like a runtime error, not an install error." },
      { q: "Somebody hands you an adapter `tar.gz` from a colleague's laptop. Should you deploy it?",
        a: "Be careful. From CWM 2.1 adapters can be **digitally signed** and CWM verifies the signature at deployment. An unsigned adapter is code you are about to run against your network devices with stored credentials." }
    ],
    teach: [
      { p: "Room 03 left a question hanging. An action names a function, the function names an `operation`, and that operation is `generic.rest.v2.0.0.request.Patch`. But where does that string come from, and who actually performs the HTTP request?" },
      { p: "Start from what CWM is. It is a **workflow engine**: it reads a definition, tracks state, moves data, decides what runs next. It contains no protocol knowledge whatsoever. It cannot open a RESTCONF session any more than a train timetable can drive a train." },
      { p: "So the protocol knowledge lives in **adapters** — plugins you install. Each exposes **activities**, the individual callable operations. And activities do not execute inside the engine either; they execute in a **worker**, a separate process the engine dispatches to." },
      { code: "workflow action\n  -> functionRef.refName      names a catalogue entry\n  -> functions[].operation    the fully qualified activity ID\n  -> adapter                  supplies that activity\n  -> worker                   the process that runs it\n  -> resource + secret        where to connect, and as whom   (Room 06)\n  -> the device" },
      { p: "Every link can break independently, which is why a failing action needs a chain of checks rather than one." },
      { h: "The two namespaces, and why mixing them fails" },
      { table: { headers: ["Adapter", "Pattern", "Example"], rows: [
        ["Generic REST", "`generic.rest.v<ver>.request.<Method>`", "`generic.rest.v2.0.0.request.Patch`"],
        ["Cisco NSO", "`cisco.nso.v<ver>.restconf.<Method>`", "`cisco.nso.v1.0.3.restconf.Post`"]
      ] } },
      { p: "Note the segment before the method differs — `request` versus `restconf`. These are not interchangeable spellings of the same thing; they are different adapters with different argument shapes. Substituting one for the other produces an unresolvable operation, and the error arrives at runtime." },
      { h: "Version is a property of the cluster, not of the file" },
      { p: "Both workflows here declare `generic.rest.v2.0.0`, which is **confirmed tested and working** on the target cluster. Yet no Cisco document we can reach mentions a v2.0.0 Generic REST adapter: the Operator Guide shows `v1.0.3` as installed and default, public examples show `v1.0.1`, and `v1.0.2` also exists." },
      { note: { tone: "warn", text: "Notice that the published set already disagrees with itself. **That is the tell.** Cisco's documentation lags the adapters actually shipping, so the authoritative answer for *your* cluster is never in a PDF — it is in the cluster: `GET /systemFunction`, or Administration \u2192 Adapters showing which version is In Use." } },
      { h: "Lifecycle" },
      { p: "**Packaged** as a `tar.gz`. **Signed**, from 2.1 — *\"adapters can now be digitally signed by their developers and CWM will verify the signature upon adapter deployment\"*, with a Public Key API for the verifying keys. This is a supply-chain control, and it matters: an adapter is arbitrary code that receives your stored device credentials." },
      { p: "**Deployed** through Administration or `POST /adapter` (2.1 added a `force` option for uploading despite conflicts — respect the conflict, it usually meant something). **Given a worker:** the upload dialog offers *\"Automatically create worker for this adapter\"*; via API you can suppress it with `createWorker=false`, which is exactly how you end up with an installed adapter nothing can call." },
      { p: "**Custom adapters** are possible with the Adapter SDK and XDK. The XDK can inspect a YANG model and generate an activity for a path, so \"no adapter for this device\" is solvable rather than a dead end." },
      { p: "One worker you will never see: Get Started notes CWM uses an internal worker called the **execution engine**, which *\"enables the execution of all other workflow definitions and is not visible to you in the user interface\"*." }
    ],
    key: "CWM orchestrates but cannot speak any protocol; adapters supply the activities, workers execute them, and the fully qualified operation ID is a fact about your cluster.",
    palace: {
      story: [
        "The machine shop is loud. Crates of machinery arrive **shrink-wrapped with a maker's seal** — that is the signed `tar.gz`. By the roller door stands the **foreman**, whose only job is to check the seal before anything is unbolted. He refuses unsealed crates, and he is right to, because whatever is inside gets handed the vault keys from two floors up.",
        "Unbolt a machine and it goes onto the floor. But a machine on the floor **does nothing**. It needs a **certified operator**, and the board on the wall lists who is certified on what. Sign for a machine and forget to assign an operator and it stands there gleaming and idle — which is the `createWorker=false` trap, and the reason \"the adapter is installed\" and \"the adapter works\" are different claims.",
        "Every machine has a **model plate riveted to its housing**: maker, family, version, function. The catalogue downstairs is copied *from these plates*. So when the catalogue disagrees with the plate, **the plate wins** — and when the printed manual in the office disagrees with the plate, the plate still wins.",
        "Two makers supply this shop and their plates are stamped differently: one reads `...request.<Method>`, the other `...restconf.<Method>`. They are not the same machine with two labels, and an order written against the wrong plate is simply unfillable.",
        "And in the back corner, humming behind a partition, is **one machine with no plate at all and no operator listed**. It came with the building. That is the execution engine."
      ],
      table: [
        ["Shrink-wrapped crate with a maker's seal", "Signed adapter `tar.gz`"],
        ["Foreman checking the seal", "Signature verification at deployment"],
        ["Machine on the floor with no operator", "Adapter installed, no worker assigned"],
        ["Certification board on the wall", "Activities assigned to workers"],
        ["Model plate riveted to the housing", "The fully qualified operation ID"],
        ["**Plate beats catalogue; plate beats manual**", "**The cluster is authoritative, not the docs**"],
        ["Two makers, differently stamped plates", "`generic.rest...request` vs `cisco.nso...restconf`"],
        ["Unplated machine behind the partition", "The execution engine, invisible in the UI"]
      ]
    },
    drills: [
      { type: "jq", id: "d4-1", title: "Read every plate in the shop",
        prompt: "`clear-vty-sessions.sw.json` is loaded. Collect the distinct fully qualified operations it uses, as a sorted array.",
        input: S.clearVty,
        solution: "[.functions[].operation] | unique",
        expect: '[\n  "generic.rest.v2.0.0.request.Delete",\n  "generic.rest.v2.0.0.request.Get",\n  "generic.rest.v2.0.0.request.Put"\n]',
        hint: "Collect with `[ ]`, then `unique` (which also sorts).",
        why: "Three activities, one adapter family, one version. Running this before importing a workflow tells you exactly which activities the target cluster must provide." },
      { type: "jq", id: "d4-2", title: "Take the plate apart",
        prompt: "From those same operations, extract just the HTTP **method** — the last dot-separated segment — as a sorted distinct array.",
        input: S.clearVty,
        solution: "[.functions[].operation | split(\".\") | last] | unique",
        expect: '[\n  "Delete",\n  "Get",\n  "Put"\n]',
        hint: "`split(\".\")` turns the ID into an array of segments; `last` takes the final one.",
        why: "The operation ID has four independent parts — family, version, kind, method — and **each one can be wrong on its own**. Wrong family: no such adapter. Wrong version: adapter present but not that build. Wrong kind: `request` where the adapter wants `restconf`. Wrong method: no such activity. All four surface as similar-looking runtime failures, so decomposing the string is genuinely how you debug it." },
      { type: "jq", id: "d4-3", title: "Which adapter build does this workflow demand?",
        prompt: "Produce a single string naming the adapter family and version this workflow requires — everything before `.request.` — deduplicated. Raw is on.",
        input: S.clearVty, opts: { raw: true },
        solution: '[.functions[].operation | split(".request.")[0]] | unique | join(", ")',
        expect: "generic.rest.v2.0.0",
        hint: "`split(\".request.\")` gives two halves; take index `[0]`.",
        why: "One line that answers \"what must be installed for this to run?\". If it returned two entries you would know the workflow spans adapter versions — which is legal, and worth noticing before you deploy." },
      { type: "classify", id: "d4-4", title: "Upload, validation, or runtime?",
        prompt: "When does each mistake actually surface?",
        buckets: ["Upload", "Runtime"],
        items: [
          { text: "The adapter `tar.gz` is unsigned and the cluster verifies signatures", bucket: "Upload" },
          { text: "Deployed with `createWorker=false` and nothing else done", bucket: "Runtime" },
          { text: "Workflow says `v1.0.1` but `v2.0.0` is installed", bucket: "Runtime" },
          { text: "`cisco.nso.v1.0.3.request.Post` — right family, wrong kind", bucket: "Runtime" },
          { text: "The worker exists but has no Generic REST activities assigned", bucket: "Runtime" }
        ],
        why: "Four of five are runtime. That is the pattern to internalise: **the adapter layer is almost entirely unvalidated at authoring time.** A workflow importing cleanly says nothing about whether it can call anything — exactly the lesson Room 06 repeats about secrets." },
      { type: "predict", id: "d4-5", title: "Docs versus cluster",
        prompt: "The Operator Guide says the Generic REST adapter is `v1.0.3`. Your cluster's Administration \u2192 Adapters page shows `v2.0.0` In Use, and a workflow using v2.0.0 runs successfully. Which do you write in your workflow?",
        choices: [
          "v1.0.3 — the documentation is the specification",
          "v2.0.0 — an adapter present on the cluster is a fact about that cluster",
          "Neither; raise a bug and wait for the docs to be corrected",
          "Both, and let CWM pick"
        ],
        answer: 1,
        why: "This is exactly decision D-09 in this project. The published set already contradicted itself (v1.0.3 as default, v1.0.1 in examples), which is the signal that documentation lags shipping adapters. Read it from the cluster — and re-read it on every new cluster, because it does not travel." }
    ],
    recall: [
      "Explain to someone who thinks CWM \"talks to devices\" what actually happens, naming every component in the chain.",
      "A workflow that ran perfectly on cluster A fails on its first action on cluster B, having imported without complaint. List the checks you would make, in order.",
      "Why is adapter signing a security control rather than housekeeping? What does an adapter have access to?"
    ],
    gate: "You can take any operation ID apart into family, version, kind and method, and say where each part is verified — and where it is not.",
    sources: [
      "Adapter packaging, the auto-create-worker dialog and the execution engine: CWM 2.1 Get Started Guide.",
      "Adapter Manager, Worker Manager, SDK/XDK: CWM 2.1 Administrator Guide.",
      "Adapter signing, Public Key API, `POST /adapter` `force`, `createWorker=false`, `GET /systemFunction`: CWM 2.1 Release Notes.",
      "The v2.0.0 decision and why the cluster outranks the docs: D-09."
    ]
  },

  {
    n: 5, name: "The Fork in the Corridor", tagline: "switch, conditions and the null guard",
    location: "Fifth floor. The corridor splits in two. Above the split hangs a sign with a small reading window, and a sleepy porter who checks each crate's label before waving it left or right.",
    reused: "The crate's label from the Loading Dock, the pigeonhole name the result was filed under in the Mailroom, and the patch cables each branch leads to.",
    runnable: "jq",
    predict: [
      { q: "A `switch` state has three `dataConditions`. Two are true. Which branch is taken?",
        a: "The **first**, in array order. This is the one place in a workflow where order in the file *does* matter — which is exactly why it catches people who learned Room 02 well." },
      { q: "What happens if none are true and there is no `defaultCondition`?",
        a: "The workflow has nowhere to go. That is an authoring error, not something the engine recovers from gracefully. Always supply a default." },
      { q: "Cisco writes a condition as `if (.checkSyncResult0) then .checkSyncResult0 != \"in-sync\" else null end`. Why not just `.checkSyncResult0 != \"in-sync\"`?",
        a: "Because of what happens when the field is *missing*. Room 00's guard in a new costume — and Drill 2 makes the difference visible." }
    ],
    teach: [
      { p: "Every state so far had exactly one exit. A `switch` state is the first with more than one, and it decides between them by **asking questions of the data** — nothing else. It cannot query a device or call an adapter. It reads what previous states filed in the pigeonholes." },
      { p: "That is why Room 01 mattered so much. A `switch` is only as good as the names `toStateData` created. If a result was never filed, the switch is blind." },
      { code: '{\n  "name": "syncFromOrCreateVPN",\n  "type": "switch",\n  "stateDataFilter": { "input": "${ . }" },\n  "dataConditions": [\n    { "condition": "${ ... }", "transition": "SyncFromDevice0" },\n    { "condition": "${ ... }", "transition": "CreateService" }\n  ],\n  "defaultCondition": { "transition": "GiveUp" }\n}' },
      { p: "**Conditions are evaluated in order, first truthy wins.** Later conditions are never even evaluated. So order most-specific-first, and understand that overlapping conditions are not an error — they are a silent precedence decision you made by typing them in that order." },
      { p: "**`defaultCondition` is your only safety net.** Not optional in any workflow you intend to trust." },
      { p: "**A condition is a jq filter, so jq's truthiness rules apply** — and they are narrow: only `false` and `null` are falsy. `0` is truthy. `\"\"` is truthy. `[]` is truthy. `{}` is truthy. If you come from Python or JavaScript, at least two of those will surprise you." },
      { h: "The null guard, properly explained" },
      { p: "Consider what the naive version does when `checkSyncResult0` is **absent**: `null != \"in-sync\"` evaluates to `true`. So a missing result — a state that never ran, an action whose `toStateData` was forgotten — routes as though the device were **out of sync**, and the workflow confidently takes remedial action based on information it never received. It does not error. It does not warn. It just goes the wrong way." },
      { p: "The guard converts that case to `null`, which is falsy, so the condition simply does not match and evaluation moves on — eventually reaching `defaultCondition`, where a missing result is handled deliberately." },
      { note: { tone: "bad", text: "**The principle generalises: never compare a value you have not confirmed exists.** In jq the absent case is not an error, it is `null`, and `null` compares happily against anything." } }
    ],
    key: "A switch reads only what earlier states filed; guard before comparing, because a missing value routes confidently and wrongly.",
    palace: {
      story: [
        "The corridor forks. Above it hangs a **sign with a reading window** — the porter can see only what is written on the crate's label. He cannot open the crate, he cannot phone the factory floor. Whatever the Mailroom clerk wrote on that label is his entire universe.",
        "He works down a **short list of rules on a clipboard**, in order, and stops at the first that matches. Rules further down the list he never reads.",
        "At the end of his list is a **standing instruction** — \"anything else, take it to the supervisor\". That is `defaultCondition`. Without it, a crate matching no rule just sits in the corridor forever.",
        "And the detail worth remembering, because it is the bug: the porter is **short-sighted and does not admit it**. Hand him a crate with a *blank* label and he does not stop to ask. He reads the blank as \"not in-sync\", nods, and waves it down the remediation corridor. Confident, fast, wrong. The **guard** is the assistant who checks a label exists at all before the porter is allowed to read it."
      ],
      table: [
        ["The fork", "A `switch` state's multiple exits"],
        ["Reading window on the sign", "Conditions see only workflow data"],
        ["Clipboard of rules, in order", "`dataConditions[]`, first truthy wins"],
        ["Standing instruction", "`defaultCondition`"],
        ["Short-sighted confident porter", "`null != \"in-sync\"` evaluating to `true`"],
        ["The assistant checking a label exists", "`if (.field) then ... else null end`"]
      ]
    },
    drills: [
      { type: "jq", id: "d5-1", title: "jq truthiness, which is narrower than you think",
        prompt: "The input is a list of seven values. Map each to `\"T\"` if jq considers it truthy and `\"F\"` if falsy.",
        input: [null, false, 0, "", [], {}, "text"],
        solution: 'map(if . then "T" else "F" end)',
        expect: '[\n  "F",\n  "F",\n  "T",\n  "T",\n  "T",\n  "T",\n  "T"\n]',
        hint: "`map(...)` with an `if . then ... else ... end` inside.",
        why: "**Only `null` and `false` are falsy.** An empty array is truthy — so `if (.devices) then ...` passes happily on a device list that came back empty, and the branch runs against nothing. Test emptiness explicitly with `(.devices | length) > 0`." },
      { type: "jq", id: "d5-2", title: "Watch a missing value route confidently and wrongly",
        prompt: "The input is an empty object — the result was never filed. Produce an object with two keys: `naive`, holding `.checkSyncResult0 != \"in-sync\"`, and `guarded`, holding the guarded version that yields `null` when the field is absent.",
        input: {},
        solution: '{naive: (.checkSyncResult0 != "in-sync"), guarded: (if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end)}',
        expect: '{\n  "naive": true,\n  "guarded": null\n}',
        hint: "Two entries in one object. Wrap each condition in parentheses.",
        why: "`naive` says **\"yes, remediate\"** about a device it knows nothing about. `guarded` says \"I have no answer\", which is falsy, so the branch is skipped and the default handles it. One line apart. One of them silently reconfigures production hardware based on absent data. This is the highest-value single fact in the room." },
      { type: "jq", id: "d5-3", title: "Evaluate a real condition set by hand",
        prompt: "Now run the guarded pair across three different data states at once. The input is an array of three states; map each to `{needsSync, isSynced}` using guarded conditions.",
        input: [{ checkSyncResult0: "in-sync" }, { checkSyncResult0: "out-of-sync" }, {}],
        solution: 'map({needsSync: (if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end), isSynced: (if (.checkSyncResult0) then .checkSyncResult0 == "in-sync" else null end)})',
        expect: '[\n  {\n    "needsSync": false,\n    "isSynced": true\n  },\n  {\n    "needsSync": true,\n    "isSynced": false\n  },\n  {\n    "needsSync": null,\n    "isSynced": null\n  }\n]',
        hint: "Same shape as the last drill, wrapped in `map(...)`.",
        why: "Both guarded conditions go `null` on the empty state — neither matches, so control reaches `defaultCondition`. That is the design working: an unknown state is routed *deliberately* rather than guessed at." },
      { type: "predict", id: "d5-4", title: "The empty-list trap",
        prompt: "A `foreach` is guarded by `if (.devices) then ... else ... end`. A query returns `{\"devices\": []}` — no devices are out of compliance. What happens?",
        choices: [
          "The guard fails, the branch is skipped, nothing runs — correct behaviour",
          "The guard passes, the loop iterates zero times, the job reports success and changes nothing",
          "jq errors because you cannot iterate an empty array",
          "CWM warns that the collection is empty"
        ],
        answer: 1,
        why: "`[]` is truthy, so the guard passes. Combined with Room 01's lesson about results going nowhere, this is how a workflow ends up \"succeeding\" every night while doing absolutely no work — and nobody notices for months. Room 07 has the fix." }
    ],
    recall: [
      "Explain why `[]` being truthy in jq is dangerous in a `switch` condition, and give the fix.",
      "Two `dataConditions` overlap. Nothing errors. Describe what you have actually committed to, and how you would discover it six months later.",
      "Reconcile this room with Room 02: order in `states[]` is meaningless, but order in `dataConditions[]` is decisive. Why is that not a contradiction?"
    ],
    gate: "You can look at a `switch` state and name every data field it depends on, plus which earlier action was responsible for filing each one.",
    sources: [
      "The `checkSyncResult0` conditions and `stateDataFilter.input` are quoted verbatim from the CWM Get Started Guide CreateL3VPN example.",
      "`switch` is confirmed supported in both the public and internal source sets — one of the few state types with no contradiction attached."
    ]
  },

  {
    n: 6, name: "The Vault", tagline: "secrets, resources, and what indirection does not protect",
    location: "Fifth floor's neighbour, and the only room with a steel door. Numbered deposit boxes line the walls. A counter, a clerk behind glass, and a rack of brass tags by the entrance.",
    reused: "The right-hand clipboard from the Assembly Line — `config.resourceId` — is the tag you carry in here.",
    runnable: "jq",
    predict: [
      { q: "Your workflow must authenticate to a router. Where does the password live?",
        a: "In a **secret**, referenced by a **resource**, which the workflow references by ID. Three levels of indirection, and the workflow never holds the credential." },
      { q: "`set-hostname` passes `\"resourceId\": \"${ .deviceIp }\"`. What must be true about your resource?",
        a: "Its ID must be *exactly* the string typed into the form's Device IP field. The resource is named after the device's IP — this trips up almost everyone once." },
      { q: "Credentials are encrypted at rest and never appear in the workflow. Can an operator still see them?",
        a: "**Yes.** CWM's job event history can display decrypted secret values. The indirection protects the definition, not the run log. This is the room's most important fact." }
    ],
    teach: [
      { p: "Start from the constraint: **a workflow definition is source code.** It gets exported, imported, pasted into a ticket, committed to git, and mailed around. Anything inside it is effectively public." },
      { p: "Yet the workflow must reach a device that demands a username and password. So the design problem is: how does a workflow authenticate without ever containing a credential? The answer is indirection, in three layers." },
      { p: "**A secret holds the credential.** Nothing else. Schemas are `basicAuth` (username and password), `token`, and `bearer`. It has a **Secret ID**, and that ID is the only part anyone else ever names." },
      { p: "**A resource holds the connection details, and points at the secret.** Host, port, scheme, timeout — plus the Secret ID. Each resource has a type matching its adapter: `generic.rest.resource.v1.0.0`, `cisco.nso.resource.v1.0.0`, `system.event.kafka.v1.0.0`." },
      { p: "**The workflow names only the resource**, through `config.resourceId`. So the chain runs: `resourceId` \u2192 resource \u2192 Secret ID \u2192 secret \u2192 credential. The workflow knows the first link. It cannot see the last." },
      { h: "The trap that gets everyone once" },
      { p: "`set-hostname.sw.json` passes `\"resourceId\": \"${ .deviceIp }\"`. That is not a lookup by address — CWM does not resolve IPs to resources. It is a **literal name match**. Type `192.0.2.10` into the form and CWM looks for a resource *called* `192.0.2.10`. If it does not exist, the job fails at runtime — not at validation, since the name is only known once the form is submitted." },
      { h: "The thing indirection does not protect" },
      { note: { tone: "bad", text: "Everything above secures the *definition*. It does nothing for the *run*. **CWM's job event history can display decrypted secret values.** A workflow with no credentials in it, using a properly stored secret, can still leak that secret through a job's history view. Treat access to job history as equivalent to access to the credentials themselves, and never demo a job whose history contains a real credential." } },
      { h: "Lab-only settings, stated as such" },
      { p: "Lab resources typically set **`Allow Insecure: true`** so the adapter accepts a device's self-signed certificate. That is a lab-only setting and there is no version of it that is acceptable in production. In production, validate the chain and require a certificate with a **SHA-2 signature** and an **RSA \u2265 2048 or P-256** key. Anything signed with MD5 or SHA-1 is forgeable by collision attack; anything weaker than those key sizes is too weak to rely on." }
    ],
    key: "The workflow carries a tag, never the contents — but the job's history can still show the contents, so protect the history too.",
    palace: {
      story: [
        "By the steel door is a **rack of brass tags**. You take one. Stamped on it is a number and nothing else — no name, no address, no hint of what it opens. The tag is `resourceId`, and carrying it through the building is completely safe. Drop it in the street and a finder learns nothing.",
        "You hand the tag through the glass. The **clerk** consults her ledger: which box, which address, which key. She is the resource. She knows the host, the port, the scheme, and which deposit box holds the key.",
        "Behind her, the **numbered deposit boxes** are the secrets. You never see inside one. You never learn a box number. The clerk fetches what is needed and does the work on your behalf.",
        "Then the detail that makes this room worth its steel door. On the counter sits a **visitor's logbook, open, facing outward** — and the clerk, being thorough, writes down *what she retrieved*. Not the tag number. The contents. Anyone who wanders in and reads the logbook learns everything the vault was built to protect. **That is job event history.**"
      ],
      table: [
        ["Brass tag, number only", "`config.resourceId` — safe to carry anywhere"],
        ["Clerk with the ledger", "The resource: host, port, scheme, Secret ID"],
        ["Numbered deposit box", "The secret: `basicAuth`, `token`, `bearer`"],
        ["You never see inside a box", "The workflow cannot read credentials"],
        ["**The open visitor's logbook**", "**Job event history, which can show decrypted secrets**"],
        ["Propping the steel door with a brick", "`Allow Insecure: true` — lab only"]
      ]
    },
    drills: [
      { type: "jq", id: "d6-1", title: "Prove no credential is present",
        prompt: "The whole of `set-hostname.sw.json` is loaded. Count how many of its leaf paths have a credential-shaped key name — matching `password`, `secret` or `token`, case-insensitively.",
        input: S.setHostname,
        solution: '[paths(scalars) | map(tostring) | join(".")] | map(select(test("(?i)password|secret|token"))) | length',
        expect: "0",
        hint: "`paths(scalars)` emits an array-path to every leaf. Join each into a dotted string, `select` the matches, then take `length`.",
        why: "Zero. Note this asks a *structural* question — is there a credential-bearing key? — rather than a textual one. A plain `grep` for those words actually matches this file twice, because the `description` field discusses secret handling in prose. A scanner that cries wolf gets switched off." },
      { type: "jq", id: "d6-2", title: "Now catch a real one",
        prompt: "Same filter, different input: someone has hard-coded a password into a resource block. Return the offending dotted paths as an array.",
        input: { resource: { host: "192.0.2.10", password: "hunter2" } },
        solution: '[paths(scalars) | map(tostring) | join(".")] | map(select(test("(?i)password|secret|token")))',
        expect: '[\n  "resource.password"\n]',
        hint: "Same as the previous drill, minus the `length`.",
        why: "This is a two-second check worth running before you export or share any workflow, and the failure mode it catches is career-shaped." },
      { type: "order", id: "d6-3", title: "Trace the chain",
        prompt: "Put the hops in order, from what the workflow holds to what reaches the device.",
        items: [
          "Action passes `config.resourceId` = `${ .deviceIp }`",
          "CWM looks for a resource whose ID is that literal string",
          "The resource supplies host, port, scheme — and a Secret ID",
          "The secret supplies the username and password",
          "The worker injects the credential and makes the call"
        ],
        shuffled: [
          "The secret supplies the username and password",
          "CWM looks for a resource whose ID is that literal string",
          "The worker injects the credential and makes the call",
          "Action passes `config.resourceId` = `${ .deviceIp }`",
          "The resource supplies host, port, scheme — and a Secret ID"
        ],
        why: "Four hops of separation from one field. The workflow knows hop 1 and cannot reach hop 4." },
      { type: "classify", id: "d6-4", title: "When does it fail?",
        prompt: "For each misconfiguration, say whether it is caught when the workflow is imported, or only when a job runs.",
        buckets: ["Import / validation", "Runtime"],
        items: [
          { text: "The resource `192.0.2.10` does not exist", bucket: "Runtime" },
          { text: "The resource's Secret ID points at a deleted secret", bucket: "Runtime" },
          { text: "Resource type does not match the adapter's major version", bucket: "Runtime" },
          { text: "The workflow JSON is missing a required `start` key", bucket: "Import / validation" }
        ],
        why: "Every secret- and resource-level mistake is a **runtime** failure. That is the real lesson: **this layer is almost entirely unvalidated at authoring time.** A workflow that imports cleanly tells you nothing about whether it can authenticate. And the deleted-secret case is the nastiest, because workflow and resource both look correct, so the error appears to come from the device rather than from CWM's own configuration." },
      { type: "predict", id: "d6-5", title: "The logbook",
        prompt: "You have done everything right: no credentials in the workflow, a properly stored `basicAuth` secret, a correctly typed resource. A junior engineer with operator access opens a completed job and browses its event history. What can they see?",
        choices: [
          "Only the resource ID — the secret is masked everywhere",
          "Potentially the decrypted secret value",
          "Nothing; job history is admin-only by default",
          "A hash of the credential"
        ],
        answer: 1,
        why: "The indirection protects the definition, not the run log. Which means job-history access is credential access, and your access policy has to say so. This is one of those facts that only becomes real once you have seen it with your own eyes." }
    ],
    recall: [
      "Explain the three-layer indirection to a colleague, then explain what it does *not* protect.",
      "Why does `resourceId` being a literal name match — not an IP lookup — mean resource naming is part of your workflow's contract?",
      "Someone asks to leave `Allow Insecure: true` on for a customer pilot \"since it's not production yet\". Give your answer and your reasoning."
    ],
    gate: "You can explain why every failure in the classification drill is a runtime failure, and what that implies about testing.",
    sources: [
      "Secret schemas, resource types and the data model: CWM 2.1 Administrator Guide and Get Started Guide.",
      "Custom adapter-defined secrets using Protocol Buffers are new in 2.1 — Release Notes.",
      "The job-event-history exposure and the `Allow Insecure` caution come from `deliverables/guides/2026-09-04_set-hostname-restconf.md`, written from lab experience.",
      "Certificate and key strength requirements follow this repo's standing crypto rules — see `AGENTS.md`."
    ]
  },

  {
    n: 7, name: "The Loop Gallery", tagline: "foreach, parallel, and where concurrency lives",
    location: "Seventh floor. On the left, a hall of mirrors where the same room repeats away into the distance. On the right, a chamber with several doors that all swing open at once.",
    reused: "The single conveyor from the Assembly Line — this room is where you finally get a second one, and learn where it is *not* allowed to be.",
    runnable: "jq",
    predict: [
      { q: "You must set the hostname on 40 devices. Do you write 40 actions?",
        a: "No — one `foreach` state iterating a collection of 40." },
      { q: "Room 03 said operation-state actions run in sequence only. So how does CWM ever do two things at once?",
        a: "With a `parallel` state, which has concurrent **branches**. Concurrency lives at the state level, never inside one operation state's action list." },
      { q: "Cisco's Workflow Creator Guide lists supported state types as *\"operation, switch, sleep, inject, foreach\"*. Is that the complete list?",
        a: "No — and we can now prove it. `callback` is confirmed supported (Room 10 is built on it) and the Administrator Guide contains a working `event` state. Neither appears in that list, so treat it as partial rather than a denial." }
    ],
    teach: [
      { p: "Two different needs get confused constantly, so separate them before anything else. **Repetition** — do the same thing to many items: `foreach`. **Concurrency** — do different things at the same time: `parallel`. They are orthogonal. You can repeat sequentially, and you can run two different branches concurrently without repeating anything." },
      { p: "**`foreach`** iterates a collection held in workflow data, running its actions once per element. It exists so you never hand-write loop logic — and, more importantly, so the collection can be *discovered at runtime*. You do not know at authoring time how many devices are out of compliance. A `foreach` over `.nonConformantDevices` does not care." },
      { p: "**`parallel`** defines separate execution **branches** that run concurrently, then merges them back according to a completion type. Each branch owns its own actions." },
      { h: "Where concurrency is and is not allowed" },
      { note: { tone: "warn", text: "*\"While the full Serverless Workflow specification permits operation states to run actions in parallel, Cisco Crosswork Workflow Manager supports the execution of actions in sequence only.\"* So an operation state's action list is **always** a queue. Adding actions never adds concurrency. Four actions at 30 seconds each is two minutes, guaranteed, every run." } },
      { p: "If you want two things happening at once, that is a `parallel` state with two branches — a structural change, not a list change." },
      { h: "What we know, and the one thing we do not" },
      { p: "Treat `operation`, `switch`, `sleep`, `inject` and `foreach` as safe: all documented. Treat `event` and `callback` as supported too — `callback` is confirmed, and `event` has a working Administrator Guide example, which is how we established the public five-item list is incomplete rather than restrictive." },
      { note: { tone: "accent", text: "**`parallel` is the one still unconfirmed** on 2.1. It is documented with branches and completion types, and the sample catalogue includes a \"Parallel Tasks\" category — but we have no working example on this version. If you are about to depend on it for something that matters, spend ten minutes proving it on a cluster first: author two branches and try to publish. That is open question Q-07." } }
    ],
    key: "`foreach` repeats, `parallel` overlaps, and no amount of stacking actions inside one operation state will ever produce concurrency.",
    palace: {
      story: [
        "Turn left into the **hall of mirrors**. One room, reflected away to a vanishing point. Every reflection is the same room doing the same work — and crucially, you cannot count the reflections from the doorway. You find out how many there are by walking in. That is `foreach`: identical work, count unknown until runtime.",
        "Turn right instead, into a chamber with **several doors that all swing open at once**. Behind each is something *different* happening simultaneously, and the chamber will not let you leave until enough of them have finished — the completion type decides how many \"enough\" is. That is `parallel`.",
        "Between the two, remember the Assembly Line four floors down: **it still has exactly one conveyor.** You cannot get concurrency by putting more stations on it. To overlap work you must physically come up here.",
        "And nailed to the gallery wall is a **directory of the building that is missing three rooms**. You are standing in one of the rooms it does not list. The directory is not wrong so much as incomplete — and the correct response is to note it and check, not to conclude the rooms are imaginary."
      ],
      table: [
        ["Hall of mirrors, uncountable from the door", "`foreach` — same work, runtime-sized collection"],
        ["Chamber of doors opening together", "`parallel` — different work, concurrent branches"],
        ["The one conveyor downstairs", "Operation-state actions, always sequential"],
        ["Turnstile that waits for enough doors", "The branch completion type"],
        ["Directory missing three rooms", "The five-item supported-types list. See Q-07"]
      ]
    },
    drills: [
      { type: "jq", id: "d7-1", title: "Size a collection before you iterate it",
        prompt: "Room 05 established that `[]` is truthy. The input is three data states. For each, produce `{naive, sized}`: `naive` uses `if (.devices)`, `sized` tests that the length is greater than zero and treats a missing key as empty. Use `\"RUN\"` and `\"SKIP\"`.",
        input: [{ devices: [] }, { devices: ["a", "b"] }, {}],
        solution: 'map({naive: (if (.devices) then "RUN" else "SKIP" end), sized: (if ((.devices // []) | length) > 0 then "RUN" else "SKIP" end)})',
        expect: '[\n  {\n    "naive": "RUN",\n    "sized": "SKIP"\n  },\n  {\n    "naive": "RUN",\n    "sized": "RUN"\n  },\n  {\n    "naive": "SKIP",\n    "sized": "SKIP"\n  }\n]',
        hint: "`(.devices // [])` supplies an empty array before you take `length`.",
        why: "The naive guard says RUN on an empty list — a `foreach` that iterates nothing, reports success, and changes nothing. Combined with Room 01's lesson about results going nowhere, this is how a workflow \"succeeds\" nightly while doing no work. `// []` collapses the missing and empty cases into one answer." },
      { type: "classify", id: "d7-2", title: "Choose the right structure",
        prompt: "For each requirement, pick the structure.",
        buckets: ["foreach", "parallel", "One operation state"],
        items: [
          { text: "Set the same hostname template on 40 routers", bucket: "foreach" },
          { text: "While an image uploads, post a status notification to Webex", bucket: "parallel" },
          { text: "Read a device's config, then patch it, then read it back", bucket: "One operation state" },
          { text: "Run a compliance check on every device returned by an earlier query", bucket: "foreach" },
          { text: "Archive the config and open a change ticket at the same time", bucket: "parallel" }
        ],
        why: "The third one is the interesting case: the steps depend on each other, so sequence is *required*, not merely acceptable — exactly the `clear-vty-sessions` pattern. And the fourth is canonical `foreach`: the collection size is unknown at authoring time." },
      { type: "predict", id: "d7-3", title: "Correct the colleague",
        prompt: "A colleague has one operation state with six actions and says it is fine because \"CWM parallelises them anyway\". What is actually true?",
        choices: [
          "They are right; CWM parallelises actions within a state",
          "The spec allows it but CWM runs them in sequence, so the state is a serial bottleneck",
          "CWM parallelises only read-only actions",
          "It depends on how many workers are assigned"
        ],
        answer: 1,
        why: "The spec permits parallel actions; CWM does not do it. Six actions is six waits, every run. If they need overlap, that is a `parallel` state with branches — a structural change, not a longer list." },
      { type: "match", id: "d7-4", title: "Repetition or concurrency?",
        prompt: "Match each idea to what it actually gives you.",
        pairs: [
          ["Same work, count discovered at runtime", "foreach"],
          ["Different work, overlapping in time", "parallel"],
          ["Ordered steps that depend on each other", "actions in one operation state"],
          ["Deciding how many branches must finish", "completion type"]
        ] }
    ],
    recall: [
      "Distinguish repetition from concurrency using an example of each that the other cannot do.",
      "Why is the empty-collection case more dangerous than the missing-collection case?",
      "You need `parallel` for a customer deliverable next week. Describe exactly how you would establish whether you can rely on it, and what you would do if the answer is no."
    ],
    gate: "You can pick the right state type for a requirement and say what evidence you have that CWM supports it.",
    sources: [
      "Sequential-actions deviation and the `foreach` / `parallel` descriptions: Tech Buddy, 2026-09-10.",
      "`callback` confirmed supported 2026-09-10 (D-10), which establishes the public five-item list as incomplete.",
      "**`parallel` remains unconfirmed on 2.1** — tracked as Q-07 with its closing test."
    ]
  }
  ];
})(typeof window !== "undefined" ? window : globalThis);
