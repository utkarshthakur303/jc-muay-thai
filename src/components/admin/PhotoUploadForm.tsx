"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { SlotShape } from "@/content/imageSlots";
import { uploadPhotoAction } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";

/**
 * Choosing a photograph, describing it, and seeing what will happen to
 * it before it goes anywhere.
 *
 * ── WHY THE PREVIEW EXISTS ──────────────────────────────────────────
 * The fixed slots are boxes whose shape the layout decides, filled with
 * `object-cover` — so an uploaded picture is cropped, and the owner has
 * no way to know how much until it is already live on the home page.
 * Two of the three slots change shape between phone and desktop, and the
 * class cards change from landscape (1.09) to portrait (0.61), so a
 * photograph that survives one can be beheaded on the other.
 *
 * The client chose showing the crop over building a crop tool
 * (2026-08-23). The boxes below therefore use the SAME `object-cover`
 * and the SAME measured ratios as the real page, which is what makes
 * this a preview rather than an illustration.
 *
 * `URL.createObjectURL` on the local file — nothing is uploaded to draw
 * this, so choosing five photographs to compare costs no bandwidth and
 * leaves nothing behind if none of them is kept.
 * ────────────────────────────────────────────────────────────────────
 */

const FIELD =
  "min-h-11 w-full rounded-2xl border border-border bg-input-bg px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none";
const LABEL =
  "block font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full bg-accent px-6 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Uploading…" : label}
    </button>
  );
}

export function PhotoUploadForm({
  slot,
  shapes,
  needsAlt,
  submitLabel,
  currentAlt,
}: {
  slot: string;
  /** Empty for the gallery, which crops nothing. */
  shapes: readonly SlotShape[];
  needsAlt: boolean;
  submitLabel: string;
  /** Prefilled when replacing, so a description is not retyped. */
  currentAlt?: string;
}) {
  const [state, action] = useActionState(uploadPhotoAction, initialAdminState);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  /**
   * Object URLs are held by the document until revoked. Without this,
   * comparing a dozen photographs pins a dozen full-size images in
   * memory for as long as the tab is open.
   */
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const onPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(file ? URL.createObjectURL(file) : null);
    setFileName(file?.name ?? null);
  }, []);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
        setPreview(null);
        setFileName(null);
      }}
      className="mt-4 flex flex-col gap-4"
    >
      <input type="hidden" name="slot" value={slot} />

      <div>
        <label className={LABEL} htmlFor={`file-${slot}`}>
          Photograph
        </label>
        {/*
          `accept` is a convenience for the file picker and nothing more —
          it filters what the dialog shows and can be defeated by
          switching it to "All files". The real check is the server
          parsing the bytes; see lib/images/dimensions.ts.
        */}
        <input
          id={`file-${slot}`}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={onPick}
          className={`${FIELD} mt-1 file:mr-3 file:min-h-9 file:rounded-full file:border-0 file:bg-ink file:px-4 file:font-mono file:text-[10px] file:tracking-[0.08em] file:text-chalk file:uppercase`}
        />
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-3">
          JPEG, PNG or WebP, up to 8 MB. Photographs taken sideways on a
          phone are turned the right way up automatically.
        </p>
      </div>

      {preview ? (
        shapes.length > 0 ? (
          <div>
            <p className={LABEL}>
              How it will be cropped
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">
              This slot is a fixed shape, so anything outside the box below
              will not be seen. Nothing is cut off the file itself — only
              what shows on the page.
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {shapes.map((shape) => (
                <figure key={shape.label} className="flex flex-col gap-1.5">
                  <div
                    className="overflow-hidden rounded-2xl border border-border bg-input-bg"
                    style={{
                      // Matched to the real rendered box. The width is
                      // capped so a 3.17 strip and a 0.61 card can sit
                      // side by side without either dominating.
                      width: shape.ratio >= 1 ? 208 : 128,
                      aspectRatio: `${shape.ratio}`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        A blob: URL from the local disk. next/image cannot
                        take one, and there is nothing to optimise: this
                        never leaves the browser. */}
                    <img
                      src={preview}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                  <figcaption className="font-mono text-[10px] tracking-[0.08em] text-text-3 uppercase">
                    {shape.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className={LABEL}>How it will look</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">
              Gallery photographs keep their own shape — nothing is cropped.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="mt-3 max-h-56 w-auto rounded-2xl border border-border"
            />
          </div>
        )
      ) : null}

      <div>
        <label className={LABEL} htmlFor={`alt-${slot}`}>
          {needsAlt ? "Description (required)" : "Description"}
        </label>
        {needsAlt ? (
          <>
            <textarea
              id={`alt-${slot}`}
              name="alt"
              rows={2}
              required
              defaultValue={currentAlt ?? ""}
              placeholder="Two students working pads on the mat, one throwing a high kick"
              className={`${FIELD} mt-1 rounded-2xl`}
            />
            {/*
              Guidance rather than a rule, because the rule is easy and
              the judgement is not. "Photo of the gym" satisfies any
              validator and tells a blind visitor nothing.
            */}
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-3">
              Describe what is happening, as if to someone who cannot see it —
              who is in the picture and what they are doing. Skip &ldquo;photo
              of&rdquo; and &ldquo;image of&rdquo;; a screen reader already says
              so.
            </p>
          </>
        ) : (
          <>
            <input type="hidden" name="alt" value="" />
            <p className="mt-1 text-[12px] leading-relaxed text-text-3">
              Not needed here. This photograph sits behind text that already
              says everything it could — describing it as well would make a
              screen reader announce the picture and then read the heading
              describing it.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit label={submitLabel} />
        {fileName ? (
          <p className="text-[12px] text-text-3">{fileName}</p>
        ) : null}
      </div>

      {state.status !== "idle" && state.message ? (
        <p
          role="status"
          className={`text-sm leading-relaxed ${
            state.status === "error" ? "text-danger" : "text-text-2"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
