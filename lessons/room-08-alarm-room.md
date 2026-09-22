# Room 08 — The Alarm Room

**Palace location:** Seventh floor. Red lamps, a bell, a wall of labelled breakers — and in
the corner, a **staircase that only goes down**, with each tread numbered in reverse.
**Furniture reused from earlier rooms:** the numbered stations of the Assembly Line. The
reverse staircase visits them again, backwards, undoing.
**Runnable today:** the backoff arithmetic is runnable. Error handling and compensation are
reading-and-reasoning, and this is the room where reasoning matters most.

---

## 1. Predict first

1. An action has `maxAttempts: 4`. It keeps failing. What is the job's final status?
2. Why would you ever mark an error **non**-retryable?
3. A workflow patches three devices and the fourth step fails. Does CWM undo the first three?

<details>
<summary>Answers</summary>

1. **Failed.** Retries buy time against transient faults; they are not recovery. When the
   policy is exhausted the engine ends execution with status Failed.
2. Because retrying something that cannot succeed wastes the entire backoff window and delays
   the real failure. A 401 or a malformed request will fail identically four times.
3. **No.** Nothing is undone unless you authored the undo yourself. Compensation exists, but
   it is explicit, manual, and never automatic.
</details>

---

## 2. From first principles

Distributed systems fail in two categories, and conflating them is the root of most bad error
handling.

**Transient failures** — the network dropped a packet, the device was briefly busy, a TCP
connection reset. The same request, sent again, will probably work. **Retry helps.**

**Deterministic failures** — wrong credentials, malformed body, a path that does not exist on
that platform. The same request will fail identically forever. **Retry only wastes time.**

Everything in this room follows from telling those apart.

### Retry policies

Named at the top level, referenced by actions:

```json
"retries": [
  { "name": "Default", "delay": "PT3S", "maxAttempts": 3, "multiplier": 1.2, "maxDelay": "PT15S" }
]
```

Four fields describing **exponential backoff**: wait `delay` before the first retry, multiply
the wait by `multiplier` each time, never wait longer than `maxDelay`, give up after
`maxAttempts`. Durations are ISO 8601 — `PT3S` is three seconds, `PT15S` fifteen, `PT30M`
thirty minutes.

Actions opt in with `retryRef: "Default"`. Declared once, referenced many times — so tuning
the policy tunes every action that uses it. Cisco's own example ships two, `Default` and
`Custom`, precisely so different actions can back off differently.

Backoff exists because retrying instantly is worse than not retrying. A device that is briefly
overloaded does not benefit from three more requests in the same second; it benefits from
being left alone for a moment. Multiplying the wait gives it increasing room.

### Error handling

`onErrors` attaches named error handlers to a state, each able to `transition` somewhere else
or to set `compensate: true`. `nonRetryableErrors` names the errors that must skip retry
entirely. Errors themselves are declared at the top level and can be adapter-specific — the
Get Started example declares `"nsoNotFound"`.

The design principle: **retry is for the machine, error handling is for you.** Retry answers
"try again?". `onErrors` answers "what should the workflow *do* about it?" — and only you can
answer that.

### Compensation, and what it is not

This is the room's hardest idea and the one most often misunderstood.

You declare `compensatedBy` on a state, naming another state that undoes it. You trigger the
unwind by setting `compensate: true` on a transition or end. CWM then runs the compensating
states for completed states **in reverse sequential order**.

Three constraints from the documentation, all of which matter:

- Compensation is **never automatic**. A failure does not trigger it. You author the trigger.
- It **cannot be dynamically triggered** by initial workflow data, event payloads, results of
  service invocations, or errors. The decision is structural, not data-driven.
- It **should not be executed in parallel**.

So compensation is not a database transaction and calling it "rollback" will mislead you.
It is *an undo procedure you wrote, run in reverse, when you explicitly say so.* If step 3
created something, its compensating state must delete that thing — and you must write it,
test it, and remember that it too can fail.

