# Room NN — <Room Name>

> **Template.** Copy this file, keep every heading, delete this quote block.
> Rooms are numbered 00–11 and must be readable in order. Existing rooms run 220–345 lines.
> Past ~350, ask whether it is really two rooms — that question is what split adapters out of
> Room 03 into Room 04, and it was the right call.

**Palace location:** <where in the Signal Tower, and what it physically looks like>
**Furniture reused from earlier rooms:** <name the specific objects — this is what makes the
palace compound instead of stack>
**Runnable today:** <yes, with jq only | no, read-and-reason only>

---

## 1. Predict first

> Answer before reading on. Being wrong here is the point — a wrong guess you then correct
> is remembered far better than a right answer you were handed.

1. <question that probes the room's core idea using only prior rooms' vocabulary>
2. <question whose obvious answer is wrong>
3. <question that reaches forward and will be resolved by the end of the room>

<details>
<summary>Answers (open only after committing to yours)</summary>

1. …
2. …
3. …
</details>

---

## 2. From first principles

<Start from something the learner already knows to be true. Build one step at a time. Never
introduce a term without saying what problem it exists to solve. No more than one new idea
per paragraph.>

### The one sentence to keep

> <A single bolded sentence. If they remember nothing else from this room, this is it.>

---

## 3. In the palace

<The memory image. Concrete, physical, slightly absurd so it sticks. It must map 1:1 onto
the technical content above — every object stands for exactly one concept, named.>

| Object in the room | Stands for |
|---|---|
| … | … |

---

## 4. Drill

> <If runnable: state the only prerequisite. If not: say plainly that nothing is executed
> here and why, and that the drill is tracing real code instead.>

### Drill NN.1 — <name>

```bash
<exact command, copy-pasteable, paths relative to the repo root>
```

**Predict the output before running it.** Then run it.

<details>
<summary>Expected output</summary>

```
<exact verified output>
```

<Why this output and not the one they probably guessed.>
</details>

### Drill NN.2 — <name>

…

### Drill NN.3 — <name>

…

> **When a lab exists, also do this:** <the live-execution version of these drills. Omit this
> block entirely for rooms that are already fully runnable.>

---

## 5. Teach it back

> Say these out loud, or write them without looking anything up. Free recall is the strongest
> retention tool available and it costs 90 seconds.

1. <prompt demanding explanation, not recognition — "why", not "what">
2. <prompt that forces connecting this room to a previous one>
3. <prompt that asks them to predict a failure and its symptom>

**You are ready for Room NN+1 when:** <a single observable behaviour, not a feeling>

---

## 6. Cards entering the deck

Added to [`../srs/cards.json`](../srs/cards.json) with `"room": NN`. Listed here so the
lesson is self-contained.

| id | Front | Back |
|---|---|---|
| `rNN-xxx` | … | … |

---

## 7. Sources

<Cite `../../reference/SOURCES.md` rows, or specific files in `../../workflows/`. If a claim
cannot be sourced, mark it `[VERIFY]` and add it to
`../../content-memory/05-open-questions.md` with a closing test. Never fill a gap by
guessing.>
