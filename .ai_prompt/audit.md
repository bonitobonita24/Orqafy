# App Audit Toolkit — on-demand reference (V32.38, deliverable #35)

> **DEFAULT POSTURE = MANUAL / ON-DEMAND (owner-set 2026-07-28).** Nothing in this toolkit runs
> automatically in the background — not on commit, not at Phase 5, not on a timer. It is a **one-shot
> you fire when you want it**: `bash scripts/audit-app.sh [--tier=1|2] [--report-only] <target-dir>`.
> Auto-wiring any tool to a gate is an **explicit opt-in** per app, never the default. The **T2 Phase-5
> blocking gate IS wired** in `phases.md` Phase 5 as of V32.39.1 (a prose-conditional on
> `audit.tier2.enforce: true` in `inputs.yml`) — but it stays OFF until an app sets that flag, so the
> default is still zero background runs. The **Gitleaks pre-commit hook remains documented-only / not
> wired** (deferred). See §1.
>
> **Loose trigger — map intent, don't demand exact words:** "audit this app" · "run the audit toolkit
> on X" · "scan <app> for security/quality" · "one-shot audit of X" · "is <app> clean?" → load this
> file and run `audit-app.sh <target-dir>` against the named app (cross-repo is supported — the runner
> takes a positional TARGET_DIR).
>
> **PRESENT A TIER MENU when the trigger names NO tier (owner-set 2026-07-28).** The human should not have
> to memorize `--tier`/`--report-only` flags. So when the audit is invoked WITHOUT a stated tier, do NOT
> guess — reply with a short menu of scopes + each tier's coverage and let them pick a number, then run the
> chosen form. If a tier IS named ("tier 1 audit", "just the quick scan", "full audit"), skip the menu and
> run it. The menu to present:
>
> | # | Scope | Cost | Covers |
> |---|---|---|---|
> | **1** | **Full audit (T1 + T2)** ⭐ | ~minutes | everything below — the complete run |
> | **2** | Tier 1 only | ~seconds | Gitleaks (secrets) · Semgrep (SAST) · `tsc` (type-check, monorepo-aware) · ESLint (lint) |
> | **3** | Tier 2 only | ~minutes | Trivy (dep CVEs + IaC misconfig) · OSV-Scanner (SCA) · Syft (SBOM) · BackstopJS (visual regression) · plus wired Playwright/Lighthouse/axe-Pa11y/k6 |
>
> Then also offer **mode**: report-only (see findings, never blocks — the default) vs blocking (fail on
> CRITICAL/HIGH). **T3** (ZAP DAST · Stryker mutation · manual pentest) is expensive + advisory-only — a
> separate deliberate campaign (§5), NEVER an option in this quick menu. First `--tier=2` run downloads
> Trivy's vuln DB (~hundreds of MB) — flag that if resources are tight. Map the pick to
> `audit-app.sh [--tier=N] [--report-only] <target-dir>`.
>
> **Also load this file** when triaging a finding from `audit-app.sh`, on the **Scenario 48** retrofit,
> or at any `security.md` cross-reference to the CVE/image-scan gates.
>
> **INHERIT-not-REPLACE (Rule 38 never overrides Rule L1–L6 or the Checklist):** this file is the
> **AUTOMATED layer beneath** `security.md` (the L1–L6 security stack) and `Security_Checklist.md`
> (the 147-item human/AI review checklist). Rule 38 finds what a scanner can find, mechanically, on
> every commit or every Phase 5 run — it never substitutes for the reasoning-driven review those two
> files govern, and a scanner passing green never closes a `security.md`/Checklist item on its own.

