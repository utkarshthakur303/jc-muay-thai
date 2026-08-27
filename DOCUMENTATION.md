# JC Muay Thai — Technical Documentation

**Status:** production · **Last updated:** 2026-08-23 · **Applies to:** commit `a72ad33`

This document is the reference for anyone maintaining or extending this site.
It describes what the system is, how it is built, why the load-bearing
decisions were made, and the procedures that must be followed when changing it.

> **Companion documents.** `README.md` covers local setup and `SETUP-AUTH.md`
> covers Supabase auth configuration. Source files carry substantial header
> comments explaining *why* — those comments are part of the documentation and
> should be maintained alongside the code they describe.

---

## Table of contents

1. [Overview](#1-overview)
2. [Technology stack](#2-technology-stack)
3. [Environments and access](#3-environments-and-access)
4. [Repository layout](#4-repository-layout)
5. [Routes and screens](#5-routes-and-screens)
6. [Design system](#6-design-system)
7. [Data model](#7-data-model)
8. [Domain logic](#8-domain-logic)
9. [Security model](#9-security-model)
10. [Caching and the static-prerender constraint](#10-caching-and-the-static-prerender-constraint)
11. [Operational procedures](#11-operational-procedures)
12. [Testing and verification](#12-testing-and-verification)
13. [Accessibility standards](#13-accessibility-standards)
14. [Known constraints and open items](#14-known-constraints-and-open-items)
15. [Command reference](#15-command-reference)

---

## 1. Overview

### 1.1 What this is

The public website and member system for **JC Muay Thai**, a Muay Thai gym in
Jersey City, New Jersey. It comprises three distinct surfaces:

| Surface | Audience | Purpose |
|---|---|---|
| **Marketing site** (`/`) | The public | Classes, timetable, gallery, contact. Statically prerendered. |
| **Member area** (`/book`, `/account`, `/plans`, `/streak`) | Signed-in members | Booking, membership, self-marked attendance |
| **Admin panel** (`/admin/*`) | The gym owner | Classes, members, enquiries, timetable, pricing, photos |

### 1.2 Operating principles

These are not aspirations; they are enforced in review and several of them are
enforced in code.

1. **No invented content.** Every business fact — prices, class times, contact
   details, the trial offer — traces to the gym's own published material. The
   codebase has a documented history of invented copy reaching real members,
   and the resulting rule is that an unknown fact is *withheld*, never guessed.
   `src/content/site.ts` carries a `confirmed` flag on every contact channel and
   nothing renders a channel without checking it.
2. **No half-built controls.** A button that cannot honestly do what it implies
   does not ship. Where a feature depends on a database migration that has not
   been applied, the affected screen renders read-only behind an explicit
   notice rather than offering a control that would fail.
3. **Colours, fonts and animations are globally changeable.** No colour
   literal, `font-family` or `@keyframes` appears in any component. They live in
   `src/app/globals.css` and `src/lib/fonts.ts`. This has survived two rebrands.
4. **Verify, don't assert.** Claims about contrast, layout, concurrency and
   access control are measured — real browsers, real pixels, real concurrent
   requests, real refusal codes from Postgres.
5. **Nothing on this site takes payment.** The gym handles money in person.
   Prices are advertisements; quotes are private notes for the counter.

### 1.3 Scale and stakes

This is a live system with real members, real bookings and real self-marked
attendance. There is **no staging database**. Every migration and every deploy
is felt by actual people, and destructive testing against production requires a
written restore *before* the test.

---

## 2. Technology stack

### 2.1 Runtime and framework

| Component | Version | Notes |
|---|---|---|
| Next.js | 16.2.x | App Router, Turbopack, React Server Components |
| React | 19.2.x | Server Components, `useActionState`, `useFormStatus` |
| TypeScript | 6.0.x | `strict: true`. `any` is not permitted; use `unknown` and narrow. |
| Tailwind CSS | 4.3.x | CSS-first config via `@theme` in `globals.css`; no `tailwind.config.js` |
| Zod | 4.4.x | Environment schema and input validation |
| Node | 25.x | Local development and the test runner |

### 2.2 Backend services

| Service | Role |
|---|---|
| **Supabase** | PostgreSQL, Auth (email/password + Google OAuth), Storage, PostgREST |
| **Vercel** | Hosting, edge caching, CI. Git-connected: push to `main` deploys. |
| **Resend** | Transactional email for class-cancellation notices *(not yet configured)* |
| ~~Cloudflare Turnstile~~ | **Not implemented.** Keys appear in `.env.local.example` but nothing in `src/` reads them and they are absent from the Zod schemas. See §9.5. |

### 2.3 Deliberate non-dependencies

The absence of these is a decision, not an oversight:

- **No test framework.** Tests use the built-in `node --test` runner with a
  small TypeScript path-alias loader (`scripts/register-ts-alias.mjs`).
- **No component library.** UI primitives are in `src/components/ui/`.
- **No state-management library.** Server Components plus URL state plus
  `useActionState` cover every case in this application.
- **No ORM.** Queries go through `@supabase/supabase-js` (PostgREST). Access
  control is row-level security in Postgres, not application code.
- **No date library.** Time-zone handling is explicit — see §8.6.

---

## 3. Environments and access

### 3.1 Deployment topology

```
GitHub (public repo)  ──push to main──▶  Vercel  ──▶  jc-muay-thai.vercel.app
                                            │
                                            ▼
                                    Supabase (Postgres + Auth + Storage)
```

There is one environment. Local development runs against the **production**
Supabase project.

> ⚠ **The repository is public.** Every commit is world-readable. Secret-scan
> added lines before every push. Only `.env.local.example` is tracked;
> `.env.local` must never be committed.

### 3.2 Environment variables

Every variable must be declared in a Zod schema before use — `src/lib/env.ts`
for public values, `src/lib/env.server.ts` for server-only values. Public
validation runs at module load and fails the build loudly if a value is missing.

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | yes | Publishable ("anon") key. Safe in the browser — every table is protected by RLS. |
| `NEXT_PUBLIC_SITE_URL` | public | yes | Absolute origin, used for auth redirects |
| `SUPABASE_SECRET_KEY` | **server only** | no | **Bypasses all RLS.** Reached only via `src/lib/supabase/admin.ts`. Must never be prefixed `NEXT_PUBLIC_`. |
| `RESEND_API_KEY` | server only | no | Cancellation emails. Absent → the panel reports "nobody could be emailed" rather than claiming success. |
| `CONTACT_FROM_EMAIL` | server only | no | Verified sender |
| `CONTACT_NOTIFICATION_EMAIL` | server only | no | Where enquiries are delivered |
| `ADMIN_LOGIN_ID` | server only | no | The ID typed at `/admin/login`. Defaults to `admin`. **Not a secret** — see §9.8. |
| `ADMIN_LOGIN_EMAIL` | server only | no | The Supabase account that ID is an alias for. Unset → `/admin/login` says so rather than failing at the auth call. |
| ~~`NEXT_PUBLIC_TURNSTILE_SITE_KEY`~~ | — | — | **Unused.** Present in `.env.local.example` only; not in any Zod schema and not read anywhere. |
| ~~`TURNSTILE_SECRET_KEY`~~ | — | — | **Unused.** As above. |

Optional variables degrade gracefully and say so on screen. They never fail
silently.

---

## 4. Repository layout

```
web/
├── src/
│   ├── app/                     App Router routes
│   │   ├── (auth)/              login · signup · forgot-password
│   │   ├── account/             Member's own page
│   │   ├── admin/               Owner's panel (7 pages)
│   │   ├── auth/callback/       OAuth + email-confirmation exchange
│   │   ├── book/                Booking calendar
│   │   ├── plans/               Plan chooser
│   │   ├── streak/              Attendance streak, goal and graphs
│   │   ├── globals.css          ALL design tokens, keyframes and utilities
│   │   ├── layout.tsx           Root layout, fonts, theme bootstrap
│   │   └── page.tsx             Marketing home page (static)
│   │
│   ├── components/
│   │   ├── admin/               Panel-specific UI
│   │   ├── attendance/          Streak button, panel, page sections
│   │   ├── auth/                Sign-in forms
│   │   ├── booking/             Calendar, class actions, member shell
│   │   ├── classes/ contact/ gallery/ home/ schedule/
│   │   ├── layout/              Site chrome, rail, nav, theme toggle
│   │   ├── plans/               Plan picker, membership card
│   │   └── ui/                  Primitives: Field, Alert, Icon, TiltCard…
│   │
│   ├── content/                 Editorial content and vocabulary
│   │   ├── site.ts              Name, tagline, timezone, contact channels
│   │   ├── schedule.ts          Days, levels, labels, default capacity
│   │   ├── plans.ts             Plans, commitment terms, price functions
│   │   ├── classes.ts           Class descriptions
│   │   ├── gallery.ts           Built-in gallery photographs
│   │   └── imageSlots.ts        The editable photo slots
│   │
│   ├── lib/
│   │   ├── admin/               Panel queries, actions, guard
│   │   ├── attendance/          Streak maths, history, goals
│   │   ├── auth/                Member cookie, redirect safety
│   │   ├── booking/             Calendar model, horizon, occurrences
│   │   ├── contact/             Enquiry submission
│   │   ├── format/              Money, class times, gym clock
│   │   ├── images/              Photo reads, dimension parsing
│   │   ├── plans/               Plan state, prices, auto-booking
│   │   ├── schedule/            Timetable reads
│   │   ├── supabase/            Client factories, session, admin client
│   │   ├── validation/          Zod schemas
│   │   ├── env.ts               Public env schema
│   │   └── env.server.ts        Server env schema
│   │
│   └── proxy.ts                 Next 16's middleware (must live in src/)
│
├── supabase/migrations/         Numbered SQL, applied by hand
├── public/images/               Photographs compiled into the build
├── scripts/                     TS path-alias loader for the test runner
└── DOCUMENTATION.md             This file
```

**Counts at `a72ad33`:** 180 TypeScript/TSX source files, 16 test files,
227 tests, 18 migrations.

### 4.1 Naming and structure conventions

- **Screens are compositions.** Route files fetch data and compose components.
  Business logic lives in `src/lib/`.
- **Content is separate from presentation.** Anything the gym might want
  reworded lives in `src/content/`.
- **Pure logic is a separate module from its server action.** A `"use server"`
  file may export *only* async functions — a `const` export causes Next to
  refuse the module, every server action in the app stops responding, and both
  `tsc` and `next build` pass while it happens. Hence `state.ts` beside
  `actions.ts`, and `priceRows.ts` beside `prices.ts`.
- **Modules that import `@/lib/env` cannot be unit tested** — the schema
  validates at module load and throws without an environment. Pure logic is
  therefore extracted into env-free modules.

---

## 5. Routes and screens

### 5.1 Route table

| Route | Render | Access | Description |
|---|---|---|---|
| `/` | **○ Static** | public | Marketing site: hero, classes, schedule, gallery, contact |
| `/login` | ƒ Dynamic | public | Email/password + Google. Redirects to `/account` if already signed in |
| `/signup` | ƒ Dynamic | public | Account creation |
| `/forgot-password` | ○ Static | public | Password-reset request |
| `/auth/callback` | Route handler | — | OAuth and email-confirmation code exchange |
| `/book` | ƒ Dynamic | member | Booking calendar, 30-day window, day/week/month views |
| `/account` | ƒ Dynamic | member | Coming up · Been to · Membership · Account |
| `/plans` | ƒ Dynamic | member | Class + commitment chooser, monthly/yearly toggle |
| `/streak` | ƒ Dynamic | member | Streak, custom goal, two graphs, the rules |
| `/admin/login` | ƒ Dynamic | **public** | The staff door. ID + password; the ID is an alias for an account's email |
| `/admin` | ƒ Dynamic | **admin** | Four counts and the next six classes |
| `/admin/classes` | ƒ Dynamic | admin | Calendar of upcoming classes |
| `/admin/classes/[occurrenceId]` | ƒ Dynamic | admin | Roster; cancel and restore |
| `/admin/members` | ƒ Dynamic | admin | Directory, searchable, 10 per page |
| `/admin/members/[userId]` | ƒ Dynamic | admin | One member: plan, bookings, quote |
| `/admin/enquiries` | ƒ Dynamic | admin | Contact-form inbox |
| `/admin/timetable` | ƒ Dynamic | admin | The weekly pattern; edits resync occurrences |
| `/admin/pricing` | ƒ Dynamic | admin | The four advertised rates |
| `/admin/photos` | ƒ Dynamic | admin | Fixed slots and the gallery |
| `/admin/security` | ƒ Dynamic | admin | Change the admin password, confirmed by email |

`○ Static` in the build output is a **contract**, not an observation — see §10.

### 5.2 Marketing home page

Five sections, in `navSections` order, each with an `id` the scroll-spy
observer watches: `home`, `classes`, `schedule`, `gallery`, `contact`.

- **Home** — hero card with the gym wordmark (set in Michroma), a two-week
  trial promo, live class status, and a weekly class-load chart.
- **Classes** — four cards (Beginners, Intermediate, Advanced & Fighter, Kids),
  each with its photograph, duration, weekly frequency and advertised price.
- **Schedule** — the full weekly timetable plus opening hours.
- **Gallery** — the gym's photographs. Renders nothing when there are none.
- **Contact** — details and a validated enquiry form.

Navigation is a fixed sidebar rail on desktop and a bottom bar on mobile.

### 5.3 Member area

`MemberShell` frames these pages with four tabs (`/book`, `/account`,
`/plans`, `/streak`) and an upcoming-booking count.

- **`/book`** — a calendar over the 30-day window. Day, week and month views
  are a view switcher, not repeat booking.
- **`/account`** — Coming up (next class given prominence), Been to,
  Membership (chosen plan, term and advertised price), Account controls.
- **`/plans`** — pick a class and a commitment term. Choosing a plan
  auto-books matching classes (§8.4).
- **`/streak`** — current streak, a custom goal, a 12-week bar chart, a
  12-week weekday grid, and the rules in plain language.

### 5.4 Admin panel

`AdminShell` frames all eight panel pages. The navigation is one horizontally
scrolling row below the `lg` breakpoint and rejoins the header above it — see
§13.2 for the measurements that produced this.

Nav items are grouped: **what is happening** (Overview, Classes, Members,
Enquiries), **what the site says** (Timetable, Pricing, Photos) and **this
account** (Security).

#### The `(panel)` route group

Everything under `/admin` except the login page lives in a **route group**,
`src/app/admin/(panel)/`. A group is invisible in the URL — `/admin`,
`/admin/pricing` and the rest resolve exactly where they always did — but it
is a real layout boundary, and that is the point:

```
src/app/admin/layout.tsx            metadata only (noindex)
src/app/admin/login/page.tsx        the door — NOT guarded
src/app/admin/(panel)/layout.tsx    requireAdmin() — guards everything below
src/app/admin/(panel)/page.tsx      /admin
src/app/admin/(panel)/pricing/…     /admin/pricing
```

The guard used to sit on `admin/layout.tsx`, which was correct until the login
page had to exist: a guard there would redirect a signed-out visitor away from
the very page they came to sign in on.

Dropping the layout guard entirely would also have worked today — all nine
panel pages call `requireAdmin()` themselves — but it would have given up the
property that **adding a page cannot accidentally add a hole**, which is the
only reason a layout guard was worth having. The group keeps it.

---

## 6. Design system

### 6.1 The rule

**No component may contain a colour literal, a `font-family`, or a
`@keyframes` block.** All three live in `src/app/globals.css`; fonts are
declared in `src/lib/fonts.ts`. A rebrand is an edit to two files.

### 6.2 Colour tokens

Fixed brand colours:

| Token | Value | Use |
|---|---|---|
| `--color-accent` | `#ff3b30` | Brand red: CTAs, active states |
| `--color-accent-hover` | `#ff5a50` | Hover state |
| `--color-ink` | `#0b0b0c` | Near-black; text on accent |
| `--color-chalk` | `#ffffff` | Text on ink |
| `--color-on-photo` | `#edeae2` | Text over photographs (plus 82% and 64% variants) |

Theme-dependent tokens resolve through CSS custom properties and flip with the
active theme: `bg`, `card`, `border`, `divider`, `text`, `text-2`, `text-3`,
`input-bg`, `surface-nav`, `accent-strong`, `danger`.

The admin panel re-points the ground for its own subtree via `.admin-surface`
— cool where the members' side is warm, in both themes.

### 6.3 Typography

| Token | Face | Use |
|---|---|---|
| `--font-display` | **Anton** | Section headings, page titles |
| `--font-hero` | **Michroma** | The `#home` hero section only |
| `--font-body` | **Manrope** | All body copy and UI |
| `--font-mono` | **IBM Plex Mono** | Numbers, times, prices, labels |

Loaded through `next/font/google`, which self-hosts them — the family name does
not appear as a literal string in served HTML.

> **On Michroma.** The brief asked for *Good Times*, a commercial Typodermic
> face with no webfont licence available. Michroma is the closest free
> substitute: the same wide, square-shouldered geometric uppercase. It ships in
> **one weight**, so the hero reads lighter than Anton would. **Orbitron** is a
> one-line swap in `fonts.ts` if more weight is wanted. Michroma sets this copy
> at roughly **2.0–2.1× the width of Anton** at the same size — changing the
> hero face without retuning every size will overflow small screens.

### 6.4 Theming

Two themes, toggled by `ThemeToggle`, persisted to one storage key, applied by
a pre-paint script in `layout.tsx` so there is no flash.

### 6.5 A Tailwind rule that has caused real bugs

**Never concatenate idle and active class strings.** Tailwind orders utilities
by variant, not by string position, so `"hover:border-accent bg-accent"`
resolves to whichever the stylesheet happened to define last. Write mutually
exclusive branches:

```tsx
className={isCurrent
  ? "border-accent bg-accent text-ink"
  : "border-border text-text-2 hover:border-accent hover:text-accent-strong"}
```

---

## 7. Data model

Twelve tables in `public`. **Every table has row-level security enabled**, and
RLS — not application code — is the access control.

### 7.1 Tables

| Table | Purpose | Key policies |
|---|---|---|
| `profiles` | Mirror of `auth.users`, maintained by a trigger | Own row; all rows for admins |
| `admins` | Who is an admin | Readable only by admins |
| `contact_messages` | Enquiries from the contact form | Admin read + mark handled |
| `class_sessions` | The **weekly pattern** — day, time, level, capacity | Public read; admin write |
| `class_occurrences` | **Materialised classes** generated from the pattern | Member read; admin cancel/insert/delete |
| `bookings` | A member's place in a class | Own rows; all rows for admins |
| `attendance` | Self-marked training days | Own rows only, today only |
| `member_goals` | A member's custom streak target (2–365) | Own row only |
| `member_plans` | Which class and term a member is interested in | Own row; all for admins |
| `member_quotes` | What the gym quoted one member | **Admins only** — members cannot read |
| `plan_prices` | The four advertised rates | Public read (4 columns); admin update |
| `site_images` | Every photograph on the site | Public read; admin write |

### 7.2 Database functions and triggers

| Object | Purpose |
|---|---|
| `public.is_admin()` | The single definition of "admin". Called by every admin policy. |
| `public.gym_today()` | `(now() at time zone 'America/New_York')::date`. Lets attendance policies decide "is this today?" *inside* the database. |
| `sync_profile_from_auth()` / `on_auth_user_changed` | Keeps `profiles` in step with `auth.users` |
| `sync_occurrence_booked_count()` / `bookings_sync_occupancy` | Maintains `class_occurrences.booked_count` under a check constraint that makes an oversold class **unrepresentable** |
| `stamp_plan_price()` / `plan_prices_stamp` | Stamps `updated_at`/`updated_by` on a price edit so neither can be falsified by the caller |

> `booked_count` is maintained by a `SECURITY DEFINER` trigger. **Never write it
> by hand** — that is precisely how the no-oversell guarantee gets broken.

### 7.3 Two rules that recur

**Money is always integer cents.** Never a float. `0.1 + 0.2 !== 0.3` in binary
floating point, and the place that error surfaces is a total read aloud at a
counter. `parseMoneyToCents` parses by string surgery rather than
`Math.round(parseFloat(x) * 100)`, because `parseFloat("8.115") * 100` is
`811.4999999999999`.

**Vocabulary lives in exactly two places, and each comments the other.** Plan
slugs, class levels and day identifiers appear in a Postgres `CHECK` constraint
*and* in `src/content/`. Changing one without the other is the bug that
migration `20260818130000` exists to fix.

---

## 8. Domain logic

### 8.1 The timetable

The gym runs **34 sessions a week**, stored in `class_sessions`:

| Day | Sessions |
|---|---|
| Mon | 09:00 Beginners · 10:00 Intermediate · 11:00 Advanced · 17:00 Beginners · 18:00 Intermediate · 19:00 Advanced |
| Tue–Thu | as Monday, **plus** 16:00 Kids |
| Fri | mornings only — 09:00 · 10:00 · 11:00 |
| Sat | 09:00 · 10:00 · 11:00 **plus** 13:00 Kids |
| Sun | **closed** |

Default capacity is **16** per session, editable per session in the panel.

Editing the timetable **resyncs occurrences**: classes are created and removed
to match, *except* any that already have bookings. Those are reported back to
the owner so he can telephone the affected members. A timetable edit that
silently cancelled somebody's Tuesday would be the worst bug this panel could
have.

### 8.2 Booking

| Constant | Value | Meaning |
|---|---|---|
| `BOOKING_WINDOW_DAYS` | 30 | How far ahead a member may book |
| `HORIZON_DAYS` | 60 | How far ahead occurrence rows are materialised |
| `REFRESH_BELOW_DAYS` | 45 | Top-up threshold |

Occurrences are generated on demand with `ignoreDuplicates: true` — never
merged — so a cancelled or hand-edited occurrence is not silently resurrected.

**Cancelling a class does not touch bookings.** Those rows stay `booked`, and
`/account` reads the occurrence status to tell the member "the gym cancelled
this one". Flipping the bookings instead would destroy the distinction between
a class the gym called off and one the member dropped — two facts that look
identical afterwards and mean opposite things.

### 8.3 Plans and pricing

A plan is **two answers**: which class, and how long you commit for.

| Plan | Monthly | 12-week contract |
|---|---|---|
| Beginners | $125 | $99 |
| Intermediate | $150 | $125 |
| Advanced & Fighter | $190 | $165 |
| Kids | $99 | *(one price only)* |

Commitment terms: **Two-week trial**, **12-week contract** (takes the lower
rate), **Month to month**, and **Yearly**.

> **"Yearly" is a billing view, not a product.** The gym sells no annual plan.
> The figure is the standard monthly rate **× 12** and nothing else. It is
> *derived at render*, never stored, so it cannot drift; every surface showing
> it also states "12 × $X a month, still billed monthly"; and it is never
> presented as a saving, because it is not one. If the gym ever quotes a real
> annual rate, this becomes a product with its own price field.

**What a plan is not: an entitlement.** Choosing one grants nothing and
restricts nothing. A member who picks none can book exactly what any other
member can. It records an interest for the gym to follow up in person.

#### Where prices live

Since 2026-08-23, **the four monthly rates and four contract rates live in
`plan_prices`** and are editable at `/admin/pricing`. Everything else about a
plan — slug, name, tagline, inclusions, and the commitment terms — remains in
`src/content/plans.ts` and changes with a release.

The reason for the split: a slug is a `LevelId`, the same string that names a
class in the timetable, and a renamable slug is how a plan and a class stop
naming the same thing. Names and taglines are read alongside sentences
elsewhere on the page that would have to change with them.

**Code is the fallback, never the truth.** A missing table, an unreachable
Supabase, or a single row failing validation leaves *that plan* on the figure
compiled into the build. One bad row costs one price, not the page.

**The invariant that matters:** a contract rate above the monthly rate is
refused in three places — a `CHECK` constraint (the enforcement), the server
action (which names the field), and the form before submission. Every surface
shows the contract figure as the cheaper option, so the reverse would render as
*a discount that costs more* — a mistake that survives review because both
numbers look plausible alone.

**Changing an advertised price does not re-quote anybody.** `member_quotes`
snapshots its own `price_cents` when a figure is agreed, and nothing reads
through to it.

### 8.4 Plan auto-booking

Choosing a plan books matching classes automatically.

| Constant | Value |
|---|---|
| `PLAN_BOOKING_DAYS` | 7 — how far ahead the plan books |
| `PLAN_BOOKING_MAX` | 12 — the ceiling on auto-booked places |

Bookings carry `source` (`member` or `plan`) so changing plan releases only the
places the *plan* took, never one the member chose deliberately.

### 8.5 Attendance and the streak

**Attendance is self-reported.** A member marks that they trained. Nobody
checks them in. The user interface therefore says *"classes booked"*, never
*"attended"* — the two are different facts and the site must not conflate them.

Rules, enforced in the database as well as the UI:

- Marking is **today only**. No backdating, no future-dating. Enforced by
  `gym_today()` inside the attendance policies.
- A day may be un-marked (delete) **only on the day it was marked** — undo the
  mis-tap, not reshape history.
- Streaks count **open days only**: Monday to Saturday. Sunday is *stepped
  over*, so training Saturday and Monday is an unbroken streak. A marked Sunday
  still counts as a day trained, because it happened.

| Constant | Value |
|---|---|
| `MILESTONES` | 3, 7, 14, 30, 60, 100, 200, 365 |
| `GOAL_MIN` / `GOAL_MAX` | 2 / 365 |
| `HISTORY_WEEKS` | 12 (both graphs) |

A custom goal out of range is **refused, not clamped** — clamping 500 to 365
stores a goal the member did not choose.

The streak button in the site chrome is a **link** to `/streak` with a hover
preview. Hover opens after 120 ms and closes after 300 ms; the 12 px offset is
*padding on a positioned wrapper*, not a margin, so the pointer can cross it
without the panel closing (WCAG 1.4.13). Touch devices get no panel at all —
`pointerType` is checked — so a tap navigates cleanly.

### 8.6 Time zones

**The gym is in `America/New_York` and the site must show its clock, not the
viewer's.** This is a recurring source of bugs and the rules are strict:

1. **All dates are formatted on the server**, in the gym's zone, and passed to
   components as strings. Components do no date arithmetic.
2. `gymClock.ts` provides `CivilDate` — a calendar date already resolved to the
   gym's zone — and all streak/history maths operates on those, never on `Date`.
3. The zone appears in exactly two places: `site.timeZone` and `gym_today()` in
   Postgres, because a policy must decide "is this today?" *inside* the
   database where no TypeScript constant can reach. Each comments the other.

### 8.7 Photographs

Six fixed slots (`hero`, `promo`, `class-beginner`, `class-intermediate`,
`class-advanced`, `class-kids`) plus an ordered gallery, all in `site_images`
with files in the `site-images` storage bucket. Maximum upload **8 MB**; MIME
type is validated from the file's own bytes, not its extension.

A slot with no row falls back to the photograph compiled into the build, which
is what makes "revert" a `DELETE` rather than a second kind of update.
`class-kids` has no built-in and correctly renders a plain card until the gym
supplies a real photograph of a kids' session.

**An empty gallery is a real answer.** Deleting every gallery photo makes the
section disappear rather than resurrecting stock images. Prices go the other
way: an empty `plan_prices` means "not seeded" and the built-in figures stand,
because a gym with no prices is not something this site can render.

---

## 9. Security model

### 9.1 The principle

**Row-level security is the enforcement. Application code is not.**

The browser holds a publishable key and can reach PostgREST directly. Anything
checked only in TypeScript is not checked at all. Server actions in this
codebase deliberately contain **no** `isAdmin()` check before writing — a check
there would look like the gate while the real one sat in Postgres, and the day
the two disagreed the TypeScript would be believed. A non-admin calling an
admin action receives a policy refusal (`42501`), reported as "you cannot do
that".

### 9.2 Layers

| Layer | Mechanism | Catches |
|---|---|---|
| Proxy | `src/proxy.ts` → `updateSession` | Signed-out access to protected prefixes |
| Page | `requireAdmin()` / `getUser()` | What to *render* |
| **Database** | **RLS policies + column GRANTs** | **Everything that matters** |

Every protected page re-checks the session in the component. A misconfigured
matcher would otherwise expose a page silently.

### 9.3 Admin gating

`requireAdmin()` distinguishes two cases deliberately:

- **Signed out** → redirect to `/admin/login`, so the owner arriving at a
  bookmark with an expired session has a way in. The staff door rather than the
  member one: the proxy makes the same distinction, sending anything under
  `/admin` to `/admin/login` and everything else to `/login`, because the member
  form asks for a credential that would not get him there. `/admin/login` itself
  is exempted from the protected-prefix check by exact match — a prefix
  exemption would be a way to smuggle a real panel route past the guard by
  nesting it underneath.
- **Signed in, not an admin** → **`notFound()`**, not a 403. A permission page
  would confirm to a member that an admin area exists and that they found it.

`isAdmin()` **fails closed** — any error, from a network fault to a revoked
grant, resolves to `false`. The cost of guessing wrong here is every member's
data shown to whoever asked, so an unreadable `admins` table means "not an
admin".

`getPlanState()` resolves errors to `available: false`, and callers respond by
rendering **no plan UI at all** — `/plans` redirects to `/book`. The member is
never blocked; the feature simply is not there. (The source comment calls this
"fails open", meaning it does not deny the member access to the app. Both
functions resolve to a safe default; what differs is the consequence — one
hides data, the other hides a feature.)

### 9.4 Column-level grants

RLS grants access to a **row** and says nothing about which of its columns you
touched. Column `GRANT`s close that gap and are used throughout:

- `class_occurrences` — admins may update `status` and `cancellation_note`
  **only**. Not `starts_at`, `capacity`, `level`, or `booked_count`.
- `plan_prices` — admins may update the two price columns only. Not `slug`:
  renaming a plan would break its join to every class in the timetable.
- `plan_prices` **reads** are also column-scoped. `updated_by` holds an admin's
  auth id and this table is read anonymously from a public page.

> ⚠ **Consequence to know:** `select=*` on `plan_prices` fails `42501`, because
> PostgREST expands `*` to every column in the schema cache and Postgres
> refuses a `SELECT` naming a column you lack privilege for. **Name the
> columns.** A `*` read returns not-ok and the site falls back silently to
> built-in prices while the panel claims pricing is switched off.

### 9.5 Data-exposure rules

- Member **quotes are invisible to members**, enforced by policy.
- Public profile data never includes internal identifiers.
- **The contact form's only bot mitigation is a honeypot field** (`website`,
  positioned off-screen and `aria-hidden`). Cloudflare Turnstile keys exist in
  `.env.local.example` but **no code reads them** — treat the form as
  honeypot-only until that is built or the keys are removed.
- Redirect targets pass through `safeNextPath()` — open-redirect prevention.

### 9.6 Key handling

- `SUPABASE_SECRET_KEY` **bypasses all RLS**. Server-only, never
  `NEXT_PUBLIC_`, reached only through `src/lib/supabase/admin.ts`.
- The publishable key is safe in the browser *because* every table has RLS.
- **Rotate both the Supabase secret key and the database password on any
  suspected exposure** — including pasting them into a chat, a ticket, a log,
  or a screenshot.

### 9.7 A rule about reading results

**A 200 is not a success.** PostgREST answers a policy-filtered `UPDATE` or
`DELETE` with **200 and an empty body**, and Supabase Storage answers a refused
`.remove()` the same way. Always read *rows affected*, never the status code.
Every write in this codebase does `.select(…).maybeSingle()` and treats a null
result as a refusal.

### 9.8 The admin door (`/admin/login`)

A second way in for staff, alongside the member sign-in at `/login`. It exists
so the gym can reach the panel by typing a short ID rather than a full email
address on a phone.

**It is an alias, not a second auth system.** The ID resolves to
`ADMIN_LOGIN_EMAIL` and the password is submitted to Supabase unchanged:

```
"admin" ──► ADMIN_LOGIN_EMAIL ──► signInWithPassword ──► ordinary Supabase JWT
```

This shape is forced, and understanding why prevents someone re-engineering it
into something worse. `is_admin()` reads `auth.uid()` out of the JWT, and every
RLS policy in the database calls it. **A bespoke admin cookie would render the
panel and fill it with nothing** — empty tables, failed saves — and the only way
to make one work would be to route every admin query through the RLS-bypassing
secret key, which would make a TypeScript cookie check the sole guard on the
entire database. The alias keeps Postgres in charge.

Consequences worth stating:

- **Nothing here hashes, stores or compares a password.** Supabase holds it
  bcrypt-hashed, compares in constant time, rate-limits attempts, and screens
  new passwords against the breached-password corpus. There is no credential
  table and no secret in env to rotate.
- **The ID is not a secret**, and nothing pretends otherwise. The footer links
  the door from every page. It is the guessable half of a credential; the
  password does the work.
- **The account must be in `admins`.** After a successful sign-in the action
  re-checks membership through the new session and signs back out if it is
  missing — otherwise a misconfigured `ADMIN_LOGIN_EMAIL` would sign in cleanly
  and then 404, which reads as a broken panel rather than a missing `INSERT`.
- **Failures are uniform.** A wrong ID and a wrong password return the same
  sentence, and `MINIMUM_FAILURE_MS` (600ms) puts a floor under both. Without
  the floor the ID would be readable from a stopwatch — a wrong one returns
  before any network call. Measured on a dev server: 684ms vs 655ms, a 29ms
  gap, which is noise.
- **`safeAdminNext` is stricter than `safeNextPath`.** The member login may
  legitimately return someone anywhere on the site; this door only ever leads
  into the panel, so anything that is not a panel URL is refused. It rejects
  absolute URLs, protocol-relative `//host`, any backslash, `/administrators`
  (prefix that is not a segment), and `/admin/login` itself.

#### Changing the password (`/admin/security`)

Two steps, confirmed by email:

1. Current password + new password → the current one is verified by *using* it
   (`signInWithPassword`), then `reauthenticate()` mails a code.
2. The same fields plus the code → `updateUser({ password, nonce })`.

The new password is **never held server-side between the steps.** It stays in
the browser form and is submitted again with the code, so there is no pending
change record to expire, leak, or strand the account half-changed. The current
password is re-verified in step two rather than trusted from step one, because
what step one returns reaches step two as form fields the browser can edit.

Two operational notes:

- **"Secure password change" is deliberately OFF**, and the copy on the page
  reflects that. The nonce is passed on every call, but GoTrue only *validates*
  one when that project setting is on and the session is not recently created —
  and step one signs in to verify the current password, so the session is always
  seconds old by the time the change is submitted. **With the setting off, a
  wrong code is accepted.**

  This was a considered trade, not an oversight. The check that always holds is
  the current password, verified in *both* steps by using it, and enforced by
  this codebase regardless of any dashboard state. The threat the emailed code
  defends against — someone at an unattended, signed-in laptop trying to lock
  the owner out — is already defeated by not knowing that password; anyone who
  does know it is already the admin and needs no escalation.

  Turning the setting on at
  `Authentication → Providers → Email → Secure password change` upgrades the
  code from "the form asks for it" to "the server requires it", and needs no
  code change. **If it is ever enabled, revisit the page copy** — it currently
  describes the code as a step rather than as a lock, which would then be
  understating what happens.
- **Supabase's built-in mailer is rate-limited per hour** and the free-tier
  ceiling is low enough to hit by trying twice. The action says so by name
  rather than reporting a generic failure.

There is deliberately **no "forgot password" link** on this screen: a reset is
delivered to an email address and this form collects an alias instead. Resolving
it to send a link would mean telling an anonymous visitor which address the
alias stands for. Recovery runs through `/forgot-password` with the account's
own email, or the Supabase dashboard.

---

## 10. Caching and the static-prerender constraint

### 10.1 The constraint

**`/` must remain statically prerendered.** It is the marketing page, it
absorbs traffic spikes, and it is served from the edge with no Node process and
no database round trip.

**Nothing in the `/` tree may read the session during render.**
`lib/supabase/server.ts` calls `cookies()`, and touching `cookies()` during
render opts the whole route out of static generation **silently**: the build
output flips from `○ (Static)` to `ƒ (Dynamic)` and nothing else complains.

> **Verification is mandatory.** After any change touching the `/` tree,
> confirm `○ /` in the build output. On production, confirm
> `x-vercel-cache: PRERENDER`. If `/` ever shows as `ƒ (Dynamic)`, that is a
> regression, not a detail.

### 10.2 How dynamic data reaches a static page

Three datasets are read by `/` — the timetable, the photographs and the prices.
All three use the same pattern:

```ts
await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/<table>?select=…`, {
  headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
  next: { tags: [TAG] },
});
```

A **bare `fetch`** with the publishable key — no session, no cookies — tagged
so Next caches it. One request at build time, reused until an admin action
calls `updateTag(TAG)`.

| Dataset | Tag | Module |
|---|---|---|
| Timetable | `timetable` | `lib/schedule/queries.ts` |
| Photographs | `site-images` | `lib/images/queries.ts` |
| Prices | `plan-prices` | `lib/plans/prices.ts` |

The corresponding tables grant `SELECT` to `anon` deliberately: they are
photographs, times and prices printed on a public web page.

### 10.3 Invalidation

Admin actions use **`updateTag`, not `revalidateTag`**. The difference is
read-your-own-writes: `revalidateTag` takes effect on the *next* request, so
the panel would redraw showing the value it just replaced.

Each write also calls `revalidatePath` for every page that displays the data.
The price list is longer than it looks because a price appears on four
unrelated screens; a price that changed on `/` but not `/plans` is the
half-applied edit that ends in an argument at the counter.

### 10.4 Member-specific UI on a static page

The account chip and streak button appear on `/` without making it dynamic:

1. A `jc-member` display cookie holds `{n: name, e: email}` — **not a
   credential**; nothing is authorised by it.
2. A pre-paint script in `layout.tsx` sets `data-member` on `<html>`.
3. CSS shows or hides `.member-only` / `.guest-only`. Both versions ship in the
   same HTML; CSS picks.
4. Streak *numbers* arrive from a server action fired after mount.

One cached document for everyone, correct controls in the first painted frame,
and a signed-out visitor makes zero extra requests.

---

## 11. Operational procedures

### 11.1 Database migrations

Migrations are **applied by hand** by the project owner, pasting SQL into the
Supabase SQL Editor. The CLI account linked locally has no privileges on the
project.

**Consequences that shape how migrations are written:**

1. **Code goes live before the migration.** Every feature must degrade honestly
   in that window — a screen whose table does not exist renders read-only
   behind a notice naming the migration file, and members see correct data via
   the fallback path.
2. **Every migration ends with a `SELECT`** returning visible confirmation:
   row counts, policy counts, constraint checks, and the resulting data. A
   filename has been pasted by mistake before; a confirmation row makes that
   obvious.
3. **Migrations must be re-runnable.** `create table if not exists`,
   `drop policy if exists`, `on conflict do nothing`, and guarded
   `add constraint` blocks (Postgres has no `add constraint if not exists`).

**Naming:** `YYYYMMDDHHMMSS_short_description.sql`, in
`supabase/migrations/`.

### 11.2 Verifying a migration without privileges

Because there is no staging database, verification uses probes that **cannot
write**:

- **Does a table exist?** An anonymous read discriminates `42501` (exists, no
  grant) from `PGRST205` (does not exist). Always run a known-bad control
  (`zzz_not_a_table`) and a known-good control alongside it.
- **Does a `CHECK` constraint exist?** `INSERT` a row whose primary key is
  already taken. It cannot commit. A constraint violation returns `23514`
  *naming the constraint*; a valid row returns `23505` from the primary key,
  which is the control proving the checks let it through. **Confirm the row
  count is unchanged before and after.**
- **Is a write policy correct?** Attempt the write with the anonymous key,
  setting a column to the value it already holds — so a success would change
  nothing — and expect `42501`.
- **Anything genuinely destructive:** write the restore *first*.

Useful PostgREST codes:

| Code | Meaning |
|---|---|
| `PGRST205` | Table not in the schema cache (does not exist) |
| `PGRST204` | Column not in the schema cache (on writes) |
| `42703` | Column does not exist (on reads) |
| `42501` | Permission denied — grant or policy refused |
| `23514` | Check constraint violated (message names the constraint) |
| `23503` | Foreign key violated |
| `23505` | Unique constraint violated |

### 11.3 Deployment

Push to `main` → Vercel builds and deploys. There is no manual step.

**Pre-push checklist:**

- [ ] `npm test` — all green
- [ ] `npm run typecheck` — clean
- [ ] `npm run build` — clean, and **`/` still shows `○ (Static)`**
- [ ] **Secret-scan the added lines** of the whole range being pushed
      (`git diff <remote>..HEAD -U0 | grep '^+'`). Scan **added lines only** —
      scanning deletions once produced a false positive against documentation
      of the key *patterns*.
- [ ] No `.env` file in the diff
- [ ] Any migration the code depends on is either applied, or the code degrades
      honestly without it — and the owner has the SQL

**Post-deploy verification:**

- `curl -I https://jc-muay-thai.vercel.app/` → 200 with
  `x-vercel-cache: PRERENDER`
- Spot-check the changed surface for real content

### 11.4 Local development

Two concurrent dev servers corrupt `.next` and produce 500s with
`ENOENT … build-manifest.json`. Note that **`pkill -f "next dev"` does not work**
— the process renames itself; use `pkill -f "next-server"`. Never run
`npm run dev` and `npm run build` simultaneously.

---

## 12. Testing and verification

### 12.1 Unit tests

`npm test` runs **227 tests** across 16 files using `node --test`.

Tests cover pure logic only — money parsing, streak arithmetic, calendar
construction, price-row validation, plan selection, time formatting. Modules
importing `@/lib/env` cannot be tested (§4.1), which is why pure logic is
extracted.

### 12.2 Browser verification

There is no automated end-to-end suite. Verification is done with Playwright
scripts driven against a locally installed Chrome
(`chromium.launch({ channel: "chrome" })`), measuring:

- **Contrast** of every visible text node, against WCAG AA thresholds, in both
  themes at seven widths.
- **Horizontal overflow** at 320–1920 px.
- **Tap-target size** against WCAG 2.5.8.
- **Interaction** — hover, focus, keyboard and touch behaviour.

Admin screens cannot be loaded without a production admin session, which cannot
be minted in the development environment. They are verified by rendering their
components with fixtures on a **temporary preview route, deleted before
commit**.

### 12.3 Measuring contrast over photographs

The computed-style method — walking up the DOM for an opaque background — is
**wrong** over an image, because the background is a photograph plus a scrim.
Over photographs, measure off **rendered pixels**.

> **Sanity-check any pixel sampler before trusting it.** Verify it against a
> known solid pair first: the trial CTA is `ink` on `bg-accent` and must compute
> to **5.55**. A sampler returning a ratio of exactly `1.00` is reading the
> glyph, not the ground.

---

## 13. Accessibility standards

Targets: **WCAG 2.2 Level AA**.

- Every text node meets 4.5:1 (3:1 for large text), measured rather than
  assumed.
- Interactive targets meet 24×24 px (WCAG 2.5.8) — with the **inline
  exception**: a link inside a sentence, constrained by the line-height of the
  surrounding text, is conformant at any size. Making it larger would break the
  line.
- Hover content is dismissible, **hoverable** and persistent (WCAG 1.4.13). The
  streak preview's offset is padding on a positioned wrapper so the pointer can
  reach it.
- Both themes are tested; neither is a recolour of the other.
- Graphs carry screen-reader text per row; decorative cells are `aria-hidden`.
- Forms use real `<label>` elements, `aria-describedby` for help text,
  `aria-invalid` on failures, and `role="alert"` / `role="status"` for feedback.

### 13.1 Reduced motion

Animations respect `prefers-reduced-motion`. The admin welcome veil is
**removed** rather than frozen.

### 13.2 A worked example — the admin header

When Pricing became the seventh nav item, the panel header measured **289 px
tall at 320 px wide** — over a third of a phone screen spent on navigation, on
a panel used standing in the gym. Everything sat in one `flex-wrap` container,
and seven pills cannot fit two rows at that width.

The fix was to give the navigation its own horizontally scrolling row **below
`lg` only**, rejoining the header above it:

| Width | Before | After |
|---|---|---|
| 320 px | 289 px | **129 px** |
| 360 / 390 px | 237 px | **129 px** |
| 768 px | 133 px | **129 px** |
| 1024 px | 133 px | **121 px** |
| 1280 px | 77 px | **69 px** |

A universal split would have cost desktop 48 px to save the phone 160 px. The
conditional version means no width pays for another.

Scrolling hides items, so `AdminNav` is a client component solely to scroll the
current page's pill into view on mount — and only when it is genuinely out of
view. `block: "nearest"` is required, or the page scrolls vertically too.

---

## 14. Known constraints and open items

### 14.1 Deliberate constraints

| Constraint | Reason |
|---|---|
| No payment processing | The gym takes money in person. Not a v1 omission — a decision. |
| Attendance is self-reported | No check-in hardware. The UI never claims otherwise. |
| Migrations applied by hand | The linked CLI account has no privileges |
| One environment | No staging database exists |
| `select=*` fails on `plan_prices` | Column-scoped read grant; see §9.4 |

### 14.2 Not yet configured

- **Resend** — `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` and
  `CONTACT_NOTIFICATION_EMAIL` are declared and blank. Cancellation emails do
  not send; the panel reports "nobody could be emailed" rather than claiming
  success. Needs an API key, a verified sender and the gym's real address.
- **Favicons** — `/favicon.ico`, `/icon.png` and `/apple-icon.png` all 404.

### 14.3 Open items

| Item | Notes |
|---|---|
| `ClassLoadChart` bars collapse on short viewports | Pre-existing. The `<ul>` flex-shrinks below its `h-[min(20vh,120px)]` track — 0 px at 1024×700, full height only above ~1100 px. **`shrink-0` is proven *not* to be the fix** — it spills 22 px out of the card. Needs a real answer for short viewports. |
| `/account/password` | Not built |
| Privacy and Terms pages | Not written |
| Local SEO | `LocalBusiness` schema, NAP consistency and map-pack signals are unaddressed and relevant for a gym with a physical address |
| Turnstile: build it or remove the keys | The example env file advertises a protection the code does not have — see §9.5 |

### 14.4 Resolved — do not re-open

- **`See the full schedule` (135×19 px) is not a WCAG 2.5.8 failure.** It is an
  inline link inside a sentence and is explicitly exempt.
- **The hero passes AA over the photograph.** The tightest measured ratio is
  **5.55**. A sampler reporting otherwise is broken — see §12.3.

---

## 15. Command reference

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build — CHECK `○ /` IN THE OUTPUT
npm start            # Serve the production build
npm run typecheck    # tsc --noEmit
npm test             # 227 tests, node --test
npm run lint         # ⚠ non-functional — eslint is not a dependency at all
```

### Verification snippets

```bash
# Is / still statically prerendered on production?
curl -sI https://jc-muay-thai.vercel.app/ | grep -i x-vercel-cache
# expect: x-vercel-cache: PRERENDER

# Secret-scan the range about to be pushed (ADDED LINES ONLY)
git diff origin/main..HEAD -U0 | grep '^+' | grep -v '^+++' \
  | grep -inE 'sb_secret|service_role|eyJ[A-Za-z0-9_-]{20,}|postgres(ql)?://[^ ]*:[^ ]*@'

# Does a table exist? (run the controls too)
curl -s "$SUPABASE_URL/rest/v1/<table>?select=<cols>&limit=1" \
  -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $PUBLISHABLE_KEY"
```

---

## Appendix — migration history

| File | Purpose |
|---|---|
| `20260805120000_contact_messages` | Contact enquiries |
| `20260807120000_class_booking` | Sessions, occurrences, bookings, occupancy trigger |
| `20260810120000_attendance` | Self-marked attendance and `gym_today()` |
| `20260813120000_member_plans` | Which plan a member is interested in |
| `20260815120000_admin_identity` | `admins`, `is_admin()`, the member directory |
| `20260815130000_admin_writes` | First admin writes: cancel a class, handle an enquiry |
| `20260817120000_member_quotes` | Per-member quotes |
| `20260818130000_real_plans` | Replaced invented plans with the gym's real ones |
| `20260818140000_real_timetable` | Replaced the invented timetable with the real one |
| `20260819120000_fix_tuesday_kids` | Removed phantom 8 AM Tuesday classes |
| `20260822120000_class_sessions` | Timetable moves into the database, editable |
| `20260823120000_site_images` | Photographs move into the database + storage bucket |
| `20260823130000_site_images_storage_select` | The `storage.objects` SELECT policy the previous migration omitted |
| `20260823140000_annual_commitment` | Allows `'annual'` on `member_plans.commitment` |
| `20260823150000_plan_bookings` | `bookings.source` — member or plan |
| `20260823160000_streak_goals` | `member_goals` — a custom streak target |
| `20260823170000_hero_photo` | Corrects the hero row's recorded dimensions |
| `20260823180000_plan_prices` | Advertised prices move into the database |

---

*Maintained alongside the code. When a pattern changes, update this document in
the same commit.*
