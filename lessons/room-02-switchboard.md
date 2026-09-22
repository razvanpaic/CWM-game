# Room 02 — The Switchboard

**Palace location:** Second floor. An old manual telephone switchboard: a panel of labelled
jacks, a tangle of patch cables, and one jack marked with a red ring.
**Furniture reused from earlier rooms:** the pigeonholes from the Mailroom hold the data;
this room is about the *cables* that decide what runs next.
**Runnable today:** yes, with `jq` only.

---

## 1. Predict first

1. A workflow file has five states. Which one runs first?
2. There is no `main` and no line numbering. So what stops a workflow?
3. `version` and `specVersion` are both top-level keys. Do they describe the same thing?

<details>
<summary>Answers</summary>

1. Whichever one `start` names. Not the first in the array — position in `states[]` carries
   no meaning at all.
2. A state with `end: true`. Control is a chain of explicit hand-offs; when nobody hands off,
   the workflow is over.
3. No, and confusing them is common. `version` is *your* workflow's revision. `specVersion`
   is which Serverless Workflow specification release the definition claims to follow.
</details>

---

## 2. From first principles

Here is the mental shift this room exists to force: **a workflow definition is not a script.**

A script is a list of instructions with an implicit "and then the next line". A workflow
definition is a **set of named states plus wiring**. Nothing is implied by order. Nothing runs
because it appears next in the file.

That gives you the anatomy, and every part earns its place:

| Key | What it is for |
|---|---|
| `id` | The workflow's stable name. CWM builds its API paths from this |
| `name`, `description` | Human labels. `description` is the only place to leave notes — see the warning below |
| `version` | Your revision of this workflow, e.g. `1.0.0` |
| `specVersion` | Which Serverless Workflow release the definition claims to follow |
| `start` | Names the first state. **The only entry point** |
| `states[]` | The named states, in no meaningful order |
| `functions[]` | The catalogue of callable adapter operations (Room 03) |
| `retries[]` | Named retry policies, referenced by actions (Room 08) |
| `dataInputSchema` | JSON Schema validating job input before the workflow runs |

Two consequences worth internalising.

**Order in the file is meaningless; the wiring is everything.** You can shuffle `states[]`
freely. To understand a workflow you must trace `start`, then follow each `transition`. The
file's top-to-bottom reading order is a lie you have to learn to ignore.

**There is nowhere to put a comment.** JSON has no comments, and adding a non-schema key
risks validation failure. The only sanctioned place for a note is `description`. Look at what
`set-hostname.sw.json` does with it — it carries the warning that operation IDs and worker
names are cluster-specific. That is `description` used properly: not decoration, but the one
thing a future reader cannot deduce from the code.

### The one sentence to keep

> **`start` is the only entry point, `transition` is the only way forward, and `end: true` is
> the only way to stop — position in the file means nothing.**

---

## 3. In the palace

The panel of **labelled jacks** is `states[]`. Each has a name scratched on a brass plate,
and the plates are in no particular order — whoever installed them just worked outward.

One jack has a **red ring** painted round it. That is `start`. An operator arriving for a
shift does not begin at the top left; she begins at the red ring, always.

The **patch cables** are transitions. One end in a jack, the other end in the next jack along
the path. Follow the cable, not the row.

A few jacks have a **brass cap** screwed over them, no cable leaving. Those are `end: true`.
The call is finished.

And screwed to the frame is a **small enamel plate with the switchboard's own serial number
and the year the standard was published**. Two different numbers that people constantly
misread as one: `version` and `specVersion`.

| Object | Stands for |
|---|---|
| Panel of labelled jacks, unordered | `states[]` |
| Jack with the red ring | `start` |
| Patch cable | `transition` |
| Brass cap, no cable | `end: true` |
| Serial number on the enamel plate | `version` — your revision |
| Year of the standard on the same plate | `specVersion` |

---

## 4. Drill

### Drill 02.1 — Read the skeleton, ignore the body

```bash
jq '{id, version, specVersion, start, stateCount: (.states|length)}' workflows/set-hostname.sw.json
```

