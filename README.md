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
  Google OAuth pending Cloud Console credentials.
- Home, Classes, Schedule, Gallery and Contact sections. `/` is statically
  prerendered and served from the edge; nothing on it reads a session.
- Contact form — validated, rate-limited, stored in Postgres, with notification
  email ready to switch on. **Needs one migration applied before it can store
  anything:** see `SETUP-CONTACT-FORM.md`.

Pending: class booking with capacity, admin dashboard, and the Shop section
(deliberately unbuilt — nothing here can take a payment; questionnaire Q3.3).

### Single sources of truth

Worth knowing before editing anything:

| Thing | Lives in | Notes |
|---|---|---|
| Colour, type scale, radii, shadows, motion | `src/app/globals.css` | No component contains a colour literal, a font-family or a keyframe. |
| Typefaces | `src/lib/fonts.ts` | Variables named by role (`--font-display-src`), so swapping a face is one line. |
| The class timetable | `src/content/schedule.ts` | 37 sessions declared once. The weekly chart, totals, busiest days, per-level durations, every class card and every day card are derived. A build-time validator fails the deploy on an overlap or a malformed time. |
| Business facts, nav, contact channels | `src/content/site.ts` | Contact channels are gated on `confirmed`; unconfirmed ones do not render. |
| Gallery photographs | `src/content/gallery.ts` | Real pixel dimensions, so next/image reserves the right box. |
