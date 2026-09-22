# Room 01 — The Mailroom

**Palace location:** First floor, up the concrete stairs from the Loading Dock. Pigeonholes
floor to ceiling, an in-tray, an out-tray, and a franking machine that stamps everything.
**Furniture reused from earlier rooms:** the crate and label gun from the Loading Dock. Every
filter in this room is a jq filter you already know how to write.
**Runnable today:** yes, with `jq` only.

---

## 1. Predict first

1. An action runs successfully. Where does its result go?
2. CWM gives you *three* places to write a data filter around a single action. Why would one
   not be enough?
3. A job finishes with status Succeeded, but its Result card is empty. What went wrong?

<details>
<summary>Answers</summary>

1. Nowhere, unless you say so. This is the surprise. A successful action's result is
   discarded unless a filter places it into workflow data.
2. Because there are three genuinely different moments, and they need different answers:
   what the state is allowed to see, what this action is allowed to see, and where the
   action's output lands.
3. Probably nothing "went wrong" at all. The Result card shows data written by
   `toStateData`. An action with no `toStateData` runs fine and contributes nothing visible.
</details>

---

## 2. From first principles

In Room 00 you learned that a workflow is data flowing through filters. Now the question that
actually matters in practice: **whose data, and when?**

A workflow carries one JSON value as it runs. Call it the **workflow data**. It starts as the
job input and is the only thing that persists between states.

An action — one adapter call — is a stranger. It does not get the whole workflow data by
default, it does not know your naming, and when it returns something, it has no idea where
you want it kept. So three questions have to be answered separately:

**What can this state see?** `stateDataFilter.input` narrows the workflow data on the way in.

**What arguments does this action get?** `actionDataFilter.fromStateData` selects the slice
of state data made available to the action's arguments.

**Where does the answer go?** Two filters, because these are two different jobs:
- `actionDataFilter.results` reshapes the *raw thing the adapter returned*.
- `actionDataFilter.toStateData` decides *where in the workflow data* the reshaped value is
  written.

Both filters exist because adapters return envelopes, not answers. A RESTCONF GET does not
return a hostname; it returns a response object that *contains* a hostname, sometimes wrapped
in `.data`. `results` opens the envelope. `toStateData` files the contents.

Here is a real pair from `workflows/set-hostname.sw.json`:

```json
"actionDataFilter": {
  "results": "${ if (.data) then .data else . end }",
  "toStateData": "${ .currentHostname }"
}
```

Open the envelope however it arrives, then file it under `currentHostname`. Any later state
can now say `.currentHostname` and rely on it.

### The one sentence to keep

> **An action's result is discarded unless `toStateData` says where to keep it.**

---

## 3. In the palace

The in-tray on the left is `stateDataFilter.input` — the porter decides which of the day's
post is even carried into this room.

You are the clerk. You do not hand a courier the entire in-tray. You copy the two lines he
needs onto a slip: that slip is `fromStateData`.

The courier returns with a **padded envelope**, and this is the thing to remember: he always
brings an envelope, never the bare object. Sometimes the envelope has another envelope inside
it. Slitting it open until you reach the actual contents is `results`.

Then you turn to the wall of **pigeonholes**, each with a handwritten name, and put the
contents into exactly one: `toStateData`. Here is the room's whole lesson in one image —
**if you never choose a pigeonhole, you drop the contents in the bin.** Not out of malice.
There is simply nowhere else for them to go.

| Object | Stands for |
|---|---|
| In-tray | `stateDataFilter.input` — what this state may see |
| Slip copied for the courier | `actionDataFilter.fromStateData` |
| Padded envelope he returns | The adapter's raw response, always wrapped |
| Slitting it open | `actionDataFilter.results` |
| Named pigeonhole | `actionDataFilter.toStateData` |
| The bin | What happens with no `toStateData` |

---

## 4. Drill