This is the fleet-standard answer to "how does an app get automated security/quality scanning, and at
what cost." It exists because a 30-tool open-source audit toolkit was evaluated against the locked
stack (Docker Compose + Komodo + Traefik — **not** Kubernetes) and against what the framework already
gates; the result is a tiered subset, wired where it closes a real gap and documented-only everywhere
tiering would rather not pay the cost. Full disposition rationale: `docs/planning/V32.38_SCOPE.md`.
Companion: `security.md` (L1–L6, the human/AI-reasoning security layer this sits beneath),
`Security_Checklist.md` (147-item audit checklist), `lint-deploy.sh` (the sibling gate `audit-app.sh`
clones the pattern from), `design-fidelity.mjs` (Rule 31 — BackstopJS pairs directly with it).

---

## 0. Core principle — tier by COST; run on demand, never in the background

The **tier is a cost/scope band, not an auto-schedule.** Nothing here runs unless you invoke it. The
three tiers say only how *expensive* a check is — so that IF an app later opts a tier into a gate, it
opts into a sensible cost budget (T1 = seconds, safe for a pre-commit hook if wanted; T2 = minutes,
sensible for a milestone/Phase-5 run; T3 = hours, campaign-only). By **default every tier is a manual
one-shot** you fire with `audit-app.sh`; blocking gates are per-app opt-ins (§1). This is deliberate:
a gate that blocks every commit for minutes gets a permanent `--no-verify` the first time someone is
in a hurry — so the framework never imposes one; you choose it. If a new tool is ever added to this
file, slot it into one of the three cost tiers below — never bolt it on as an always-on background gate.

| Tier | Cost band | Budget | Tools | Default | Opt-in gate (if the app wants one) |
|---|---|---|---|---|---|
| **T1** | cheap | seconds | Gitleaks · Semgrep · `tsc` · ESLint | manual one-shot | pre-commit (lefthook) — recommended for Gitleaks only; DOCUMENTED-ONLY, not wired (§1) |
| **T2** | moderate | minutes | Trivy (image+config) · OSV-Scanner · Syft (SBOM) · BackstopJS | manual one-shot | Phase 5 validation gate (blocking) via `inputs.yml` — WIRED V32.39.1 (§1) |
| **T3** | expensive | hours | ZAP DAST · Stryker mutation · k6 load · manual pentest | manual / campaign | never wired — advisory only |

Semgrep, `tsc`, ESLint, axe/Pa11y, Playwright, Lighthouse, and k6 are **already run** at their own
framework gates (§3 below) — this file's runner adds **Gitleaks** (T1) and **Trivy / OSV-Scanner /
Syft / BackstopJS** (T2) as an on-demand one-shot. It documents T3 with run instructions but wires
nothing to any gate.

---

## 1. Manual / on-demand by default — nothing auto-runs (owner-set 2026-07-28)

The owner's model: *"I don't want any of this to run automatically in the background — I just want a
manual trigger, an on-demand one-shot run when I want it."* That is the standing default for **every**
app, new or existing.

- **Default for ALL tiers = a manual one-shot.** `audit-app.sh [--tier=1|2] [--report-only] <target>`
  runs only when you (or the "audit this app" trigger) invoke it. No lefthook wiring, no Phase-5 gate,
  no scheduled job is installed by default. A framework sync never adds a background gate to any app.
- **`--report-only` is the safe default mode.** It prints findings and **exits 0 regardless of
  severity** — the run informs, it never blocks. Fail-closed exit codes only matter once an app has
  opted a tier into a real gate (below).
- **Blocking gates are explicit, per-app OPT-INS — off by default:**
  - **T2 as a Phase 5 blocking gate — WIRED (V32.39.1):** set `audit.tier2.enforce: true` in
    `inputs.yml`. `phases.md` Phase 5 reads that flag as a prose-conditional and, when true, runs
    `bash scripts/audit-app.sh --tier=2` as a HARD gate — a CRITICAL/HIGH finding makes the runner
    exit 1 and blocks Phase 6. Until the flag is set, the Phase-5 gate is simply skipped and T2 stays
    manual/advisory only.
  - **T1 as a pre-commit hook — DEFERRED (documented-only, NOT wired):** an app MAY wire
    `audit-app.sh --tier=1` (or just Gitleaks) into lefthook, but the framework installs NO
    lefthook/pre-commit wiring by default and ships none. Off by default.
