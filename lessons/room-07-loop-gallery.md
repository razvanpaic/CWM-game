# Room 07 — The Loop Gallery

**Palace location:** Sixth floor. On the left, a hall of mirrors where the same room repeats
away into the distance. On the right, a chamber with several doors that all swing open at once.
**Furniture reused from earlier rooms:** the single conveyor from the Assembly Line — this
room is where you finally get a second one, and learn where it is *not* allowed to be.
**Runnable today:** reasoning only, and this room carries a documented contradiction you
should not resolve by guessing.

---

## 1. Predict first

1. You must set the hostname on 40 devices. Do you write 40 actions?
2. Room 03 said operation-state actions run in sequence only. So how does CWM ever do two
   things at once?
3. Cisco's Workflow Creator Guide lists the supported state types as *"operation, switch,
   sleep, inject, foreach"*. Is that the complete list?

<details>
<summary>Answers</summary>

1. No — one `foreach` state iterating a collection of 40.
2. With a `parallel` state, which has concurrent **branches**. Concurrency lives at the state
   level, never inside one operation state's action list.
3. Almost certainly not, and this is the room's live problem. The Administrator Guide contains
   a working `event` state, and CWM 2.1 workflows use `callback` for guided tasks — neither is
   in that five-item list. See Q-03.
</details>

---

## 2. From first principles

Two different needs get confused constantly, so separate them before anything else:

**Repetition** — do the same thing to many items. `foreach`.
**Concurrency** — do different things at the same time. `parallel`.

They are orthogonal. You can repeat sequentially, and you can run two different branches
concurrently without repeating anything.

**`foreach`** iterates a collection held in workflow data, running its actions once per
element. It exists so you never hand-write loop logic — and, more importantly, so the
collection can be *discovered at runtime*. You do not know at authoring time how many devices
are out of compliance. A `foreach` over `.nonConformantDevices` does not care.

**`parallel`** defines separate execution **branches** that run concurrently, then merges them
back according to a completion type. Each branch owns its own actions.

### Where concurrency is and is not allowed

This is the room's structural point, and it is a genuine CWM deviation from the spec:

> *"While the full Serverless Workflow specification permits operation states to run actions
> in parallel, Cisco Crosswork Workflow Manager supports the execution of actions in sequence
> only."*

So an operation state's action list is **always** a queue, no matter how you write it. Adding
actions never adds concurrency. If you want two things happening at once, that is a
`parallel` state with two branches — a structural change, not a list change.

The practical consequence, which people discover the slow way: piling actions into one
operation state to "keep it tidy" makes the state a serial bottleneck. Four actions at 30
seconds each is two minutes, guaranteed, every run.

### The contradiction you must carry, not resolve

Cisco's public **Workflow Creator Guide** overview states: *"Supported types are: `operation`,
`switch`, `sleep`, `inject`, `foreach`."*

That list omits `event`, `parallel` and `callback`. But:

- The **Administrator Guide** contains a working `"type": "event"` example with `onEvents`.
- The internal KB shows CWM 2.1 workflows using `"type": "callback"`, and the guided-task
  documentation explicitly instructs authors to add a callback state referencing a form event.
- A **Parallel state** with branches and completion types is documented separately, and the
  CWM 2.1 sample catalogue includes a "Parallel Tasks" category.

So the five-item list is best read as incomplete or scoped to some narrower context, not as a
denial. But **we cannot prove that from the documents we hold**, which is why this is
question Q-03 rather than a fact.

What to do with that as an author: treat `operation`, `switch`, `sleep`, `inject` and
`foreach` as safe. Treat `event` and `callback` as very likely supported, since working
examples exist. Treat `parallel` as documented but unconfirmed on our target version — and if
you are about to depend on it for something that matters, spend ten minutes proving it on a
cluster first. The closing test is in Q-03 and it is cheap.

### The one sentence to keep

> **`foreach` repeats, `parallel` overlaps, and no amount of stacking actions inside one
> operation state will ever produce concurrency.**

---

## 3. In the palace

Turn left into the **hall of mirrors**. One room, reflected away to a vanishing point. Every
reflection is the same room doing the same work — and crucially, you cannot count the
reflections from the doorway. You find out how many there are by walking in. That is
`foreach`: identical work, count unknown until runtime.

Turn right instead, into a chamber with **several doors that all swing open at once**. Behind
each is something *different* happening simultaneously, and the chamber will not let you leave
until enough of them have finished — the completion type decides how many "enough" is. That is
`parallel`.

