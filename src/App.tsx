import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

// ─── Palette ────────────────────────────────────────────────────
const C = {
  void: '#0B0B0C',
  onyx: '#121214',
  gold: '#C5A880',
  goldDim: 'rgba(197,168,128,0.35)',
  crimson: '#FF2A4B',
  bone: '#EDEAE2',
  boneDim: 'rgba(237,234,226,0.55)',
  canvas: '#3A3733',
  canvasDim: 'rgba(58,55,51,0.6)',
}

// ─── Custom Cursor ───────────────────────────────────────────────
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -100, y: -100 })
  const [tight, setTight] = useState(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY } }
    document.addEventListener('mousemove', onMove)

    const onEnter = (e: Event) => {
      const t = e.currentTarget as HTMLElement
      if (t.dataset.cta !== undefined) setTight(true)
    }
    const onLeave = () => setTight(false)

    const ctaEls = document.querySelectorAll('[data-cta]')
    ctaEls.forEach(el => {
      el.addEventListener('mouseenter', onEnter as EventListener)
      el.addEventListener('mouseleave', onLeave)
    })

    let raf: number
    const tick = () => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      ctaEls.forEach(el => {
        el.removeEventListener('mouseenter', onEnter as EventListener)
        el.removeEventListener('mouseleave', onLeave)
      })
    }
  }, [])

  return (
    <div
      ref={dotRef}
      style={{
        position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999,
        willChange: 'transform',
      }}
    >
      <div
        style={{
          width: 6, height: 6, borderRadius: '50%',
          backgroundColor: C.gold,
          transform: `translate(-50%, -50%) scale(${tight ? 1.8 : 1})`,
          transition: 'transform 0.2s ease',
        }}
      />
    </div>
  )
}

// ─── Watermark — faint centered wordmark behind every section but the hero ──
function Watermark() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <span style={{
        fontFamily: "'Anton', 'Barlow Condensed', sans-serif",
        fontSize: 'clamp(100px, 16vw, 260px)',
        color: 'rgba(237,234,226,0.025)',
        letterSpacing: '0.01em',
        lineHeight: 1,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        JC Muay-Thai
      </span>
    </div>
  )
}

// ─── Nav ─────────────────────────────────────────────────────────
function Nav({ ctaReady }: { ctaReady: boolean }) {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '28px 48px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 18, fontWeight: 900, color: C.gold,
        letterSpacing: '0.18em', textTransform: 'uppercase',
      }}>
        JC Muay-Thai
      </span>
      <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
        {[['CLASSES', '#classes'], ['SCHEDULE', '#schedule'], ['GALLERY', '#gallery'], ['SHOP', '#shop']].map(([label, href]) => (
          <a
            key={label}
            href={href}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11, fontWeight: 500, color: C.boneDim,
              letterSpacing: '0.22em', textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.bone)}
            onMouseLeave={e => (e.currentTarget.style.color = C.boneDim)}
          >
            {label}
          </a>
        ))}
        <a
          href="#contact"
          data-cta
          className={ctaReady ? 'cta-pulse' : ''}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11, fontWeight: 500, color: C.gold,
            letterSpacing: '0.22em', textDecoration: 'none',
            padding: '9px 22px',
            border: `1px solid ${C.gold}`,
            display: 'inline-block',
            transition: 'background 0.2s, color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = C.gold
            e.currentTarget.style.color = C.void
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = C.gold
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          CONTACT US
        </a>
      </div>
    </nav>
  )
}

