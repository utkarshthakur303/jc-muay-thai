# JC Muay-Thai — Design & Build Brief v2
*Rewritten from a generic "Awwwards-style AI prompt" into a grounded, technically specific creative direction.*

---

## Design Thesis

JC Muay-Thai is not a gym website. It's the five minutes before a class starts — wraps going on, chalk in the air, one hard light over the canvas. Every animation on this site has to earn its place by belonging to that moment. Everything that doesn't gets cut.

**One signature. Everything else quiet.** The brief below deliberately does less in more places and more in one place — because scattered effects are what make a site feel AI-generated, and one well-executed mechanic is what makes it feel designed.

---

## Why the original brief reads as generic — and what replaces it

| Generic tell | What it becomes here |
|---|---|
| Floating 3D product rotating in a smoky void | A hand-wrap ritual sequence, scroll-scrubbed and physically grounded (see below) |
| "Magnetic mouse snapping" + "cursor distortion" on everything | A single precision reticle cursor, damped spring pull, CTAs only |
| Liquid shader distortion on every gallery/shop hover | One shader treatment, reserved for the gallery, executed properly |
| Glassmorphic neon panels | Solid matte surfaces, hairline gold edge — glassmorphism reads dated in 2026 |
| "Unleash Your Inner Fighter" | Copy specific to this gym — see Section 01 rewrite |
| Dark background + one neon accent everywhere | Same palette, but crimson is rationed to one moment per screen, not a wash |

---

## Visual Identity System

### Palette (your hex values, kept — plus the two neutrals a real build actually needs)
- **Deep Charcoal Void** `#0B0B0C` — dominant surface
- **Onyx Black** `#121214` — secondary surface / cards
- **Muay Thai Matte Gold** `#C5A880` — heritage, status, trim. Carries ~90% of the accent weight.
- **Signal Crimson** `#FF2A4B` — reserved for exactly **one** element per screen (one CTA pulse, one rim-light kicker). Never a background wash, never a panel glow.
- **Bone** `#EDEAE2` — primary text on dark (softer than pure white)
- **Canvas Grey** `#3A3733` — hairlines, dividers, muted states

Discipline note: if crimson appears in more than one place on a given screen, cut it back. It should feel like a decision being made, not ambient lighting.

### Typography
Skip the default "Clash Display / Syne / Inter" stack — it's the exact combination almost every AI-generated design brief reaches for right now, which undercuts the "not generic" goal on its own.

- **Display:** Founders Grotesk X-Compressed (or equivalent compressed grotesque — e.g. Owners Wide). Extreme negative tracking, used only above 48px. Grounded in fight-poster and boxing-bill lettering, not a generic "portfolio font."
- **Data / Schedule:** IBM Plex Mono or JetBrains Mono. Used for the schedule grid, class numbering, and stat callouts — gives those elements a ticket-stub / scoreboard read instead of generic table styling.
- **Body:** General Sans or Suisse Int'l. Quiet, legible workhorse — deliberately *not* Inter/SF Pro, which are the reflexive AI-brief default.

### Material Language (new — this is what makes the 3D feel real instead of CGI-generic)
- Leather: worn, matte, visible grain — not glossy showroom leather
- Cotton hand-wrap: waxed-thread weave, visible fray at the edges
- Gold: brushed/hammered with real patina, not chrome-polished — patina reads as heritage, gloss reads as stock asset
- Canvas ring floor: coarse woven texture, faint chalk residue
- Rope: manila/hemp texture on the ring posts, not a smooth CG cylinder

---

## The Signature: The Wrap Ritual

This replaces the "floating glove rotates on Y-axis" hero — that shot is the single most overused move in 3D product hero design right now, and it's decorative rather than mechanical (nothing the user does changes it).

**Sequence, tied directly to scroll position (GSAP ScrollTrigger, `scrub: true` — the wrap's progress *is* the user's scroll progress, not a decoration running alongside it):**

1. Cold open on black. A single practical bulb flickers on, lighting a bare hand and forearm resting on a wooden bench.
2. As the user scrolls, a length of cotton hand-wrap spools out and winds around the hand knuckle by knuckle — scroll position drives wrap position 1:1. A small chalk-dust puff kicks off at each knuckle pass (cheap camera-facing GPU sprites, not a volumetric sim).
3. At full wrap, the hand closes into a fist. Hard cut (not a morph) to the leather glove sliding on — gold trim catches one rim-light as it settles. This is the one moment Signal Crimson appears, as a thin kicker light along the glove's edge.
4. The wordmark **JC Muay-Thai** locks into frame as the fist closes, with the negative space of the type punching through where the fist lands — a considered relationship between type and subject, not overlap for its own sake.
5. Sub-copy holds static underneath. No animation here — restraint after the payoff.
6. Continued scroll pulls the camera back through gym dust into the wider space for Section 02. Same underlying "reveal on scroll" mechanic as the original brief, just motivated by an actual camera move through an environment instead of an object flying off-screen.

**Copy for this moment** (replacing "Unleash Your Inner Fighter," which could sit on any gym site in the country):
- H1: `JC Muay-Thai`
- Sub: "Jersey City's Muay Thai gym for well over a decade. Real technique, real coaching, real people — beginner to fight-ready."

