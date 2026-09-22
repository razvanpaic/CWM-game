# CWM Signal Tower — learning portal

A self-contained web app for learning **Cisco Crosswork Workflow Manager 2.1** from first
principles: twelve rooms of a memory palace, spaced repetition, and drills that actually
execute.

**No build step. No dependencies. No network.** Download the folder, open it, learn.

---

## Run it

The reliable way — any static server will do:

```bash
cd portal/web
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Or just **double-click `index.html`**. Everything works from `file://` — the app loads its
content as plain scripts precisely so it does not need a server. The one caveat is that some
browsers refuse local storage on `file://`, so progress may not persist between sessions.
The portal detects this and tells you, and you can still export your progress by hand.

To hand it to someone else, zip this folder. That is the whole distribution.

Tested in Chrome and Safari on macOS, from both `file://` and a static server.

---

## What is in it

**Twelve rooms**, ground floor to summit, each reusing the previous room's furniture so
knowledge compounds instead of stacking:

| # | Room | Teaches |
|---|---|---|
| 00 | The Loading Dock | jq from first principles |
| 01 | The Mailroom | `stateDataFilter`, `fromStateData`, `results`, `toStateData` |
| 02 | The Switchboard | Workflow anatomy — a definition is not a script |
| 03 | The Assembly Line | `operation` states, `functions[]` vs `actions[]`, sequencing |
| 04 | The Machine Shop | Adapters, workers, signing, operation-ID namespaces |
| 05 | The Fork in the Corridor | `switch`, `dataConditions`, the null guard |
| 06 | The Vault | Secrets, resources, and what indirection does *not* protect |
| 07 | The Loop Gallery | `foreach` vs `parallel`, where concurrency lives |
| 08 | The Alarm Room | Retries, backoff, `onErrors`, compensation |
| 09 | The Antenna Deck | CloudEvents, Kafka vs MQTT, correlation |
| 10 | The Waiting Room | `callback`, guided tasks, human approval |
| 11 | The Control Room | MOPs, stages, the action I/O contract |

**Each room runs five beats, in order**, and the order is the method:

1. **Predict** — commit to answers *before* being taught. A corrected wrong guess is
   remembered far better than a handed-over right one.
2. **Learn** — first principles, one idea at a time, ending in a single sentence to keep.
3. **Palace** — the memory image, mapped one-to-one onto the concepts. This is the
   retention mechanism, not decoration.
4. **Drill** — 60 exercises across the tower. You must solve every drill in a room to pass.
5. **Recall** — free recall, out loud, nothing in front of you.

Complete all five and the room is **mastered**: the next floor unlocks and that room's cards
enter your review rotation. Rooms are gated deliberately — the palace only compounds if you
climb it in order. You can lift the gate in **Progress** if you would rather roam.

---

## Why it should make learning faster

Three mechanisms, all of them load-bearing rather than decorative.

**Retrieval before exposure.** Every room opens with questions you cannot yet answer.
Guessing wrong and then being corrected produces far better retention than reading the right
answer first — and it is why the Predict beat cannot be skipped.

**Spaced repetition, released by mastery.** 74 cards on an SM-2-lite schedule. Cards are
*not* available until you have mastered their room, so review never front-runs teaching.
Grade **Again / Hard / Good / Easy** and the interval adapts. An empty queue is the system
working, not a bug.

**Practical, checked immediately.** 29 of the 60 drills are real `jq` you type and run, and
the portal tells you at once whether your output matches. The other 31 are predict-the-output,
sort-into-buckets, put-in-order and match-the-pair — all forms of retrieval rather than
recognition.

Everything is grounded in the actual workflow definitions from this repo, not paraphrases.

---

## The jq engine

The portal ships its own jq implementation (`js/jq/`) so drills run offline with nothing
installed. It is a **deliberately scoped subset** of jq, sized to this curriculum, and it
never guesses: an unsupported construct raises an explicit error naming what is missing.

It is verified two ways, and both are reproducible on your machine:

```bash
node portal/web/js/jq/tests.js          # 63 engine assertions
cd portal/web && node tools/verify-drills.js   # every drill's solution vs REAL jq
```

`verify-drills.js` runs each drill's reference solution through both the portal engine and the
real `jq` binary, and fails if either disagrees with the stated expected output. That is what
stops a drill from teaching a wrong answer. At the time of writing: **63/63 assertions pass
and all 29 jq drills match real jq byte for byte.**

The **Diagnostics** page runs the same assertions in your browser and reports what the engine
does and does not support.

---

## Layout

```
portal/web/
├── index.html            everything is wired here, in load order
├── css/                  base.css (tokens) · app.css (layout, components, views)
├── js/
│   ├── jq/               lex · parse · eval · builtins · index · tests
│   ├── ui.js             small DOM helpers, no framework
│   ├── store.js          progress, XP, streak, localStorage, export/import
│   ├── srs.js            SM-2-lite scheduler
│   ├── views/            tower · room · drills · review · playground · progress
│   └── app.js            hash router and boot
├── data/
│   ├── samples.js        generated from workflows/
│   ├── cards.js          generated from portal/srs/cards.json
│   ├── rooms-00-03.js    room content
│   ├── rooms-04-07.js
│   ├── rooms-08-11.js
│   └── index.js          assembles and validates the bundle at load time
└── tools/                build-cards.py · build-samples.py · verify-drills.js · smoke.js
```

Two data files are **generated** — do not hand-edit them:

```bash
python3 portal/web/tools/build-cards.py     # after editing portal/srs/cards.json
python3 portal/web/tools/build-samples.py   # after editing anything in workflows/
```

`data/index.js` validates the content bundle every time the page loads. A missing drill
solution or a card pointing at a nonexistent room shows up on Diagnostics immediately rather
than halfway through a lesson.

---

## Development checks

```bash
# content + engine, no dependencies
node portal/web/js/jq/tests.js
cd portal/web && node tools/verify-drills.js

# full end-to-end: drives every view, room, beat and drill in a headless DOM
cd portal/web
npm install --no-save jsdom
node tools/smoke.js .
```

The smoke test is the one thing with a dependency, and it is optional — the portal itself has
none. It checks that all 12 rooms × 5 beats render, that all 60 drill cards appear, that
solving a drill is recorded, that mastery releases cards and unlocks the next room, that
review grading reschedules, and that progress export/import round-trips.

---

## Your data

Progress is stored in this browser's local storage and is **never sent anywhere** — there is
no analytics, no telemetry, and no network code in the portal at all. Export it from
**Progress** to move between machines or keep a backup.

---

## Honest limits

- **There is no lab.** No CWM instance, no CML, no NSO. Rooms 00–02 and 05 are fully runnable
  with the built-in jq engine. The rest teach by reading and reasoning against real
  definitions, and each carries a "when a lab exists, also do this" note. See
  `reference/lab-stack.md` for the deferred lab design.
- **The jq engine is a subset.** It covers the curriculum and common exploration; `reduce`,
  `foreach`, `def`, variable bindings and path assignment are not implemented, and it says so.
- **Three CWM facts are still open**, each with a closing test, in
  `content-memory/05-open-questions.md`: whether `parallel` works on 2.1 (Q-07), whether
  `clear-vty-sessions` runs at adapter v2.0.0 (Q-06), and which jq version the CWM engine
  embeds (Q-08).
- **This project deliberately differs from Cisco's documentation** in two places, on lab
  evidence: `specVersion` is `0.8` (D-08) and the Generic REST adapter is `v2.0.0` (D-09).
  Rooms 02 and 04 explain why, so the difference is taught rather than hidden.