// ─── Hero / Wrap Ritual ──────────────────────────────────────────
function HeroSection({ onComplete }: { onComplete: () => void }) {
  const bufferRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const bulbRef = useRef<HTMLDivElement>(null)
  const handGroupRef = useRef<HTMLDivElement>(null)
  const sheenRef = useRef<SVGEllipseElement>(null)
  const wrap1Ref = useRef<SVGPathElement>(null)
  const wrap2Ref = useRef<SVGPathElement>(null)
  const wrap3Ref = useRef<SVGPathElement>(null)
  const wrap4Ref = useRef<SVGPathElement>(null)
  const wrap5Ref = useRef<SVGPathElement>(null)
  const wrapShadeRefs = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)]
  const rimRef = useRef<HTMLDivElement>(null)
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const scrollHintRef = useRef<HTMLDivElement>(null)
  const chalkRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

  useEffect(() => {
    // Bulb flicker
    if (bulbRef.current) {
      bulbRef.current.classList.add('bulb-on')
    }

    // Idle skin sheen — a slow breathing highlight so the hand reads as alive
    // even before the user starts scrolling. Independent of the scroll timeline.
    const sheenTween = sheenRef.current
      ? gsap.to(sheenRef.current, { opacity: 0.55, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      : null


    // Measure path lengths
    const paths = [wrap1Ref.current, wrap2Ref.current, wrap3Ref.current, wrap4Ref.current, wrap5Ref.current]
    paths.forEach(p => {
      if (!p) return
      const len = p.getTotalLength()
      p.style.strokeDasharray = String(len)
      p.style.strokeDashoffset = String(len)
    })

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: bufferRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
        onUpdate: (self) => {
          if (self.progress > 0.88) {
            onComplete()
          }
          // Chalk dust puffs at knuckle passes
          chalkRefs.forEach((ref, i) => {
            const threshold = 0.3 + i * 0.15
            if (ref.current) {
              ref.current.style.opacity = self.progress > threshold && self.progress < threshold + 0.12
                ? String((self.progress - threshold) / 0.06)
                : '0'
            }
          })
          // Cylindrical highlight sheen on each wrap band, synced to its reveal
          wrapShadeRefs.forEach((ref, i) => {
            const threshold = 0.22 + i * 0.14
            if (ref.current) {
              ref.current.style.opacity = self.progress > threshold ? '1' : '0'
            }
          })
        },
      },
    })

    // Subtle tightening — the fist flexes almost imperceptibly as the wrap
    // is applied, settling firm by the time the last band lands.
    tl.fromTo(handGroupRef.current,
      { scale: 1.015, rotate: -1.1 },
      { scale: 0.99, rotate: 0, ease: 'none', duration: 1.9, transformOrigin: '50% 68%' },
      0,
    )

    // Reveal wraps sequentially
    tl.to(wrap1Ref.current, { strokeDashoffset: 0, ease: 'none' }, 0)
    tl.to(wrap2Ref.current, { strokeDashoffset: 0, ease: 'none' }, 0.14)
    tl.to(wrap3Ref.current, { strokeDashoffset: 0, ease: 'none' }, 0.28)
    tl.to(wrap4Ref.current, { strokeDashoffset: 0, ease: 'none' }, 0.44)
    tl.to(wrap5Ref.current, { strokeDashoffset: 0, ease: 'none' }, 0.6)

    // Rim light
    tl.to(rimRef.current, { opacity: 1, ease: 'none' }, 0.72)

    // Fade scroll hint
    tl.to(scrollHintRef.current, { opacity: 0, ease: 'none' }, 0.1)

    // Fonts (Anton/Barlow) swap in asynchronously and can reflow the page
    // after ScrollTrigger has already measured start/end pixel positions —
    // the classic cause of a scroll animation that "does nothing." Re-measure
    // once fonts are actually ready, and once more after full load (images).
    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready?.then(refresh)
    window.addEventListener('load', refresh)

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill())
      sheenTween?.kill()
      window.removeEventListener('load', refresh)
    }
  }, [])

  const handPath = `
    M 160 440
    L 142 310 Q 138 260 148 235
    L 155 215 Q 158 185 162 165
    Q 165 150 172 148 Q 180 147 183 165
    L 185 185 Q 186 198 191 198 Q 197 198 199 185
    L 200 158 Q 202 140 210 139 Q 219 139 220 158
    L 221 186 Q 222 198 228 198 Q 234 198 236 186
    L 237 162 Q 239 143 248 143 Q 257 143 258 162
    L 258 188 Q 259 200 265 200 Q 271 200 273 188
    L 274 168 Q 276 152 283 152 Q 291 152 292 168
    L 292 208 Q 290 228 278 240
    L 268 256 Q 264 268 264 288
    L 266 320 Q 276 365 278 440 Z
  `

  return (
    <div ref={bufferRef} style={{ height: '200vh', position: 'relative' }}>
      <div
        ref={stickyRef}
        style={{
          position: 'sticky', top: 0, height: '100vh',
          backgroundColor: C.void,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Background photograph — two fighters sparring, heavily faded into the void */}
        <img
          src="https://images.unsplash.com/photo-1726867825984-0582b27728b8?w=1600&h=1200&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            filter: 'brightness(0.28) saturate(0.35) grayscale(0.2)',
            opacity: 0.55,
          }}
        />
        {/* Dark blend overlay — keeps the photo subordinate to the void aesthetic */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(11,11,12,0.55) 0%, ${C.void} 100%)`,
        }} />

        {/* Practical bulb */}
        <div
          ref={bulbRef}
          style={{
            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: '#FFF4D0',
            boxShadow: '0 0 12px 4px rgba(255,235,140,0.5), 0 0 60px 20px rgba(255,220,100,0.12)',
            opacity: 0,
          }}
        />

        {/* Light cone */}
        <div style={{
          position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
          width: 700, height: '80vh',
          background: 'radial-gradient(ellipse 350px 500px at 50% 0%, rgba(255,235,160,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Chalk dust puffs */}
        {chalkRefs.map((ref, i) => (
          <div
            key={i}
            ref={ref}
            style={{
              position: 'absolute',
              top: `${35 + i * 8}%`,
              left: `${42 + i * 5}%`,
              width: 60, height: 60,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(220,210,190,0.25) 0%, transparent 70%)',
              filter: 'blur(8px)',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.1s',
            }}
          />
        ))}

        {/* Hand + Wrap SVG — kept running as an ambient background layer,
            dimmed and softened so the centered text reads as the focal point */}
        <div
          ref={handGroupRef}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 480, height: 640,
            transform: 'translate(-50%, -50%)',
            opacity: 0.5,
            filter: 'drop-shadow(0 24px 44px rgba(0,0,0,0.55))',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <svg
            viewBox="60 130 280 330"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* Hand skin — subtle vertical falloff instead of a flat fill */}
              <linearGradient id="handGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f1f22" />
                <stop offset="55%" stopColor="#17171a" />
                <stop offset="100%" stopColor="#0d0d0f" />
              </linearGradient>
              {/* Soft sheen across the back of the hand, near the knuckles */}
              <radialGradient id="knuckleSheen" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="rgba(255,244,220,0.28)" />
                <stop offset="100%" stopColor="rgba(255,244,220,0)" />
              </radialGradient>
              {/* Cylindrical highlight overlaid on each wrap band to sell the fabric roll */}
              <linearGradient id="wrapShade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,246,225,0.85)" />
                <stop offset="20%" stopColor="rgba(255,246,225,0.12)" />
                <stop offset="55%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(35,24,10,0.5)" />
              </linearGradient>
            </defs>

            {/* Hand silhouette */}
            <path d={handPath} fill="url(#handGrad)" stroke={C.canvas} strokeWidth="0.5" />

            {/* Knuckle bumps */}
            {[172, 195, 218, 240, 258].map((cx, i) => (
              <ellipse key={i} cx={cx} cy={i === 4 ? 205 : 200} rx={11} ry={7} fill="#1e1e21" />
            ))}

            {/* Idle skin sheen — breathes gently, independent of scroll */}
            <ellipse ref={sheenRef} cx={205} cy={185} rx={70} ry={55} fill="url(#knuckleSheen)" opacity={0.3} />

            {/* Wrap strip 1 — wrist/base */}
            <path
              ref={wrap1Ref}
              d="M 138 400 C 175 393 220 391 275 399"
              stroke="#D4BFA0" strokeWidth="24" strokeLinecap="round" fill="none"
              style={{ strokeDasharray: 0, strokeDashoffset: 0 }}
            />
            {/* Cylindrical sheen — synced to this band's reveal */}
            <path
              ref={wrapShadeRefs[0]}
              d="M 138 400 C 175 393 220 391 275 399"
              stroke="url(#wrapShade)" strokeWidth="24" strokeLinecap="round" fill="none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.5s ease' }}
            />
            {/* Wrap thread lines on strip 1 */}
            <path
              d="M 138 400 C 175 393 220 391 275 399"
              stroke="rgba(160,130,90,0.35)" strokeWidth="1" strokeLinecap="round" fill="none"
              strokeDasharray="3 6"
            />

            {/* Wrap strip 2 */}
            <path
              ref={wrap2Ref}
              d="M 136 368 C 175 360 222 358 276 366"
              stroke="#C8B394" strokeWidth="22" strokeLinecap="round" fill="none"
            />
            <path
              ref={wrapShadeRefs[1]}
              d="M 136 368 C 175 360 222 358 276 366"
              stroke="url(#wrapShade)" strokeWidth="22" strokeLinecap="round" fill="none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.5s ease' }}
            />
            <path
              d="M 136 368 C 175 360 222 358 276 366"
              stroke="rgba(150,120,80,0.3)" strokeWidth="1" fill="none"
              strokeDasharray="3 6"
            />

            {/* Wrap strip 3 — mid palm */}
            <path
              ref={wrap3Ref}
              d="M 136 336 C 178 328 224 326 276 334"
              stroke="#D0BA9C" strokeWidth="20" strokeLinecap="round" fill="none"
            />
            <path
              ref={wrapShadeRefs[2]}
              d="M 136 336 C 178 328 224 326 276 334"
              stroke="url(#wrapShade)" strokeWidth="20" strokeLinecap="round" fill="none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.5s ease' }}
            />
            <path
              d="M 136 336 C 178 328 224 326 276 334"
              stroke="rgba(155,125,85,0.3)" strokeWidth="1" fill="none"
              strokeDasharray="3 6"
            />

            {/* Wrap strip 4 — upper palm */}
            <path
              ref={wrap4Ref}
              d="M 140 302 C 182 292 228 290 277 300"
              stroke="#BCA888" strokeWidth="18" strokeLinecap="round" fill="none"
            />
            <path
              ref={wrapShadeRefs[3]}
              d="M 140 302 C 182 292 228 290 277 300"
              stroke="url(#wrapShade)" strokeWidth="18" strokeLinecap="round" fill="none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.5s ease' }}
            />
            <path
              d="M 140 302 C 182 292 228 290 277 300"
              stroke="rgba(145,115,75,0.3)" strokeWidth="1" fill="none"
              strokeDasharray="3 6"
            />

            {/* Wrap strip 5 — knuckles */}
            <path
              ref={wrap5Ref}
              d="M 150 262 C 182 250 228 248 272 258"
              stroke="#C8B08A" strokeWidth="16" strokeLinecap="round" fill="none"
            />
            <path
              ref={wrapShadeRefs[4]}
              d="M 150 262 C 182 250 228 248 272 258"
              stroke="url(#wrapShade)" strokeWidth="16" strokeLinecap="round" fill="none"
              style={{ mixBlendMode: 'overlay', opacity: 0, transition: 'opacity 0.5s ease' }}
            />
            <path
              d="M 150 262 C 182 250 228 248 272 258"
              stroke="rgba(148,118,78,0.3)" strokeWidth="1" fill="none"
              strokeDasharray="3 6"
            />
          </svg>

          {/* Crimson rim light — one use for this screen */}
          <div
            ref={rimRef}
            style={{
              position: 'absolute',
              right: 40, top: '12%', bottom: '18%',
              width: 2,
              background: `linear-gradient(to bottom, transparent, ${C.crimson} 25%, ${C.crimson} 75%, transparent)`,
              opacity: 0,
              filter: 'blur(2px)',
              transition: 'opacity 0.3s',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 38, top: '20%', bottom: '26%',
              width: 10,
              background: `linear-gradient(to bottom, transparent, rgba(255,42,75,0.08) 30%, rgba(255,42,75,0.08) 70%, transparent)`,
              opacity: 0,
            }}
          />
        </div>

        {/* Centered hero copy — the focal point; the wrap animation runs
            behind it as ambient motion rather than competing for attention. */}
        <div
          ref={wordmarkRef}
          style={{
            position: 'relative', zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '0 24px', textAlign: 'center',
          }}
        >
          {/* Eyebrow */}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, fontWeight: 500,
            color: C.gold, letterSpacing: '0.42em',
            marginBottom: 20,
          }}>
            REAL TECHNIQUE. REAL FIGHTERS.
          </span>

          {/* Wordmark — bright, bold, and static from the first frame.
              The wrap animation behind it carries the motion; the title
              itself doesn't need to fade or wipe in to read as dramatic. */}
          <h1 style={{
            fontFamily: "'Anton', 'Barlow Condensed', sans-serif",
            fontSize: 'clamp(88px, 17vw, 200px)',
            fontWeight: 400,
            color: C.bone,
            letterSpacing: '0.01em',
            lineHeight: 0.86,
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 0 90px rgba(197,168,128,0.4), 0 4px 30px rgba(0,0,0,0.9)',
          }}>
            JC Muay-Thai
          </h1>

          {/* Gold rule */}
          <div style={{ width: 48, height: 2, background: C.gold, margin: '28px 0 24px' }} />

          {/* Sub-copy — static and dramatic; not tied to scroll */}
          <p
            ref={subRef}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 17, fontWeight: 300,
              color: C.boneDim,
              letterSpacing: '0.03em',
              lineHeight: 1.7,
              maxWidth: 520, margin: 0,
            }}
          >
            Jersey City's home for Muay Thai — over a decade of real coaching, real people, and{' '}
            <em style={{ color: C.gold, fontStyle: 'italic' }}>zero shortcuts</em>. Beginner to fight-ready.
          </p>
        </div>

        {/* Scroll hint */}
        <div
          ref={scrollHintRef}
          style={{
            position: 'absolute', bottom: 32, right: 48, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, color: C.goldDim, letterSpacing: '0.3em',
            writingMode: 'vertical-rl',
          }}>
            SCROLL
          </span>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${C.goldDim}, transparent)` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Heritage Section ────────────────────────────────────────────
