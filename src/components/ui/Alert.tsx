type AlertProps = {
  tone: "error" | "success" | "warning";
  children: React.ReactNode;
};

const TONE_CLASSES: Record<AlertProps["tone"], string> = {
  error: "border-crimson/40 bg-crimson/10 text-crimson",
  success: "border-accent/40 bg-accent/10 text-accent",
  warning: "border-accent/40 bg-accent/10 text-accent",
};

export function Alert({ tone, children }: AlertProps) {
  return (
    <div
      // assertive: these announce the outcome of a submit the user just made,
      // so a screen reader should interrupt rather than queue.
      role="alert"
      aria-live="assertive"
      className={`rounded-[14px] border px-4 py-3 text-sm leading-relaxed ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  );
}
