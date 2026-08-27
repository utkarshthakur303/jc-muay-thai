import { AdminShell } from "@/components/admin/AdminShell";
import { GalleryList } from "@/components/admin/GalleryList";
import { PhotoUploadForm } from "@/components/admin/PhotoUploadForm";
import { SlotCard } from "@/components/admin/SlotCard";
import { GALLERY_SLOT, IMAGE_SLOTS } from "@/content/imageSlots";
import { requireAdmin } from "@/lib/admin/guard";
import { getPhotoState } from "@/lib/admin/photos";

/**
 * Every photograph on the site, in one place.
 *
 * Until now all ten were string literals pointing at files in
 * `public/images`, so changing the hero meant a developer, a commit and
 * a deploy — which meant it was never changed. Eight of the ten are
 * stock pictures chosen for the mockup: a generic fighter, generic
 * gloves, a generic silhouette. Only two are this gym, and they were
 * carried across by hand on 2026-08-18.
 *
 * That is the thing this page is for. A gym's photographs are the most
 * persuasive part of its website, and this one has been advertising
 * itself with pictures of somewhere else.
 *
 * TWO SECTIONS, BECAUSE THEY BEHAVE DIFFERENTLY. The fixed slots are
 * positions in the layout — one picture each, cropped to a shape the
 * page decides, replaceable. The gallery is a list — any number, in an
 * order the owner sets, cropped not at all.
 */

export const metadata = { title: "Photos" };

export default async function AdminPhotosPage() {
  await requireAdmin();

  const { gallery, slots, source } = await getPhotoState();
  const editable = source === "database";

  return (
    <AdminShell
      current="/admin/photos"
      heading="Photos"
      lead="Every picture on the site. Replacing one puts it live straight away."
    >
      {/*
        No controls at all on the fallback path. The pictures below are
        the ones compiled into the build; they have no row and no id, so
        a Replace button over one could not do what it says. Saying so is
        the honest version — and members keep seeing the right photographs
        either way.
      */}
      {editable ? null : (
        <div className="mt-5 rounded-card border border-danger px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-text">
            <strong className="font-semibold">
              Photo management is not switched on yet.
            </strong>{" "}
            The <code className="font-mono text-[13px]">site_images</code> table
            and its storage bucket have not been created, so what you see below
            is what is built into the site rather than anything you can change.
            Run the migration{" "}
            <code className="font-mono text-[13px]">
              20260823120000_site_images.sql
            </code>{" "}
            and this page starts working. The site looks exactly the same to
            visitors in the meantime.
          </p>
        </div>
      )}

      <section aria-labelledby="fixed" className="mt-8">
        <h2
          id="fixed"
          className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase"
        >
          Fixed positions
        </h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-text-2">
          Each of these is one picture in one place. They are cropped to fit
          the space, so you will be shown exactly what gets cut before anything
          is saved.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {IMAGE_SLOTS.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              image={slots[slot.id]}
              editable={editable}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="gallery" className="mt-12">
        <h2
          id="gallery"
          className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase"
        >
          Gallery · {gallery.length}{" "}
          {gallery.length === 1 ? "photograph" : "photographs"}
        </h2>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-text-2">
          The grid on the home page. Every photograph keeps its own shape —
          nothing here is cropped — and the order below is the order they
          appear in.
        </p>

        {gallery.length === 0 ? (
          /*
            The client's call on 2026-08-23: an empty gallery hides the
            section rather than resurrecting the stock photographs. Which
            means this state is a live change to the public page, and the
            owner has to be told so rather than left looking at an empty
            list wondering whether it saved.
          */
          <p className="mt-4 rounded-card border border-border px-5 py-4 text-sm leading-relaxed text-text-2">
            There are no gallery photographs, so the gallery section does not
            appear on the home page at all. Add one below and it comes back.
          </p>
        ) : (
          <GalleryList photos={gallery} editable={editable} />
        )}

        {editable ? (
          <div className="mt-8 rounded-card border border-border px-5 py-5 sm:px-6">
            <h3 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
              Add a gallery photograph
            </h3>
            <PhotoUploadForm
              slot={GALLERY_SLOT}
              shapes={[]}
              needsAlt
              submitLabel="Add photograph"
            />
          </div>
        ) : null}
      </section>

      <p className="mt-10 max-w-prose text-[13px] leading-relaxed text-text-3">
        Changes take effect straight away, on the home page and everywhere else
        the picture appears. Photographs taken sideways on a phone are turned
        the right way up automatically.
      </p>
    </AdminShell>
  );
}
