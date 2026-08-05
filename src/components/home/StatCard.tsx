import { TiltCard } from "@/components/ui/TiltCard";

/**
 * A single headline fact.
 *
 * The mockup drew an animated line graph under each of these. Both were
 * decorative — the paths were hand-drawn curves that encoded nothing. Set
 * beside a real number, a rising line reads as evidence for it, which is
 * the one thing a chart must never do dishonestly. They are gone; the
 * space goes to a caption that is true.
 */
export function StatCard({
  label,
  value,
  className = "",
  children,
}: {
  /** Small mono caption above the number. */
  label: string;
  value: string;
  /**
   * Grid placement, supplied by the caller. Stated explicitly rather than
   * left to grid auto-flow: the hero occupies column 1 across all three
   * rows, and auto-placement around a spanning item depends on flow order
   * in ways that quietly change the moment a tile is added.
   */
  className?: string;
  /** Optional supporting content below the number. */
  children?: React.ReactNode;
}) {
  return (
    <TiltCard
      className={`card-surface card-hover flex flex-col justify-center p-5 sm:p-6 lg:row-start-1 lg:p-[clamp(16px,2vw,28px)] ${className}`}
    >
      <p className="label-mono">{label}</p>
      <p className="mt-1.5 font-display text-5xl leading-none text-text">
        {value}
      </p>
      <span aria-hidden className="mt-4 block h-0.5 w-10 rounded-full bg-accent" />
      {children ? <div className="mt-3">{children}</div> : null}
    </TiltCard>
  );
}
