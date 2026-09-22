# Room 09 — The Antenna Deck

**Palace location:** Eighth floor, open to the sky. A mast, a winch, and two chutes — one
marked IN, one marked OUT, and no way to use either for both. A clerk sits by the winch
matching tags on incoming mailbags against a ledger.
**Furniture reused from earlier rooms:** the Mailroom's envelopes arrive here by air instead
of by road. The clerk's matching ledger is Room 05's condition logic applied to arrivals.
**Runnable today:** reasoning and jq. No broker, so nothing is actually published.

---

## 1. Predict first

1. You need a workflow to start when a router raises an alarm. Which component queues that
   alarm — CWM, or something else?
2. One event type is defined for a Kafka topic. Can it both consume and produce?
3. A workflow declares `specVersion: "0.8"` and an event body declares `specversion: "1.0"`.
   Is one of them wrong?

<details>
<summary>Answers</summary>

1. Something else. *"CWM doesn't act as an event broker itself."* It connects to external
   brokers — Kafka, AMQP, HTTP, and MQTT as of 2.1.
2. No. Consume **or** produce. The `both` option is explicitly not supported.
3. Neither. Different specifications entirely: capital-V `specVersion` is Serverless Workflow,
   lowercase `specversion` is CloudEvents. The near-identical spelling is a genuine trap.
</details>

---

## 2. From first principles

Everything so far has been **pull**: you start a job, it runs, it finishes. Events invert
that. Something happens in the network, and a workflow starts *because* of it.

For that, three separate problems need solving: who holds the message, what shape it is in,
and which of many running things it belongs to.

**Who holds the message.** Not CWM. It is a workflow engine, not a message bus, and the
documentation is blunt: *"CWM doesn't act as an event broker itself. It provides a means to
connect to external brokers."* So you must supply one. This is the fact people get wrong when
planning an architecture, and it changes the deployment diagram — there is a box on it you have
to run yourself.

Four are supported, each with its own resource type:

| Broker | Resource type | Added |
|---|---|---|
| **Kafka** | `system.event.kafka.v1.0.0` | the primary choice for labs and for scale |
| **MQTT** | *(MQTT event resource)* | **new in CWM 2.1** |
| AMQP | `system.event.amqp.v1.0.0` | |
| HTTP | `system.event.http.v1.0.0` | simplest; no broker to run, but no queue either |

### Kafka and MQTT, concretely

These are the two that matter here, and they are not interchangeable. Both carry CloudEvents,
both do consume and produce, but they are built for different shapes of problem.

**Kafka** is a durable, partitioned log. Messages persist, consumers track an offset, and
history can be replayed. A Kafka event resource of type `system.event.kafka.v1.0.0` takes a
`brokers` list — `["host:9092"]` — plus an optional secret if the broker authenticates. Then
an **event type** binds a name to a topic and a kind:

```
event type  router-alarm-consume    topic cwm-lab-alarms-in     kind consume
event type  workflow-status-produce topic cwm-lab-status-out    kind produce
```

Consume subscribes to the topic and hands matching events to an event state. Produce publishes
from inside a running workflow. You can watch either side from the command line, which is the
fastest way to prove wiring before blaming CWM:

```bash
kafka-console-producer.sh --bootstrap-server host:9092 --topic cwm-lab-alarms-in
kafka-console-consumer.sh --bootstrap-server host:9092 --topic cwm-lab-status-out
```

**MQTT** is a lightweight publish/subscribe protocol built for constrained devices and
telemetry — small headers, topic hierarchies, quality-of-service levels. It is not a log: there
is no offset to rewind. Release Notes describe both directions plainly: *"For the consume event
kind, CWM connects to an MQTT broker and subscribes to specific topics... For the produce event
kind... CWM delivers to the broker for publishing on the designated topic."*

**Choosing between them.** Kafka when you need durability, replay or many consumers of the same
stream — fleet-wide job status, an audit trail, anything another system will also read. MQTT
when the traffic is device telemetry or lightweight signals, especially from many endpoints
where a Kafka client would be too heavy. If you want the event to survive CWM being restarted
mid-flight, that is Kafka's guarantee and not MQTT's.

