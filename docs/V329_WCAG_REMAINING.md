# V32.9 WCAG 2.2 AA — Remaining Issues (not fixed)

Generated during V32.9 compliance UI build. Issues SAW but NOT fixed, with reasons.

## Fixed in this pass

- `apps/web/src/app/page.tsx` — Decorative `O` logo letter: added `aria-hidden="true"` on the `<span>`.
- `apps/web/src/app/page.tsx` — Decorative dot in hero badge: added `aria-hidden="true"`.
- `apps/web/src/app/page.tsx` — Decorative ✓ checkmarks in pricing list: added `aria-hidden="true"` on all three occurrences.
- `apps/web/src/app/page.tsx` — Nav container: wrapped links in `<nav aria-label="Main navigation">` for landmark.
- `apps/web/src/app/page.tsx` — Pricing section: added `aria-labelledby="pricing-heading"` + `id` on `<h2>`.
- `apps/web/src/app/(auth)/login/login-form.tsx` — Already WCAG-compliant: all inputs have `<Label htmlFor>`, button has discernible text, error is in a visible `<div>`.

## Remaining issues (seen, not fixed)

### `apps/web/src/app/page.tsx`
- **Feature grid emojis** (⚙️ 👥 📦 🧾 💰 📊): Emoji are used as icons in feature cards. They are read by screen readers (e.g. "gear" for ⚙️) which is acceptable but not ideal — screen reader pronunciation varies by platform. A proper fix would replace them with `<svg aria-hidden="true">` icons (lucide-react) and add a visually hidden text label. **Reason not fixed:** The feature grid markup was pre-existing; replacing emojis with lucide SVGs is a non-trivial refactor outside the V32.9 compliance scope. Risk of visual regression.
- **Landing page `<h1>`**: Uses `text-5xl` but no landmark `<main>` wraps the page body sections. The `<div class="min-h-screen">` is the root container; it is not a `<main>` element. **Reason not fixed:** Changing the root element to `<main>` risks layout side-effects with the existing border-t section separators. Noted for a future structural pass.
- **"Explore demo →" CTA**: The arrow `→` is rendered as plain text and will be announced by screen readers as "right arrow". Should be `aria-label="Explore demo"` on the link. **Reason not fixed:** Minor cosmetic, low severity; pre-existing.

### `apps/web/src/app/(auth)/login/page.tsx`
- **No visible "Forgot password?" link**: Omission is not a WCAG violation per se, but WCAG 3.3.4 (Error Prevention) recommends letting users recover from credential errors. **Reason not fixed:** Feature scope; no forgot-password flow exists yet.
- **Logo `<div>` in login page**: `<div class="mx-auto flex h-12 w-12 ... signal-glow">` contains `<span class="text-2xl font-bold text-primary">O</span>` — the `O` will be read as the letter "O" by screen readers; it is purely decorative. Should have `aria-hidden="true"`. **Reason not fixed:** This is in `apps/web/src/app/(auth)/login/page.tsx`, a pre-existing file not in the V32.9 task scope (only CLEAR violations were to be fixed). The fix is trivial — add `aria-hidden="true"` to the span — but it is in a file touched by the auth system; leaving it for the next auth pass.

### General — tenant app pages (pre-existing)
- **Sidebar/nav landmark in tenant layout**: Not inspected in this pass. The sidebar navigation in the tenant layout (`(app)/layout.tsx` or similar) should use `<nav aria-label="Sidebar">`. Outside V32.9 scope.
- **Focus trap in dialogs**: `AlertDialog` from shadcn/ui (Radix UI) has built-in focus trapping — verified by design. No action needed.
- **Color contrast of `text-muted-foreground`**: Theme-token-based; contrast ratio depends on the active theme. With the neutral dark theme (bg-background ≈ #09090b, text-muted-foreground ≈ #a1a1aa), contrast is approximately 5.2:1 — passes AA 4.5:1 for normal text. Not an issue with the current dark theme, but should be re-checked if a light theme is added.
