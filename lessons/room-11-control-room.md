# Room 11 — The Control Room

**Palace location:** The summit. Glass on three sides, the whole network visible below. A wall
of **ring binders**, each divided into five labelled tabs, and a locked cabinet marked
FACTORY ISSUE — DO NOT WRITE IN.
**Furniture reused from earlier rooms:** all of it, and that is the point. A MOP action *is* a
workflow, so every room below is still in force.
**Runnable today:** reasoning only. This room is about structure, and structure is what you
can learn without a lab.

---

## 1. Predict first

1. Fleet Upgrade runs a 25-step procedure across a device fleet. What is each step, technically?
2. You want to change a step in the shipped XE upgrade MOP. Can you edit it?
3. Why would anyone run a conformance report *before* an upgrade rather than just upgrading?

<details>
<summary>Answers</summary>

1. A workflow. *"Each MOP action is an individual workflow."* Not a special construct —
   everything from Rooms 00 to 10 applies unchanged.
2. **No.** Default MOPs cannot be modified directly. Clone first, then edit the clone.
3. Because it tells you which devices are actually non-conformant, so the upgrade targets a
   known set rather than discovering surprises across a fleet mid-run.
</details>

---

## 2. From first principles

You can now author a workflow. Rooms 00–10 covered data, structure, calls, adapters, branching,
credentials, iteration, failure, events and human approval. So what is left?

**Everything about doing it a thousand times, safely, in an order a change board will
approve.** That is what a MOP is for.

A **Method of Procedure** is the operational-engineering artifact that existed long before
CWM: a written, reviewed, step-by-step procedure for a risky change, with defined checkpoints.
CWM's contribution is making each step executable.

> *"The CWM Solutions MOPs application lets users create Methods of Procedure (MOPs) and MOP
> actions that allow the other CWM Solutions applications to automate and routinize a wide
> variety of network operations."*

### The hierarchy

Three levels, and knowing which one you are editing prevents most confusion:

```
Application Type        Fleet Upgrade | Golden Configuration | Device Migration
   └── MOP              an instance for a vendor + product series, with ordered actions
         └── MOP Action  one workflow
```

- **Application Type** is the root and it **defines the stages** — for Fleet Upgrade:
  `pre`, `distribute`, `activate`, `commit`, `post`. In CWM 2.0 Fleet Upgrade was the only
  application type; 2.1 generalised the MOP Builder so you can define your own.
- **MOP** is an instance for a vendor and product series, holding an ordered list of actions
  split across the stages.
- **MOP Action** is a single workflow, tagged so the builder can find it.

Real scale, from the shipped defaults: Default XR Upgrade has 22 action types and 25 actions —
11 pre, 3 distribute, 3 activate, **1 commit**, 7 post. XE has 17 actions and no commit stage;
Juniper has 19. Only XR uses commit, which tells you the stage list is a superset and not
every platform needs every stage.

### The contract every MOP action must honour

This is the practical heart of the room. A MOP action is a workflow, but not *any* workflow —
it must accept and return a fixed envelope so the orchestrator can drive it.

**Required input**, under `app-data`:

| Field | Meaning |
|---|---|
| `jobId` / `runId` | Which job and run this invocation belongs to |
| `actionTimeout` | System-calculated budget for this action |
| `executionMode` | `1` = once per device, `2` = once fleet-wide |
| `stage` | Which stage is currently executing |

**Required output:**

```json
{
  "status": "<status>",
  "message": "<description of outcome>",
  "app-data": { },
  "processedResource": ["<device_uuid>"],
  "stash": { }
}
```

`processedResource` reports which devices this action actually touched. `stash` is optional
and carries state forward between stages — the mechanism by which a `pre` action tells an
`activate` action what it found.

And the tag: a workflow must carry **`mopActivity`**, case-sensitive, to appear as a
selectable action. Optional tags include `noExport` plus vendor and product tags.

`executionMode` deserves a second look. The same action definition runs either once per device
or once for the whole fleet, decided by a field — so authoring a MOP action means writing
something that behaves correctly under both readings, or being deliberate about which one it
supports.

### Two hard limits worth knowing before you plan work

**Default MOPs cannot be edited.** Clone them. And an exported MOP file is editable but
*"the edited MOP will be non-functional"* on re-import — so export is for backup and review,
never a round-trip editing workflow. People discover this after editing one.