function HeritageSection() {
  const statRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!sectionRef.current) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); obs.disconnect() }
    }, { threshold: 0.3 })
    obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="heritage"
      style={{
        position: 'relative', overflow: 'hidden',
        backgroundColor: C.void,
        padding: '140px 0',
        borderTop: `1px solid ${C.canvas}`,
      }}
    >
      <Watermark />
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 48px',
        display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 80, alignItems: 'center',
      }}>
        {/* Left — engraved stat */}
        <div>
          <div ref={statRef} style={{ position: 'relative', marginBottom: 32 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(96px, 14vw, 180px)',
              fontWeight: 900,
              lineHeight: 0.85,
              color: C.canvas,
              userSelect: 'none',
            }}>
              10+
            </div>
            {/* Gold wipe overlay */}
            <div
              style={{
                position: 'absolute', inset: 0,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 'clamp(96px, 14vw, 180px)',
                fontWeight: 900,
                lineHeight: 0.85,
                color: C.gold,
                clipPath: revealed ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
                transition: 'clip-path 1.4s cubic-bezier(0.16,1,0.3,1)',
                userSelect: 'none',
              }}
            >
              10+
            </div>
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18, fontWeight: 700,
            color: C.boneDim, letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            YEARS IN JERSEY CITY
          </div>
          <div style={{
            marginTop: 24,
            width: 48, height: 1,
            background: `linear-gradient(to right, ${C.gold}, transparent)`,
          }} />
        </div>

        {/* Right — copy */}
        <div>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 700,
            color: C.bone,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            marginBottom: 28,
            textTransform: 'uppercase',
          }}>
            EST. IN JERSEY CITY.<br />
            BUILT ON THE CANVAS.
          </p>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16, fontWeight: 300,
            color: C.boneDim,
            lineHeight: 1.75,
            maxWidth: 480,
            marginBottom: 24,
          }}>
            JC Muay Thai was opened with one rule: no shortcuts. More than a decade later, the same coaches, the same ring, the same commitment to technique over theatrics. We've trained first-timers and professional fighters under the same roof.
          </p>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 16, fontWeight: 300,
            color: C.boneDim,
            lineHeight: 1.75,
            maxWidth: 480,
          }}>
            If you want to learn Muay Thai the right way — not a watered-down fitness version — this is where you start.
          </p>
          <div style={{ marginTop: 40 }}>
            <a
              href="#classes"
              data-cta
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11, fontWeight: 500,
                color: C.bone, letterSpacing: '0.22em',
                textDecoration: 'none',
                padding: '12px 28px',
                border: `1px solid ${C.canvas}`,
                display: 'inline-block',
                transition: 'border-color 0.2s, color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.gold
                e.currentTarget.style.color = C.gold
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.canvas
                e.currentTarget.style.color = C.bone
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              VIEW CLASSES
            </a>
          </div>
        </div>
      </div>

      {/* Wireframe ring background — subtle texture */}
      <div style={{
        position: 'absolute',
        right: 0, top: '50%', transform: 'translateY(-50%)',
        width: 320, height: 320,
        borderRadius: '50%',
        border: `1px solid ${C.canvasDim}`,
        opacity: 0.3,
        pointerEvents: 'none',
      }} />
    </section>
  )
}

