# Spaced repetition deck

`cards.json` holds the card *content*. The portal canvas holds the *schedule*. Keeping them
apart is deliberate: content is authored, reviewed and versioned in git, while schedule is
personal, changes every day, and would make the repo noisy.

## Card schema

```json
{
  "schemaVersion": 1,
  "cards": [
    {
      "id": "r0-guard",
      "room": 0,
      "front": "Why `if (.data) then .data else . end` instead of `.data`?",
      "back": "The adapter may or may not wrap its payload in `.data`...",
      "tags": ["jq", "data-filters"]
    }
  ]
}
```

| Field | Rules |
|---|---|
| `id` | `r<room>-<slug>`. Stable forever — the schedule is keyed on it, so **renaming an id resets that card's history**. Rewording front/back is fine and keeps history. |
| `room` | Integer 0–11. Drives the "cards from rooms you have finished" filter. |
| `front` | The prompt. Must be answerable from its own text — no "as we saw above". |
| `back` | The answer. One idea. If it needs two paragraphs it should be two cards. |
| `tags` | Free-form, for filtering. Current: `gotcha` (28), `adapters` (12), `states` (11), `events` (10), `jq` (9), `callback` (7), `data-filters` (7), `dsl` (7), `errors` (7), `mops` (7), `secrets` (7). |

## Writing cards that are worth reviewing

A good card asks for something you must *reconstruct*, not something you recognise. In
practice that means:

- Prefer **"why"** and **"what breaks if"** over "what is". `r0-guard` asks why a conditional
  exists, which forces you to reconstruct the adapter's inconsistent response shape. A card
  reading "what does `.data` do" teaches nothing.
- **One fact per card.** Cards testing two things fail for one reason and you cannot tell
  which.
- **Tag the traps.** Anything counter-intuitive gets `gotcha` — for example that CWM runs
  operation-state actions in sequence only, or that `select(false)` emits nothing rather
  than `null`.
- Cards may quote real expressions from `../../workflows/`. That is encouraged; a card
  grounded in code you have actually read sticks better than an abstract one.

## Scheduling (implemented in the portal canvas)

SM-2-lite. Each card carries `{ interval, ease, due, streak }` in canvas state, persisted to
a `.canvas.data.json` sidecar that survives IDE restarts.

| Grade | Effect |
|---|---|
| **Again** | `interval → 0` (due now), `ease → ease − 0.20`, `streak → 0` |
| **Hard** | `interval → max(1, interval × 1.2)`, `ease → ease − 0.15` |
| **Good** | `interval → max(1, interval × ease)`, `streak + 1` |
| **Easy** | `interval → max(2, interval × ease × 1.3)`, `ease → ease + 0.15`, `streak + 1` |

New cards start at `interval: 0`, `ease: 2.5`. Ease is clamped to `[1.3, 3.0]` — below 1.3 a
card stops making progress and simply churns, which means it is a badly written card and
should be split rather than repeated.

Intervals are in days. The canvas surfaces a due-today queue on load; an empty queue is a
valid and good state, not an error to display around.
