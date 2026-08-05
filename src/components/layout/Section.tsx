/**
 * The frame every content section shares: spacing, heading, optional
 * right-aligned meta line, optional intro paragraph.
 *
 * Four sections were about to repeat the same three elements with the same
 * six utility strings. Pulled together here so the type scale and rhythm
 * are set once — and so `id`, the heading and the landmark name cannot get
 * out of step, which is exactly the drift that breaks nav anchors.
 *
 * The heading names the landmark via aria-labelledby, which is what
 * promotes a plain <section> to a navigable region. Screen-reader users
 * can then jump between Classes, Schedule, Gallery and Contact with the
 * same rotor the sighted nav gives everyone else.
 */
export function Section({
  id,
  title,
  meta,
  intro,
  children,
}: {
  id: string;
  title: string;
  /** Short mono line, baseline-aligned to the right of the heading. */
  meta?: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="mt-16 lg:mt-25">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <h2
          id={headingId}
          className="font-display text-[clamp(2.25rem,4vw,2.75rem)] tracking-[0.01em] text-text"
        >
          {title}
        </h2>
        {meta ? (
          <p className="font-mono text-xs tracking-[0.06em] text-text-2 uppercase">
            {meta}
          </p>
        ) : null}
      </div>

      {intro ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-2">
          {intro}
        </p>
      ) : null}

      {children}
    </section>
  );
}