<details>
<summary>Expected output</summary>

```json
{
  "id": "set-hostname",
  "version": "1.0.0",
  "specVersion": "0.8",
  "start": "SetHostname",
  "stateCount": 2
}
```

Five lines and you know what the workflow is, which revision, which spec it claims, where it
begins and how big it is. This is the first thing to run against any unfamiliar workflow.

Note `specVersion: "0.8"`. Cisco's public Workflow Creator Guide says CWM 2.1 *"corresponds
to the 0.9 specification"*, while the internal KB gives the engine baseline as 0.8 and Cisco's
own samples use both. This file ran on a real cluster. Nobody documents whether a mismatch is
rejected. Hold both facts; do not pick a side. See D-08 and Q-01.
</details>

### Drill 02.2 — Follow the cables

```bash
jq -r '.states[] | "\(.name) --> \(.transition // "END")"' workflows/set-hostname.sw.json
```

<details>
<summary>Expected output</summary>

```
SetHostname --> GetHostname
GetHostname --> END
```

`// "END"` is jq's alternative operator: use the left side unless it is `null` or `false`. A
state with no `transition` has ended, so `//` labels it. You have just generated a control-flow
graph from a declaration — which is exactly what the Designer's Graph view does.
</details>

### Drill 02.3 — Run the same filter on the other workflow

Predict the output first. There are four states and one of them is a `sleep`.

```bash
jq -r '.states[] | "\(.name) --> \(.transition // "END")"' workflows/clear-vty-sessions.sw.json
```

<details>
<summary>Expected output</summary>

```
GetVtyPool --> PutEemApplet
PutEemApplet --> WaitForClear
WaitForClear --> {"nextState":"DeleteEemApplet"}
DeleteEemApplet --> END
```

**Did you predict that third line?** Almost nobody does. `WaitForClear`'s transition is not a
string — it is an **object** `{"nextState": "DeleteEemApplet"}`.

`transition` accepts either form: the bare string is shorthand, the object is the long form
(and can carry extra fields such as `compensate`, which you will meet in Room 08). Both mean
the same hand-off. Your filter assumed strings and printed the raw object instead.

This matters beyond cosmetics. Tooling that assumes one shape will silently mis-read
workflows written in the other. Write the shape-tolerant version:

```bash
jq -r '.states[] | "\(.name) --> \(if .transition|type=="object" then .transition.nextState else (.transition // "END") end)"' workflows/clear-vty-sessions.sw.json
```
</details>

### Drill 02.4 — What each state is made of

```bash
jq -r '.states[] | "\(.name): type=\(.type), actions=\(.actions|length? // 0)"' workflows/clear-vty-sessions.sw.json
```

<details>
<summary>Expected output</summary>

```
GetVtyPool: type=operation, actions=1
PutEemApplet: type=operation, actions=1
WaitForClear: type=sleep, actions=0
DeleteEemApplet: type=operation, actions=1
```

`length?` swallows the error that `length` would raise on the `sleep` state, which has no
`actions` key at all; `// 0` then supplies a sensible value. Different state types genuinely
have different shapes, and a `sleep` state calls nothing — it only waits.
</details>

---

## 5. Teach it back

1. Someone reorders `states[]` alphabetically. What breaks? Justify your answer.
2. Explain the difference between `version` and `specVersion` to someone who has confused
   them, and say which one you would change after fixing a bug in a state.
3. You inherit a 30-state workflow. Describe the first three commands you would run, and what
   each tells you.

**You are ready for Room 03 when:** given any workflow file, you can produce its execution
order without reading the actions.

---

## 6. Cards entering the deck

`r2-declaration`, `r2-required`, `r2-transition`, `r2-specversion`, `r2-version-field` — see
[`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- `../../workflows/*.sw.json` — all structure quoted verbatim, including the object-form
  `transition` in Drill 02.3, which is genuinely in `clear-vty-sessions.sw.json`.
- `specVersion` contradiction: `../../reference/SOURCES.md`, decision D-08, question Q-01.
- Every "Expected output" block is real captured output from `jq-1.7.1`.
