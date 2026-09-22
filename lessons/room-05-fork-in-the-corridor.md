# Room 05 — The Fork in the Corridor

**Palace location:** Fourth floor. The corridor splits in two. Above the split hangs a sign
with a small reading window, and a sleepy porter who checks each crate's label before waving
it left or right.
**Furniture reused from earlier rooms:** the crate's label (Room 00), the pigeonhole name the
result was filed under (Room 01), and the patch cables that each branch leads to (Room 02).
**Runnable today:** yes — the conditions are jq, so you can hand-evaluate every one.

---

## 1. Predict first

1. A `switch` state has three `dataConditions`. Two of them are true. Which branch is taken?
2. What happens if none are true and there is no `defaultCondition`?
3. Cisco's own example writes a condition as
   `${ if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end }`.
   Why not simply `${ .checkSyncResult0 != "in-sync" }`?

<details>
<summary>Answers</summary>

1. The first one, in array order. This is the one place in a workflow where **order in the
   file does matter** — which is exactly why it catches people who learned Room 02 well.
2. The workflow has nowhere to go. That is an authoring error, not something the engine
   recovers from gracefully. Always supply a default.
3. Because of what happens when the field is *missing*. Room 00's guard, in a new costume —
   and Drill 05.2 makes the difference visible.
</details>

---

## 2. From first principles

Every state so far had exactly one exit. A `switch` state is the first with more than one, and
it decides between them by **asking questions of the data** — nothing else. It cannot query a
device or call an adapter. It reads what previous states filed in the pigeonholes.

That is the whole reason Room 01 mattered so much. A `switch` is only as good as the names
`toStateData` created. If a result was never filed, the switch is blind.

The shape:

```json
{
  "name": "syncFromOrCreateVPN",
  "type": "switch",
  "stateDataFilter": { "input": "${ . }" },
  "dataConditions": [
    { "condition": "${ ... }", "transition": "SyncFromDevice0" },
    { "condition": "${ ... }", "transition": "CreateService" }
  ],
  "defaultCondition": { "transition": "GiveUp" }
}
```

Three things to hold on to.

**Conditions are evaluated in order, first truthy wins.** Later conditions are never even
evaluated. So conditions must be ordered most-specific-first, and overlapping conditions are
not an error — they are a silent precedence decision you made by typing them in that order.

**`defaultCondition` is your only safety net.** Not optional in any workflow you intend to
trust.

**A condition is a jq filter, so jq's truthiness rules apply** — and jq's rules are narrow:
only `false` and `null` are falsy. `0` is truthy. `""` is truthy. `[]` is truthy. `{}` is
truthy. If you come from Python or JavaScript, at least two of those will surprise you.

### The null guard, properly explained

Cisco's real condition again:

```
${ if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end }
```

Consider what the naive version does when `checkSyncResult0` is **absent**:

`null != "in-sync"` evaluates to `true`.

So a missing result — a state that never ran, an action whose `toStateData` was forgotten —
routes as though the device were **out of sync**, and the workflow confidently takes remedial
action based on information it never actually received. It does not error. It does not warn.
It just goes the wrong way.

The guard converts that case to `null`, which is falsy, so the condition simply does not
match and evaluation moves on — eventually reaching `defaultCondition`, where a missing result
is handled deliberately.

**The principle generalises: never compare a value you have not confirmed exists.** In jq the
absent case is not an error, it is `null`, and `null` compares happily against anything.

### The one sentence to keep

> **A switch reads only what earlier states filed; guard before comparing, because a missing
> value routes confidently and wrongly.**

---

## 3. In the palace

The corridor forks. Above it hangs a **sign with a reading window** — the porter can see only
what is written on the crate's label. He cannot open the crate, he cannot phone the factory
floor. Whatever the Mailroom clerk wrote on that label is his entire universe.

He works down a **short list of rules on a clipboard**, in order, and stops at the first that
matches. Rules further down the list he never reads.

At the end of his list is a **standing instruction** — "anything else, take it to the
supervisor". That is `defaultCondition`. Without it, a crate matching no rule just sits in the
corridor forever.

And the detail worth remembering, because it is the bug: the porter is **short-sighted and
does not admit it**. Hand him a crate with a *blank* label and he does not stop to ask. He
reads the blank as "not in-sync", nods, and waves it down the remediation corridor. Confident,
fast, wrong. The **guard** is the assistant who checks a label exists at all before the porter
is allowed to read it.