> Prerequisite: `jq`. Run from the repository root. Each drill emulates one stage, so by the
> end you will have hand-run the whole pipeline.

### Drill 01.1 — `fromStateData`: hand over only what is needed

```bash
echo '{"deviceIp":"192.0.2.10","hostname":"lab-asr1001","unrelated":"noise"}' | jq '{ hostname }'
```

<details>
<summary>Expected output</summary>

```json
{
  "hostname": "lab-asr1001"
}
```

`{ hostname }` is shorthand for `{ hostname: .hostname }`. `deviceIp` and `unrelated` are not
hidden — they were never handed over. Narrowing is not about secrecy; it is about the action
being unable to depend on fields you did not promise it.
</details>

### Drill 01.2 — `results`: open a two-layer envelope

This is a real expression from Cisco's own CreateL3VPN example, unmodified:

```bash
echo '{"data":{"tailf-ncs:output":{"result":"in-sync"}}}' \
  | jq 'if (.data) then .data | ."tailf-ncs:output".result else null end'
```

<details>
<summary>Expected output</summary>

```
"in-sync"
```

Three layers peeled to reach one string: guard `.data`, step into it, then reach through the
colon-containing key `"tailf-ncs:output"` — quoted for the same reason you quoted a key when
*building* one in Room 00. Without `results`, the next state would have to know NSO's
response shape. With it, the next state just reads a string.
</details>

### Drill 01.3 — `toStateData`: file it in a pigeonhole

```bash
echo '{"deviceIp":"192.0.2.10"}' | jq '. + { checkSyncResult0: "in-sync" }'
```

<details>
<summary>Expected output</summary>

```json
{
  "deviceIp": "192.0.2.10",
  "checkSyncResult0": "in-sync"
}
```

The original data is intact and the result now sits beside it under a name later states can
use. Drop the `. +` and you get *only* the new key — the workflow's memory of `deviceIp`
gone. That is the shape of a whole class of "the second state can't find the device" bugs.
</details>

### Drill 01.4 — Watch the result hit the bin

```bash
echo '{"deviceIp":"192.0.2.10"}' | jq '.'
```

That is it. That is the drill. The action ran, returned `"in-sync"`, and because no filter
placed it anywhere, the workflow data is byte-for-byte what it was before. The job will
report Succeeded. The Result card will show nothing new. **A successful action that changed
nothing is the single most confusing failure mode in CWM**, and it is invisible in the status
column.

> **When a lab exists, also do this:** run `set-hostname` once as-is, then again with
> `toStateData` deleted from the second action, and compare the Job Event Log side by side.
> Both jobs succeed. Only one has a Result card. Seeing that with your own eyes is worth more
> than this entire lesson.

---

## 5. Teach it back

1. Explain why `results` and `toStateData` are two filters and not one, using the envelope
   image but not the words "results" or "toStateData".
2. A colleague says "the action failed, the next state got `null`". Give two explanations that
   have nothing to do with the action failing.
3. Why does narrowing with `fromStateData` make a workflow *easier to change later*, even
   though it is more typing now?

**You are ready for Room 02 when:** you can point at any `actionDataFilter` in
`workflows/` and say what the adapter returned, what survived the filter, and what name it
now lives under.

---

## 6. Cards entering the deck

`r1-three-moments`, `r1-results`, `r1-tostatedata`, `r1-invisible`, `r1-result-card`,
`r1-datainputschema` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- `../../workflows/set-hostname.sw.json` and `clear-vty-sessions.sw.json` — all
  `actionDataFilter` blocks quoted verbatim.
- The `"tailf-ncs:output".result` expression in Drill 01.2 is from the CWM Get Started Guide
  CreateL3VPN example; see `../../reference/SOURCES.md`.
- `fromStateData`, `results`, `toStateData` and `dataInputSchema` support confirmed
  2026-09-10; recorded in `../../content-memory/02-research.md`.
- Every "Expected output" block is real captured output from `jq-1.7.1`.