- **RECOMMENDED opt-in (still your choice): Gitleaks on pre-commit.** A secret is unrecoverable the
  moment it lands in git history — found at the next milestone, it has already been in history (and
  possibly pushed) for weeks, and rotation is the only remedy. A diff-scoped `gitleaks protect
  --staged` runs in seconds and stops the secret ever entering history. Every *other* check is about
  current code state and is genuinely fine to defer to an on-demand sweep. This is the one gate worth
  turning on — but per the owner's model it is **recommended, never auto-enabled**.
- **Zero-disruption is automatic here:** because the default is "runs only when invoked," syncing
  V32.38 into any app — new or already-deployed — never makes a previously-green app red. Same spirit
  as the V32.33/34 zero-disruption contracts, achieved by defaulting to manual rather than by an
  opt-out flag.

## 2. Graceful degrade — fail-closed on findings, fail-open on tooling

`scripts/audit-app.sh` clones the exact posture proven in `lint-deploy.sh` C8 (shellcheck):

- **A missing/uninstallable tool WARNS and is skipped** — it never fails the run, and it never
  silently passes as if the check ran. The summary line distinguishes `FAIL` (a real finding) from
  `WARN — tool not found` (coverage gap) so the two are never confused in the exit code or the report.
- **A finding, once a tool DID run, is fail-closed per the severity policy in §6** — a scanner that
  ran and found a CRITICAL always blocks, tier and opt-in notwithstanding.
- An app must never become un-buildable because Trivy (or any other T2 tool) isn't installed in a
  given environment — that would turn an availability problem into a correctness gate, which is the
  exact inversion this rule exists to prevent.

```bash
if ! command -v trivy &>/dev/null; then
  warn "trivy not found — skipping T2 image/config scan (install: https://aquasecurity.github.io/trivy)"
else
  # ... run the scan
fi
```

---

## 3. Already wired elsewhere — do NOT duplicate

These tools are load-bearing gates the framework already runs; `audit-app.sh` never re-implements or
re-invokes them under a different name. If a task needs one of these, read the file named, not this one.

| Tool | Already gated at | Authority |
|---|---|---|
| **Playwright** (verify-all-pages + `design:check` visual-fidelity) | Phase 5 OUTPUT CONTRACT | `phases.md` §Phase 5 · `~/.claude/rules/playwright_verify_all_pages` |
| **Lighthouse** (SEO ≥ 90) | Phase 5 SEO gate, hard on any public-facing app | `.ai_prompt/seo.md` §6 |
| **axe-core / Pa11y** (WCAG 2.2 AA) | Phase 4 Parts 5-6 + Phase 5, hard gate on gov/LGU apps | `ui-rules.md` Rule 13 · `accessibility-agents` skill |
| **k6** | Phase 5, perf-gated when PRODUCT.md §10 declares perf targets or a public API | `phases.md` extended testing block |
| **Semgrep** | T1 tool (MCP-connected SAST) — run on-demand by `audit-app.sh`; pre-commit only if the app opts in | this file, T1 row — the tool itself is pre-existing |
| **`pnpm audit`** | Phase 5 command 9 (npm-advisory SCA) | `phases.md` Phase 5, "9 commands" + CVE decision tree |

`audit-app.sh` treats all six as **out of scope** — it neither re-runs them nor re-reports their
output. Its job is exactly the four T2 tools in §4 plus the one T1 tool in §4.1, nothing already covered.

---

## 4. What's WIRED — per-tool sections

### 4.1 Gitleaks (T1 — git-history / diff secret scan)

**Specializes in:** detecting hardcoded secrets (API keys, tokens, private keys, connection strings)
in the code being committed — the real gap Rule 38 closes: the framework holds SOPS+age for secret
*storage* but had no automated check that a secret never gets typed into a file in the first place.