| Object | Stands for |
|---|---|
| The fork | a `switch` state's multiple exits |
| Reading window on the sign | conditions see only workflow data |
| Clipboard of rules, in order | `dataConditions[]`, first truthy wins |
| Standing instruction | `defaultCondition` |
| Short-sighted confident porter | `null != "in-sync"` evaluating to `true` |
| The assistant checking a label exists | `if (.field) then ... else null end` |

---

## 4. Drill

### Drill 05.1 — jq truthiness, which is narrower than you think

```bash
for v in 'null' 'false' '0' '""' '[]' '{}' '"text"'; do
  printf '%-8s -> ' "$v"
  echo "$v" | jq -c 'if . then "TRUTHY" else "FALSY" end'
done
```

<details>
<summary>Expected output</summary>

```
null     -> "FALSY"
false    -> "FALSY"
0        -> "TRUTHY"
""       -> "TRUTHY"
[]       -> "TRUTHY"
{}       -> "TRUTHY"
"text"   -> "TRUTHY"
```

**Only `null` and `false` are falsy.** An empty array is truthy — so
`if (.devices) then ...` passes happily on a device list that came back empty, and the branch
runs against nothing. Test emptiness explicitly with `(.devices | length) > 0`.
</details>

### Drill 05.2 — Watch a missing value route confidently and wrongly

```bash
echo '{}' | jq '.checkSyncResult0 != "in-sync"'
echo '{}' | jq 'if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end'
```

<details>
<summary>Expected output</summary>

```
true
null
```

The first says **"yes, remediate"** about a device it knows nothing about. The second says
"I have no answer", which is falsy, so the branch is skipped and the default handles it.

One line apart. One of them silently reconfigures production hardware based on absent data.
This is the highest-value single fact in the room.
</details>

### Drill 05.3 — Evaluate a real condition set by hand

Cisco's CreateL3VPN switch has four conditions across two devices. Run all four against three
different data states:

```bash
for d in '{"checkSyncResult0":"in-sync"}' '{"checkSyncResult0":"out-of-sync"}' '{}'; do
  echo "state: $d"
  echo "$d" | jq -c '{
    c1_needs_sync: (if (.checkSyncResult0) then .checkSyncResult0 != "in-sync" else null end),
    c2_is_synced:  (if (.checkSyncResult0) then .checkSyncResult0 == "in-sync" else null end)
  }'
done
```

<details>
<summary>Expected output</summary>

```
state: {"checkSyncResult0":"in-sync"}
{"c1_needs_sync":false,"c2_is_synced":true}
state: {"checkSyncResult0":"out-of-sync"}
{"c1_needs_sync":true,"c2_is_synced":false}
state: {}
{"c1_needs_sync":null,"c2_is_synced":null}
```

Both guarded conditions go `null` on the empty state — neither matches, so control reaches
`defaultCondition`. That is the design working: an unknown state is routed *deliberately*
rather than guessed at.
</details>

> **When a lab exists, also do this:** build a two-branch switch, delete the `toStateData` from
> the action feeding it, and watch which branch a job takes. Then add the guard and watch it
> reach the default instead.

---

## 5. Teach it back

1. Explain why `[]` being truthy in jq is dangerous in a `switch` condition, and give the fix.
2. Two `dataConditions` overlap. Nothing errors. Describe what you have actually committed to,
   and how you would discover it six months later.
3. Reconcile this room with Room 02: order in `states[]` is meaningless, but order in
   `dataConditions[]` is decisive. Why is that not a contradiction?

**You are ready for Room 06 when:** you can look at a `switch` state and name every data field
it depends on, plus which earlier action was responsible for filing each one.

---

## 6. Cards entering the deck

`r5-switch`, `r5-null-guard`, `r5-default` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- The `checkSyncResult0` conditions and `stateDataFilter.input` are quoted verbatim from the
  CWM Get Started Guide CreateL3VPN example; see `../../reference/SOURCES.md`.
- jq truthiness verified locally against `jq-1.7.1`; every "Expected output" block is real
  captured output.
- `switch` is confirmed supported in both the public and internal source sets — one of the few
  state types with no contradiction attached. Compare Room 07.