// ─── Classes Section ─────────────────────────────────────────────
const classData = [
  {
    num: '01',
    title: 'FUNDAMENTALS',
    sub: 'The foundation.',
    desc: 'Stance, guard, teep, round kick, and the clinch. We break technique down to its components and rebuild it properly. No prior experience required — we see beginners every week.',
    tag: 'ALL LEVELS',
    img: 'https://images.unsplash.com/photo-1611816153165-fed23698666d?w=600&h=800&fit=crop&auto=format',
    alt: 'Woman training with boxing gloves',
  },
  {
    num: '02',
    title: 'SPARRING',
    sub: 'Controlled contact.',
    desc: 'Technique under pressure, coached in real time. Rounds are light to moderate — this is a learning environment, not a tryout. Mouthguard and headgear required.',
    tag: 'INTERMEDIATE+',
    img: 'https://images.unsplash.com/photo-1726867825984-0582b27728b8?w=600&h=800&fit=crop&auto=format',
    alt: 'Two athletes sparring in the ring',
  },
  {
    num: '03',
    title: 'FIGHT PREP',
    sub: 'If you want to compete.',
    desc: 'Periodized conditioning, strategy sessions, and full-speed drilling for athletes preparing for amateur or professional bouts. By invitation — speak to a coach first.',
    tag: 'FIGHT TEAM',
    img: 'https://images.unsplash.com/photo-1636302925863-6ad504baaf3c?w=600&h=800&fit=crop&auto=format',
    alt: 'Fighter in training',
  },
]

