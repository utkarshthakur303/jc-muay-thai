import { ACCEPTED_TYPES } from "@/lib/images/dimensions";
import { MAX_UPLOAD_BYTES } from "@/lib/admin/photos";

/**
 * What the panel will and will not take, said once and plainly.
 *
 * ── WHY THIS IS WORTH A BOX OF ITS OWN ──────────────────────────────
 * The upload forms already carry a one-line hint, but a hint is only
 * read by someone who has not yet hit the problem. The problem is HEIC:
 * it is what an iPhone saves by default, it is most of what this gym
 * photographs with, and a refused upload tells the owner the file could
 * not be read without telling him that his camera is the reason or what
 * to change. The client asked for this note on 2026-08-31.
 *
 * The accepted list is derived from `ACCEPTED_TYPES` and the limit from
 * `MAX_UPLOAD_BYTES` rather than typed out, so a screen that says what
 * the server does cannot drift away from what the server does.
 */

/**
 * How each accepted type is written for a person. Keyed by the MIME
 * types the parser accepts, so adding a format to `ACCEPTED_TYPES`
 * without naming it here shows up as a blank on the screen rather than
 * as a format nobody was told about.
 */
const NAMES: Record<string, { name: string; extensions: string }> = {
  "image/jpeg": { name: "JPEG", extensions: ".jpg, .jpeg" },
  "image/png": { name: "PNG", extensions: ".png" },
  "image/webp": { name: "WebP", extensions: ".webp" },
};

export function PhotoFormatsNote() {
  const megabytes = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

  return (
    <section
      aria-labelledby="formats"
      className="mt-6 rounded-card border border-border px-5 py-5 sm:px-6"
    >
      <h2
        id="formats"
        className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase"
      >
        What you can upload
      </h2>

      <dl className="mt-4 flex flex-col gap-4 text-[13px] leading-relaxed">
        <div>
          <dt className="font-semibold text-text">
            Three formats, up to {megabytes} MB each
          </dt>
          <dd className="mt-1 text-text-2">
            <ul role="list" className="flex flex-wrap gap-x-5 gap-y-1">
              {ACCEPTED_TYPES.map((type) => (
                <li key={type} className="font-mono text-[12px] text-text-2">
                  {NAMES[type]?.name}{" "}
                  <span className="text-text-3">{NAMES[type]?.extensions}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-text">
            Not HEIC — which is what an iPhone saves by default
          </dt>
          <dd className="mt-1 max-w-prose text-text-2">
            If a photograph straight off your phone is refused, this is
            almost always why. Two ways round it: on the iPhone, open{" "}
            <span className="font-mono text-[12px]">
              Settings → Camera → Formats
            </span>{" "}
            and choose <strong className="font-semibold">Most Compatible</strong>,
            which makes every photograph you take from then on a JPEG. Or, for
            one you have already taken, take a screenshot of it — a screenshot
            is always a PNG.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-text">
            HEIF, AVIF, GIF, TIFF, BMP, SVG, RAW, PDF and video are all refused
          </dt>
          <dd className="mt-1 max-w-prose text-text-2">
            Every upload is opened and read here before it is stored, so
            renaming a file to <span className="font-mono text-[12px]">.jpg</span>{" "}
            does not get it in. Nothing is saved when a file is refused — you
            get a message saying what was wrong and the picture on the site is
            untouched.
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-text">
            Sideways photographs are turned the right way up
          </dt>
          <dd className="mt-1 max-w-prose text-text-2">
            A phone held upright records a wide photograph plus a note telling
            the viewer to rotate it. That note is read here, so what you see in
            the preview is what goes on the site.
          </dd>
        </div>
      </dl>
    </section>
  );
}
