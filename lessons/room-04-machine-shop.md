# Room 04 — The Machine Shop

**Palace location:** Fourth floor, and the noisiest room in the building. Crates of machinery
arrive shrink-wrapped, a foreman checks each maker's seal before anything is unbolted, and a
board on the wall lists which operators are certified on which machine.
**Furniture reused from earlier rooms:** the machine catalogue from the Assembly Line one floor
down. Room 03 taught you to *read* that catalogue; this room is where the machines are
installed and the catalogue gets written.
**Runnable today:** reasoning and jq. Installing an adapter needs a cluster, but the reasoning
is what prevents the mistakes.

---

## 1. Predict first

1. CWM cannot speak RESTCONF, NETCONF or SSH on its own. So what actually does?
2. You upload an adapter. Can workflows call it immediately?
3. Somebody hands you an adapter `tar.gz` from a colleague's laptop. Should you deploy it?

<details>
<summary>Answers</summary>

1. An **adapter** — a plugin carrying the protocol knowledge, plus a **worker** process that
   executes its activities. CWM orchestrates; adapters do the talking.
2. Not necessarily. An adapter with no worker assigned to its activities is installed but
   unusable — and the failure looks like a runtime error, not an install error.
3. Be careful. From CWM 2.1 adapters can be **digitally signed** and CWM verifies the
   signature at deployment. An unsigned adapter is code you are about to run against your
   network devices with stored credentials. Treat it exactly as seriously as that sounds.
</details>

---

## 2. From first principles

Room 03 left a question hanging. An action names a function, the function names an
`operation`, and that operation is *"generic.rest.v2.0.0.request.Patch"*. But where does that
string come from, and who actually performs the HTTP request?

Start from what CWM is. It is a **workflow engine**: it reads a definition, tracks state, moves
data, decides what runs next. It contains no protocol knowledge whatsoever. It cannot open a
RESTCONF session any more than a train timetable can drive a train.

So the protocol knowledge lives in **adapters** — plugins you install. Each adapter exposes
**activities**, the individual callable operations. And activities do not execute inside the
engine either; they execute in a **worker**, a separate process the engine dispatches to.

That gives the full chain, and every link can break independently:

```
workflow action
  -> functionRef.refName          names a catalogue entry
  -> functions[].operation        the fully qualified activity ID
  -> adapter                      supplies that activity
  -> worker                       the process that runs it
  -> resource + secret            where to connect and as whom  (Room 06)
  -> the device
```

### The two namespaces, and why mixing them fails

Operation IDs are structured, and the structure differs per adapter family:

| Adapter | Pattern | Example |
|---|---|---|
| Generic REST | `generic.rest.v<ver>.request.<Method>` | `generic.rest.v2.0.0.request.Patch` |
| Cisco NSO | `cisco.nso.v<ver>.restconf.<Method>` | `cisco.nso.v1.0.3.restconf.Post` |

Note the segment before the method differs — `request` versus `restconf`. These are not
interchangeable spellings of the same thing; they are different adapters with different
argument shapes. A Generic REST action takes a `path`, headers and a body. An NSO action talks
to NSO, which then talks to the device. Substituting one namespace for the other produces an
unresolvable operation, and the error arrives at runtime.

### Version is a property of the cluster, not of the file

This is the room's most practical lesson, and this repo is the worked example.

Both workflows here declare `generic.rest.v2.0.0`, which is **confirmed tested and working**
on the target cluster. Yet no Cisco document we can reach mentions a v2.0.0 Generic REST
adapter at all: the CWM 2.1 Operator Guide shows `v1.0.3` as installed and default, public
examples show `v1.0.1`, and `v1.0.2` also exists.

Notice that the published set already disagrees with itself. That is the tell. **Cisco's
documentation lags the adapters actually shipping**, so the authoritative answer for *your*
cluster is never in a PDF — it is in the cluster:

```
GET /systemFunction            # the API answer
Administration -> Adapters     # the UI answer, showing which version is In Use
```

Read it, then align `functions[].operation` and `functions[].metadata.worker`. Do this every
time you move a definition between clusters. It is the single most common reason an imported
workflow validates cleanly and then fails on its first action.

### Lifecycle

**Packaged** as a `tar.gz` installable archive.