function ClassesSection() {
  const [active, setActive] = useState(0)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  return (
    <section
      id="classes"
      style={{
        position: 'relative', overflow: 'hidden',
        backgroundColor: C.onyx, padding: '140px 0', borderTop: `1px solid ${C.canvas}`,
      }}
    >
      <Watermark />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 72, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 900, color: C.bone,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            lineHeight: 0.9, margin: 0,
          }}>
            CLASS<br />SELECTION
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: C.boneDim,
            maxWidth: 280, lineHeight: 1.6, margin: 0,
          }}>
            Three tiers. One progression. Talk to a coach if you're unsure where to start — most people begin in Fundamentals regardless of fitness background.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {classData.map((cls, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              onMouseEnter={() => setHoveredCard(i)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                background: 'none', border: 'none', padding: 0, textAlign: 'left',
                position: 'relative', overflow: 'visible',
                outline: 'none',
                transform: hoveredCard === i ? 'translateY(-10px)' : 'translateY(0)',
                boxShadow: hoveredCard === i ? '0 28px 44px rgba(0,0,0,0.45)' : '0 0 0 rgba(0,0,0,0)',
                transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease',
                willChange: 'transform',
              }}
            >
              {/* Image with depth-of-field effect */}
              <div style={{
                position: 'relative', height: 480,
                backgroundColor: C.void,
                overflow: 'hidden',
              }}>
                <img
                  src={cls.img}
                  alt={cls.alt}
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: active === i
                      ? 'brightness(0.65) saturate(0.7)'
                      : 'brightness(0.35) saturate(0.3) blur(1px)',
                    transform: active === i ? 'scale(1.02)' : 'scale(1)',
                    transition: 'filter 0.5s ease, transform 0.5s ease',
                  }}
                />
                {/* Overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(to top, ${C.void} 0%, transparent 55%)`,
                }} />

                {/* Active gold hairline top */}
                {active === i && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: 2,
                    background: C.gold,
                  }} />
                )}

                {/* Content overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  padding: '28px 28px 36px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11, color: C.goldDim, letterSpacing: '0.12em',
                    }}>
                      {cls.num}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9, color: C.boneDim, letterSpacing: '0.2em',
                      padding: '4px 10px',
                      border: `1px solid ${C.canvasDim}`,
                    }}>
                      {cls.tag}
                    </span>
                  </div>

                  {/* Bottom */}
                  <div>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12, fontWeight: 300, color: C.gold,
                      letterSpacing: '0.1em', marginBottom: 8,
                    }}>
                      {cls.sub}
                    </div>
                    <h3 style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 38, fontWeight: 900,
                      color: C.bone, letterSpacing: '-0.01em',
                      textTransform: 'uppercase', margin: '0 0 16px',
                    }}>
                      {cls.title}
                    </h3>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13, fontWeight: 300,
                      color: C.boneDim, lineHeight: 1.65,
                      opacity: active === i ? 1 : 0,
                      transform: active === i ? 'translateY(0)' : 'translateY(8px)',
                      transition: 'opacity 0.4s, transform 0.4s',
                      margin: 0,
                    }}>
                      {cls.desc}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Schedule Section ─────────────────────────────────────────────
