# Room 00 — The Loading Dock

**Palace location:** Ground floor, roller door open to the street. Crates arrive on pallets.
A workbench, a crowbar, and a stack of empty crates with blank labels.
**Furniture reused from earlier rooms:** none — this is the ground floor.
**Runnable today:** yes, with `jq` only. Nothing else. No CWM, no lab, no network.

---

## 1. Predict first

> Answer before reading on. Being wrong here is the point — a wrong guess you then correct is
> remembered far better than a right answer you were handed.

1. A CWM workflow moves a device from one hostname to another. Of everything the workflow
   does, how much of it do you think is *reshaping JSON* versus *talking to the device*?
2. `jq` is often called "sed for JSON". Given that, would you expect a `jq` filter to always
   return exactly one result?
3. This line is real, copied from `workflows/set-hostname.sw.json`:
   `"results": "${ if (.data) then .data else . end }"`. Why would anyone write a conditional
   there instead of just `.data`?

<details>
<summary>Answers (open only after committing to yours)</summary>

1. Almost all of it. The device conversation is two HTTP requests the adapter makes for you.
   Everything you *author* is reshaping. That is why this room is the ground floor.
2. No — and this is the single most common misconception. A filter can return zero, one, or
   many results. `.[]` exists purely to turn one array into many outputs.
3. Because the adapter does not guarantee the shape it hands back. Sometimes the payload is
   wrapped in `.data`, sometimes it *is* the payload. That line normalises both into one
   shape so the next state can rely on it. You will run this in Drill 00.3.
</details>

---

## 2. From first principles

You already know how a shell pipe works:

```bash
cat file | grep error | wc -l
```

Text flows left to right. Each program takes what the last one produced. Nobody stores
anything; the data just moves and changes shape as it goes.

`jq` is that exact idea, with one substitution: **instead of lines of text flowing through,
JSON values flow through.**

That is the whole model. Everything else is vocabulary.

**`.` is "the thing I was just handed."** On its own it changes nothing:

```bash
echo '{"hostname":"lab-asr1001"}' | jq '.'
```

**`.foo` reaches inside.** Hand it an object, get back what lives at that key.

**`|` chains filters,** identically to the shell. `.a | .b` means "reach into `a`, then from
there reach into `b`". `.a.b` is shorthand for the same thing.

**A filter may produce more than one result.** This is the leap. `.[]` takes an array and
emits each element *as a separate output*:

```bash
echo '[1,2,3]' | jq '.[]'     # three outputs: 1, then 2, then 3
```

Not an array of three. *Three results.* Once you accept that a filter is a stream rather
than a function returning one value, `map` and `select` stop needing memorisation:

- **`map(f)`** — run `f` on every element, collect the results back into one array.
- **`select(cond)`** — emit the input if `cond` is true, emit *nothing* if false. It is a
  gate, not a transformer. Being able to emit nothing is why it works.

**`{ }` builds something new.** This is the one that matters most here. You are not editing
the crate you were handed; you are labelling a fresh one:

```bash
echo '{"hostname":"lab-asr1001"}' | jq '{ "Cisco-IOS-XE-native:hostname": .hostname }'
```

Look closely at that last command. **You have just written a line of production CWM.** It is
character-for-character the expression inside `workflows/set-hostname.sw.json`:

```json
"data": "${ { \"Cisco-IOS-XE-native:hostname\": .hostname } }"
```

The `${ ... }` is CWM's marker meaning "the thing inside is a jq filter, evaluate it against
the current workflow data". Strip the marker and the escaping, and it is the filter you just
ran on your laptop.

### The one sentence to keep

> **Every `${ ... }` in a CWM workflow is a jq filter, and the workflow's data is what flows
> through the pipe.**

---

## 3. In the palace

The roller door rattles up. A pallet of crates is dropped on the concrete — that pallet is
your **input JSON**, and it is the only material you have.

You take one crate to the workbench. The **crowbar** is `.`: it does not change the crate, it
just gets you looking inside. Reaching in for a single item is `.foo`.

Now the important bit. Against the wall is a **tipping table**. Put a crate of many items on
it and tip — the items come out and roll down the belt *one at a time, separately*. That is
`.[]`. The crate did not become a smaller crate; it stopped being a crate at all.

Further down the belt stands an **inspector with a gate** (`select`). Items she approves roll
on. Items she rejects do not go into a reject bin — they simply cease to exist. Nothing
downstream ever learns they were there.

At the end is the **stack of empty crates and a label gun** (`{ }`). You never ship the crate
that arrived. You build a new one, gun a fresh label onto it — `Cisco-IOS-XE-native:hostname`
— and drop in the item you pulled out. That new crate is what leaves the dock.

| Object in the room | Stands for |
|---|---|
| Pallet of crates | The input JSON — the only material available |
| Crowbar | `.` — look inside without changing anything |
| Reaching in for one item | `.foo` |
| Tipping table | `.[]` — one crate becomes many separate items |
| Conveyor belt | `\|` — output of one step becomes input of the next |
| Inspector with a gate | `select(cond)` — rejected items cease to exist |
| Doing the same job to every item | `map(f)` |
| Empty crate + label gun | `{ }` — build something new, never edit the original |
| The crate that leaves the dock | What `${ ... }` evaluates to |

Remember the dock as **loud and physical**. Rooms above it get quieter and more abstract, and
you will keep coming back down here whenever a filter confuses you.

---

## 4. Drill

> Only prerequisite: `jq`. Check with `jq --version` — macOS ships it, and this repo was
> verified against `jq-1.7.1`. Run everything from the repository root.

### Drill 00.1 — Open the crate

```bash
jq '.hostname' workflows/set-hostname.input.example.json
```

**Predict the output before running it.** Then run it.