**HTTP is the odd one out** and worth naming as such: there is no broker to deploy, CWM simply
accepts a POSTed CloudEvent. That makes it the quickest thing to demo and the wrong thing to
depend on, because nothing queues. If nobody is listening the event is gone.

**What shape the message is in.** CloudEvents — a CNCF standard for event envelopes so that
producers and consumers need not agree bilaterally. CWM 2.1 supports **CloudEvents 1.0.2**. An
HTTP-consumed body must be JSON representing a CloudEvent with at minimum `specversion`, `id`,
`type`, and `source`. CWM 2.1 also relaxes the strict CloudEvents requirement for some newer
paths, though the exact scope of that relaxation is not defined in our documents.

**Which running thing it belongs to.** This is the interesting problem. A hundred upgrade jobs
are in flight and an event arrives saying "device reload complete". Which job wanted it?

That is **correlation**, and CWM 2.1 changed how it works:

- **Context attributes** — user-defined key/value filters on the event's envelope.
- **Payload-based correlation, new in 2.1** — correlation rules can reference fields in the
  event *body* using jq expressions. Note it is documented as **API only**.
- **A breaking change:** `correlationAttrs` changed from `string[]` to `integer[]`, now holding
  attribute *indices* rather than names, alongside a new `payloadAttrs` map. Any 2.0-era
  automation that wrote correlation config by hand will break on upgrade.

### Consume and produce are separate objects

An event type has a `kind` — consume or produce — and it is one or the other. A workflow that
reacts to an alarm and then publishes a completion notice needs **two** event types, not one
bidirectional one. `both` is explicitly unsupported.

Consume feeds an **event state**, which waits for a matching event via `onEvents`. Produce
publishes from inside a running workflow.

Recall from Room 07 that `event` is absent from the public five-item state-type list even
though the Administrator Guide contains a working example. That list is now known to be
incomplete — `callback` was confirmed supported on 2026-09-10 despite also being missing from
it — so treat the omission of `event` as a documentation gap rather than a limitation.

### The two specVersions

Worth a line of its own because it costs people an afternoon:

| Field | Belongs to | Value here |
|---|---|---|
| `specVersion` | Serverless Workflow, in the workflow definition | `"0.8"` (D-08) |
| `specversion` | CloudEvents, in the event body | `"1.0"` |

Same word, different case, different specification, different file. They are never "out of
sync" with each other, because they were never describing the same thing.

### The one sentence to keep

> **CWM is not the broker; CloudEvents is the envelope; correlation is how one arriving event
> finds the one job that was waiting for it.**

---

## 3. In the palace

You step out onto the roof. The **mast** is the external broker, and the thing to notice
immediately is that **it is not part of the building** — it is bolted to the parapet and
belongs to someone else. Cut it down and the whole floor goes deaf. That is CWM not being a
broker.

There are actually **two masts**, and they are shaped differently.

The tall one has a **winch and a locked strongroom at its base**. Every bag hauled up is
logged and stored, in order, and you can go back and re-read yesterday's. That is **Kafka**:
durable, ordered, replayable, and heavy enough that you notice running it.

Beside it stands a thin whip antenna with **no strongroom at all** — just a hatch and a
constant chatter of small slips arriving from hundreds of little sensors around the estate.
Nothing is kept. Miss a slip and it is gone. That is **MQTT**: light, chatty, made for many
small senders, with no memory.

And propped against the parapet is a **speaking tube** running down to the street, with nobody
required at either end. Shout into it and if someone happens to be listening they hear you.
That is **HTTP**: no broker to maintain, and no queue either.

Two **chutes** in the floor. One marked IN, one marked OUT. They are physically separate, and
you cannot send a bag up the IN chute no matter how you angle it. Consume or produce, never
both.

