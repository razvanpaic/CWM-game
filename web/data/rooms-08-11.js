/* Rooms 08-11: errors and compensation, events and brokers, callback, MOPs. */
(function (root) {
  "use strict";
  var S = root.SAMPLES;

  root.ROOMS_08_11 = [
  {
    n: 8, name: "The Alarm Room", tagline: "retries, backoff and compensation",
    location: "Eighth floor. Red lamps, a bell, a wall of labelled breakers — and in the corner, a staircase that only goes down, with each tread numbered in reverse.",
    reused: "The numbered stations of the Assembly Line. The reverse staircase visits them again, backwards, undoing.",
    runnable: "partly",
    predict: [
      { q: "An action has `maxAttempts: 4`. It keeps failing. What is the job's final status?",
        a: "**Failed.** Retries buy time against transient faults; they are not recovery. When the policy is exhausted the engine ends execution with status Failed." },
      { q: "Why would you ever mark an error **non**-retryable?",
        a: "Because retrying something that cannot succeed wastes the entire backoff window and delays the real failure. A 401 or a malformed request will fail identically four times." },
      { q: "A workflow patches three devices and the fourth step fails. Does CWM undo the first three?",
        a: "**No.** Nothing is undone unless you authored the undo yourself. Compensation exists, but it is explicit, manual, and never automatic." }
    ],
    teach: [
      { p: "Distributed systems fail in two categories, and conflating them is the root of most bad error handling." },
      { p: "**Transient failures** — the network dropped a packet, the device was briefly busy, a connection reset. The same request, sent again, will probably work. Retry helps." },
      { p: "**Deterministic failures** — wrong credentials, malformed body, a path that does not exist on that platform. The same request will fail identically forever. Retry only wastes time." },
      { h: "Retry policies" },
      { code: '"retries": [\n  { "name": "Default", "delay": "PT3S", "maxAttempts": 3,\n    "multiplier": 1.2, "maxDelay": "PT15S" }\n]' },
      { p: "Four fields describing **exponential backoff**: wait `delay` before the first retry, multiply the wait by `multiplier` each time, never wait longer than `maxDelay`, give up after `maxAttempts`. Durations are ISO 8601 — `PT3S` is three seconds, `PT30M` is thirty minutes." },
      { p: "Actions opt in with `retryRef: \"Default\"`. Declared once, referenced many times — so tuning the policy tunes every action that uses it." },
      { p: "Backoff exists because retrying instantly is worse than not retrying. A device that is briefly overloaded does not benefit from three more requests in the same second; it benefits from being left alone for a moment." },
      { h: "Error handling" },
      { p: "`onErrors` attaches named handlers to a state, each able to `transition` elsewhere or set `compensate: true`. `nonRetryableErrors` names the errors that must skip retry entirely. Errors are declared at the top level and can be adapter-specific — Cisco's example declares `\"nsoNotFound\"`." },
      { p: "The design principle: **retry is for the machine, error handling is for you.** Retry answers \"try again?\". `onErrors` answers \"what should the workflow *do* about it?\" — and only you can answer that." },
      { h: "Compensation, and what it is not" },
      { p: "You declare `compensatedBy` on a state, naming another state that undoes it. You trigger the unwind with `compensate: true`. CWM then runs the compensating states for completed states **in reverse sequential order**." },
      { note: { tone: "bad", text: "Three constraints, all of which matter. Compensation is **never automatic** — a failure does not trigger it, you author the trigger. It **cannot be dynamically triggered** by workflow data, event payloads, action results or errors: the decision is structural, not data-driven. And it **should not be executed in parallel**. So it is not a database transaction, and calling it \"rollback\" will mislead you." } },
      { p: "`clear-vty-sessions.sw.json` is worth studying here. It creates an EEM applet and deletes it in `DeleteEemApplet` — compensation logic in spirit, but implemented as a *normal forward step*. Which means: if the workflow fails between the PUT and the DELETE, **the applet is left on the device.** A real, honest limitation sitting in this repo." },
      { h: "Timeouts" },
      { p: "Separate from retry: retry is about repeating, timeout is about waiting. Documented examples include `resultEventTimeout: \"PT30M\"` and `actionExecTimeout: \"PT60M\"`. Fleet Upgrade's guidance says to raise Action, Event, State and Workflow timeouts to **at least 3600 seconds** for image distribution — a reminder that defaults are sized for API calls, not for moving gigabytes to a router." }
    ],
    key: "Retry handles transient faults automatically; everything else — routing, undoing, giving up — is something you have to author, and compensation never fires on its own.",
    palace: {
      story: [
        "**Red lamps and a bell.** Something has gone wrong. The bell rings a fixed number of times, with a longer pause between each ring — three seconds, then a little more, then more again, never longer than fifteen. That is the retry policy. When the last ring fades and nobody has answered, the shift is over. **Failed.**",
        "The **wall of labelled breakers** is `onErrors`. Each breaker is labelled with a specific fault and a specific corridor to take. Some have a red tag reading *do not reset* — `nonRetryableErrors`. Resetting those just burns the bell.",
        "Then the corner of the room, and the image to keep. A **staircase that only goes down**, treads numbered in reverse: 4, 3, 2, 1. To undo the day's work you walk down it, visiting each station you completed, in the opposite order, undoing what you did there.",
        "Three things about that staircase, all essential. Nobody is ever pushed down it — **you choose to walk it**. The treads exist only where **you built them**: a station with no tread is a station whose work is not coming undone. And you cannot decide to take the stairs based on what is written on a crate; the decision was made when the building was designed, not on the day."
      ],
      table: [
        ["Bell with lengthening pauses", "`delay` \u00d7 `multiplier`, capped by `maxDelay`"],
        ["Fixed number of rings", "`maxAttempts`; silence afterwards = Failed"],
        ["Wall of labelled breakers", "`onErrors` — named fault, chosen corridor"],
        ["Red *do not reset* tags", "`nonRetryableErrors`"],
        ["Reverse-numbered staircase", "Compensation, running completed states backwards"],
        ["You must choose to walk it", "`compensate: true` — never automatic"],
        ["Missing treads", "States with no `compensatedBy` — nothing is undone"],
        ["Sand timer by the door", "`actionExecTimeout`, `resultEventTimeout`"]
      ]
    },
    drills: [
      { type: "jq", id: "d8-1", title: "Read the policy",
        prompt: "Extract the retry policy from `set-hostname.sw.json` as a compact object with keys `name`, `delay`, `multiplier`, `maxAttempts`, `maxDelay`. Compact output is on.",
        input: S.setHostname, opts: { compact: true },
        solution: ".retries[0] | {name, delay, multiplier, maxAttempts, maxDelay}",
        expect: '{"name":"Default","delay":"PT3S","multiplier":1.2,"maxAttempts":3,"maxDelay":"PT15S"}',
        hint: "Index the first policy, then use object shorthand for all five keys.",
        why: "Every action in this workflow references this one policy by name. Changing it changes every action's failure behaviour at once — which is the point of naming it, and the risk of sharing it." },
      { type: "predict", id: "d8-2", title: "Compute the real budget",
        prompt: "With `delay: PT3S`, `multiplier: 1.2`, `maxAttempts: 3` and `maxDelay: PT15S`, roughly how long can one failing action occupy the workflow in waiting — and does the 15-second cap ever engage?",
        choices: [
          "About 45 seconds; the cap engages on the third retry",
          "About 11 seconds; the cap never engages",
          "About 15 seconds; the cap engages immediately",
          "Unbounded; maxAttempts only limits consecutive failures"
        ],
        answer: 1,
        why: "Waits are 3.00s, 3.60s and 4.32s — about **10.9 seconds** total. The `maxDelay: PT15S` cap is never reached: with a multiplier of 1.2 and only three attempts, the ceiling is decoration. A policy can look carefully tuned and have parameters that never engage. And eleven seconds is a *tight* budget for a device that is genuinely busy." },
      { type: "classify", id: "d8-3", title: "Retryable or not?",
        prompt: "Sort each failure by whether retrying it can possibly help.",
        buckets: ["Retry helps", "Retry is waste"],
        items: [
          { text: "`Connection reset by peer` mid-request", bucket: "Retry helps" },
          { text: "HTTP 401 Unauthorized", bucket: "Retry is waste" },
          { text: "HTTP 404 on the RESTCONF path", bucket: "Retry is waste" },
          { text: "HTTP 409 Conflict — config lock held by another process", bucket: "Retry helps" },
          { text: "`ResourceNotFound` for the resource ID", bucket: "Retry is waste" }
        ],
        why: "Only two of five benefit. The 409 is the best case for backoff: the lock is held *now* and probably will not be shortly. And note where `ResourceNotFound` comes from — CWM's own configuration, not the device (Room 06). A single blanket policy on every action, which is what both workflows here do, spends real time on failures it cannot fix." },
      { type: "predict", id: "d8-4", title: "Find the leak in our own workflow",
        prompt: "`clear-vty-sessions` PUTs an EEM applet, sleeps `PT5S`, then DELETEs it. The workflow is killed during the sleep. What is left behind?",
        choices: [
          "Nothing — CWM rolls back incomplete workflows",
          "The applet stays in the running config, with a countdown timer that will still fire",
          "The applet is left but disabled",
          "The next run cleans it up automatically"
        ],
        answer: 1,
        why: "`CWM-CLEAR-VTY` remains in the running config and its timer fires on its own schedule with nobody watching. The next run then tries to PUT an applet that already exists. Declaring the delete as `compensatedBy` would help — but compensation is never automatic, so a hard-killed workflow may never run its own compensation either. **The durable answer is idempotence:** write the PUT so re-running it over an existing applet is harmless. This is a real flaw in code this repo ships, not a textbook example." },
      { type: "match", id: "d8-5", title: "Retry or compensation?",
        prompt: "Match each statement to the mechanism it describes.",
        pairs: [
          ["Fires automatically on transient failure", "retry"],
          ["Runs completed states in reverse order", "compensation"],
          ["Cannot be triggered by an error or by data", "compensation"],
          ["Exhausting it ends the job as Failed", "retry"]
        ] }
    ],
    recall: [
      "Explain the difference between retry and compensation to someone who thinks both mean \"handle errors\".",
      "Why can compensation not be triggered by an error or by workflow data, and what does that force you to do differently?",
      "Every action in a workflow shares one retry policy. Argue for and against."
    ],
    gate: "You can look at any action and say what happens on transient failure, on deterministic failure, and on abandonment mid-run.",
    sources: [
      "Retry fields and the Failed-on-exhaustion behaviour: CWM Get Started Guide Ch.4; `retries` quoted from `workflows/set-hostname.sw.json`.",
      "`onErrors`, `nonRetryableErrors`, `compensatedBy` and the three compensation constraints: CWM Overview and TDM deck, slides 36-38.",
      "Timeouts and the 3600-second Fleet Upgrade guidance: Administrator Guide and Fleet Upgrade User Guide.",
      "The leaked-applet analysis is **our own reading** of `clear-vty-sessions.sw.json`, not a documented Cisco caveat."
    ]
  },

  {
    n: 9, name: "The Antenna Deck", tagline: "events, CloudEvents, Kafka and MQTT",
    location: "Ninth floor, open to the sky. Two masts of different shapes, a winch, and two chutes in the floor — one marked IN, one marked OUT, and no way to use either for both.",
    reused: "The Mailroom's envelopes arrive here by air instead of by road. The clerk's matching ledger is Room 05's condition logic applied to arrivals.",
    runnable: "jq",
    predict: [
      { q: "You need a workflow to start when a router raises an alarm. Which component queues that alarm — CWM, or something else?",
        a: "Something else. *\"CWM doesn't act as an event broker itself.\"* It connects to external brokers — Kafka, AMQP, HTTP, and MQTT as of 2.1." },
      { q: "One event type is defined for a Kafka topic. Can it both consume and produce?",
        a: "No. Consume **or** produce. The `both` option is explicitly not supported." },
      { q: "A workflow declares `specVersion: \"0.8\"` and an event body declares `specversion: \"1.0\"`. Is one wrong?",
        a: "Neither. Different specifications entirely: capital-V `specVersion` is Serverless Workflow, lowercase `specversion` is CloudEvents. The near-identical spelling is a genuine trap." }
    ],
    teach: [
      { p: "Everything so far has been **pull**: you start a job, it runs, it finishes. Events invert that. Something happens in the network, and a workflow starts *because* of it. Three separate problems need solving: who holds the message, what shape it is in, and which of many running things it belongs to." },
      { h: "Who holds the message — not CWM" },
      { p: "*\"CWM doesn't act as an event broker itself. It provides a means to connect to external brokers.\"* So you must supply one. This is the fact people get wrong when planning an architecture: there is a box on the diagram you have to run yourself." },
      { table: { headers: ["Broker", "Resource type", "Notes"], rows: [
        ["**Kafka**", "`system.event.kafka.v1.0.0`", "Primary choice for labs and for scale"],
        ["**MQTT**", "MQTT event resource", "**New in CWM 2.1**"],
        ["AMQP", "`system.event.amqp.v1.0.0`", ""],
        ["HTTP", "`system.event.http.v1.0.0`", "No broker to run — and no queue either"]
      ] } },
      { h: "Kafka and MQTT, concretely" },
      { p: "These are the two that matter here, and they are not interchangeable. Both carry CloudEvents, both do consume and produce, but they are built for different shapes of problem." },
      { p: "**Kafka** is a durable, partitioned log. Messages persist, consumers track an offset, history can be replayed. A resource of type `system.event.kafka.v1.0.0` takes a `brokers` list — `[\"host:9092\"]` — plus an optional secret if the broker authenticates. Then an **event type** binds a name to a topic and a kind." },
      { code: "event type  router-alarm-consume     topic cwm-lab-alarms-in    kind consume\nevent type  workflow-status-produce  topic cwm-lab-status-out   kind produce" },
      { p: "You can watch either side from the command line, which is the fastest way to prove wiring before blaming CWM:" },
      { code: "kafka-console-producer.sh --bootstrap-server host:9092 --topic cwm-lab-alarms-in\nkafka-console-consumer.sh --bootstrap-server host:9092 --topic cwm-lab-status-out" },
      { p: "**MQTT** is a lightweight publish/subscribe protocol built for constrained devices and telemetry — small headers, topic hierarchies, quality-of-service levels. It is not a log: there is no offset to rewind. *\"For the consume event kind, CWM connects to an MQTT broker and subscribes to specific topics... For the produce event kind... CWM delivers to the broker for publishing on the designated topic.\"*" },
      { note: { tone: "accent", text: "**Choosing between them.** Kafka when you need durability, replay, or many consumers of the same stream. MQTT when the traffic is device telemetry or lightweight signals from many endpoints where a Kafka client would be too heavy. If the event must survive CWM being restarted mid-flight, that is Kafka's guarantee and not MQTT's. **This selection guidance is general messaging reasoning, not a Cisco recommendation** — Cisco documents that both are supported, not when to prefer each." } },
      { p: "**HTTP is the odd one out** and worth naming as such: no broker to deploy, CWM simply accepts a POSTed CloudEvent. That makes it the quickest thing to demo and the wrong thing to depend on, because nothing queues. If nobody is listening, the event is gone." },
      { h: "CloudEvents, and correlation" },
      { p: "CloudEvents is a CNCF standard for event envelopes so producers and consumers need not agree bilaterally. CWM 2.1 supports **CloudEvents 1.0.2**; an HTTP-consumed body must be JSON representing a CloudEvent with at minimum `specversion`, `id`, `type`, and `source`." },
      { p: "Then the interesting problem. A hundred upgrade jobs are in flight and an event arrives saying \"device reload complete\". Which job wanted it? That is **correlation**, and 2.1 changed how it works: **context attributes** filter on the envelope; **payload-based correlation** (new in 2.1, API only) can reference fields in the event *body* using jq. And a **breaking change** — `correlationAttrs` went from `string[]` to `integer[]`, now holding attribute *indices*, alongside a new `payloadAttrs` map. Any 2.0-era automation writing correlation config by hand breaks on upgrade." }
    ],
    key: "CWM is not the broker; CloudEvents is the envelope; correlation is how one arriving event finds the one job that was waiting for it.",
    palace: {
      story: [
        "You step out onto the roof. The **mast** is the external broker, and the thing to notice immediately is that **it is not part of the building** — it is bolted to the parapet and belongs to someone else. Cut it down and the whole floor goes deaf.",
        "There are actually **two masts**, shaped differently. The tall one has a **winch and a locked strongroom at its base**: every bag hauled up is logged and stored, in order, and you can go back and re-read yesterday's. That is **Kafka** — durable, ordered, replayable, and heavy enough that you notice running it.",
        "Beside it stands a thin whip antenna with **no strongroom at all** — just a hatch and a constant chatter of small slips arriving from hundreds of little sensors around the estate. Nothing is kept. Miss a slip and it is gone. That is **MQTT**.",
        "And propped against the parapet is a **speaking tube** running down to the street, with nobody required at either end. Shout into it and if someone happens to be listening they hear you. That is **HTTP**.",
        "Two **chutes** in the floor, one marked IN and one marked OUT. They are physically separate, and you cannot send a bag up the IN chute no matter how you angle it. Every bag arriving down the IN chute has a **standard-issue tag** — who sent it, what kind, a unique number. Standard-issue is the point: the sorting clerk never has to learn a new tag format per sender.",
        "And the **clerk with the ledger**. Downstairs, a hundred people are waiting for a specific bag. She reads the tag and decides who has been waiting for this one. Until 2.1 she could read only the tag; now she may open the bag and read a line inside it. Her ledger was also **re-numbered** in 2.1 — she used to look people up by name and now uses row numbers, so anyone holding an old reference is looking at the wrong person entirely."
      ],
      table: [
        ["Masts bolted to the parapet, owned by someone else", "The external broker — CWM supplies none"],
        ["Tall mast, winch, locked strongroom", "**Kafka** — durable, ordered, replayable"],
        ["Whip antenna, chattering sensors, no strongroom", "**MQTT** — light pub/sub, no replay"],
        ["Speaking tube to the street", "HTTP — no broker, and no queue"],
        ["Two separate chutes, IN and OUT", "Event `kind`: consume or produce, never `both`"],
        ["Standard-issue tag on every bag", "CloudEvents 1.0.2 envelope"],
        ["Clerk reading the tag", "Correlation on context attributes"],
        ["Clerk allowed to open the bag (2.1)", "Payload correlation via jq — API only"],
        ["Re-numbered ledger", "`correlationAttrs`: `string[]` \u2192 `integer[]`"]
      ]
    },
    drills: [
      { type: "jq", id: "d9-1", title: "Split envelope from payload",
        prompt: "A CloudEvent has arrived. Produce `{required, payload}` where `required` holds the four mandatory envelope fields and `payload` holds the event body. Compact output is on.",
        input: { specversion: "1.0", id: "a1b2c3", type: "router-alarm-consume", source: "/lab/asr1001", data: { deviceIp: "192.0.2.10", severity: "critical" } },
        opts: { compact: true },
        solution: "{required: {specversion, id, type, source}, payload: .data}",
        expect: '{"required":{"specversion":"1.0","id":"a1b2c3","type":"router-alarm-consume","source":"/lab/asr1001"},"payload":{"deviceIp":"192.0.2.10","severity":"critical"}}',
        hint: "Object shorthand handles the four envelope fields; `payload: .data` for the body.",
        why: "`specversion` here is **1.0 — CloudEvents**, not the workflow's `specVersion`. The envelope carries routing metadata; `data` carries your content. Correlation before 2.1 could read only the envelope; from 2.1 it can reach into `data` with jq." },
      { type: "jq", id: "d9-2", title: "Correlate, and guard the key",
        prompt: "Three events arrive; the second is missing its correlation field. Map each to its `deviceIp`, or to the string `\"UNCORRELATED\"` when the field is absent.",
        input: [{ data: { deviceIp: "192.0.2.10" } }, { data: {} }, { data: { deviceIp: "192.0.2.11" } }],
        opts: { compact: true },
        solution: 'map(if (.data.deviceIp) then .data.deviceIp else "UNCORRELATED" end)',
        expect: '["192.0.2.10","UNCORRELATED","192.0.2.11"]',
        hint: "`map(...)` with the same guard shape you used in Room 05.",
        why: "Room 00's guard, now on the roof. An unguarded missing field yields `null` — and a `null` correlation key either matches nothing or, worse, matches the wrong waiter. Guarding turns a silent mis-delivery into an explicit \"this cannot be correlated\"." },
      { type: "classify", id: "d9-3", title: "Pick the broker",
        prompt: "For each requirement, choose the broker. Ask yourself: what must survive?",
        buckets: ["Kafka", "MQTT", "HTTP"],
        items: [
          { text: "Publish per-device status from a 100-device upgrade, which ticketing also consumes", bucket: "Kafka" },
          { text: "Ingest optical-power telemetry from several hundred transceivers", bucket: "MQTT" },
          { text: "Prove an event-driven workflow triggers at all, in a 15-minute laptop demo", bucket: "HTTP" },
          { text: "Trigger from a router alarm where losing it during a CWM restart is unacceptable", bucket: "Kafka" }
        ],
        why: "The first needs two independent consumers of one stream plus an audit trail. The second is many lightweight senders — Kafka would work but asks every agent to carry a heavy client, and stale telemetry is worthless anyway. The third needs nothing installed. The fourth is precisely Kafka's durability guarantee: on MQTT an alarm raised while CWM is down is simply gone." },
      { type: "predict", id: "d9-4", title: "How many event types?",
        prompt: "A workflow should start on a critical alarm, run a diagnostic, then publish the outcome for a ticketing system. What is the minimum number of event types, and why?",
        choices: [
          "One — a single bidirectional type handles both directions",
          "Two — one consume for the alarm, one produce for the outcome",
          "Three — consume, produce, and one for correlation",
          "None — a workflow can read and write topics directly"
        ],
        answer: 1,
        why: "They cannot be one object, because `both` is unsupported. If the diagnostic *also* waits for the device to finish something, that is a **third** consume type, correlated back to this specific job — and that is where correlation stops being theoretical, because now several instances of the same workflow are each waiting for their own device's reply." },
      { type: "match", id: "d9-5", title: "Two specs, one word",
        prompt: "Match each field to what it belongs to.",
        pairs: [
          ["`specVersion: \"0.8\"`", "Serverless Workflow, in the workflow definition"],
          ["`specversion: \"1.0\"`", "CloudEvents, in the event body"],
          ["`correlationAttrs`", "Envelope attribute indices, integer[] since 2.1"],
          ["`payloadAttrs`", "Body fields, referenced with jq, API only"]
        ] }
    ],
    recall: [
      "A colleague's architecture diagram shows CWM receiving alarms directly from routers. Correct it, and say what is missing.",
      "Explain the two `specVersion` fields to someone who thinks they must be kept in sync.",
      "Why is correlation harder than routing, and what would go wrong with no correlation at all?"
    ],
    gate: "You can specify the event types, kinds and correlation keys for an event-driven requirement, and justify Kafka versus MQTT versus HTTP.",
    sources: [
      "*\"CWM doesn't act as an event broker itself\"*, the consume/produce limitation, CloudEvents minimum fields and the Kafka resource type: CWM 2.1 Administrator Guide.",
      "CloudEvents 1.0.2, **MQTT new in 2.1** with the quoted consume/produce description, payload correlation being API only, and the `correlationAttrs` breaking change: CWM 2.1 Release Notes.",
      "Topic names and console producer/consumer usage: the Kafka labs in the legacy `cwm-learn` material.",
      "**Not from Cisco:** the Kafka-versus-MQTT selection reasoning is general messaging architecture, not a Cisco recommendation."
    ]
  },

  {
    n: 10, name: "The Waiting Room", tagline: "callback, guided tasks and human approval",
    location: "Tenth floor, one below the summit. Rows of chairs, a frosted-glass hatch with a bell, a clipboard on a chain, and a clock on the wall that nobody is watching.",
    reused: "The chutes and tags from the Antenna Deck — a callback waits for an *event*, so everything from Room 09 is load-bearing here.",
    runnable: "reason",
    predict: [
      { q: "A workflow must pause until a human approves a change. Which state type?",
        a: "`callback`. Confirmed supported on 2026-09-10 — and worth noting it is **absent from the public five-item state-type list**, which is how we learned that list is incomplete." },
      { q: "That workflow is now paused. What is it actually waiting for, technically?",
        a: "**An event.** A callback state references an event, so a human clicking Approve becomes an event arriving. The pause is Room 09's machinery wearing a different hat." },
      { q: "`set-hostname` already uses a form. Is that a callback?",
        a: "**No**, and this trips people up. `set-hostname` binds a form as *job input* via Data \u2192 Connect to form — collected before the workflow starts. A callback pauses a workflow that is already running." }
    ],
    teach: [
      { p: "Every state so far has been autonomous: it acts, decides, retries, moves on. Even the `sleep` in `clear-vty-sessions` only waits a fixed interval and carries on regardless." },
      { p: "But real change management contains a step no engine can perform: **someone has to look at it and say yes.** A dry-run diff before pushing to production. A maintenance window that opens when the NOC lead confirms. A migration that pauses after traffic diversion so somebody can check the graphs. You cannot automate that away, so you have to *model* it." },
      { h: "How the pause actually works" },
      { p: "A callback state suspends execution and **references an event**. It resumes when a matching event arrives. That means three things follow immediately." },
      { p: "Everything from Room 09 applies — the event needs a type, and if many jobs are paused at once it needs **correlation** so the right one resumes. A \"human approval\" and \"an external system finished\" are *the same thing to CWM*: both are an awaited event, and the human is a slow, opinionated event source. And the workflow is genuinely suspended, not spinning: it occupies no worker while it waits." },
      { p: "The authoring shape, from this repo's own notes (D-02): a callback belongs in the **Code** view, declaring top-level `events` and pairing the callback state with a no-op action. The Designer's Events toolbox is for MOP and system events, **not** for Forms — a distinction that cost a whole session to establish." },
      { h: "Two ways the human gets asked" },
      { p: "**Render the form in CWM.** The Form Designer builds the dialog, the operator sees it in the CWM UI, approval happens in-product. Suits a small team who all have CWM access." },
      { p: "**Notify an external system.** Emit a notification event to Kafka, AMQP, MQTT or HTTP and let the approval arrive back as an event. Suits a large operations team who live in ServiceNow, Webex or a NOC console and are never going to log into CWM. Room 09's produce side carries the ask outward." },
      { p: "The lineage is worth knowing: operator dialogs arrived in CWM 1.1, the Form Designer in 1.2. Guided tasks are built on exactly this machinery." },
      { h: "Forms appear at two different moments — do not conflate them" },
      { table: { headers: ["", "Job input form", "Callback form"], rows: [
        ["When", "Before the workflow starts", "While it is running"],
        ["Bound by", "Data \u2192 **Connect to form**", "A `callback` state referencing a form event"],
        ["Example", "`set-hostname`'s `deviceIp` + `hostname`", "\"Approve this dry-run diff?\""],
        ["Workflow state", "Not yet running", "Suspended mid-flight"]
      ] } },
      { h: "What a paused workflow costs you" },
      { note: { tone: "warn", text: "**It can wait forever.** A callback with no timeout is a job that never ends — Room 08's `actionExecTimeout` and `resultEventTimeout` exist precisely so a human who went on holiday does not leave a job open indefinitely. **Someone must be able to find it:** a pending approval nobody knows about is an outage in slow motion, which is the strongest argument for notifying outward. **Correlation stops being optional:** forty paused per-device jobs is entirely a correlation problem. And **it interacts with compensation** — if a callback times out and you unwind, the compensation must handle \"we had already diverted traffic and were waiting for sign-off\"." } }
    ],
    key: "A callback is an event state wearing a human's hat: the workflow suspends, an event resumes it, and if nobody is told it is waiting then nothing resumes it at all.",
    palace: {
      story: [
        "Rows of **chairs**, and this is the first room in the tower where a crate simply *sits down*. It is not being worked on. Nobody is retrying anything. It waits, and it costs nothing to wait — no operator is tied up, no machine is idling.",
        "In the wall is a **frosted-glass hatch with a bell**. The crate cannot see who is behind it and does not care. What matters is that **somebody must ring the bell** before the crate stands up and continues to the summit. That bell is the awaited event, and the person behind the glass is interchangeable with a machine — the crate cannot tell the difference, and neither can CWM.",
        "Two ways the bell gets rung. There is a **clipboard on a chain** beside the hatch, for whoever happens to walk past — a form rendered in CWM. And there is a **pneumatic tube** in the corner that fires a note out of the building to whoever is actually on shift — a notification event to Kafka, MQTT or Webex. The tube exists because relying on someone wandering past the hatch is not an operational plan.",
        "Now the two details that make this room worth remembering. There is a **clock on the wall that nobody is watching**. Chairs are comfortable. A crate can sit here past the end of the maintenance window, past the end of the shift, past the weekend. Nothing in the room objects. **The timeout is the only thing that ever makes a chair uncomfortable**, and you have to install it yourself.",
        "And by the door, a **second smaller desk marked ARRIVALS** where crates are asked their business *before* they enter the building at all. That is the job input form. Same paperwork, completely different moment: crates at the arrivals desk have not started their journey; crates in the chairs are halfway up the tower."
      ],
      table: [
        ["A crate sitting in a chair", "A suspended `callback` state, consuming no worker"],
        ["Frosted hatch with a bell", "The awaited event that resumes it"],
        ["Whoever is behind the glass", "A human or a machine — CWM cannot tell"],
        ["Clipboard on a chain", "Approval form rendered in CWM"],
        ["Pneumatic tube out of the building", "Notification event to Kafka / MQTT / AMQP / HTTP"],
        ["**Unwatched clock**", "**No timeout — the job waits forever**"],
        ["ARRIVALS desk by the door", "Job input form, Connect to form, before the run"],
        ["Forty crates in forty chairs", "Why correlation is mandatory at fleet scale"]
      ]
    },
    drills: [
      { type: "classify", id: "d10-1", title: "Input form or callback?",
        prompt: "For each, decide which mechanism collects the answer.",
        buckets: ["Job input form", "Callback"],
        items: [
          { text: "Ask which device to reconfigure", bucket: "Job input form" },
          { text: "Show an NSO dry-run diff and ask \"commit this?\"", bucket: "Callback" },
          { text: "Collect a change-request number for the audit log", bucket: "Job input form" },
          { text: "Pause a migration after traffic diversion until the NOC confirms the graphs", bucket: "Callback" },
          { text: "Ask which software image to distribute", bucket: "Job input form" }
        ],
        why: "The discriminator is **not** \"does a human answer it\" — a human answers all five. It is **whether the question can even be asked before the workflow runs.** If the answer depends on something the workflow produced, it has to be a callback." },
      { type: "jq", id: "d10-2", title: "Read a form definition",
        prompt: "`set-hostname.form.json` is loaded. For each component, produce `{label, key, required}`, defaulting `required` to `false` when it is not set.",
        input: S.hostnameForm, opts: { compact: true },
        solution: "[.formSchema.components[] | {label, key, required: (.validate.required // false)}]",
        expect: '[{"label":"Device IP","key":"deviceIp","required":true},{"label":"Hostname","key":"hostname","required":true}]',
        hint: "Iterate `.formSchema.components`, and use `// false` for the default.",
        why: "Two fields, both required — and note the `key` values are exactly the names the workflow reads with `${ .deviceIp }`. **The form's Property Name is the contract**, not its Label. Rename the label freely; rename the key and the workflow breaks." },
      { type: "predict", id: "d10-3", title: "The failure modes of a naive approval",
        prompt: "A colleague adds an approval callback to a per-device fleet upgrade across 40 routers, renders the form in CWM, and sets no timeout. Which is the *first* thing that goes wrong operationally?",
        choices: [
          "The workflow errors because callback needs a timeout",
          "Forty near-identical pending approvals appear, and nobody watching a terminal is notified any exist",
          "CWM automatically approves after 24 hours",
          "The jobs consume 40 workers while waiting"
        ],
        answer: 1,
        why: "It does not error, and it does not consume workers — suspension is cheap. What breaks is human: forty look-alike approvals with no correlation aid, and no notification to anyone actually on shift. Then the window closes with devices in mixed states, and compensation must now cope with \"was awaiting approval\". The fix is architectural: approve **fleet-wide** where the decision is genuinely one decision, notify outward, and always set a timeout with a defined expiry path." },
      { type: "predict", id: "d10-4", title: "Why the toolbox distinction matters",
        prompt: "Someone hunts for \"forms\" in the Designer's Events toolbox and does not find them. What do they wrongly conclude?",
        choices: [
          "That forms require a licence upgrade",
          "That forms are unsupported, or that they must hand-write a callback to collect job input",
          "That the Designer is broken",
          "That forms only work via the API"
        ],
        answer: 1,
        why: "And they then solve the wrong problem — producing a workflow that pauses mid-run to ask a question that should have been asked before it started. The underlying trap: **both mechanisms involve a form and an event, so the UI's grouping feels authoritative when it is merely a grouping.** Recognising which question you are asking is what stops the search before it begins." },
      { type: "match", id: "d10-5", title: "Match the mechanism",
        prompt: "Pair each need with how it is served.",
        pairs: [
          ["Small team, everyone has CWM access", "Render the approval form in CWM"],
          ["Large ops team living in ServiceNow", "Emit a notification event outward"],
          ["Stop a job waiting forever", "actionExecTimeout / resultEventTimeout"],
          ["Resume the right one of forty paused jobs", "Event correlation"]
        ] }
    ],
    recall: [
      "Explain why a human approval and an external system's completion signal are the same thing to CWM, and what that buys you architecturally.",
      "Give the rule for choosing between a job input form and a callback form, in one sentence, without listing examples.",
      "Someone says \"we'll add the approval step and sort out notifications later\". Explain what they have actually built."
    ],
    gate: "You can decide input-form versus callback for any requirement, and name the two things a callback needs that nothing else in the tower does.",
    sources: [
      "`callback` support confirmed 2026-09-10; absent from the public five-item list, which is how that list was established as incomplete. See D-10.",
      "Operator dialogs (1.1), Form Designer (1.2), render-in-CWM versus notify-outward, and the NSO dry-run sign-off example: CWM Overview and TDM deck, slides 28-30.",
      "The Events-toolbox-is-not-Forms distinction and callback-in-Code-view: decision **D-02**, established on a CNC 7.2 lab.",
      "**Not from Cisco:** the failure-mode analysis and the fleet-wide-versus-per-device guidance are our own reasoning."
    ]
  },

  {
    n: 11, name: "The Control Room", tagline: "MOPs, stages and the action contract",
    location: "The summit. Glass on three sides, the whole network visible below. A wall of ring binders, each divided into five labelled tabs, and a locked cabinet marked FACTORY ISSUE — DO NOT WRITE IN.",
    reused: "All of it, and that is the point. A MOP action *is* a workflow, so every room below is still in force.",
    runnable: "partly",
    predict: [
      { q: "Fleet Upgrade runs a 25-step procedure across a fleet. What is each step, technically?",
        a: "A workflow. *\"Each MOP action is an individual workflow.\"* Not a special construct — everything from Rooms 00 to 10 applies unchanged." },
      { q: "You want to change a step in the shipped XE upgrade MOP. Can you edit it?",
        a: "**No.** Default MOPs cannot be modified directly. Clone first, then edit the clone." },
      { q: "Why run a conformance report *before* an upgrade rather than just upgrading?",
        a: "Because it tells you which devices are actually non-conformant, so the upgrade targets a known set rather than discovering surprises across a fleet mid-run." }
    ],
    teach: [
      { p: "You can now author a workflow. Rooms 00-10 covered data, structure, calls, adapters, branching, credentials, iteration, failure, events and human approval. So what is left? **Everything about doing it a thousand times, safely, in an order a change board will approve.** That is what a MOP is for." },
      { p: "A **Method of Procedure** is the operational-engineering artifact that existed long before CWM: a written, reviewed, step-by-step procedure for a risky change, with defined checkpoints. CWM's contribution is making each step executable." },
      { h: "The hierarchy" },
      { code: "Application Type      Fleet Upgrade | Golden Configuration | Device Migration\n   \u2514\u2500 MOP               an instance for a vendor + product series\n        \u2514\u2500 MOP Action    one workflow" },
      { p: "**Application Type** is the root and it **defines the stages** — for Fleet Upgrade: `pre`, `distribute`, `activate`, `commit`, `post`. In CWM 2.0 Fleet Upgrade was the only application type; 2.1 generalised the MOP Builder so you can define your own. **MOP** is an instance for a vendor and product series. **MOP Action** is a single workflow, tagged so the builder can find it." },
      { p: "Real scale from the shipped defaults: Default XR Upgrade has 22 action types and 25 actions — 11 pre, 3 distribute, 3 activate, **1 commit**, 7 post. XE has 17 actions and no commit stage; Juniper has 19. Only XR uses commit, which tells you the stage list is a superset and not every platform needs every stage." },
      { h: "The contract every MOP action must honour" },
      { p: "A MOP action is a workflow, but not *any* workflow — it must accept and return a fixed envelope so the orchestrator can drive it." },
      { table: { headers: ["Required input, under `app-data`", "Meaning"], rows: [
        ["`jobId` / `runId`", "Which job and run this invocation belongs to"],
        ["`actionTimeout`", "System-calculated budget for this action"],
        ["`executionMode`", "`1` = once per device, `2` = once fleet-wide"],
        ["`stage`", "Which stage is currently executing"]
      ] } },
      { code: '{\n  "status": "<status>",\n  "message": "<description of outcome>",\n  "app-data": { },\n  "processedResource": ["<device_uuid>"],\n  "stash": { }\n}' },
      { p: "`processedResource` reports which devices this action actually touched. `stash` is optional and carries state forward between stages — the mechanism by which a `pre` action tells an `activate` action what it found. And the tag: a workflow must carry **`mopActivity`**, case-sensitive, to appear as a selectable action." },
      { p: "`executionMode` deserves a second look. The same action definition runs either once per device or once for the whole fleet, decided by a field — so authoring a MOP action means writing something that behaves correctly under both readings, or being deliberate about which one it supports." },
      { h: "Two hard limits worth knowing before you plan work" },
      { note: { tone: "warn", text: "**Default MOPs cannot be edited** — clone them. And an exported MOP file is editable but *\"the edited MOP will be non-functional\"* on re-import, so export is for backup and review, never a round-trip editing workflow. People discover this after editing one. **The parallelism figure is contested:** the Fleet Upgrade User Guide states a maximum of 50 devices per job; TAC training says 100, *\"doubled from 50 in 2.0\"*. Treat 100 as the 2.1 capability and note the guide disagrees. Separately, *acceptable failures* has a sharp edge — a batch completes once started, so total failures can exceed the budget you set." } },
      { h: "Conformance before action" },
      { p: "Golden Configuration's flow is Global Variable \u2192 Template \u2192 Apply \u2192 Conformance, with Jinja2 templating, dry-run, and a variable hierarchy of global \u2192 template \u2192 job. The operational principle generalises past Golden Config: **measure, then act on the measured set.** A conformance report turns \"upgrade the fleet\" into \"upgrade these 14 devices\" — a smaller change, a shorter window, and a reviewable artifact. It is also the difference between a change board approving your plan and asking you to come back." }
    ],
    key: "A MOP is staged, reviewable choreography over ordinary workflows — so everything you learned below still applies, and the only new skill is honouring the contract.",
    palace: {
      story: [
        "You reach the summit. Glass on three sides, the whole network laid out below — the first room in the tower from which you can see *scale* rather than a single device.",
        "Along the back wall, **ring binders**. Each is one MOP. Open one and it is divided by five labelled tabs: pre, distribute, activate, commit, post. Behind each tab, numbered pages in a fixed order. **Each page is a work order — and each work order is a crate that goes back down to the Loading Dock to be processed.** That is a MOP action being a workflow. The tower has no other machinery; the summit only decides *sequence*.",
        "Every page has a **printed header and footer**. The header is stamped before the page is handed down: which job, which stage, per-device or fleet-wide, how long you have. The footer must be filled in and returned: what happened, which devices you touched, and anything the next stage needs to know. Hand back a page with a blank footer and the whole binder stalls.",
        "In the corner, the **locked cabinet marked FACTORY ISSUE — DO NOT WRITE IN**. Those are the default MOPs. You may read them and take a **photocopy** to write on. There is also a photocopier that produces copies which *look* perfect but cannot be filed back into the cabinet — that is export-then-reimport.",
        "And bolted by the window, a **counting frame** for how many devices go at once. Its label has been overwritten: one hand wrote 50, another wrote 100. Nobody has erased the first number."
      ],
      table: [
        ["Glass walls, the whole network below", "The first view of fleet scale"],
        ["A ring binder", "A MOP"],
        ["Five labelled tabs", "Stages: pre, distribute, activate, commit, post"],
        ["One numbered page", "A MOP action — an ordinary workflow"],
        ["Sending the page down to the dock", "The action executing through Rooms 00-10"],
        ["Printed header", "Required `app-data`: `jobId`, `stage`, `executionMode`, `actionTimeout`"],
        ["Footer you must fill in", "Required output: `status`, `message`, `processedResource`"],
        ["Locked FACTORY ISSUE cabinet", "Default MOPs — clone, never edit"],
        ["Copies that cannot be re-filed", "Exported MOPs are non-functional on re-import"],
        ["Counting frame with two numbers", "50 vs 100 parallel devices, contested"],
        ["Surveyor's report before any work", "A conformance run before acting"]
      ]
    },
    drills: [
      { type: "jq", id: "d11-1", title: "Audit an action's output contract",
        prompt: "A MOP action returned only `{\"status\":\"ok\"}`. Compute which required output keys are **missing** — check for `status`, `message` and `processedResource`.",
        input: { status: "ok" }, opts: { compact: true },
        solution: '["status","message","processedResource"] - keys',
        expect: '["message","processedResource"]',
        hint: "Array subtraction: `[...] - keys` removes the keys that are present.",
        why: "The workflow ran, the action succeeded, and the orchestrator cannot tell what happened or which devices were touched. That is Room 01's invisible-success failure at MOP scale — now with a maintenance window attached." },
      { type: "jq", id: "d11-2", title: "Summarise a MOP's shape",
        prompt: "Given the per-stage action counts of the Default XR Upgrade MOP, produce a single line of `stage=count` pairs separated by spaces. Raw is on.",
        input: { pre: 11, distribute: 3, activate: 3, commit: 1, post: 7 }, opts: { raw: true },
        solution: 'to_entries | map("\\(.key)=\\(.value)") | join(" ")',
        expect: "pre=11 distribute=3 activate=3 commit=1 post=7",
        hint: "`to_entries` turns the object into `{key, value}` pairs you can interpolate.",
        why: "Eleven of 25 actions are in `pre`. That distribution tells you where the designers thought the risk was — and it is the strongest argument for never skipping the readiness stage." },
      { type: "order", id: "d11-3", title: "Sequence a real change",
        prompt: "Put the Fleet Upgrade stages in execution order.",
        items: ["pre", "distribute", "activate", "commit", "post"],
        shuffled: ["activate", "post", "pre", "commit", "distribute"],
        why: "XE has no commit stage; XR does. The stage list is a superset — an Application Type defines which stages exist, and not every platform needs all of them." },
      { type: "classify", id: "d11-4", title: "Place the artifact",
        prompt: "Which level of the hierarchy is each thing?",
        buckets: ["Application Type", "MOP", "MOP Action"],
        items: [
          { text: "\"Default XR Upgrade\"", bucket: "MOP" },
          { text: "\"Fleet Upgrade\"", bucket: "Application Type" },
          { text: "A workflow that checks free disk space on one router", bucket: "MOP Action" },
          { text: "The definition of which stages exist", bucket: "Application Type" },
          { text: "`Sleep-cwm-sol`", bucket: "MOP Action" }
        ],
        why: "Defining a custom Application Type is a bigger decision than a custom MOP: you are defining the stage vocabulary everything else inherits." },
      { type: "predict", id: "d11-5", title: "Which stage do you never skip?",
        prompt: "You are 40 minutes into a 2-hour window, running late, upgrading 40 IOS-XE routers. Which stage is it most costly to skip?",
        choices: [
          "distribute — the images are large and slow",
          "pre — it is the cheapest stage and the only one that can still tell you \"do not start\"",
          "post — verification can always be done tomorrow",
          "activate — it can be deferred to the next window"
        ],
        answer: 1,
        why: "Skipping `pre` does not save time. It moves the discovery of a problem from *before* the window into the middle of it, when 40 routers are half-upgraded and rollback is expensive. Every other stage costs more to get wrong, but only `pre` can prevent the whole thing." },
      { type: "match", id: "d11-6", title: "The contract",
        prompt: "Match each field to its job.",
        pairs: [
          ["`executionMode`", "1 = per device, 2 = fleet-wide"],
          ["`processedResource`", "Which devices this action actually touched"],
          ["`stash`", "Carries state forward between stages"],
          ["`mopActivity`", "Case-sensitive tag that makes it selectable"]
        ] }
    ],
    recall: [
      "Explain to an operations manager what a MOP is and why it is safer than a documented runbook a human follows.",
      "Someone edited an exported MOP file and re-imported it, and now it does not work. Explain what happened and what they should have done.",
      "Trace one MOP action all the way down the tower: name the room that governs its data filters, its adapter call, its credentials, and its retry behaviour."
    ],
    gate: "You can answer that last recall question without notes — because that is the whole point of the palace.",
    sources: [
      "*\"Each MOP action is an individual workflow\"*, the hierarchy, stage list, `app-data` contract, required output, the `mopActivity` tag and the non-functional-reimport limitation: CWM 2.1 MOPs User Guide.",
      "Default MOP action counts (XR 22/25, XE 15/17, Juniper 17/19) and the 3600-second guidance: Fleet Upgrade User Guide and TAC Training.",
      "Golden Configuration flow, Jinja2 and the variable hierarchy: CWM 2.1 Golden Configuration guide.",
      "**Contested:** 50 devices per job (Fleet Upgrade User Guide) versus 100 (TAC Training, *\"doubled from 50 in 2.0\"*)."
    ]
  }
  ];
})(typeof window !== "undefined" ? window : globalThis);