<details>
<summary>Expected output</summary>

```
"lab-asr1001"
```

Note the quotes. `jq` returns a JSON *string*, not bare text — the quotes are part of the
value. Add `-r` ("raw") when you want the text without them. That distinction causes real
bugs later, which is why you are meeting it in the first drill.
</details>

### Drill 00.2 — Build the crate that ships

```bash
jq '{ "Cisco-IOS-XE-native:hostname": .hostname }' workflows/set-hostname.input.example.json
```

<details>
<summary>Expected output</summary>

```json
{
  "Cisco-IOS-XE-native:hostname": "lab-asr1001"
}
```

This is the actual RESTCONF request body that `set-hostname.sw.json` PATCHes to the device.
You did not simplify it or approximate it — that is the real payload. The key needs quoting
because it contains a colon, which `jq` would otherwise try to interpret.
</details>

### Drill 00.3 — Why that conditional exists

Prediction 3 asked why anyone writes `if (.data) then .data else . end`. Run it against two
different shapes:

```bash
echo '{"data":{"Cisco-IOS-XE-native:hostname":"lab-asr1001"},"status":200}' \
  | jq 'if (.data) then .data else . end'

echo '{"Cisco-IOS-XE-native:hostname":"lab-asr1001"}' \
  | jq 'if (.data) then .data else . end'
```

<details>
<summary>Expected output</summary>

Both commands print **exactly the same thing**:

```json
{
  "Cisco-IOS-XE-native:hostname": "lab-asr1001"
}
```

That identical result *is* the answer. Two different inputs, one predictable output. The
adapter sometimes wraps its payload in `.data` and sometimes hands it over bare; this filter
flattens both cases so the next state can be written against one shape only.

Now notice what plain `.data` would have done to the second input: returned `null`, and the
following state would have failed somewhere further along, with an error pointing at the
wrong place. The conditional is not defensive clutter — it is the author refusing to depend
on an unguaranteed shape.
</details>

### Drill 00.4 — One filter, many results

```bash
jq -r '.states[].name' workflows/set-hostname.sw.json
```

<details>
<summary>Expected output</summary>

```
SetHostname
GetHostname
```

Two lines, because `.[]` produced **two separate results**, not one array. Compare with
`jq -r '[.states[].name]'`, where the surrounding brackets collect the stream back into a
single array. Streams versus arrays is the distinction people trip over for months.
</details>

### Drill 00.5 — The gate and the label gun together

```bash
jq -r '[.states[] | select(.type=="operation") | .name] | join(", ")' workflows/set-hostname.sw.json
```

<details>
<summary>Expected output</summary>

```
SetHostname, GetHostname
```

Read it right to left as a sentence: tip the states out one at a time, let only the
`operation` ones through the gate, take each one's name, collect what survives into an array,
then join it into a string. Five filters, one pipe. Both states in this workflow happen to be
`operation` states — run it against `clear-vty-sessions.sw.json` and one state drops out,
because that workflow contains a `sleep`. Predict which before you run it.
</details>

---

## 5. Teach it back

> Say these out loud, or write them without looking anything up. Free recall is the strongest
> retention tool available and it costs 90 seconds.

1. Explain to someone who knows shell but not `jq` what `.[]` does, without using the word
   "array" in your answer.
2. `select` can return nothing at all. Why is that a feature rather than a bug, and what
   would break if it returned `null` instead?
3. A colleague replaces `if (.data) then .data else . end` with plain `.data` because it is
   shorter. Describe the failure: when does it break, and — the harder part — *where* will the
   error appear to be coming from?

**You are ready for Room 01 when:** you can look at any `${ ... }` in
`workflows/set-hostname.sw.json` and say out loud what flows in and what comes out, without
running it.

---

## 6. Cards entering the deck

Added to [`../srs/cards.json`](../srs/cards.json) with `"room": 0`.

| id | Front | Back |
|---|---|---|
| `r0-model` | What flows through a jq pipe? | JSON values, not text. Same model as a shell pipe, different cargo. |
| `r0-dot` | What does `.` mean? | "The value I was just handed." Identity — changes nothing. |
| `r0-iterate` | What does `.[]` produce from `[1,2,3]`? | Three *separate* results, not an array of three. |
| `r0-select` | What does `select(false)` emit? | Nothing at all. Not `null` — no output. That is why it works as a gate. |
| `r0-build` | How do you construct a new object with a key containing a colon? | `{ "Cisco-IOS-XE-native:hostname": .hostname }` — quote the key. |
| `r0-cwm-bridge` | In a CWM workflow, what is inside `${ ... }`? | A jq filter, evaluated against the current workflow data. |
| `r0-guard` | Why `if (.data) then .data else . end` instead of `.data`? | The adapter may or may not wrap its payload in `.data`. This normalises both to one shape; plain `.data` yields `null` on the unwrapped case and fails later, far from the cause. |
| `r0-raw` | Difference between `jq '.hostname'` and `jq -r '.hostname'`? | Without `-r` you get the JSON string `"lab-asr1001"` including quotes; with `-r` you get raw text. |

---

## 7. Sources

- `../../workflows/set-hostname.sw.json` — the `data`, `results` and `resourceId`
  expressions are quoted verbatim from this file, unmodified.
- `../../workflows/set-hostname.input.example.json` — input used by every drill.
- jq behaviour was verified locally against `jq-1.7.1` (macOS). Every "Expected output" block
  in this room is real captured output, not predicted.
- CWM's use of jq for `${ }` expressions and data filters: see the `actionDataFilter` row in
  `../../reference/SOURCES.md`. **`[VERIFY]`** — no Cisco document in our set states which jq
  version or dialect the engine embeds, so avoid relying on very new jq builtins in workflow
  expressions.
