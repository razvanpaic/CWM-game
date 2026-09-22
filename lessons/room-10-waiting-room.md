# Room 10 — The Waiting Room

**Palace location:** Tenth floor, one below the summit. Rows of chairs, a frosted-glass hatch
with a bell, a clipboard on a chain, and a clock on the wall that nobody is watching.
**Furniture reused from earlier rooms:** the chutes and tags from the Antenna Deck — a
callback waits for an *event*, so everything from Room 09 is load-bearing here. The Forms
Designer is the same tool that fed Room 00's `deviceIp`.
**Runnable today:** reasoning only.

---

## 1. Predict first

1. A workflow must pause until a human approves a change. Which state type?
2. That workflow is now paused. What is it actually waiting for, technically?
3. `set-hostname` already uses a form. Is that a callback?

<details>
<summary>Answers</summary>

1. `callback`. Confirmed supported on 2026-09-10 — and worth noting it is **absent from the
   public five-item state-type list**, which is how we learned that list is incomplete.
2. **An event.** A callback state references an event, so a human clicking Approve becomes an
   event arriving. The pause is Room 09's machinery wearing a different hat.
3. **No**, and this trips people up. `set-hostname` binds a form as *job input* via
   Data → Connect to form — collected before the workflow starts. A callback pauses a workflow
   that is already running. Different mechanisms, different moments.
</details>

---

## 2. From first principles

Every state so far has been autonomous: it acts, it decides, it retries, it moves on. Even the
`sleep` in `clear-vty-sessions` only waits a fixed interval and carries on regardless.

But real change management contains a step no engine can perform: **someone has to look at it
and say yes.** A dry-run diff before pushing to production. A maintenance window that opens
when the NOC lead confirms. A migration that pauses after traffic diversion so somebody can
check the graphs.

You cannot automate that away, so you have to *model* it. That is what `callback` is for.

### How the pause actually works

A callback state suspends execution and **references an event**. It resumes when a matching
event arrives. That is the whole mechanism, and it means:

- Everything from Room 09 applies — the event needs a type, and if many jobs are paused at
  once, it needs **correlation** so the right one resumes.
- A "human approval" and "an external system finished" are *the same thing to CWM*. Both are
  just an awaited event. The human is a slow, opinionated event source.
- The workflow is genuinely suspended, not spinning. It occupies no worker while it waits.

The authoring shape, from this repo's own notes (D-02): a callback belongs in the **Code** view,
declaring top-level `events` and pairing the callback state with a no-op action. The Designer's
Events toolbox is for MOP and system events, **not** for Forms — a distinction that cost a
whole session to establish, recorded so it does not have to be learned twice.

### Two ways the human gets asked

CWM offers both, and the choice is organisational rather than technical:

**Render the form in CWM.** The Form Designer builds the dialog, the operator sees it in the
CWM UI, and approval happens in-product. Straightforward, and it suits a small team who all
have CWM access.

**Notify an external system.** Emit a notification event to Kafka, AMQP, MQTT or HTTP and let
the approval arrive back as an event. This suits a large operations team who live in
ServiceNow, Webex or a NOC console and are never going to log into CWM. Room 09's produce side
is what carries the ask outward.

The lineage is worth knowing: operator dialogs arrived in CWM 1.1, the Form Designer in 1.2.
Guided tasks are built on exactly this machinery.

### Forms appear at two different moments — do not conflate them

This is the room's sharpest distinction.

| | Job input form | Callback form |
|---|---|---|
| When | Before the workflow starts | While it is running |
| Bound by | Data → **Connect to form** | A `callback` state referencing a form event |
| Example | `set-hostname`'s `deviceIp` + `hostname` | "Approve this dry-run diff?" |
| Workflow state | Not yet running | Suspended mid-flight |

D-02 records that this repo deliberately **rejected** combining a callback with Connect to form
in the same teaching workflow — not because it fails, but because doing both at once obscures
which mechanism is doing what. Learn them separately; then combine them knowingly.

### What a paused workflow costs you

An honest look, because "add an approval step" is easy to say:

