import { isSupabaseConfigured } from "@/lib/env";

/**
 * Development-only banner shown while the app is pointed at placeholder
 * Supabase credentials. Without it, sign-in fails with an opaque network
 * error and the cause is easy to misdiagnose as a code bug.
 *
 * Renders nothing in production, and nothing once real keys are present.
 */
export function ConfigNotice() {
  if (isSupabaseConfigured || process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="mb-6 rounded-[14px] border border-accent/40 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-accent">
      <strong className="font-semibold">Not connected yet.</strong> This is the
      finished sign-in screen running on placeholder credentials, so the buttons
      won&apos;t authenticate. Add the real Supabase keys to{" "}
      <code className="font-mono">.env.local</code> to make it live — see{" "}
      <code className="font-mono">SETUP-AUTH.md</code>.
    </div>
  );
}