---

## 3D & Motion Engineering

**Asset pipeline:** glTF 2.0, Draco-compressed, texture-atlased. Three LOD tiers — LOD0 (desktop, real-time cloth sim on the wrap), LOD1 (tablet, simplified geometry + baked lighting), LOD2 (mobile/low-end — the wrap sequence becomes a pre-baked looping video-sprite instead of live WebGL, so mobile still hits 60fps instead of running a degraded version of the desktop scene).

**Camera & lighting rig:** one warm practical key light (~3200K, like a pull-chain bulb) + one gold-tinted bounce fill implied off the canvas floor. Crimson is the one rim-light kicker described above and nowhere else in the hero. Camera parallax is subtle and mouse-driven — a damped ±15px range, not a full free-look drag.

**Shader & particle work:**
- Chalk dust: instanced GPU sprites that respond to *scroll velocity* — more kicks up on fast scrolls, settles when the user pauses. Motion tied to real behavior, not looping ambiently.
- A single post-process pass (subtle film grain + vignette) across the whole page for a consistent cinematic read, instead of per-element shader effects stacked everywhere.
- The one reserved shader hover-distortion lives on the [GALLERY] only — executed well, not spread across every image and link on the site.

**Cursor system:** replace "cursor turns into a transparent inverse circle that distorts text" with a small precision reticle — a thin gold ring that tightens like a focus-mitt target on hover. Magnetic pull only on primary CTAs, ~24px capture radius, spring-damped rather than an instant snap.

**Transition choreography:** one smooth-scroll library (Lenis) driving a single coordinated GSAP ScrollTrigger timeline, so every section advances off one scrub track instead of independent scroll listeners fighting each other — this is what keeps a heavily-animated site feeling directed instead of chaotic.

**Sound design (optional, muted by default, toggle visible):** a soft leather-thud on primary CTA click, a faint wrap-tightening whoosh at the hero's fist-close beat. Nothing loops, nothing fires on hover — sound fatigue is a fast way to undercut a premium feel.

---

## Section-by-Section Rebuild

### 01 — Hero
Covered above (The Wrap Ritual). Nav stays minimal and transparent: `[CLASSES] [SCHEDULE] [GALLERY] [SHOP]`, with `[CONTACT US]` as the one hard-edged gold-outlined button — no neon pulse on load; the pulse (subtle, slow) only activates after the hero sequence completes, so it reads as an invitation, not a default.

### 02 — Heritage & Trust
Keep the asymmetric split — `[EST. > 10 YEARS IN JERSEY CITY]` is real, defensible content, not a decorative stat. Animate the numeral like it's being engraved into a belt plate (gold-leaf fill wiping in left-to-right) rather than a generic counting-up tick, which is the default for every "years in business" stat on the internet. Wireframe ring mesh in the background stays, but drop the parallax speed so it reads as texture, not another competing animation.

### 03 — Class Selection
Three-tier structure is legitimate here — it's a real skill progression, so the `01/02/03` numbering earns its place (unlike most decorative numbered markers). Keep the three cards, but:
- Swap "morphing" between 3D assets for a **rack focus** — foreground/background swap with a quick depth-of-field pull, cheaper to run and reads more intentional than a full morph.
- Materials matter more than the assets themselves: chalk-scuffed canvas on the heavy bag, sweat-worn leather on the Thai pads, visible brass buckle wear on the belt. That's what sells "real gym," not the asset count.

### 04 — Schedule Matrix
Lean into the monospace data typeface here — treat each time slot like a ticket stub, not a calendar app UI. The marquee banner stays, but animate it as chalk being written across a board (a stroke-draw-on effect) rather than a default CSS scroll-marquee — small, cheap, and specific to the gym.

### 05 — Contact & Footer
Keep the terrain map with the pulsing location pin — that's a genuinely good, grounded idea from the original brief. Swap "neon border on input focus" for a thin gold hairline that draws in on focus (matches the material language instead of introducing a new neon moment this late in the page).

---

## Performance & Accessibility Guardrails

- Real QA bar: **60fps on a mid-range Android** (e.g. a Pixel 7a-class device), not just a high-end iPhone — this is the actual bar top-tier WebGL studios build to.
- `prefers-reduced-motion`: swap the scroll-scrubbed wrap sequence for a static hero frame + simple fade-ins. No exceptions.
- Full keyboard navigation with a visible gold focus outline (not the browser default blue) on every interactive element — schedule grid, class cards, and the contact form included.
- LOD2 mobile fallback (baked video-sprite instead of live WebGL) is not a downgrade to apologize for — it's the same craft discipline the best studios in this space already build to.

---

## Anti-Slop Build Checklist

- [ ] One signature moment carries the page. Everything else is quiet by comparison.
- [ ] Every particle/shader effect is triggered by something real — scroll velocity, cursor proximity, a click — never purely ambient looping.
- [ ] Signal Crimson appears once per screen, maximum.
- [ ] No glassmorphic panels anywhere on the site.
- [ ] Every line of copy is specific to this gym — cut anything that could sit on any fitness site in the country.
- [ ] If an effect can only be described as "cool 3D thing floats and rotates," cut it or re-ground it in something a fighter actually does.