- **It can wait forever.** A callback with no timeout is a job that never ends. Room 08's
  timeouts are the tool — `actionExecTimeout` and `resultEventTimeout` exist precisely so a
  human who went on holiday does not leave a job open indefinitely.
- **Someone must be able to find it.** A pending approval nobody knows about is an outage in
  slow motion. This is the strongest argument for notifying outward rather than waiting for
  someone to notice a dialog in CWM.
- **Correlation stops being optional.** One paused job is simple. Forty paused per-device jobs
  in a fleet upgrade, each awaiting its own approval, is entirely a correlation problem.
- **It interacts with compensation.** If a callback times out and you unwind (Room 08), the
  compensation must handle "we had already diverted traffic and were waiting for sign-off".

### The one sentence to keep

> **A callback is an event state wearing a human's hat: the workflow suspends, an event
> resumes it, and if nobody is told it is waiting then nothing resumes it at all.**

---

## 3. In the palace

Rows of **chairs**, and this is the first room in the tower where a crate simply *sits down*.
It is not being worked on. Nobody is retrying anything. It waits, and it costs nothing to wait
— no operator is tied up, no machine is idling.

In the wall is a **frosted-glass hatch with a bell**. The crate cannot see who is behind it and
does not care. What matters is that **somebody must ring the bell** before the crate stands up
and continues to the summit. Ring the bell and the crate resumes. That bell is the awaited
event, and the person behind the glass is interchangeable with a machine — the crate cannot
tell the difference and neither can CWM.

Two ways the bell gets rung. There is a **clipboard on a chain** beside the hatch, for whoever
happens to walk past — that is a form rendered in CWM. And there is a **pneumatic tube** in the
corner that fires a note out of the building to whoever is actually on shift — that is a
notification event to Kafka, MQTT or Webex. The tube exists because relying on someone
wandering past the hatch is not an operational plan.

Now the two details that make this room worth remembering.

There is a **clock on the wall that nobody is watching**. Chairs are comfortable. A crate can
sit here past the end of the maintenance window, past the end of the shift, past the weekend.
Nothing in the room objects. **The timeout is the only thing that ever makes a chair
uncomfortable**, and you have to install it yourself.

And by the door, a **second smaller desk marked ARRIVALS** where crates are asked their
business *before* they enter the building at all. That is the job input form — Connect to form.
Same paperwork, completely different moment. Crates at the arrivals desk have not started
their journey; crates in the chairs are halfway up the tower.

| Object | Stands for |
|---|---|
| A crate sitting in a chair | a suspended `callback` state, consuming no worker |
| Frosted hatch with a bell | the awaited event that resumes it |
| Whoever is behind the glass | a human or a machine — CWM cannot tell |
| Clipboard on a chain | approval form rendered in CWM |
| Pneumatic tube out of the building | notification event to Kafka / MQTT / AMQP / HTTP |
| **Unwatched clock** | **no timeout — the job waits forever** |
| ARRIVALS desk by the door | job input form, Connect to form, before the run |
| Forty crates in forty chairs | why correlation is mandatory at fleet scale |

---

## 4. Drill

> Reasoning only. Nothing here executes, and a callback is one of the few things genuinely
> hard to reason about without seeing it, so these drills lean on precision instead.

### Drill 10.1 — Input form or callback?

For each, say which mechanism and why:

1. Ask which device to reconfigure.
2. Show an NSO dry-run diff and ask "commit this?"
3. Collect a change-request number for the audit log before starting.
4. Pause a migration after traffic diversion until the NOC confirms the graphs look right.
5. Ask which software image to distribute to a fleet.

<details>
<summary>Answers</summary>

1. **Input form.** Known before anything runs.
2. **Callback.** The diff does not exist until a state has produced it, so the question is
   unanswerable before the run.
3. **Input form.** Known up front.
4. **Callback**, and the textbook case — the decision depends on observations only available
   mid-flight.
5. **Input form.** Chosen before the job starts.

The discriminator is not "does a human answer it" — a human answers all five. It is
**whether the question can even be asked before the workflow runs.** If the answer depends on
something the workflow produced, it has to be a callback.
</details>

