# Room 06 — The Vault

**Palace location:** Fifth floor, and the only room with a steel door. Numbered deposit boxes
line the walls. A counter, a clerk behind glass, and a rack of **brass tags** by the entrance.
**Furniture reused from earlier rooms:** the right-hand clipboard from the Assembly Line —
`config.resourceId` — is the tag you carry in here.
**Runnable today:** no adapter calls, but the reasoning drills are the point. Nothing in this
room requires a lab to understand, and getting it wrong requires an incident to un-learn.

---

## 1. Predict first

1. Your workflow must authenticate to a router. Where does the password live?
2. `set-hostname` passes `"resourceId": "${ .deviceIp }"`. What must be true about your
   resource for that to work?
3. Credentials are encrypted at rest and never appear in the workflow. Can an operator still
   see them?

<details>
<summary>Answers</summary>

1. In a **secret**, referenced by a **resource**, which the workflow references by ID. Three
   levels of indirection, and the workflow never holds the credential.
2. Its ID must be *exactly* the string typed into the form's Device IP field. The resource is
   named after the device's IP — this trips up almost everyone once.
3. **Yes.** CWM's job event history can display decrypted secret values. The indirection
   protects the definition, not the run log. This is the room's most important fact.
</details>

---

## 2. From first principles

Start from the constraint: **a workflow definition is source code.** It gets exported,
imported, pasted into a ticket, committed to git, and mailed around. Anything inside it is
effectively public.

Yet the workflow must reach a device that demands a username and password. So the design
problem is: how does a workflow authenticate without ever containing a credential?

The answer is indirection, in three layers:

**A secret holds the credential.** Nothing else. Schemas are `basicAuth` (username and
password), `token`, and `bearer`. It has a **Secret ID**, and that ID is the only part anyone
else ever names.

**A resource holds the connection details, and points at the secret.** Host, port, scheme,
timeout — plus the Secret ID. Each resource has a type matching its adapter:
`generic.rest.resource.v1.0.0`, `cisco.nso.resource.v1.0.0`,
`system.event.kafka.v1.0.0`, and so on.

**The workflow names only the resource,** through `config.resourceId`.

So the chain runs: `resourceId` → resource → Secret ID → secret → credential. The workflow
knows the first link. It cannot see the last.

### The trap that gets everyone once

`set-hostname.sw.json` passes `"resourceId": "${ .deviceIp }"`. That is not a lookup by
address — CWM does not resolve IPs to resources. It is a **literal name match**. Whatever
string arrives in `deviceIp` is used as the resource's ID.

So a Generic REST resource must already exist whose **ID is the device's IP address**, with
its `host` set to the same value. Type `192.0.2.10` into the form and CWM looks for a resource
called `192.0.2.10`. If it does not exist, the job fails at runtime — not at validation, since
the name is only known once the form is submitted.

### The thing indirection does not protect

Everything above secures the *definition*. It does nothing for the *run*.

**CWM's job event history can display decrypted secret values.** A workflow with no
credentials in it, using a properly stored secret, can still leak that secret through a job's
history view. Which means: treat access to job history as equivalent to access to the
credentials themselves, and never demo a job whose history contains a real credential.

### Lab-only settings, stated as such

Lab resources typically set **`Allow Insecure: true`** so the adapter accepts a device's
self-signed certificate.

That is a lab-only setting and there is no version of it that is acceptable in production. In
production, validate the chain, and require a certificate with a **SHA-2 signature** and an
**RSA ≥ 2048 or P-256** key. Anything signed with MD5 or SHA-1 is forgeable by collision
attack; anything below RSA 2048 or P-256 is too weak to rely on. A self-signed certificate is
fine for a device on your own bench and never fine for a public-facing or shared system.

### The one sentence to keep

> **The workflow carries a tag, never the contents — but the job's history can still show the
> contents, so protect the history too.**

---

## 3. In the palace

By the steel door is a **rack of brass tags**. You take one. Stamped on it is a number and
nothing else — no name, no address, no hint of what it opens. The tag is `resourceId`, and
carrying it through the building is completely safe. Drop it in the street and a finder learns
nothing.

You hand the tag through the glass. The **clerk** consults her ledger: which box, which
address, which key. She is the resource. She knows the host, the port, the scheme, and which
deposit box holds the key.

Behind her, the **numbered deposit boxes** are the secrets. You never see inside one. You
never learn a box number. The clerk fetches what is needed and does the work on your behalf.

Then the detail that makes this room worth its steel door. On the counter sits a **visitor's
logbook**, open, facing outward — and the clerk, being thorough, writes down *what she
retrieved*. Not the tag number. The contents. Anyone who wanders in and reads the logbook
learns everything the vault was built to protect. **That is job event history.**

| Object | Stands for |
|---|---|
| Brass tag, number only | `config.resourceId` — safe to carry anywhere |
| Clerk with the ledger | the resource: host, port, scheme, Secret ID |
| Numbered deposit box | the secret: `basicAuth`, `token`, `bearer` |
| You never see inside a box | the workflow cannot read credentials |
| **The open visitor's logbook** | **job event history, which can show decrypted secrets** |
| Propping the steel door with a brick | `Allow Insecure: true` — lab only |