const scheduleData = [
  {
    day: 'MON', slots: [
      { time: '06:30', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '17:30', cls: 'KIDS', dur: '45 MIN' },
      { time: '19:00', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '20:15', cls: 'ADVANCED', dur: '60 MIN' },
    ]
  },
  {
    day: 'TUE', slots: [
      { time: '06:30', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '19:00', cls: 'SPARRING', dur: '75 MIN' },
      { time: '20:30', cls: 'CONDITIONING', dur: '45 MIN' },
    ]
  },
  {
    day: 'WED', slots: [
      { time: '06:30', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '17:30', cls: 'KIDS', dur: '45 MIN' },
      { time: '19:00', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '20:15', cls: 'FIGHT PREP', dur: '75 MIN' },
    ]
  },
  {
    day: 'THU', slots: [
      { time: '06:30', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '19:00', cls: 'ADVANCED', dur: '60 MIN' },
      { time: '20:15', cls: 'SPARRING', dur: '75 MIN' },
    ]
  },
  {
    day: 'FRI', slots: [
      { time: '06:30', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '19:00', cls: 'FUNDAMENTALS', dur: '60 MIN' },
      { time: '20:15', cls: 'OPEN MAT', dur: '60 MIN' },
    ]
  },
  {
    day: 'SAT', slots: [
      { time: '10:00', cls: 'OPEN MAT', dur: '90 MIN' },
      { time: '12:00', cls: 'FUNDAMENTALS', dur: '60 MIN' },
    ]
  },
  {
    day: 'SUN', slots: [
      { time: '11:00', cls: 'OPEN GYM', dur: '120 MIN' },
    ]
  },
]

const todayAbbr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()]

function ScheduleSection() {
  const [selectedDay, setSelectedDay] = useState(todayAbbr)
  const day = scheduleData.find(d => d.day === selectedDay) ?? scheduleData[0]

  return (
    <section
      id="schedule"
      style={{
        position: 'relative', overflow: 'hidden',
        backgroundColor: C.void, padding: '140px 0', borderTop: `1px solid ${C.canvas}`,
      }}
    >
      <Watermark />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ marginBottom: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 900, color: C.bone,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            lineHeight: 0.9, margin: 0,
          }}>
            SCHEDULE<br />MATRIX
          </h2>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: C.goldDim, letterSpacing: '0.25em',
          }}>
            JERSEY CITY, NJ
          </span>
        </div>

        {/* Day selector — monospace ticket tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 2, overflowX: 'auto' }}>
          {scheduleData.map(({ day: d }) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.18em',
                padding: '10px 24px',
                border: 'none',
                backgroundColor: selectedDay === d ? C.gold : C.onyx,
                color: selectedDay === d ? C.void : C.canvas,
                cursor: 'none',
                transition: 'background 0.15s, color 0.15s, transform 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {d}
              {d === todayAbbr && selectedDay !== d && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 4, height: 4, borderRadius: '50%',
                  backgroundColor: C.crimson,
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Slot rows */}
        <div style={{ border: `1px solid ${C.canvas}` }}>
          {day.slots.map((slot, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 100px',
                borderBottom: i < day.slots.length - 1 ? `1px solid ${C.canvasDim}` : 'none',
                padding: '20px 28px',
                alignItems: 'center',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(18,18,20,0.4)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(197,168,128,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'transparent' : 'rgba(18,18,20,0.4)')}
            >
              {/* Time */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 20, fontWeight: 600,
                color: C.gold, letterSpacing: '0.04em',
              }}>
                {slot.time}
              </span>

              {/* Class name */}
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 26, fontWeight: 900,
                color: C.bone, letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {slot.cls}
              </span>

              {/* Duration */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: C.boneDim, letterSpacing: '0.2em',
                textAlign: 'right',
              }}>
                {slot.dur}
              </span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, color: C.canvas, letterSpacing: '0.18em',
          marginTop: 16, textAlign: 'right',
        }}>
          SCHEDULE SUBJECT TO CHANGE — CONFIRM VIA INSTAGRAM
        </p>
      </div>
    </section>
  )
}