Between the two, remember the Assembly Line one floor down: **it still has exactly one
conveyor**. You cannot get concurrency by putting more stations on it. To overlap work you
must physically come up here.

And nailed to the gallery wall is a **directory of the building that is missing three rooms**.
You are standing in one of the rooms it does not list. The directory is not wrong so much as
incomplete — and the correct response is to note it and check, not to conclude the rooms are
imaginary.

| Object | Stands for |
|---|---|
| Hall of mirrors, uncountable from the door | `foreach` — same work, runtime-sized collection |
| Chamber of doors opening together | `parallel` — different work, concurrent branches |
| The one conveyor downstairs | operation-state actions, always sequential |
| Turnstile that waits for enough doors | the branch completion type |
| Directory missing three rooms | the five-item supported-types list. See Q-03 |

---

## 4. Drill

> No lab, so these are reasoning and reading drills. Drill 07.2 is runnable.

### Drill 07.1 — Choose the right structure

For each, say `foreach`, `parallel`, or "neither — one operation state is fine":

1. Set the same hostname template on 40 routers.
2. While a software image uploads, post a status notification to Webex.
3. Read a device's config, then patch it, then read it back.
4. Run a compliance check on every device returned by an earlier query.
5. Upgrade 100 devices, at most 10 at a time.

<details>
<summary>Answers</summary>

1. `foreach` — same work, many items.
2. `parallel` — two genuinely different jobs overlapping.
3. **Neither.** One operation state with three sequential actions. The steps depend on each
   other, so sequence is required, not merely acceptable — exactly the `clear-vty-sessions`
   pattern from Room 03.
4. `foreach`, and the collection size is unknown at authoring time. This is the canonical case.
5. `foreach` with a batch limit, which is what Fleet Upgrade's parallelism setting is doing
   under the covers. Room 11 returns to this — note the sources disagree on whether the cap is
   50 or 100.
</details>

### Drill 07.2 — Size a collection before you iterate it

Room 05 established that `[]` is truthy in jq. So guarding a `foreach` with
`if (.devices) then ...` passes on an empty list.

```bash
for d in '{"devices":[]}' '{"devices":["a","b"]}' '{}'; do
  printf '%-24s naive=%s  sized=%s\n' "$d" \
    "$(echo "$d" | jq -c 'if (.devices) then "RUN" else "SKIP" end')" \
    "$(echo "$d" | jq -c 'if ((.devices // []) | length) > 0 then "RUN" else "SKIP" end')"
done
```

<details>
<summary>Expected output</summary>

```
{"devices":[]}           naive="RUN"  sized="SKIP"
{"devices":["a","b"]}    naive="RUN"  sized="RUN"
{}                       naive="SKIP"  sized="SKIP"
```

The naive guard says RUN on an empty list — a `foreach` that iterates nothing, reports
success, and changes nothing. Combined with Room 01's lesson about results going nowhere, this
is how a workflow ends up "succeeding" every night while doing absolutely no work. Nobody
notices for months.

`// []` supplies a default before `length`, so the missing and empty cases collapse to one
answer.
</details>

### Drill 07.3 — Justify a structure to a sceptic

A colleague has one operation state with six actions and says it is fine because "CWM
parallelises them anyway". Write your correction in three sentences: what is actually true,
what it costs, and what to do instead.

---

## 5. Teach it back

1. Distinguish repetition from concurrency using an example of each that the other cannot do.
2. Why is the empty-collection case more dangerous than the missing-collection case?
3. You need `parallel` for a customer deliverable next week. Describe exactly how you would
   establish whether you can rely on it, and what you would do if the answer is no.

**You are ready for Room 08 when:** you can pick the right state type for a requirement and
say what evidence you have that CWM supports it.

---

## 6. Cards entering the deck

`r7-foreach`, `r7-parallel`, `r7-parallel-vs-actions`, `r7-matrix-conflict` — see
[`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- Sequential-actions deviation, `foreach` / `parallel` / `inject` descriptions, and the
  five-item supported-types list: Tech Buddy 2026-09-10, recorded in
  `../../content-memory/02-research.md`.
- The `event` state example is in the CWM Administrator Guide; `callback` usage in CWM 2.1
  guided tasks comes from the internal KB. Both contradict the five-item list. **`[VERIFY]`** —
  tracked as Q-03 in `../../content-memory/05-open-questions.md`, with its closing test.
- The authoritative state-type matrix lives in the CWM 2.1 Workflow Creator Guide, which is
  **not** in our local document set. Obtaining it would close this room's open question
  without needing a cluster.
