# Full-Audit Pre-Scope — on-demand reference (V32.52, deliverable #43)

> On-demand — deliverable #43 (V32.52). Authority: `~/.claude/library/full-audit-check-trigger.md` (the
> `full audit check` dimension taxonomy) + `invisible-quality-radar.md` (D1-D10, primer-FLAG scoped).

> **Advisory-only, always exit 0.** `audit-scope.mjs` never blocks an audit, never blocks a commit, and
> never blocks a build. It is a deterministic 🔧 pre-pass that hands the `full audit check` swarm a starting
> manifest — a guaranteed FLOOR of the audit dimensions in play, never a ceiling on what the swarm covers.

This is the fleet-standard answer to "what should a full audit look at, deterministically, before the
Architect starts enumerating dimensions." It parses what changed, classifies the **target type**
(framework / app / foreign / session), and resolves two things per audit-worthy surface: which audit
**dimensions** are guaranteed in play, and which already-built **mechanical gate script** is relevant. The
output is a manifest — JSON for tooling, Markdown for a human — written to `test-artifacts/audit/`.

It is the audit-side sibling of `review-scope.mjs` (#40): same pre-scope PATTERN (a deterministic pre-step
that scopes an agent's work), lifted from **code review** to the **`full audit check`** semantic swarm.
Companion surfaces: `full-audit-check-trigger.md` (the 🧠 engine this feeds), `review-scope.mjs` +
`review-scope.md` (the code-review sibling, nested for the D1 code lens on a code diff), the AIEF `scripts/`
gate set (`check-framework-alignment` · `spec-gap-check` · `lint-deploy` · `lint-design` ·
`dev-freshness-check` · `sync-context` · `audit-app`), `invisible-quality-radar.md` (D1-D10 registry).

---

## 1. Purpose + the two design laws

Today the `full audit check` swarm is **all-🧠**: the Architect enumerates audit dimensions *from scratch*
every time, decides what changed by reading, and can silently miss a changed surface — the exact failure the
rule's origin session hit (2 stray files first flagged, 8 repos actually affected). There is no mechanical
**FLOOR** telling the Architect "these surfaces changed, so at minimum these dimensions are in play."

`audit-scope.mjs` supplies that floor. It is the same "automated layer beneath the reasoning layer"
relationship that `audit.md`'s scanners have to `security.md`, and that `review-scope.mjs` has to a code
review. Both design laws are load-bearing — a change to either changes what "correct" means for this tool.

**DESIGN LAW 1 (FLOOR-not-ceiling).** The manifest lists the MINIMUM guaranteed audit dimensions per
surface — never the full scope of what the swarm should check. It ADDS to the Architect's open-ended audit;
it never caps or replaces it. A dimension absent from the manifest for a surface is NOT permission to skip
that concern — it just means the deterministic pass didn't have a strong-enough signal to guarantee it. The
swarm's **completeness critic** is precisely what re-adds what this mechanical pass could not see; the
manifest is pointed at as *one* input for the critic to challenge, never the whole scope.

**DESIGN LAW 2 (deterministic, no LLM in the pre-step).** Pure functions over a git diff + a target-type
classifier + hardcoded `DIMENSION_RULES` / `GATE_RULES` tables (mirroring review-scope's `LENS_RULES` /
`SCANNER_RULES`). Same input → same manifest, byte-for-byte. Zero runtime deps (`node:*` stdlib only). The
*judgment* stays entirely in the 🧠 swarm; the pre-step only scopes it.

---

## 2. How to run it

```bash
node scripts/audit-scope.mjs [--base <ref>] [--diff <path>] [--target-type framework|app|foreign|session]
```

- **No flags** — diffs the working tree (`git diff`, uncommitted changes) and auto-classifies the target
  type from filesystem signals (§3).
- **`--base <ref>`** — diffs against a ref (e.g. `--base v32.51.5`, `--base HEAD~4`) via `git diff <ref>`.
  For a framework/app release audit this is typically `lastTag..HEAD` (the release batch).
- **`--diff <path>`** — reads a pre-computed unified diff from a file instead of shelling out to git
  (useful for CI, or for auditing a patch that isn't the current working tree).
- **`--target-type <t>`** — overrides the auto-classifier (§3). The one case you must set this is a
  **session** audit (a session's body of work), which has no distinct filesystem marker.

The manifest lands at:

- `test-artifacts/audit/audit-scope-manifest.json` — machine-readable, `schemaVersion` + `generated`
  timestamp + the full per-surface dimension/gate breakdown.
- `test-artifacts/audit/audit-scope-manifest.md` — the same data as a Markdown table, led by the
  FLOOR-not-ceiling banner, for a human (or the Architect) to read directly.

Both files are written on every run, and the Markdown table is also echoed to stdout. **The tool always
exits 0.** If the diff can't be read for any reason, it falls back to a degraded empty-diff manifest whose
`notice` field explains what happened, still writes both files, and still exits 0 — a broken diff source is
never a reason to block an audit.

---

## 3. Target-type classification → dimension enablement

`review-scope` has one target type (a code diff). Full-audit explicitly **adapts per target type**, so the
pre-scope's first job is to classify, then enable only the dimension families that fit. Deterministic
signals, no LLM:

| Target type | Detected from | Dimension families ENABLED | Notable AUTO-SKIP |
|---|---|---|---|
| **framework** | `specdrivenprompt/` + `Master_Prompt.md` present | cross-ref-drift · claim-vs-reality · stray-artifacts · coverage | **regression SKIP** (near-zero runtime) · most D1-D5 SKIP |
| **app** | `docs/PRODUCT.md` + (`inputs.yml` or Prisma schema) | ALL: claim-vs-reality · regression **ON** · stray · coverage · D1-D5 (scoped by primer FLAGS) | — |
| **foreign** | git repo, none of the above markers | claim-vs-reality · regression (runtime code) · stray · coverage · D1/D2/D5 by-signal | framework-specific gates SKIP |
| **session** | `--target-type session` | claim-vs-reality · stray · coverage · (regression only if it touched app runtime code) | regression SKIP on pure-docs sessions |

**Invisible-quality dimensions (D1-D5) are gated by the app's primer FLAGS**, exactly as
`invisible-quality-radar.md` prescribes. The pre-scope reads the marker-delimited `AIEF:PRIMER` region of
the target's `CLAUDE.md` (`parsePrimerFlags`) so a web-only internal CRUD app never gets a D3/WCAG floor
while a public gov/LGU app gets the full set. This makes the manifest project-aware, not shape-generic, at
zero LLM cost. An absent/unparseable primer → those FLAG-gated D-dimensions simply don't floor (they are
never *invented* — the swarm still adds them if warranted).

---

## 4. Dimension rule table + gate map

### 4a. `DIMENSION_RULES` — surface → audit dimension (the 🧠 floor)

Authority for the meaning of each dimension: `full-audit-check-trigger.md` taxonomy + `invisible-quality-
radar.md` D1-D10. This table mirrors that authority and does not redefine it.

| Dimension | Fires when a changed surface… | Target types | Confidence |
|---|---|---|---|
| **cross-ref-drift** | is a count/version-bearing framework file (`Master_Prompt.md`, `CLAUDE_compact.md`, `Framework_Feature_Index.md`, `deploy.sh`, `CLAUDE.md`, the doc-hub / Prompt_References HTML) | framework | path |
| **claim-vs-reality** | is `docs/PRODUCT.md` / `inputs.yml` / Prisma schema / `IMPLEMENTATION_MAP.md` (drift candidate) | all | path |
| **regression** | contains a large deletion, OR changes a shared signature / TS type / Prisma model / API-response shape / exported symbol | app, foreign | content (deletion-aware) |
| **D1-security** | is an auth / route-handler / RBAC / token / upload surface | framework, app, foreign | path+content |
| **D2-seo** | is a public route / page metadata / `sitemap.ts` / `robots.ts` | app, foreign | path+content |
| **D3-a11y** | is a UI / form / motion surface **and** primer `GOV_LGU=yes` → HARD | app, foreign | hard (FLAG) |
| **D4-privacy** | touches personal/sensitive data **and** primer `DATA_SENSITIVITY=personal` | app, foreign | path (FLAG-gated) |
| **D5-audit-ability** | is a security-relevant mutation with no adjacent `AuditLog` write | app, foreign | content |
| **stray-artifacts** | is a scratch / pointer / `.bak` / `.orig` file left in the repo | all | path |
| **coverage** | adds a `TODO`/`FIXME`, or an unimplemented spec section | all | content |

The manifest records, per surface, the union of matched dimensions with their `why` + `confidence` — the
Architect's guaranteed starting taxonomy. **Confidence tags:** `content` = a strong pattern matched in the
added lines; `path` = only the location matched (weaker-but-valid floor — "look here, this concern lives
here"); `hard` = a primer FLAG forced the dimension (e.g. a11y on a gov/LGU app is a hard WCAG gate, not
advisory). A deletion floors `regression` + `stray` even with no surviving content.

### 4b. `GATE_RULES` — surface → existing 🔧 mechanical script (Option A, list-only)

The full-audit **already has a 🔧 layer**: the deployed gate scripts. The pre-scope does **not** reimplement
them — it resolves *which are relevant to the changed surfaces* and lists them for the Architect to run
(**Option A**: list-only, so Law 2's determinism + speed hold; the Architect already runs these scripts).

| Changed surface | Relevant mechanical gate (existing deliverable) |
|---|---|
| count-bearing / any `specdrivenprompt/` file | `check-framework-alignment.sh` |
| `docs/PRODUCT.md` ↔ schema ↔ impl | `spec-gap-check.sh --report-only` |
| `deploy/compose/**` | `lint-deploy.sh` |
| UI / design surface (`.tsx`, `globals.css`) | `lint-design.sh --report-only` |
| a dev-served app compose after a ship | `dev-freshness-check.sh --report-only` |
| a code diff (review overlap) | `review-scope.mjs` (nest its manifest for the D1 code lens) |
| `CLAUDE.md` managed region | `sync-context.sh --check` |
| any code/config/env file (secrets/SAST) | `audit-app.sh --tier=1 --report-only` |

This is the design's payoff: the pre-scope is the **router between "what changed" and "which of our
already-built mechanical checks apply,"** so the swarm never forgets a relevant gate and the Architect
spends its 🧠 budget on the semantic dimensions the scripts can't cover. Every `script` named here is a real
AIEF gate — a parity test fails if one is renamed or removed.

---

## 5. Consumption by the `full audit check` swarm (the seam)

`full-audit-check-trigger.md` step 1 = "PM summons an Architect … it enumerates the relevant audit
dimensions." The pre-scope slots in *before* that enumeration:

```
trigger fires
  → PM runs:  node scripts/audit-scope.mjs [--base <ref>] [--target-type <t>]   (deterministic, ~instant)
  → PM hands the Architect: target + scope + audit-scope-manifest.md      ← NEW: the FLOOR
  → Architect enumerates dimensions = manifest floor ∪ its own open-ended additions
  → Architect dispatches READ-ONLY worker auditors (one per dimension/surface)
  → Architect runs the completeness critic   ← still asks "what did the MANIFEST miss?"  (ceiling-less)
  → ONE consolidated verdict → PM
```

Read the manifest as a **checklist floor, not a checklist ceiling**:

1. **Run it FIRST**, before the Architect enumerates dimensions.
2. **Read every surface's `dimensions`/`gates` as GUARANTEED in scope** — then keep auditing beyond that,
   on every surface, with the swarm's own judgment, same as always.
3. **Audit beyond it freely.** The manifest never narrows scope — it only widens the floor of what's
   guaranteed not to be silently skipped. A surface with an empty `dimensions` array still gets a full
   audit; it just means the deterministic pass found no strong signal for it.
4. **Point the completeness critic at the manifest as ONE input** to challenge ("what did the manifest
   miss?"), never as the whole scope — this is what preserves Law 1.
5. **Freshness — regenerate if the diff changed.** The manifest is a snapshot of the diff at generation
   time. If the audited range moves (more commits, a rebase), re-run before trusting it again.

---

## 6. Advisory-only posture — never gates, never blocks

`audit-scope.mjs` has no blocking mode and no gate wiring anywhere in the framework. It always exits 0,
including on a diff-read failure (§2). It is not invoked automatically at any phase, commit hook, or CI
step — the `full audit check` Architect (or a human) reaches for it deliberately, the same manual/on-demand
posture `review-scope.mjs` and `audit.md`'s toolkit use. Nothing about its output can fail a build, block a
commit, or gate a merge; its only effect is widening what an audit looks at. Any fix the *swarm* later
proposes stays owned by the swarm's fix policy (`full-audit-check-trigger.md`) under HARD HOLD — untouched
here.

---

## 7. Authority pointers

- **Dimension semantics (the taxonomy):** `~/.claude/library/full-audit-check-trigger.md` (the audit-
  dimension taxonomy) + `invisible-quality-radar.md` (D1-D10, the primer-FLAG scope-selector). On a conflict
  between this doc's table and those, they win; this doc is a derived mirror, not an independent authority.
- **Gate semantics + how to actually run them:** the AIEF `scripts/` gate set — `check-framework-alignment`,
  `spec-gap-check`, `lint-deploy`, `lint-design`, `dev-freshness-check`, `review-scope`, `sync-context`,
  `audit-app` (each with its own `.md`/header). This tool never runs a gate; it only names which is relevant.
- **The code-review sibling:** `review-scope.mjs` (#40) + `review-scope.md` (#41) — same pre-scope pattern,
  nested here for the D1 code lens on a code diff. Not superseded; the two share the generic manifest schema.
- **Consumer:** the `full audit check` magic-word routine (`full-audit-check-trigger.md`, §5) — the primary
  place this manifest gets read.