**Invocation — on-demand one-shot (default):** `audit-app.sh --tier=1 <target>` runs Gitleaks over the
repo. **Recommended opt-in — pre-commit hook (diff-scoped, off by default):**
```bash
gitleaks protect --staged --redact -v
```
`--staged` scans only the staged diff (seconds); `--redact` keeps the secret value out of CI logs and
terminal output. This is the one gate §1 recommends turning on (secrets-in-history are unrecoverable),
but per the owner's manual-default model it is enabled only if the app explicitly opts in.

**Full-history scan** (T3 campaign, not per-commit):
```bash
gitleaks detect --source . --redact -v --report-format json --report-path gitleaks-report.json
```

**Reading output:** each finding names `RuleID` (e.g. `generic-api-key`, `aws-access-token`),
`File`, `StartLine`, and a redacted `Secret` preview. Zero findings = clean exit 0.

**Triage/severity policy:** every Gitleaks finding is treated as **CRITICAL** — there is no "low
severity secret." A true positive blocks the commit unconditionally; rotate the secret (Server-Setups
SOPS+age, never re-committed) before re-attempting. A false positive (e.g. a test fixture UUID that
matches a pattern) is allowlisted by fingerprint in `.gitleaks.toml`, never by disabling the rule
globally, and the allowlist entry is reviewed the same way a `DECISIONS_LOG.md` mitigation is (§6).

### 4.2 Trivy — image CVE scan + `trivy config` IaC scan (T2)

**Specializes in:** OS-package and application-layer CVEs baked into the built container image, plus
misconfiguration scanning of the Dockerfile/Compose IaC itself. **This closes the V32.38 F2 phantom
gate** — `security.md` previously claimed "existing Trivy image gates (Phase 5/6)" that did not exist
anywhere in `phases.md` or any CI workflow; this section is now the real implementation that claim
should have pointed to.

**Invocation:**
```bash
# Image CVE scan — run against the just-built app image before it's pushed
trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed "${IMAGE_TAG}"

# Compose/Dockerfile IaC misconfig scan
trivy config --severity HIGH,CRITICAL --exit-code 1 deploy/compose
```
`--ignore-unfixed` keeps the gate actionable (a CVE with no available patch is a §6 Step 3 decision,
not a build blocker); `--exit-code 1` makes CI treat any surviving HIGH/CRITICAL as a hard failure.

**Reading output:** a table of `Library | Vulnerability | Severity | Installed Version | Fixed
Version`. `config` findings report `ID | Severity | Message | Resolution` per misconfigured
Dockerfile/Compose line (e.g. exposed root user, missing `HEALTHCHECK`).

**Triage/severity policy:** follow §6 exactly — this is the gate `security.md`'s phantom claim should
have pointed to all along.

### 4.3 OSV-Scanner — SCA beyond npm advisories (T2)

**Specializes in:** dependency CVEs `pnpm audit` cannot see — OS-level packages inside the built
image, transitive dependencies across ecosystems, and any non-npm package the app pulls in (e.g. a
Python tool invoked by a build script). `pnpm audit` (Phase 5 command 9, §3) stays the first-line
npm-ecosystem SCA gate; OSV-Scanner is the wider net, not a replacement.

**Invocation:**
```bash
osv-scanner --lockfile=pnpm-lock.yaml --lockfile=deploy/compose/Dockerfile ./
```

**Reading output:** grouped by `Ecosystem | Package | Version | Vulnerability ID (OSV/CVE/GHSA) |
Severity`. A summary count line at the end gives the pass/fail signal.

**Triage/severity policy:** §6. A finding OSV-Scanner surfaces that `pnpm audit` already caught is
deduped by CVE ID in the report, not double-counted against the gate.

### 4.4 Syft — SBOM as a release artifact (T2)

**Specializes in:** generating a Software Bill of Materials for the built image — not a
vulnerability scanner itself, but the artifact `security.md` already promises ships with every
release (`security.md:455`) and the input Trivy/OSV-Scanner/Grype can re-scan later without rebuilding.