**Signed**, from CWM 2.1 — *"Adapters can now be digitally signed by their developers and CWM
will verify the signature upon adapter deployment."* There is a Public Key API for managing
the keys used to verify. This is a supply-chain control and it matters: an adapter is arbitrary
code that receives your stored device credentials.

**Deployed** through Administration, or `POST /adapter`. CWM 2.1 added a `force` option for
uploading despite conflicts — useful, and worth respecting, since the conflict it is
overriding was usually telling you something.

**Given a worker.** The upload dialog offers *"Automatically create worker for this adapter"*.
Via API you can suppress that with `createWorker=false`, which is exactly how you end up with
an installed adapter that nothing can call.

**Custom adapters** are possible with the **Adapter SDK and XDK**. The XDK can inspect a YANG
model and generate an activity for a path — the tooling exists so that "no adapter for this
device" is a solvable problem rather than a dead end.

### The invisible component: the execution engine

One worker you will never see. Get Started notes CWM uses an internal worker called the
**execution engine**, which *"enables the execution of all other workflow definitions and is
not visible to you in the user interface."* Worth knowing so you do not go looking for it when
counting workers.

### The one sentence to keep

> **CWM orchestrates but cannot speak any protocol; adapters supply the activities, workers
> execute them, and the fully qualified operation ID is a fact about your cluster.**

---

## 3. In the palace

The machine shop is loud. Crates of machinery arrive **shrink-wrapped with a maker's seal** —
that is the signed `tar.gz`. By the roller door stands the **foreman**, whose only job is to
check the seal before anything is unbolted. He refuses unsealed crates, and he is right to,
because whatever is inside gets handed the vault keys from two floors up.

Unbolt a machine and it goes onto the floor. But a machine on the floor **does nothing**. It
needs a **certified operator**, and the board on the wall lists who is certified on what. Sign
for a machine and forget to assign an operator and it stands there gleaming and idle — which
is the `createWorker=false` trap, and the reason "the adapter is installed" and "the adapter
works" are different claims.

Every machine has a **model plate riveted to its housing**: maker, family, version, function.
`generic.rest.v2.0.0.request.Patch`. The catalogue in the Assembly Line downstairs is copied
*from these plates*. So when the catalogue disagrees with the plate, **the plate wins** — and
when the printed manual in the office disagrees with the plate, the plate still wins.

Two makers supply this shop and their plates are stamped differently: one reads
`...request.<Method>`, the other `...restconf.<Method>`. They are not the same machine with
two labels, and an order written against the wrong plate is simply unfillable.

And in the back corner, humming behind a partition, is **one machine with no plate at all and
no operator listed**. It came with the building. That is the execution engine.

| Object | Stands for |
|---|---|
| Shrink-wrapped crate with a maker's seal | signed adapter `tar.gz` |
| Foreman checking the seal | signature verification at deployment |
| Machine on the floor with no operator | adapter installed, no worker assigned |
| Certification board on the wall | activities assigned to workers |
| Model plate riveted to the housing | the fully qualified operation ID |
| **Plate beats catalogue; plate beats manual** | **the cluster is authoritative, not the docs** |
| Two makers, differently stamped plates | `generic.rest...request` vs `cisco.nso...restconf` |
| Unplated machine behind the partition | the execution engine, invisible in the UI |

---

## 4. Drill

### Drill 04.1 — Read every plate in the shop

```bash
jq -r '.functions[] | "\(.name)\t\(.operation)\tworker=\(.metadata.worker)"' \
  workflows/set-hostname.sw.json workflows/clear-vty-sessions.sw.json | column -t
```

<details>
<summary>Expected output</summary>

```
REST.Patch   generic.rest.v2.0.0.request.Patch   worker=cwm-solutions-generic.rest
REST.Get     generic.rest.v2.0.0.request.Get     worker=cwm-solutions-generic.rest
REST.Get     generic.rest.v2.0.0.request.Get     worker=cwm-solutions-generic.rest
REST.Put     generic.rest.v2.0.0.request.Put     worker=cwm-solutions-generic.rest
REST.Delete  generic.rest.v2.0.0.request.Delete  worker=cwm-solutions-generic.rest
```