### Drill 10.2 — Find the failure modes

A colleague adds an approval callback to a fleet upgrade that runs per-device across 40
routers. They render the form in CWM and set no timeout. List everything that will go wrong.

<details>
<summary>Answer</summary>

1. **Forty simultaneous pending approvals**, one per device, all looking near-identical in the
   UI. Without correlation, resuming the right job becomes guesswork.
2. **Nobody is notified.** The forms sit in CWM. The engineer running the window is watching a
   terminal, not the CWM approvals view.
3. **No timeout means the jobs never end.** They are still open next week — and each is holding
   whatever half-finished state its device is in.
4. **The maintenance window closes** with devices in mixed states, some upgraded and some
   awaiting activation.
5. **Compensation gets much harder** (Room 08): unwinding now means undoing a partial fleet,
   and the compensating states must cope with "was waiting for approval" as a starting point.

The fix is architectural, not cosmetic: approve **fleet-wide** rather than per-device where the
decision is genuinely one decision, notify outward via Room 09's produce side, and always set
a timeout with a defined expiry path.
</details>

### Drill 10.3 — Why the toolbox distinction matters

This repo's D-02 records that the Designer's **Events toolbox is for MOP and system events, not
Forms**, and that a start form is bound through **Data → Connect to form** instead. Explain what
someone hunting for "forms" in the Events toolbox concludes, and why that wasted a session.

<details>
<summary>Answer</summary>

They conclude forms are not supported, or that they must hand-write a callback state to collect
job input — solving the wrong problem entirely, and producing a workflow that pauses mid-run to
ask a question that should have been asked before it started.

The underlying trap: **both mechanisms involve a form and an event, so the UI's grouping feels
authoritative when it is merely a grouping.** The Events toolbox is about events the workflow
reacts to. Connect to form is about data the workflow starts with. Recognising which question
you are asking — Drill 10.1 — is what stops the search before it starts.
</details>

> **When a lab exists, also do this:** build the smallest possible callback — one state that
> waits for one form event — and watch the job sit in a suspended state. Then let it time out
> and read what the Job Event Log says. Then run two instances at once and try to resume only
> the second; that is where correlation stops being theory.

---

## 5. Teach it back

1. Explain why a human approval and an external system's completion signal are the same thing
   to CWM, and what that buys you architecturally.
2. Give the rule for choosing between a job input form and a callback form, in one sentence,
   without listing examples.
3. Someone says "we'll add the approval step and sort out notifications later". Explain what
   they have actually built.

**You are ready for Room 11 when:** you can decide input-form versus callback for any
requirement, and name the two things a callback needs that nothing else in the tower does.

---

## 6. Cards entering the deck

`r10-callback-is-event`, `r10-human-or-machine`, `r10-form-moments`, `r10-no-timeout`,
`r10-notify-outward`, `r10-toolbox-trap`, `r10-suspended-cost` — see
[`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- `callback` support confirmed 2026-09-10; it is absent from the public five-item state-type
  list, which is how that list was established as incomplete. See D-10 and
  `../../content-memory/05-open-questions.md` (Q-03, closed).
- Operator dialogs (CWM 1.1), the Form Designer (CWM 1.2), rendering forms directly in CWM
  versus emitting notification events to external messaging for large operations teams, and the
  NSO dry-run sign-off example: CWM Overview and TDM deck, slides 28–30, via
  `../../reference/SOURCES.md`.
- Guided tasks being built on callback states referencing a form event: internal KB
  (`cwm_guided_tasks`), recorded in `../../content-memory/02-research.md`.
- The Events-toolbox-is-not-Forms distinction, and `callback` belonging in the Code view with
  top-level `events` plus a no-op action: decision **D-02**, established on a CNC 7.2 lab.
- Timeout fields `actionExecTimeout` and `resultEventTimeout`: CWM Administrator Guide.
- **Not from Cisco documentation:** the failure-mode analysis in Drill 10.2 and the
  fleet-wide-versus-per-device approval guidance are our own reasoning, built from the
  documented mechanics plus Room 08's compensation constraints.