---

## 4. Drill

### Drill 06.1 — Prove no credential is present, and learn why grep is the wrong tool

Start with the obvious check:

```bash
grep -ricE 'password|secret|token|bearer' workflows/*.sw.json
```

<details>
<summary>Expected output — and why it is misleading</summary>

```
workflows/clear-vty-sessions.sw.json:1
workflows/set-hostname.sw.json:1
```

**Two hits. Both files "contain secrets".** Except they do not. Both matches are in the
`description` field, where the author wrote prose *about* secret handling — "Secrets stay in
the CWM resource", "No passwords in this definition". A keyword grep cannot tell the
difference between discussing a credential and containing one.

This matters because a scanner that cries wolf gets switched off. Ask the structural question
instead: **is there a credential-bearing key anywhere in the JSON?**

```bash
jq -r '[paths(scalars) | map(tostring) | join(".")]
       | map(select(test("(?i)password|passwd|secret|token|bearer|apikey|api_key")))
       | if length==0 then "  none - no credential-bearing keys" else . end' \
   workflows/set-hostname.sw.json workflows/clear-vty-sessions.sw.json
```

```
  none - no credential-bearing keys
```

`paths(scalars)` walks every leaf in the document and returns its full path, so this asks
about *structure* rather than text. Zero credential-bearing keys in either file — which is the
claim you actually wanted to verify, and the one worth running before you export or share a
workflow.
</details>

### Drill 06.2 — Trace the chain by hand

Using `workflows/set-hostname.sw.json`, write out the full path from the workflow to the
device password. Name every hop.

<details>
<summary>Answer</summary>

1. Action `patchHostname` passes `config.resourceId` = `${ .deviceIp }` = `192.0.2.10`.
2. CWM looks for a Generic REST resource whose **ID is the literal string** `192.0.2.10`.
3. That resource holds `host`, `port`, `scheme`, `timeout` — and a **Secret ID**.
4. That secret, of schema `basicAuth`, holds the username and password.
5. The worker `cwm-solutions-generic.rest` injects the credential when it makes the call.

The workflow knows step 1. It cannot reach step 4. Four hops of separation from one field.
</details>

### Drill 06.3 — Predict three failures

For each, say whether it fails at **import/validation** or at **runtime**, and what the
symptom looks like:

1. The resource `192.0.2.10` does not exist.
2. The resource exists but its Secret ID points at a deleted secret.
3. The resource type is `generic.rest.resource.v1.0.0` but the adapter is a different major
   version.

<details>
<summary>Answers</summary>

1. **Runtime.** The name is not known until the form is submitted, so nothing can be checked
   earlier. Expect a resource-not-found error on the first action.
2. **Runtime**, and this is the nastiest of the three — the workflow and the resource both
   look correct, so the error appears to come from the device rather than from CWM's own
   configuration.
3. **Runtime**, typically as a type or activity mismatch. Room 03's lesson again: the
   resource type must match the adapter's major version, and both are cluster-specific facts.

All three are runtime. That is the real lesson: **the secret/resource layer is almost entirely
unvalidated at authoring time.** A workflow that imports cleanly tells you nothing about
whether it can authenticate.
</details>

> **When a lab exists, also do this:** run a job, open its event history, and look for the
> credential with your own eyes. Then set your team's access policy on job history
> accordingly. This is one of those facts that only becomes real once you have seen it.

---

## 5. Teach it back

1. Explain the three-layer indirection to a colleague, then explain what it does *not* protect.
2. Why does `resourceId` being a literal name match — not an IP lookup — mean resource naming
   is part of your workflow's contract?
3. Someone asks to leave `Allow Insecure: true` on for a customer pilot "since it's not
   production yet". Give your answer and your reasoning.

**You are ready for Room 07 when:** you can explain why every failure in Drill 06.3 is a
runtime failure, and what that implies about testing.

---

## 6. Cards entering the deck

`r6-indirection`, `r6-resource-types`, `r6-secret-schemas`, `r6-job-history-leak`,
`r6-allow-insecure`, `r6-resourceid-match` — see [`../srs/cards.json`](../srs/cards.json).

---

## 7. Sources

- Secret schemas, resource types and the secrets/resources data model: CWM 2.1 Administrator
  Guide and Get Started Guide, via `../../reference/SOURCES.md`.
- Custom adapter-defined secrets using Protocol Buffers are new in 2.1 — CWM 2.1 Release Notes.
- The job-event-history exposure and the `Allow Insecure` caution both come from
  `../../deliverables/guides/2026-09-04_set-hostname-restconf.md`, written from lab experience.
- `resourceId` semantics: `../../workflows/set-hostname.sw.json` and decision D-02.
- Certificate and key strength requirements follow this repo's standing crypto rules; see the
  security section of `../../AGENTS.md`.
