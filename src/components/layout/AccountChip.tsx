"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { readMemberCookie, type MemberDisplay } from "@/lib/auth/memberCookie";

/**
 * The account control in the top bar. "Sign in" for a visitor, a chip that
 * peeks at the member's name and email for someone signed in.
 *
 * Both are always in the DOM. Which one is visible is decided in CSS from
 * `<html data-member>`, set before first paint by the script in the root
 * layout — so this component never causes the swap, it only refills the
 * details. That is what lets the home page stay statically generated and
 * still greet a returning member correctly on the first frame.
 *
 * Decisions worth stating, because a hover panel is easy to get wrong:
 *
 * 1. **The chip is a link, not a menu button.** Everything you can do with
 *    an account — see it in full, sign out — already lives on /account.
 *    A menu here would be a second, smaller copy of that page that has to
 *    be kept in step with it, and it would put the sign-out control behind
 *    a hover, where a mis-aimed pointer can dismiss it. Click goes to the
 *    account; hover previews it.
 *
 * 2. **The panel opens on focus too, and closes on Escape.** WCAG 1.4.13
 *    requires content shown on hover to be dismissable without moving the
 *    pointer, hoverable, and persistent, unless it obscures nothing. This
 *    one drops over the page, so it needs all three: Escape dismisses it,
 *    the panel sits inside the hovered element so the pointer can travel
 *    into it, and nothing but the user closes it.
 *
 * 3. **Touch never opens it.** A tap that both navigates and reveals a
 *    panel does neither clearly, and the panel would be gone before it was
 *    read. Pointer events are filtered to mouse and pen; a tap simply goes
 *    to /account, which shows the same two fields properly.
 *
 * The panel is toggled with visibility rather than unmounted, so it can
 * fade and so screen readers do not see it while it is closed.
 */
export function AccountChip() {
  const [member, setMember] = useState<MemberDisplay | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const found = readMemberCookie();
    setMember(found);

    /**
     * Re-asserts what the pre-paint script decided. It has to happen here
     * as well, because that script runs once per document load and a
     * sign-in finishes with a client-side navigation — after which the
     * cookie has changed but no new document was parsed. This also
     * corrects the case where the cookie exists but does not decode.
     */
    const root = document.documentElement;
    if (found) root.setAttribute("data-member", "");
    else root.removeAttribute("data-member");
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Touch reports pointerType "touch" and would otherwise open the panel on
  // the tap that is already navigating away.
  const isHoverPointer = (pointerType: string) =>
    pointerType === "mouse" || pointerType === "pen";

  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }, []);

  return (
    <>
      <Link
        href="/login"
        className="guest-only flex min-h-11 items-center rounded-full px-2.5 font-mono text-[12px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:text-accent-strong sm:px-4"
      >
        Sign in
      </Link>

      <div
        className="member-only relative flex items-center"
        onPointerEnter={(event) => {
          if (isHoverPointer(event.pointerType)) setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (isHoverPointer(event.pointerType)) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      >
        <Link
          href="/account"
          aria-label="Your account"
          aria-describedby={member ? panelId : undefined}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-2 transition-colors hover:border-accent hover:text-accent-strong"
        >
          <Icon name="user" size={18} />
        </Link>

        {member ? (
          <div
            id={panelId}
            className={`absolute top-full right-0 mt-2 w-60 rounded-2xl border border-border bg-card p-4 shadow-lift transition-all duration-200 ease-out ${
              open
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-1 opacity-0"
            }`}
          >
            {/* text-2, not text-3. The muted-most token measures 4.14:1
                dark and 3.63:1 light on a card, and at 10px this is normal
                text, so the floor is 4.5:1 — a label nobody can read is
                not a subtle label. */}
            <p className="font-mono text-[10px] tracking-widest text-text-2 uppercase">
              Signed in as
            </p>

            {/* A member with no name is the normal case for a Google
                account that never set one, not an error state. */}
            <p className="mt-2 text-sm leading-snug font-medium wrap-break-word text-text">
              {member.name ?? "Member"}
            </p>

            {member.email ? (
              <p className="mt-0.5 font-mono text-[11px] leading-snug break-all text-text-2">
                {member.email}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