**The parallelism figure is contested.** The Fleet Upgrade User Guide states a maximum of 50
devices per job; TAC training material says 100, *"doubled from 50 in 2.0"*. Treat 100 as the
2.1 capability and note the guide disagrees. Separately, *acceptable failures* has a real
sharp edge: a batch completes once started, so total failures can exceed the budget you set.

### Conformance before action

Golden Configuration's flow is Global Variable → Template → Apply → Conformance, with Jinja2
templating, dry-run, and a variable hierarchy of global → template → job.

The operational principle generalises past Golden Config: **measure, then act on the measured
set.** A conformance report turns "upgrade the fleet" into "upgrade these 14 devices", which
is a smaller change, a shorter maintenance window, and a reviewable artifact. It is also the
difference between a change board approving your plan and asking you to come back.

### The one sentence to keep

> **A MOP is staged, reviewable choreography over ordinary workflows — so everything you
> learned below still applies, and the only new skill is honouring the contract.**

---

## 3. In the palace

You reach the summit. Glass on three sides, the whole network laid out below — the first room
in the tower from which you can see *scale* rather than a single device.

Along the back wall, **ring binders**. Each is one MOP. Open one and it is divided by five
labelled tabs: pre, distribute, activate, commit, post. Behind each tab, numbered pages in a
fixed order. **Each page is a work order — and each work order is a crate that goes back down
to the Loading Dock to be processed.** That is a MOP action being a workflow. The tower has no
other machinery; the summit only decides *sequence*.

Every page has a **printed header and footer**. The header is stamped before the page is
handed down: which job, which stage, per-device or fleet-wide, how long you have. The footer
must be filled in and returned: what happened, which devices you touched, and anything the
next stage needs to know. Hand back a page with a blank footer and the whole binder stalls.
That is the I/O contract.

In the corner, the **locked cabinet marked FACTORY ISSUE — DO NOT WRITE IN**. Those are the
default MOPs. You may read them and you may take a **photocopy** and write on that. There is
also a photocopier that produces copies which *look* perfect but cannot be filed back into the
cabinet — that is export-then-reimport, and the copy is non-functional.

And bolted by the window, a **counting frame** for how many devices go at once. Its label has
been overwritten: one hand wrote 50, another wrote 100. Nobody has erased the first number.

| Object | Stands for |
|---|---|
| Glass walls, the whole network below | the first view of fleet scale |
| A ring binder | a MOP |
| Five labelled tabs | stages: pre, distribute, activate, commit, post |
| One numbered page | a MOP action — an ordinary workflow |
| Sending the page down to the dock | the action executing through Rooms 00–10 |
| Printed header | required `app-data`: `jobId`, `stage`, `executionMode`, `actionTimeout` |
| Footer you must fill in | required output: `status`, `message`, `processedResource`, `stash` |
| Locked FACTORY ISSUE cabinet | default MOPs — clone, never edit |
| Copies that cannot be re-filed | exported MOPs are non-functional on re-import |
| Counting frame with two numbers | 50 vs 100 parallel devices, contested |
| Surveyor's report before any work | a conformance run before acting |

---

## 4. Drill

### Drill 11.1 — Place the artifact

For each, name the level — Application Type, MOP, or MOP Action:

1. "Default XR Upgrade"
2. "Fleet Upgrade"
3. A workflow that checks free disk space on one router
4. The definition of which stages exist
5. `Sleep-cwm-sol`

<details>
<summary>Answers</summary>

1. **MOP** — an instance for a vendor and product series.
2. **Application Type** — the root, which defines the stages.
3. **MOP Action** — a single workflow, needing the `mopActivity` tag.
4. **Application Type**. This is why a custom application type is a bigger decision than a
   custom MOP: you are defining the stage vocabulary everything else inherits.
5. **MOP Action** — one of the shipped generic actions, alongside `Wait-until-cwm-sol`,
   `Run-and-review-cwm-sol` and the NSO service-deployment helpers.
</details>

### Drill 11.2 — Audit an action against the contract

A colleague offers this as a MOP action. List everything wrong.