**Invocation:**
```bash
syft "${IMAGE_TAG}" -o cyclonedx-json=sbom-"${IMAGE_TAG//[:\/]/_}".json
```

**Reading output:** not a pass/fail check — Syft always exits 0 on a successful scan. The gate is
**presence**: Phase 5 fails only if the SBOM file was not produced or is empty/malformed JSON.

**Triage/severity policy:** N/A (no severity; a generation failure is a tooling WARN per §2, not a
finding). Archive the SBOM alongside the image tag it describes — it is the artifact a future CVE
disclosure gets diffed against without re-pulling or re-building the image.

### 4.5 BackstopJS — visual regression (T2)

**Specializes in:** pixel-diff visual regression across the app's key screens — pairs directly with
`design-fidelity.mjs` (Rule 31), which checks *structural* layout drift against the approved mockup;
BackstopJS catches *pixel-level* drift (a color token silently changed, a shadow lost, an icon
swapped) that a structural anchor check does not see.

**Invocation:**
```bash
backstop test --config=backstop.config.js
```
Baselines live in `tests/visual/backstop_data/bitmaps_reference/` (parallel convention to the existing
`tests/visual/fixtures/` Playwright baseline — see `phases.md` Phase 5 `design:check`); a legitimate
UI change updates the baseline the same two-step way `design:check` does: fix or intentionally
re-baseline, never silently overwrite.

**Reading output:** an HTML report (`backstop_data/html_report/index.html`) with side-by-side
before/after/diff images per scenario, plus a `passed`/`failed` count and a JSON summary for CI.

**Triage/severity policy:** any failed scenario blocks T2 (visual regression has no "low severity" —
either the pixels match the approved baseline within threshold, or they don't). Reconcile the same two
legal paths `design:check` already uses: (1) fix the code to match the baseline, or (2)
update-design-first → recompile → re-capture baseline as a reviewed human commit → re-run.

---

## 5. T3 — campaign / on-demand runbooks (documented, NOT wired to any gate)

T3 tools are genuinely useful but too expensive (minutes-to-hours) or too noisy (high false-positive
rate needing human judgment) to gate any commit or Phase 5 run. They are run **deliberately**, by
name, when the owner or a security-review task calls for them — never automatically.

### 5.1 OWASP ZAP — DAST (dynamic application security testing)
```bash
zap-baseline.py -t https://staging.example.com -r zap-report.html
```
Run against a **staging** deployment only, never production, and only after the owner has authorized
a staging validation pass. Findings are read by a human — ZAP's baseline scan has a known false-
positive rate that makes it unsuitable as an automated blocking gate.

### 5.2 Stryker — mutation testing
```bash
pnpm dlx stryker run
```
Audits whether the *existing* test suite actually catches regressions (mutates the source, checks
whether a test fails) — a low mutation score reveals tests that assert nothing meaningful. Run as a
periodic health-check on test quality, not per-commit; a full mutation run on a mid-size app can take
tens of minutes to hours.

### 5.3 k6 — load testing (campaign mode)
The **perf-gated** k6 usage (PRODUCT.md §10 declared targets) is already wired at Phase 5 (§3 table).
This T3 entry is for **exploratory/capacity campaigns** beyond the gated thresholds — soak tests,
spike tests, breakpoint tests run ahead of a scaling decision:
```bash
k6 run --vus 200 --duration 10m scripts/loadtest/soak.js
```

### 5.4 Manual penetration test
Out of this framework's automation entirely — route to the **Hacking-Framework** pillar's engagement
model (its own Kali-based pentest pillar with a documented engagement process). This file only notes
the handoff point; it does not define the engagement.

**Promotion note:** Schemathesis (API property-testing against tRPC/OpenAPI surfaces) is currently
T3/document-only but is a strong fit for this stack — it may be promoted to a T2 wired gate in a later
framework version once it's proven out on a real app. Not wired in V32.38.

---

## 6. Severity / triage policy (mirrors the Phase 5 CVE decision tree, `phases.md` §Phase 5)

Every wired tool (§4) reports through the **same three-bucket policy** the existing `pnpm audit` CVE
gate already uses — Rule 38 does not invent a second standard, it extends the one that exists:

- **CRITICAL — never accept unfixed, at any tier.** Blocks the commit (T1) or Phase 5 (T2)
  unconditionally. Escalate to a human immediately; do not proceed past the failing gate under any
  circumstance, matching `phases.md`'s "CRITICAL CVE (any step): NEVER accept unfixed."
- **HIGH — blocks unless explicitly mitigated and recorded.** Follow the same step order as the
  existing CVE decision tree:
  1. Attempt the tool's own auto-fix path (`pnpm audit --fix` equivalent — e.g. bump the flagged
     package, rebuild the image after a base-image bump for Trivy).
  2. If unresolved, upgrade the affected component to its latest compatible version; re-run tests;
     proceed only if green.
  3. If still unresolved (no fix available), write to `DECISIONS_LOG.md`:
     ```
     UNFIXED [TOOL] FINDING: [ID] in [package/file]
     No fix available as of [date]. Risk accepted: YES.
     Mitigation: [e.g. "not reachable from user input" / "base image update pending upstream"]
     ```
     then suppress *that specific finding* (never the whole tool/rule) via the tool's own
     ignore-list mechanism (`.trivyignore`, `.gitleaksignore` allowlist entry, OSV-Scanner
     `.osv-scanner.toml` ignore), append a 🔴 lesson to `LESSONS_REGISTRY.md`, and proceed.
