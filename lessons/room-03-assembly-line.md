# Room 03 — The Assembly Line

**Palace location:** Third floor. A conveyor with numbered stations, and bolted to the wall a
thick ring-bound **machine catalogue** listing every machine the factory owns.
**Furniture reused from earlier rooms:** the Mailroom clerk still handles data at every
station; the Switchboard's cables still decide which floor you go to next.
**Runnable today:** partly. The jq drills run; the adapter calls do not, because there is no
lab. The tracing drills are the substance here.

---

## 1. Predict first

1. `functions[]` and `actions[]` are separate top-level concepts. What is the difference?
2. An `operation` state lists three actions. Do they run at the same time?
3. You copy a working workflow from a colleague's cluster to yours. It validates. Will it run?

<details>
<summary>Answers</summary>

1. `functions[]` is a catalogue — what *may* be called. `actions[]` is an actual call.
   `functionRef.refName` ties a call back to its catalogue entry.
2. No. The Serverless Workflow spec permits parallel actions, but **CWM runs operation-state
   actions in sequence only.** A real, documented deviation.
3. Probably not. Operation IDs and worker names are per-cluster. Validation checks shape, not
   whether `generic.rest.v2.0.0.request.Patch` exists on *your* cluster.
</details>

---

## 2. From first principles

An `operation` state exists to **do things**, and everything else in this room follows from
the fact that CWM cannot do those things itself. It has no idea how to speak RESTCONF or
NETCONF. Adapters do. So there has to be a way to name a capability, and a way to invoke it.

Those are two separate jobs, so they are two separate structures.

**`functions[]` — the catalogue.** Each entry gives a short local `name` and the fully
qualified `operation` it resolves to:

```json
{
  "name": "REST.Patch",
  "operation": "generic.rest.v2.0.0.request.Patch",
  "metadata": { "worker": "cwm-solutions-generic.rest" }
}
```

Three separate facts in one entry: what you will call it, what it really is, and which
**worker** process executes it.

**`actions[]` — the calls.** An action references the catalogue by name and supplies arguments:

```json
{
  "name": "patchHostname",
  "retryRef": "Default",
  "functionRef": {
    "refName": "REST.Patch",
    "arguments": {
      "input": { "path": "restconf/data/...", "header": {...}, "data": "${ ... }" },
      "config": { "resourceId": "${ .deviceIp }" }
    }
  },
  "actionDataFilter": { ... }
}
```

Note the split inside `arguments`. **`input`** is the request itself — path, headers, body.
**`config`** is *which device to send it to*, via `resourceId`. Two different kinds of
information, deliberately not mixed: the same request can be aimed at any resource.

**Actions run in sequence.** Worth stating twice because the spec says otherwise and people
carry that assumption in. If you need concurrency, you need a `parallel` state (Room 07), not
a longer action list.

### Where that operation string comes from

Look again at the catalogue entry above: `generic.rest.v2.0.0.request.Patch`. Three questions
it raises are deliberately left for the next room — what supplies that activity, what a worker
actually is, and why the version number is part of the name at all. Room 04 is the machine shop
where all three get answered.

One thing to carry up the stairs, because it changes how you read every workflow after this:
**that string is a fact about a cluster, not a constant.** The workflow's own `description`
field says exactly that. Room 02 flagged `description` as the place for what a reader cannot
deduce from the code — this is what it was for.

### The one sentence to keep

> **`functions[]` names capabilities, `actions[]` invokes them, and the fully qualified
> operation ID belongs to the cluster — never to the file.**

---

## 3. In the palace

The **machine catalogue** bolted to the wall is `functions[]`. Each page: a nickname you shout
on the floor ("Patcher"), the full model number stamped on the machine's plate, and which
**operator** is certified to run it. The nickname is local slang; the model number is the
truth; the operator is the worker.

The **numbered stations** along the conveyor are `actions[]`. Station 1, then station 2, then
station 3 — and here is the thing the room is built to teach: **there is exactly one
conveyor.** A crate cannot be at two stations at once. That is sequential execution, and it is
a property of the building, not of the crates.

At each station the worker holds two clipboards. The left one is **`input`**: what to do. The
right one is **`config`**: which machine on the factory floor to do it to. Same instructions,
different machine, just by swapping the right clipboard.

And the catalogue's model numbers are **specific to this factory**. Carry the catalogue to a
different plant and the nicknames still make sense while the model numbers refer to machines
that were never installed there.