Every mailbag arriving down the IN chute has a **standard-issue tag**: who sent it, what kind
of bag, a unique number. Standard-issue is the point — the sorting clerk never has to learn a
new tag format per sender. That is CloudEvents.

And the **clerk with the ledger**. Downstairs, a hundred people are waiting for a specific
bag. She reads the tag and decides who has been waiting for this one. Until 2.1 she could read
only the tag; now she is allowed to open the bag and read a line inside it, which is
payload-based correlation. Her ledger was also **re-numbered** in 2.1 — she used to look people
up by name and now she uses row numbers, so anyone holding an old ledger reference is looking
at the wrong person entirely.

| Object | Stands for |
|---|---|
| Masts bolted to the parapet, owned by someone else | the external broker — CWM supplies none |
| Tall mast with winch and locked strongroom | **Kafka** — durable, ordered, replayable |
| Whip antenna, chattering sensors, no strongroom | **MQTT** — light pub/sub, no replay |
| Speaking tube to the street | HTTP — no broker, and no queue |
| Two separate chutes, IN and OUT | event `kind`: consume or produce, never `both` |
| Standard-issue tag on every bag | CloudEvents 1.0.2 envelope |
| Clerk reading the tag | correlation on context attributes |
| Clerk allowed to open the bag (2.1) | payload-based correlation via jq — API only |
| Re-numbered ledger | `correlationAttrs`: `string[]` → `integer[]`, a breaking change |
| Someone downstairs waiting | an `event` state blocked on `onEvents` |

---

## 4. Drill

### Drill 09.1 — Build a minimal valid CloudEvent

The four required fields, and a payload a correlation rule could read:

```bash
echo '{
  "specversion": "1.0",
  "id": "a1b2c3",
  "type": "router-alarm-consume",
  "source": "/lab/asr1001",
  "data": { "deviceIp": "192.0.2.10", "severity": "critical" }
}' | jq -c '{required: {specversion, id, type, source}, payload: .data}'
```

<details>
<summary>Expected output</summary>

```json
{"required":{"specversion":"1.0","id":"a1b2c3","type":"router-alarm-consume","source":"/lab/asr1001"},"payload":{"deviceIp":"192.0.2.10","severity":"critical"}}
```

`specversion` here is **1.0 — CloudEvents**, not the workflow's `specVersion`. The envelope
carries routing metadata; `data` carries your content. Correlation before 2.1 could only read
the envelope; from 2.1 it can reach into `data` with jq.
</details>

### Drill 09.2 — Write a payload correlation rule

Suppose fifty jobs are waiting, each for its own device. Write the jq that extracts the
correlation key from the event above, then show why the guard matters.

```bash
EV='{"specversion":"1.0","id":"a1","type":"router-alarm-consume","source":"/lab","data":{"deviceIp":"192.0.2.10"}}'
echo "$EV" | jq -r '.data.deviceIp'
echo "$EV" | jq -r 'if (.data.deviceIp) then .data.deviceIp else "UNCORRELATED" end'
echo '{"specversion":"1.0","id":"a2","type":"router-alarm-consume","source":"/lab","data":{}}' \
  | jq -r 'if (.data.deviceIp) then .data.deviceIp else "UNCORRELATED" end'
```

<details>
<summary>Expected output</summary>

```
192.0.2.10
192.0.2.10
UNCORRELATED
```

Room 00's guard, now on the roof. An event missing its correlation field yields `null`
unguarded — and a `null` correlation key either matches nothing or, worse, matches the wrong
waiter. Guarding turns a silent mis-delivery into an explicit "this cannot be correlated".
</details>

### Drill 09.3 — Design the event types for a real flow

A workflow should: start when a router raises a critical alarm, run a diagnostic, then publish
the outcome for a ticketing system. List every event type needed, with `kind`, and say why.

<details>
<summary>Answer</summary>

**Two event types, minimum:**

1. `kind: consume` on the alarm topic — feeds an `event` state that starts the workflow.
2. `kind: produce` on a status topic — publishes the outcome.

