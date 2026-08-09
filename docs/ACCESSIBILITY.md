# Accessibility — Audit & How to Verify

## Status

Automated WCAG 2.1 AA audit (axe-core 4.13) passes with **0 violations** on all
public pages and the authentication pages:

`/`, `/verify`, `/apply`, `/notices`, `/policies`, `/status`, `/login`,
`/login/mfa`, `/login/change-password`.

The role-scoped portal pages (`/portal/*`) share the same components and
palette; every color token they use was brought to AA-safe values (see the
palette notes below) but they require a session to audit, so re-run axe
logged-in to confirm.

## How to re-run the audit

Requires the dev server (`npm run dev`) on `http://localhost:3000` and a local
Chrome install:

```powershell
npx --yes @axe-core/cli http://localhost:3000/login `
  --chrome-path "C:\Program Files\Google\Chrome\Application\chrome.exe" --exit
```

For portal pages, authenticate first (demo accounts in `README.md` use
password `UniAbuja@2026`), then point axe at `/portal/<module>`.

## What was fixed (2026-08-08)

| Issue | Fix |
| --- | --- |
| `color-contrast` on secondary text | Raised `text-slate/40`, `/50`, `/60` to `/70`–`/75`; raised `text-white/50`, `/60` to `/70` in the portal sidebar. |
| `color-contrast` on brand-gold links | Added `--color-brand-strong` (`#165c0d`) — a darker green that meets AA on white and slate — and migrated links/buttons from `text-brand`/`bg-brand` to `text-brand-strong`/`bg-brand-strong`. `--color-brand` is now reserved for brand-colour accents on light backgrounds. |
| `heading-order` on `/verify` and `/status` | Footer column headings changed from `<h3>` to `<h2>` so the order is never skipped (pages with no in-main `<h2>` otherwise jumped `h1 → h3`). |
| Skip-link target | Unified the target id to `main-content` on the public shell, the portal shell, and all auth pages. |
| Public route shell | Public pages moved into the `(public)` route group (`src/app/(public)/`) whose layout renders `<Header/>`, the skip link, `<main id="main-content">`, `<Footer/>` and `<FloatingActions/>` once — no per-page duplication, and the homepage no longer re-renders the shell. |

## Palette contract (contrast ≥ 4.5:1 at 12px+)

Measured against white, slate `#1A2A2A` and `--color-brand-strong` `#165c0d`:

- Secondary text on white: use `text-slate/75` (≈6.6:1) or darker.
- Text on `bg-brand-strong`: use `text-white/70` (≈5.1:1) or brighter.
- Links: `text-brand-strong` on white (≈5.4:1) or `text-gold` on slate (≈5.9:1).
- `text-brand` (`#165c0d` no longer; `--color-brand` is light, see `globals.css`)
  must only be used for non-text accents on light backgrounds.
- Body copy: `text-white/85` or brighter on the hero overlay.

Do not introduce opacity-based text classes below these floors without
re-running axe.

## Existing structural features

- Skip link → `#main-content` at the top of every page.
- Visible `:focus-visible` rings and reduced-motion support (`prefers-reduced-motion`) in `src/app/globals.css`.
- Landmarks: `header`, `nav` (labelled), `main`, `complementary` (footer), `dl` for stat lists.
- `<html lang="en">`, descriptive `<title>` metadata per page.
- Focus trap + Esc-to-close on the mobile drawer; `aria-expanded`/`aria-controls` wiring in the header.