- **MEDIUM / LOW — advisory, never blocks.** Logged in the tool's report; no `DECISIONS_LOG.md` entry
  required, but a recurring MEDIUM cluster on the same package is worth a manual look.

This mirrors `phases.md`'s CVE resolution decision tree line-for-line in spirit (same three-step
escalation, same DECISIONS_LOG.md record shape, same "CRITICAL is never accepted" rule) — extended
from "npm CVEs only" to "any T1/T2 tool finding."

---

## 7. Deliberately NOT adopted (and why)

From the original 30-tool survey (`docs/planning/V32.38_SCOPE.md` §4), these were evaluated and
rejected for the framework's baseline — not overlooked:

| Tool | Why not adopted |
|---|---|
| **Kubescape**, **Polaris** | K8s-native scanners; `Master_Prompt.md` Rule 6 makes the K8s scaffold **inactive by default** — every real fleet app runs Docker Compose + Komodo + Traefik. Conditional-at-most if an app later flips `deploy.k8s.enabled: true`; not baseline. |
| **Falco** | eBPF runtime intrusion detection — an infra/host-level concern, not a per-app build-time concern. Already canon: root `CLAUDE.md` — *"Phase 6 infra monitoring — OUT OF SCOPE — owned by Server-Setups."* Broadcast to that pillar, not built here. |
| **Horusec** | A SAST/secrets aggregator — redundant once Semgrep (SAST, already MCP-wired) and Gitleaks (secrets, §4.1) are both in place. Adding it would mean maintaining a third overlapping ruleset for no new coverage. |
| **Chromatic** | Visual regression, but requires Storybook — which this stack does not use. BackstopJS (§4.5) is the framework-agnostic pick that needs no component-catalog tool as a prerequisite. |
| **SonarQube** | A heavy, self-hosted server product. Semgrep + `tsc` + ESLint already cover the bulk of what it would add, at zero extra infrastructure. |
| **Keploy** | eBPF-based record-replay API testing — heavy runtime instrumentation for a capability Playwright + the Phase 5 test suite already cover at lower operational cost. |
| **OWASP Dependency-Check** | Java-centric CVE database tooling; OSV-Scanner (§4.3) supersedes it for this stack's ecosystems (npm/Node, OS packages) without the JVM dependency. |
| **Checkov** | Broad IaC policy scanning across Terraform / Kubernetes / Helm / Dockerfile — but this stack has **no Terraform and no active Helm/K8s** (Rule 6), leaving only Dockerfile + Compose, which `trivy config` (§4.2) already covers from the anchor binary we are installing anyway. Adopting Checkov would mean a second IaC engine and ruleset for the same two file types. Revisit only if an app ever adopts Terraform or flips `deploy.k8s.enabled: true`. |