They cannot be one object, because `both` is unsupported. If the diagnostic itself waits for
a device to finish something, that is a **third** consume type, correlated back to this
specific job — and that is where correlation stops being theoretical, because now several
instances of the same workflow are each waiting for their own device's reply.
</details>

### Drill 09.4 — Pick the broker, and defend it

For each requirement, choose **Kafka**, **MQTT** or **HTTP**, and say what breaks if you pick
one of the others:

1. Publish a completion status per device from a 100-device fleet upgrade, which the ticketing
   system will also consume.
2. Ingest temperature and optical-power telemetry from several hundred transceivers.
3. Prove an event-driven workflow triggers at all, in a fifteen-minute demo, on a laptop.
4. Trigger a workflow from a router alarm where losing the alarm during a CWM restart is
   unacceptable.

<details>
<summary>Answers</summary>

1. **Kafka.** Two independent consumers of the same stream, and status you will want to audit
   later. On MQTT the ticketing system has to be connected at the moment each message is sent
   or it never sees it; on HTTP there is no stream to consume at all.
2. **MQTT.** Many lightweight senders is exactly the protocol's purpose. Kafka would work but
   asks every transceiver-side agent to carry a much heavier client, and telemetry that stale
   is worthless anyway so durability buys little.
3. **HTTP.** Nothing to install — POST a CloudEvent and watch the workflow start. And do not
   let it survive the demo, because nothing queues.
4. **Kafka.** This is precisely the durability guarantee. On MQTT an alarm raised while CWM is
   down is simply gone, with nothing to indicate it ever existed.

Notice the pattern: the question is never "which is best" but **what must survive** — a
restart, a slow consumer, a second reader.
</details>

> **When a lab exists, also do this:** consume a CloudEvent from a Kafka topic with a
> deliberately missing correlation field and watch what the engine does with it. Then produce
> the same event over MQTT, restart CWM mid-flight, and compare what each broker did with the
> in-flight message. Reading that Kafka is durable and MQTT is not takes ten seconds; watching
> one message survive and the other vanish is what makes you remember it.

---

## 5. Teach it back

1. A colleague's architecture diagram shows CWM receiving alarms directly from routers.
   Correct it, and say what is missing.
2. Explain the two `specVersion` fields to someone who thinks they must be kept in sync.
3. Why is correlation harder than routing, and what would go wrong with no correlation at all?

**You are ready for Room 10 when:** you can specify the event types, kinds and correlation
keys for an event-driven requirement without looking anything up.

---

## 6. Cards entering the deck

`r9-not-a-broker`, `r9-consume-or-produce`, `r9-cloudevents`, `r9-two-specversions`,
`r9-correlation-breaking`, `r9-kafka-durable`, `r9-mqtt-light`, `r9-kafka-resource`,
`r9-broker-choice` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- *"CWM doesn't act as an event broker itself"*, the consume/produce/`both` limitation, the
  CloudEvents minimum fields, and the Kafka resource type `system.event.kafka.v1.0.0` with its
  `brokers` list: CWM Administrator Guide, via `../../reference/SOURCES.md`.
- CloudEvents 1.0.2 support, **MQTT as new in 2.1** and its consume/produce description quoted
  above, payload-based correlation via jq being API only, and the `correlationAttrs`
  `string[]` → `integer[]` breaking change: CWM 2.1 Release Notes.
- Topic names, `kafka-console-producer` / `kafka-console-consumer` usage and the
  consume/produce event-type pattern: the Kafka labs in the legacy `cwm-learn` skill material.
- **Not from Cisco documentation:** the Kafka-versus-MQTT selection guidance in this room is
  general messaging-architecture reasoning — durability and replay versus lightweight pub/sub —
  not a Cisco recommendation. Cisco documents that both are supported, not when to prefer each.
- The scope of 2.1's relaxed CloudEvents requirement is not defined in our document set.
- The `event` state type's absence from the public five-item list is a documentation gap, not a
  limitation — see Room 07 and Q-07.