Five functions, one adapter version, one worker. They agree — but they only agree **since
2026-09-10**, when `clear-vty-sessions` was moved from `v1.0.1` to match the confirmed
v2.0.0. Read `workflows/README.md` for why, including the caveat that its GET/PUT/DELETE
calls have not themselves been re-run at v2.
</details>

### Drill 04.2 — Parse an operation ID into its parts

```bash
for op in generic.rest.v2.0.0.request.Patch cisco.nso.v1.0.3.restconf.Post; do
  echo "$op" | jq -R -r 'capture("^(?<family>.+)\\.v(?<ver>[0-9.]+)\\.(?<kind>[a-z]+)\\.(?<method>[A-Z][a-z]+)$")
    | "family=\(.family)  version=\(.ver)  kind=\(.kind)  method=\(.method)"'
done
```

<details>
<summary>Expected output</summary>

```
family=generic.rest  version=2.0.0  kind=request  method=Patch
family=cisco.nso  version=1.0.3  kind=restconf  method=Post
```

Four independent parts, and **each one can be wrong on its own**. Wrong family: no such
adapter. Wrong version: adapter present but not that build. Wrong kind: `request` where the
adapter wants `restconf`. Wrong method: the adapter has no such activity. All four surface as
similar-looking runtime failures, so being able to decompose the string is genuinely how you
debug it.
</details>

### Drill 04.3 — Diagnose five install-time mistakes

For each, say whether it fails at **upload**, at **validation**, or at **runtime**:

1. The adapter `tar.gz` is unsigned and the cluster verifies signatures.
2. The adapter is deployed with `createWorker=false` and nothing else is done.
3. The workflow says `generic.rest.v1.0.1...` but v2.0.0 is installed.
4. The workflow says `cisco.nso.v1.0.3.request.Post` — right adapter family, wrong kind.
5. The worker exists but has no Generic REST activities assigned to it.

<details>
<summary>Answers</summary>

1. **Upload.** Verification happens at deployment, which is the point of signing it.
2. **Runtime.** Upload succeeds; the adapter appears installed. The first job to call it fails
   because nothing can execute the activity.
3. **Runtime.** Definitions validate for shape, not for whether the operation resolves on this
   cluster.
4. **Runtime.** `request` versus `restconf` is a naming mistake no schema check will catch.
5. **Runtime.**

Four of five are runtime, and that is the pattern to internalise: **the adapter layer is
almost entirely unvalidated at authoring time.** A workflow importing cleanly says nothing
about whether it can call anything. Exactly the lesson Room 06 will repeat about secrets.
</details>

> **When a lab exists, also do this:** run `GET /systemFunction` and diff the returned
> operation IDs against `functions[].operation` in both workflows. Then deliberately deploy
> with `createWorker=false`, run a job, and read the error — knowing what a missing worker
> looks like in the Job Event Log turns a long confusion into a short one.

---

## 5. Teach it back

1. Explain to someone who thinks CWM "talks to devices" what actually happens, naming every
   component in the chain.
2. A workflow that ran perfectly on cluster A fails on its first action on cluster B, having
   imported without complaint. List the checks you would make, in order.
3. Why is adapter signing a security control rather than housekeeping? What does an adapter
   have access to?

**You are ready for Room 05 when:** you can take any operation ID apart into family, version,
kind and method, and say where each part is verified — and where it is not.

---

## 6. Cards entering the deck

`r4-no-protocol`, `r4-chain`, `r4-namespaces`, `r4-cluster-authoritative`, `r4-signing`,
`r4-createworker`, `r4-exec-engine` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- Adapter packaging, the *"Automatically create worker for this adapter"* dialog, and the
  execution engine being invisible in the UI: CWM 2.1 Get Started Guide.
- Adapter Manager, Worker Manager, and the SDK/XDK: CWM 2.1 Administrator Guide, Architecture
  overview.
- Adapter signing, the Public Key API, `POST /adapter` with `force`, `createWorker=false`, and
  `GET /systemFunction`: CWM 2.1 Release Notes. All via `../../reference/SOURCES.md`.
- `cisco.nso.v1.0.3.restconf.Post` is the only fully qualified operation ID appearing in our
  local document set.
- The v2.0.0 decision, and why the cluster outranks the documentation here: decision D-09 and
  `../../workflows/README.md`.
- Every "Expected output" block is real captured output, verified against `jq-1.7.1`.