// ─── Gallery Section ─────────────────────────────────────────────
const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1716307043003-dbe6a5cc496e?w=700&h=500&fit=crop&auto=format', alt: 'Boxing ring with gloves', span: 2 },
  { src: 'https://images.unsplash.com/photo-1601588462060-470011bd9a18?w=350&h=500&fit=crop&auto=format', alt: 'Athletes in training', span: 1 },
  { src: 'https://images.unsplash.com/photo-1607702713064-0143212236ae?w=350&h=480&fit=crop&auto=format', alt: 'Fighter in dark gym', span: 1 },
  { src: 'https://images.unsplash.com/photo-1620123449946-30d6efd4b8ba?w=350&h=480&fit=crop&auto=format', alt: 'Dark gym boots detail', span: 1 },
  { src: 'https://images.unsplash.com/photo-1561532325-7d5231a2dede?w=700&h=480&fit=crop&auto=format', alt: 'Red boxing gloves close-up', span: 2 },
]

function GallerySection() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <section
      id="gallery"
      style={{
        position: 'relative', overflow: 'hidden',
        backgroundColor: C.onyx, padding: '140px 0', borderTop: `1px solid ${C.canvas}`,
      }}
    >
      <Watermark />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ marginBottom: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 900, color: C.bone,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            lineHeight: 0.9, margin: 0,
          }}>
            GALLERY
          </h2>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10, color: C.goldDim, letterSpacing: '0.25em',
          }}>
            {galleryImages.length} FRAMES
          </span>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 3,
        }}>
          {galleryImages.map((img, i) => (
            <div
              key={i}
              style={{
                gridColumn: img.span === 2 ? 'span 2' : 'span 1',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: C.void,
                height: img.span === 2 ? 380 : 360,
                transform: hoveredIdx === i ? 'translateY(-8px)' : 'translateY(0)',
                boxShadow: hoveredIdx === i ? '0 22px 38px rgba(0,0,0,0.5)' : '0 0 0 rgba(0,0,0,0)',
                zIndex: hoveredIdx === i ? 2 : 1,
                transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <img
                src={img.src}
                alt={img.alt}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  filter: hoveredIdx === i
                    ? 'brightness(0.9) saturate(0.8) contrast(1.05)'
                    : 'brightness(0.6) saturate(0.4)',
                  transform: hoveredIdx === i ? 'scale(1.04)' : 'scale(1)',
                  transition: 'filter 0.6s ease, transform 0.6s ease',
                }}
              />
              {/* Shader-like hover distortion — CSS only */}
              {hoveredIdx === i && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'radial-gradient(ellipse at var(--mx, 50%) var(--my, 50%), rgba(197,168,128,0.08) 0%, transparent 60%)',
                  mixBlendMode: 'screen',
                  pointerEvents: 'none',
                }} />
              )}
              {/* Gold hairline on hover */}
              <div style={{
                position: 'absolute', inset: 0,
                border: hoveredIdx === i ? `1px solid rgba(197,168,128,0.5)` : '1px solid transparent',
                transition: 'border-color 0.3s',
                pointerEvents: 'none',
              }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Contact Section ──────────────────────────────────────────────
function ContactSection() {
  const [focused, setFocused] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const inputStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${focused === name ? C.gold : C.canvas}`,
    color: C.bone,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 15,
    fontWeight: 300,
    padding: '14px 0',
    outline: 'none',
    transition: 'border-color 0.3s',
    letterSpacing: '0.03em',
  })

  return (
    <section
      id="contact"
      style={{
        position: 'relative', overflow: 'hidden',
        backgroundColor: C.void, padding: '140px 0', borderTop: `1px solid ${C.canvas}`,
      }}
    >
      <Watermark />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, alignItems: 'start' }}>
          {/* Left — location */}
          <div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 900, color: C.bone,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              lineHeight: 0.9, margin: '0 0 48px',
            }}>
              FIND<br />THE GYM
            </h2>

            {/* Map placeholder — terrain style */}
            <div style={{
              position: 'relative',
              height: 280,
              backgroundColor: '#131410',
              border: `1px solid ${C.canvas}`,
              overflow: 'hidden',
              marginBottom: 36,
            }}>
              {/* Grid lines — terrain map */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left: `${(i + 1) * 12.5}%`,
                  borderLeft: `1px solid rgba(58,55,51,0.4)`,
                }} />
              ))}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  top: `${(i + 1) * 16.6}%`,
                  borderTop: `1px solid rgba(58,55,51,0.4)`,
                }} />
              ))}
              {/* Location label */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                {/* Pulsing pin */}
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: C.gold, margin: '0 auto',
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 24, height: 24, borderRadius: '50%',
                    border: `1px solid ${C.goldDim}`,
                    animation: 'cta-pulse 2s ease-in-out infinite',
                  }} />
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, color: C.gold, letterSpacing: '0.2em',
                }}>
                  JERSEY CITY, NJ
                </div>
              </div>
              {/* Map monospace labels */}
              {['GROVE ST', 'JOURNAL SQ', 'NEWPORT'].map((label, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: `${25 + i * 25}%`,
                  left: `${10 + i * 15}%`,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8, color: 'rgba(58,55,51,0.7)',
                  letterSpacing: '0.15em',
                }}>
                  {label}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['ADDRESS', 'Jersey City, NJ'],
                ['PHONE', '(201) 555-0147'],
                ['EMAIL', 'info@jcMuay-Thai.com'],
                ['HOURS', 'Mon–Fri 6:30am–9:30pm\nSat–Sun 10am–2pm'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, color: C.canvas, letterSpacing: '0.2em',
                    paddingTop: 2,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14, fontWeight: 300, color: C.boneDim,
                    whiteSpace: 'pre-line', lineHeight: 1.6,
                  }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            <p style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 32, fontWeight: 700,
              color: C.bone, letterSpacing: '-0.01em',
              textTransform: 'uppercase', marginBottom: 40,
            }}>
              START HERE.
            </p>

            {submitted ? (
              <div style={{ paddingTop: 60, textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 48, fontWeight: 900,
                  color: C.gold, letterSpacing: '-0.01em',
                  textTransform: 'uppercase', marginBottom: 16,
                }}>
                  RECEIVED.
                </div>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14, fontWeight: 300, color: C.boneDim,
                }}>
                  We'll be in touch within 24 hours.
                </p>
              </div>
            ) : (
              <form
                onSubmit={e => { e.preventDefault(); setSubmitted(true) }}
                style={{ display: 'flex', flexDirection: 'column', gap: 36 }}
              >
                {[
                  { name: 'name', label: 'FULL NAME', type: 'text', required: true },
                  { name: 'email', label: 'EMAIL ADDRESS', type: 'email', required: true },
                  { name: 'phone', label: 'PHONE (OPTIONAL)', type: 'tel', required: false },
                ].map(field => (
                  <div key={field.name} style={{ position: 'relative' }}>
                    <label style={{
                      position: 'absolute', top: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9, color: focused === field.name ? C.gold : C.canvas,
                      letterSpacing: '0.22em',
                      transition: 'color 0.3s',
                    }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      required={field.required}
                      style={{ ...inputStyle(field.name), paddingTop: 24 }}
                      onFocus={() => setFocused(field.name)}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                ))}

                <div style={{ position: 'relative' }}>
                  <label style={{
                    position: 'absolute', top: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, color: focused === 'message' ? C.gold : C.canvas,
                    letterSpacing: '0.22em',
                    transition: 'color 0.3s',
                  }}>
                    MESSAGE
                  </label>
                  <textarea
                    name="message"
                    rows={3}
                    style={{
                      ...inputStyle('message'),
                      paddingTop: 24,
                      resize: 'none',
                      display: 'block',
                    }}
                    onFocus={() => setFocused('message')}
                    onBlur={() => setFocused(null)}
                  />
                </div>

                <button
                  type="submit"
                  data-cta
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 18, fontWeight: 900,
                    color: C.void, backgroundColor: C.crimson,
                    border: 'none', padding: '18px 0',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    cursor: 'none',
                    transition: 'background 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
                    marginTop: 8,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = '#e02040'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 14px 28px rgba(255,42,75,0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = C.crimson
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 0 0 rgba(0,0,0,0)'
                  }}
                >
                  SEND MESSAGE
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      backgroundColor: C.onyx,
      borderTop: `1px solid ${C.canvas}`,
      padding: '48px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 22, fontWeight: 900,
        color: C.gold, letterSpacing: '0.18em',
      }}>
        JC Muay-Thai
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, color: C.canvas, letterSpacing: '0.22em',
      }}>
        © {new Date().getFullYear()} JC Muay-Thai — JERSEY CITY, NJ
      </span>
      <div style={{ display: 'flex', gap: 24 }}>
        {['INSTAGRAM', 'FACEBOOK'].map(s => (
          <a
            key={s}
            href="#"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: C.canvas, letterSpacing: '0.2em',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.gold)}
            onMouseLeave={e => (e.currentTarget.style.color = C.canvas)}
          >
            {s}
          </a>
        ))}
      </div>
    </footer>
  )
}

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [ctaReady, setCtaReady] = useState(false)

  useEffect(() => {
    // Lenis smooth scroll + GSAP ScrollTrigger integration
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const rafFn = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(rafFn)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(rafFn)
    }
  }, [])

  return (
    <div className="grain-overlay vignette" style={{ backgroundColor: C.void, position: 'relative' }}>
      <CustomCursor />
      <Nav ctaReady={ctaReady} />
      <HeroSection onComplete={() => setCtaReady(true)} />
      <HeritageSection />
      <ClassesSection />
      <ScheduleSection />
      <GallerySection />
      <ContactSection />
      <Footer />
    </div>
  )
}