`clear-vty-sessions.sw.json` is worth studying here. It creates an EEM applet and then deletes
it in `DeleteEemApplet`. That is compensation logic in spirit, but implemented as a *normal
forward step* rather than a declared `compensatedBy`. Which means: if the workflow fails
between the PUT and the DELETE, **the applet is left on the device.** A real, honest limitation
sitting in this repo.

### Timeouts

Separate from retry: retry is about repeating, timeout is about waiting. Documented examples
include `resultEventTimeout: "PT30M"` and `actionExecTimeout: "PT60M"`, plus a `timeout` on the
resource itself. Fleet Upgrade's troubleshooting guidance says to raise Action, Event, State
and Workflow timeouts to **at least 3600 seconds** for image distribution — a reminder that
default timeouts are sized for API calls, not for moving gigabytes to a router.

### The one sentence to keep

> **Retry handles transient faults automatically; everything else — routing, undoing,
> giving up — is something you have to author, and compensation never fires on its own.**

---

## 3. In the palace

**Red lamps and a bell.** Something has gone wrong. The bell rings a fixed number of times,
with a longer pause between each ring — three seconds, then a little more, then more again,
never longer than fifteen. That is the retry policy: `delay`, `multiplier`, `maxDelay`,
`maxAttempts`. When the last ring fades and nobody has answered, the shift is over. **Failed.**

The **wall of labelled breakers** is `onErrors`. Each breaker is labelled with a specific
fault and a specific corridor to take. Some breakers have a red tag reading *do not reset* —
`nonRetryableErrors`. Resetting those just burns the bell.

Then the corner of the room, and the image to keep. A **staircase that only goes down**, treads
numbered in reverse: 4, 3, 2, 1. To undo the day's work you walk down it, visiting each station
you completed, in the opposite order, undoing what you did there.

Three things about that staircase, all essential:

- Nobody is ever pushed down it. **You choose to walk it.** A failure upstairs does not
  sweep you onto the stairs.
- The treads exist only where **you built them**. A station with no tread is a station whose
  work is not coming undone.
- You cannot decide to take the stairs based on what is written on a crate. The decision was
  made when the building was designed, not on the day.

| Object | Stands for |
|---|---|
| Bell with lengthening pauses | `delay` × `multiplier`, capped by `maxDelay` |
| Fixed number of rings | `maxAttempts`; silence afterwards = Failed |
| Wall of labelled breakers | `onErrors` — named fault, chosen corridor |
| Red *do not reset* tags | `nonRetryableErrors` |
| Reverse-numbered staircase | compensation, running completed states backwards |
| You must choose to walk it | `compensate: true` — never automatic |
| Missing treads | states with no `compensatedBy` — nothing is undone |
| Sand timer by the door | `actionExecTimeout`, `resultEventTimeout` |

---

## 4. Drill

### Drill 08.1 — Compute the real backoff window

`set-hostname.sw.json` uses `delay: PT3S`, `multiplier: 1.2`, `maxDelay: PT15S`,
`maxAttempts: 3`. How long can one failing action occupy the workflow?

```bash
jq -r '.retries[] | "policy=\(.name) delay=\(.delay) mult=\(.multiplier) max=\(.maxAttempts) cap=\(.maxDelay)"' workflows/set-hostname.sw.json
python3 -c "
d, m, cap, n = 3.0, 1.2, 15.0, 3
total, wait = 0.0, d
for i in range(1, n + 1):
    print(f'  retry {i}: wait {min(wait, cap):.2f}s')
    total += min(wait, cap)
    wait *= m
print(f'  total waiting: {total:.2f}s across {n} retries')
"
```

<details>
<summary>Expected output</summary>

```
policy=Default delay=PT3S mult=1.2 max=3 cap=PT15S
  retry 1: wait 3.00s
  retry 2: wait 3.60s
  retry 3: wait 4.32s
  total waiting: 10.92s across 3 retries
```