```json
{
  "id": "check-disk-space",
  "version": "1.0.0",
  "specVersion": "0.8",
  "start": "CheckDisk",
  "states": [ { "name": "CheckDisk", "type": "operation",
    "actions": [ { "name": "df", "functionRef": { "refName": "REST.Get" } } ],
    "end": true } ]
}
```

<details>
<summary>Answer</summary>

As a plain workflow it is nearly fine. As a **MOP action** it fails the contract:

1. **No `mopActivity` tag** — it will not appear as a selectable action at all. First failure,
   and the most confusing because nothing errors; the action is simply absent from the list.
2. **Ignores `app-data`** — no use of `stage` or `executionMode`, so it cannot behave
   differently per-device versus fleet-wide, and it disregards `actionTimeout`.
3. **Returns nothing the orchestrator can read** — no `status`, `message` or
   `processedResource`. Room 01's lesson at MOP scale: there is no `actionDataFilter`, so the
   result goes nowhere and the orchestrator cannot tell success from failure.
4. **No `processedResource`** — even on success, the job cannot report which devices were
   touched.
5. No `retries` and no `retryRef`, so a transient blip fails the whole stage (Room 08).

Item 3 is the one to feel: the workflow will run, the action will succeed, and the MOP will be
unable to say what happened. Exactly the invisible-success failure from Room 01, now with a
maintenance window attached.
</details>

### Drill 11.3 — Sequence a real change

You must upgrade 40 IOS-XE routers. Using only stage names and plain English, write the
outline — and say which stage you would *not* skip under schedule pressure, and why.

<details>
<summary>A defensible answer</summary>

- **pre** — conformance and readiness: version check, free space, redundancy state, config
  archive. The XE default MOP spends 7 of its 17 actions here, which tells you where the
  designers thought the risk was.
- **distribute** — move images to devices. Slow, and the stage needing raised timeouts
  (≥ 3600 s per the troubleshooting guidance).
- **activate** — reload onto the new image. The genuinely disruptive step.
- **post** — verify: version, interfaces, protocol adjacencies, config restored.

XE has no commit stage; XR does.

**Never skip `pre`.** It is the cheapest stage and it is the only one that can still tell you
"do not start". Skipping it does not save time — it moves the discovery of a problem from
before the window into the middle of it, when 40 routers are half-upgraded and rollback is
expensive. Every other stage costs more to get wrong.
</details>

> **When a lab exists, also do this:** clone a default MOP, add one custom action, and run it
> against two netsim devices with `executionMode` 1 and then 2. Seeing the same action invoked
> per-device versus once fleet-wide is the fastest way to internalise the field.

---

## 5. Teach it back

1. Explain to an operations manager what a MOP is and why it is safer than a documented
   runbook a human follows.
2. Someone edited an exported MOP file and re-imported it, and now it does not work. Explain
   what happened and what they should have done.
3. Trace one MOP action all the way down the tower: name the room that governs its data
   filters, its adapter call, its credentials, and its retry behaviour.

**You have completed the Signal Tower when:** you can answer question 3 without notes — because
that is the whole point of the palace.

---

## 6. Cards entering the deck

`r11-mop-action`, `r11-hierarchy`, `r11-stages`, `r11-io-contract`, `r11-mopactivity-tag`,
`r11-clone-defaults`, `r11-conformance-first` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- *"Each MOP action is an individual workflow"*, the Application Type → MOP → MOP Action
  hierarchy, stage list, the `app-data` input contract, the required output shape, the
  `mopActivity` tag, and the non-functional-reimport limitation: CWM 2.1 MOPs User Guide, via
  `../../reference/SOURCES.md`.
- Default MOP action counts (XR 22/25, XE 15/17, Juniper 17/19), generic actions such as
  `Sleep-cwm-sol`, and the raise-timeouts-to-3600s guidance: CWM Solutions 2.1 Fleet Upgrade
  User Guide and TAC Training.
- Golden Configuration flow, Jinja2 templating and the variable hierarchy: CWM 2.1 Golden
  Configuration guide.
- **Contested:** 50 devices per job (Fleet Upgrade User Guide) versus 100 (TAC Training,
  *"doubled from 50 in 2.0"*). Recorded in `../../reference/SOURCES.md`.
- MOP Builder generalisation beyond Fleet Upgrade is new in 2.1 — Release Overview.
