type AlertProps = {
  tone: "error" | "success" | "warning";
  children: React.ReactNode;
};

const TONE_CLASSES: Record<AlertProps["tone"], string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-accent/40 bg-accent/10 text-accent-strong",
  warning: "border-accent/40 bg-accent/10 text-accent-strong",
};

export function Alert({ tone, children }: AlertProps) {
  return (
    <div
      // assertive: these announce the outcome of a submit the user just made,
      // so a screen reader should interrupt rather than queue.
      role="alert"
      aria-live="assertive"
      className={`rounded-[14px] border px-4 py-3 text-sm leading-relaxed backdrop-blur-sm ${TONE_CLASSES[tone]}`}
    >
      {children}
    </div>
  );
}