Under eleven seconds. The `maxDelay: PT15S` cap is never reached — with a multiplier of 1.2
and only three attempts, the ceiling is decoration. That is worth noticing: a policy can look
carefully tuned and have parameters that never engage. And eleven seconds is a *tight* budget
for a device that is genuinely busy.
</details>

### Drill 08.2 — Classify failures

Retryable or not? Say why:

1. `Connection reset by peer` mid-request.
2. HTTP 401 Unauthorized.
3. HTTP 404 on `restconf/data/Cisco-IOS-XE-native:native/hostname`.
4. HTTP 409 Conflict on a config lock held by another process.
5. `ResourceNotFound` for resource ID `192.0.2.10`.

<details>
<summary>Answers</summary>

1. **Retryable.** Textbook transient.
2. **Not retryable.** The credential will not improve. Three more attempts and three more
   audit-log failures.
3. **Not retryable.** The path does not exist on that platform — likely the wrong YANG model
   or a device that is not IOS-XE. Retrying cannot conjure it.
4. **Retryable**, and the best case for backoff: the lock is held *now* and probably will not
   be shortly.
5. **Not retryable**, and note *where* it comes from — CWM's own configuration, not the
   device (Room 06, Drill 06.3). No number of retries will create the resource.

Only two of five benefit from retry. A single blanket `Default` policy on every action, which
is what both workflows in this repo do, spends real time on failures it cannot fix.
</details>

### Drill 08.3 — Find the leak in our own workflow

Read `clear-vty-sessions.sw.json`. It PUTs an EEM applet, sleeps `PT5S`, then DELETEs it.
What is left behind if the workflow dies during the sleep, and what would fix it?

<details>
<summary>Answer</summary>

**The applet stays on the device.** `CWM-CLEAR-VTY` remains in the running config, containing
a countdown timer that will fire and run `clear line vty` — on its own schedule, with nobody
watching. The next run then attempts to PUT an applet that already exists.

The structural fix is to declare the delete as compensation for the PUT state via
`compensatedBy`, so an explicit unwind removes it. But note the limitation honestly: because
compensation is never automatic, you must still *trigger* it, and a workflow that dies hard
enough may never run its own compensation either. Which is why the durable answer is
idempotence — write the PUT so that re-running it over an existing applet is harmless.

This is the most valuable paragraph in the room, because it is a real flaw in code this repo
ships rather than a textbook example.
</details>

> **When a lab exists, also do this:** run `clear-vty-sessions`, kill the job during
> `WaitForClear`, and inspect the device's running config. Then run it again and see what the
> PUT does to an applet that already exists.

---

## 5. Teach it back

1. Explain the difference between retry and compensation to someone who thinks both mean
   "handle errors".
2. Why can compensation not be triggered by an error or by workflow data, and what does that
   force you to do differently?
3. Every action in a workflow shares one retry policy. Argue for and against.

**You are ready for Room 09 when:** you can look at any action and say what happens on
transient failure, on deterministic failure, and on abandonment mid-run.

---

## 6. Cards entering the deck

`r8-retry-shape`, `r8-retryref`, `r8-exhausted`, `r8-nonretryable`, `r8-compensation-manual`,
`r8-compensation-order`, `r8-sleep` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- Retry policy fields and the engine's Failed-on-exhaustion behaviour: CWM Get Started Guide
  Ch.4; `retries` block quoted verbatim from `../../workflows/set-hostname.sw.json`.
- `onErrors`, `nonRetryableErrors`, `compensatedBy`, `compensate: true`, reverse-order
  execution and the three compensation constraints: CWM Overview TDM slides 36–38, via
  `../../reference/SOURCES.md`.
- Timeout examples and the 3600-second Fleet Upgrade guidance: CWM Administrator Guide and
  Fleet Upgrade User Guide troubleshooting table.
- The leaked-applet analysis in Drill 08.3 is our own reading of
  `../../workflows/clear-vty-sessions.sw.json`, not a documented Cisco caveat.
