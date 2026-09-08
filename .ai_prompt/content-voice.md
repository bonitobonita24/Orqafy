# Content Human-Voice Pass — on-demand reference (V32.54, deliverable #44)

Deploys to `.ai_prompt/content-voice.md`. Read-on-demand, pulled ONLY when a content task fires —
the same posture as `motion.md` / `design-principles.md` / `privacy.md`, NOT the always-on posture of
`seo.md` (Rule 35). This file exists so a build session produces human-reading published prose WITHOUT
the owner having to invoke the `humanize` skill by name.

---

## 0. Core principle — ON-DEMAND, automatic-when-content, NEVER always-on

**The one rule this file enforces:** when a build/feature session generates or edits **human-facing
prose that the app or site will PUBLISH**, it applies a human-voice pass automatically — `humanize`
(write-human-from-the-start, or a rewrite) followed by an `ai-check` gate — **without waiting to be
told**. The owner never types "humanize this"; it is part of the content loadout the same way
`context7` is part of the library-lookup loadout.

**What this is NOT (owner-set 2026-08-31):** this is deliberately **NOT** a constitutional, always-on
concern. Contrast with Rule 35 (SEO), which is baked into every app whether or not content is being
written. The human-voice pass is **pulled from the library ONLY when content is actually being made** —
it never loads into a non-content session (a schema migration, a Docker fix, a tRPC route), and it is
never scaffolded into an app as a permanent feature. On-demand in trigger, automatic in application.

The distinction, stated once so it can't drift:

| | Rule 35 SEO | This human-voice pass |
|---|---|---|
| Posture | Always-on / constitutional | On-demand |
| Scaffolded into every app? | Yes (out of the box) | No |
| Loads in a non-content session? | Its baseline is always present | Never |
| When content IS being made | Applies | Applies — automatically, un-invoked |

## 1. What counts as "content" (the trigger surface)

The pass fires when the task produces human-facing prose meant to be READ by a user/visitor/client:

- Marketing / landing / about / product-page copy
- Blog posts, articles, announcements, statements
- Social captions, meta descriptions surfaced to humans
- In-app content: onboarding text, empty-state copy, tooltips, help text, dialog/toast/notification
  copy, transactional email bodies
- Generated documentation and showcase text (the `app-showcase` pipeline's markdown/site copy + deck
  narration)

If the deliverable is prose a person will read, the pass applies. If unsure, apply it — it is cheap.

## 2. The pass — write-human-first, then gate

The skills are **globally installed and universal** (`~/.claude/skills/humanize/`,
`~/.claude/skills/ai-check/`) — available in every seat, not vendored into the app. Two equivalent
entry points:

1. **Write-human-from-the-start.** When authoring net-new copy, apply `humanize`'s generate-mode
   levers from the first sentence (burstiness, specificity anchors, no assistant voice, ≤1 em-dash /
   300 words, no banned vocabulary). Preferred — cleaner than rewriting your own output.
2. **Rewrite pass.** When copy already exists (a generator's first draft, an owner-supplied blurb),
   run the `humanize` rewrite over it.

Either way, close with the **`ai-check` gate**: score the prose, and if it still reads AI-authored,
loop once on the flagged signals. Only then is the content "done."

This rides **ON TOP OF** the content generator (`copywriting`, `app-showcase`, `doc-coauthoring`) —
it never replaces it. Generate with the right tool, then humanize + gate.

## 3. SKIP list — where the pass does NOT apply

- **Non-prose output:** source code, config files, JSON/YAML, database seed data, structured/tabular
  data, API payloads, test fixtures.
- **Deliberately rigid / legal register:** terms of service, privacy-policy legal text, formal
  contracts, regulatory statements — where exact prescribed wording matters more than natural voice.
  (Note it explicitly; do not silently humanize legal text.)

## 4. Where it fires in the build (on-demand cues, not a scaffold step)

No new phase, no PRODUCT.md section, no interview. The pass attaches to the phases that already author
content:

- **Phase 2.8 / 3.3 (mockup & prototype copy).** When realistic copy goes into `docs/MOCKUP.jsx` /
  the prototype, write it human-first. (Alongside the Rule 35 §1.5 SEO-aware content cue that already
  sits here.)
- **Phase 7 (Feature Update).** Any feature that adds user-facing copy runs the pass on that copy.
- **`app-showcase` pipeline (cross-phase).** All generated docs-site / landing / deck prose runs the
  pass before it is committed to the target app.
- **Phase 5 (validation) — light check.** On a public-facing app, run `ai-check` over the primary
  marketing/landing copy as a report-only sanity pass. Advisory, never a hard gate.

## 5. Multilingual caveat

`humanize`'s **mechanical** levers (the banned-word list, the em-dash-per-300-words count) are
**English-tuned**. The underlying **principles** — vary sentence length, add concrete specifics, drop
the assistant voice — transfer to any language, and the pass still improves non-English copy. But the
forensic `ai-check` gate cannot score non-English text with the same rigor, and AI-detectors for
non-English are weaker and different. So for non-English content the realistic bar is
"reads natural to a native speaker," not "beats a detector." For a genuinely multilingual app, this is
separate from the i18n feature itself (locale routing, translation files, hreflang — a build concern).

## 6. Relationship to the rest of the framework (INHERIT-not-REPLACE)

- **On top of** the content generators (`copywriting` / `app-showcase` / `doc-coauthoring`), never a
  replacement.
- **Distinct from** Rule 35 SEO: SEO is always-on and structural (headings, metadata, sitemap); this
  is on-demand and stylistic (voice). They co-apply on public-facing copy without conflict.
- **Governed globally by** `~/.claude/rules/skill-loadout-card.md` ("Content default" note) +
  `~/.claude/library/capability-map.md` (cluster ③ Content/copy) + AIEF memory
  `feedback_humanize_default_content_pass`. This deliverable is the framework-side, deploy-into-the-app
  expression of that global discipline.

HARD HOLD — local only; deploying this file never triggers a push/merge/deploy.