| Object | Stands for |
|---|---|
| Machine catalogue on the wall | `functions[]` |
| Nickname shouted on the floor | `functions[].name`, used by `refName` |
| Model number on the plate | the fully qualified `operation` |
| Certified operator | `metadata.worker` |
| Numbered stations, one conveyor | `actions[]`, executed in sequence |
| Left clipboard | `arguments.input` — the request |
| Right clipboard | `arguments.config.resourceId` — the target |

---

## 4. Drill

> The jq drills run now. The adapter calls cannot, because there is no lab — so drills 03.2
> and 03.3 are about reading real code precisely, which is the skill that actually prevents
> outages.

### Drill 03.1 — Print the catalogue

```bash
jq -r '.functions[] | "\(.name)  ->  \(.operation)   [worker: \(.metadata.worker)]"' workflows/set-hostname.sw.json
```

<details>
<summary>Expected output</summary>

```
REST.Patch  ->  generic.rest.v2.0.0.request.Patch   [worker: cwm-solutions-generic.rest]
REST.Get  ->  generic.rest.v2.0.0.request.Get   [worker: cwm-solutions-generic.rest]
```

Run the same command against `clear-vty-sessions.sw.json` and you get three functions on the
same adapter version and the same worker. That agreement is recent: until 2026-09-10 the two
files disagreed, because which adapter version was real had not been established. It has been
now — see D-09, and Room 04 for what that version string actually means.
</details>

### Drill 03.2 — Trace one action end to end

Read `SetHostname` in `workflows/set-hostname.sw.json` and answer without running anything:

1. Which catalogue entry does `patchHostname` resolve to, and which worker executes it?
2. What is the full HTTP request — method, path, headers, body?
3. Which device does it go to, and where did that value come from?
4. After it returns, what name does its result live under?

<details>
<summary>Answers</summary>

1. `refName: "REST.Patch"` → `generic.rest.v2.0.0.request.Patch`, worker
   `cwm-solutions-generic.rest`.
2. PATCH `restconf/data/Cisco-IOS-XE-native:native/hostname`, with both `Accept` and
   `Content-Type` set to `application/yang-data+json`, body
   `{ "Cisco-IOS-XE-native:hostname": "<hostname>" }` — the object you built by hand in
   Drill 00.2.
3. The resource whose ID equals `${ .deviceIp }` — the value typed into the form's Device IP
   field. So the Generic REST resource must be named after the device's IP.
4. `patchResult`, via `toStateData`. `GetHostname` then files its own result under
   `currentHostname`.
</details>

### Drill 03.3 — Find the sequencing dependency

`clear-vty-sessions.sw.json` runs `GetVtyPool`, `PutEemApplet`, `WaitForClear` (sleep `PT5S`),
`DeleteEemApplet`. Why is sequential execution not merely convenient here but *required*?

<details>
<summary>Answer</summary>

Because each step depends on the previous one having landed on the device. The applet must
exist before it can fire; it must have fired before deleting it is safe. Run `PutEemApplet`
and `DeleteEemApplet` concurrently and you race the device — sometimes deleting the applet
before it ever executes, and the VTY lines never clear. The `sleep` is there precisely because
CWM cannot see whether the applet has fired; it can only wait a plausible interval.

That is the honest reading: `PT5S` is an assumption about someone else's timing, which is why
this workflow is the repo's best example of *and this is the part that could bite you*.
</details>

> **When a lab exists, also do this:** deploy `set-hostname` with its operation IDs edited to a
> version the cluster does *not* have, and capture the exact error. Knowing what a wrong
> operation ID looks like in the Job Event Log turns a 40-minute confusion into 40 seconds.

---

## 5. Teach it back

1. Explain why `input` and `config` are separate, and what you would have to change to point
   the same request at a different device.
2. A workflow validates but every job fails immediately at the first action. List three
   candidate causes from this room alone.
3. Your colleague adds a fourth action to an operation state to "speed things up by running it
   alongside the others". Correct them, and say what they should do instead.

**You are ready for Room 04 when:** you can read any action and state its method, path, target
resource and result location without running it.

---

## 6. Cards entering the deck

`r3-functions-vs-actions`, `r3-sequential`, `r3-opid-shape`, `r3-opid-percluster`, `r3-worker`
— see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- `../../workflows/set-hostname.sw.json`, `clear-vty-sessions.sw.json` — all `functions` and
  `actions` quoted verbatim.
- Sequential-actions deviation and the Generic REST version evidence: Tech Buddy 2026-09-10,
  recorded in `../../content-memory/02-research.md`; decision D-09; question Q-02.
- `cisco.nso.v1.0.3.restconf.Post` is the only fully qualified operation ID appearing in our
  local document set — see `../../reference/SOURCES.md`.