**Conditional on Rule 37 (microservices escalation) — not baseline:**

| Tool | Condition |
|---|---|
| **Tracetest** | OTel distributed-trace span assertions only pay off once services are actually distributed — at modular-monolith default (the framework's baseline per `microservices.md`) there is one process to trace, so this is pure overhead. Wire it only if/when Rule 37 escalation fires. |
| **Pact** | Consumer-driven contract testing exists to guard a boundary *between* independently-deployed services. A modular monolith has no such boundary — its "contracts" are TypeScript function signatures, already caught by `tsc`. Same Rule 37 gate as Tracetest. |

---

## 8. Retrofit on an existing app (Scenario 48, owner-gated)

Follow **Scenario 48 — Existing-App Audit Toolkit Retrofit**: dev-first, LOCAL-only, same HARD HOLD
posture as every other retrofit scenario (CI/CD Scenario 45, SEO Scenario 44, RBAC Scenario 42).
"Retrofit" here means **making the manual one-shot available**, not installing a gate: confirm
`audit-app.sh` runs against the app (`--report-only`) and triage the first report (§6). Wiring any
tier into an actual gate is a separate, explicit per-app choice (§1) — if the app wants it, opt
Gitleaks into pre-commit first (the one §1 recommends), then optionally set
`audit.tier2.enforce: true` in `inputs.yml` for a T2 Phase-5 gate once its first report is clean.
Staging/production promotion of anything built during the retrofit still requires the owner's explicit
word, per `~/.claude/rules/deploy-discipline.md`.

---

## Hard rules (never violated)

- **INHERIT-not-REPLACE.** Rule 38 is the automated layer beneath `security.md` L1–L6 and
  `Security_Checklist.md`; it never overrides either, and a green scan never closes a Checklist item
  that requires human/AI reasoning.
- **Manual by default.** Nothing runs automatically in the background — the toolkit is a manual
  on-demand one-shot (`audit-app.sh`). A gate (pre-commit or Phase-5 blocking) is an explicit per-app
  opt-in, never installed by a framework sync (owner-set 2026-07-28, §1).
- **Tier discipline (cost bands).** T1 = seconds, T2 = minutes, T3 = hours. Tiers describe cost, not an
  auto-schedule; if opted into a gate, a tier keeps its cost budget. A tool never changes cost tier
  without a version bump that says so explicitly.
- **Graceful degrade.** A missing/uninstallable tool WARNS and is skipped; it never fails the build and
  never silently reports "clean." Fail-closed on findings, fail-open on tooling.
- **Zero-disruption.** Because the default is run-only-when-invoked, no gate lands on any app (new or
  already-deployed) without that app's explicit opt-in. Gitleaks-on-pre-commit is the one gate §1
  recommends, but even it is opt-in, never auto-enabled.
- **Never duplicate an existing gate.** Playwright, Lighthouse, axe/Pa11y, k6, Semgrep, and `pnpm
  audit` stay owned by their existing authorities (§3); `audit-app.sh` never re-implements them.
- **HARD HOLD.** Wiring or retrofitting this toolkit onto an app is LOCAL only — no staging/prod/demo
  push without the owner's explicit word.

Companion authorities: `security.md` (L1–L6 stack this file sits beneath) · `Security_Checklist.md`
(147-item human/AI review checklist) · `phases.md` (Phase 5 OUTPUT CONTRACT + CVE decision tree this
file's §6 mirrors) · `design-fidelity.mjs` (Rule 31 — BackstopJS's structural-check sibling) ·
`microservices.md` (Rule 37 — the escalation gate Tracetest/Pact wait on) · `docs/planning/V32.38_SCOPE.md`
(full 30-tool disposition + rationale).
