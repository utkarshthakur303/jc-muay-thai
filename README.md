# JC Muaythai

Production website for JC Muaythai, Jersey City — Next.js 16 (App Router),
React 19, Tailwind CSS v4, Supabase.

Replaces the previous static `dc-runtime` HTML export, which rendered entirely
client-side (no SEO) and depended on unpkg at runtime.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styling | Tailwind CSS v4 |
| Auth / DB | Supabase (email/password + Google OAuth) |
| Hosting | Vercel |

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in — see SETUP-AUTH.md
npm run dev
```

Runs on http://localhost:3000.

Without valid Supabase credentials the app still boots and the auth screens
render, but sign-in shows an explicit "Not connected yet" banner in
development rather than failing with an opaque network error.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Node's built-in runner over `src/**/*.test.ts` |

Tests cover the calculations that are wrong in ways nobody notices until
months later — chiefly turning "Tuesday 19:00 at the gym" into a real
instant across both daylight saving transitions. `scripts/ts-alias-hook.mjs`
teaches Node the `@/` path alias, which it does not read from `tsconfig.json`.

## Environment variables

All are required — `src/lib/env.ts` validates them at startup and fails the
build loudly if any are missing.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_*` — safe in the browser |
| `SUPABASE_SECRET_KEY` | `sb_secret_*` — **server only**, bypasses row-level security |
| `NEXT_PUBLIC_SITE_URL` | Origin of this deployment |

`.env.local` is git-ignored and must never be committed.

## Deploying to Vercel

1. Import this repository (Framework preset: **Next.js** — auto-detected)
2. Root Directory: **leave as the repo root**
3. Add all four environment variables above under Settings → Environment Variables
4. In Supabase → Authentication → URL Configuration, add the deployment origin
   to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`) — sign-in fails
   silently if it is missing

> There is deliberately no `vercel.json`. The previous one pinned
> `framework: null` and `outputDirectory: "."` for the static build; leaving it
> in place would make Vercel ignore Next.js entirely.

## Project structure

```
src/
├── app/
│   ├── (auth)/           login, signup, forgot-password
│   ├── account/          member area (auth-guarded)
│   ├── auth/callback/    OAuth + email-link handler
│   └── layout.tsx        fonts, theme bootstrap
├── components/
│   ├── auth/             auth-specific composition
│   └── ui/               primitives
├── lib/
│   ├── auth/actions.ts   server actions
│   ├── supabase/         browser / server / session clients
│   └── validation/       Zod schemas
└── proxy.ts              session refresh + route protection
```

`src/proxy.ts` is Next 16's rename of `middleware.ts`. It **must** live inside
`src/` when a `src/` directory exists — at the repo root it is silently
ignored, with no warning and an empty middleware manifest.

## Status

Built:

- Authentication — email/password verified end-to-end against the live project;
  Google OAuth pending Cloud Console credentials. Completing a sign-in returns
  to the site, not to `/account`; a visitor sent to `/login` from a protected
  route still lands back where they were headed.
- Home, Classes, Schedule, Gallery and Contact sections. `/` is statically
  prerendered and served from the edge; nothing on it reads a session — the
  top bar's account chip is driven by a display cookie the proxy writes and a
  pre-paint script reads, so the page stays cacheable and still greets a
  returning member on the first frame. See `src/lib/auth/memberCookie.ts`.
- Contact form — validated, rate-limited, stored in Postgres, verified
  end-to-end. Notification email is written but not switched on (`RESEND_API_KEY`
  is unset), so enquiries are stored and nobody is emailed about them.
- Class booking — `/book` lists the next 14 days with live spot counts;
  `/account` shows upcoming classes with cancellation and a history of past
  ones. Capacity cannot be oversold: the limit is a database constraint, not
  an application check.

Pending: attendance marking (needs a coach-facing register — deliberately out
of scope, so `/account` says "classes booked", never "attended"), the admin
dashboard for editing the timetable and gallery, payments, and the Shop
section.

### Single sources of truth

Worth knowing before editing anything:

| Thing | Lives in | Notes |
|---|---|---|
| Colour, type scale, radii, shadows, motion | `src/app/globals.css` | No component contains a colour literal, a font-family or a keyframe. |
| Typefaces | `src/lib/fonts.ts` | Variables named by role (`--font-display-src`), so swapping a face is one line. |
| The class timetable | `src/content/schedule.ts` | 37 sessions declared once. The weekly chart, totals, busiest days, per-level durations, every class card and every day card are derived. A build-time validator fails the deploy on an overlap or a malformed time. |
| Business facts, nav, contact channels | `src/content/site.ts` | Contact channels are gated on `confirmed`; unconfirmed ones do not render. |
| Gallery photographs | `src/content/gallery.ts` | Real pixel dimensions, so next/image reserves the right box. |
| Who the visitor is, for display | `src/lib/auth/memberCookie.ts` | Written by the proxy, read before paint and by the account chip. Display only — nothing is authorised by it, and every protected route still calls `getUser()`. |
| Where auth sends people afterwards | `src/lib/auth/redirects.ts` | One open-redirect guard, shared by the sign-in action, both auth pages and the callback. |
| Mat capacity | `src/content/schedule.ts` | `DEFAULT_CLASS_CAPACITY`. **The one invented number in the codebase** — booking cannot exist without a limit. Needs the gym's real figure. |
| Booking rules | `supabase/migrations/20260807120000_class_booking.sql` | Capacity, ownership and the booking window are RLS policies and constraints. The server actions produce the error *message*; they are not the enforcement. |
