import { AdminShell } from "@/components/admin/AdminShell";
import { EnquiryCard } from "@/components/admin/EnquiryCard";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/guard";
import { getInbox } from "@/lib/admin/enquiries";
import { formatInstant } from "@/lib/format/classTime";

/**
 * Messages sent through the contact form on the home page.
 *
 * Until now these landed in a table nobody could read without opening the
 * Supabase dashboard, which means that in practice they landed nowhere.
 * The form has always stored them correctly and always told the sender the
 * truth; this is the other half — somebody at the gym actually seeing them.
 *
 * Timestamps are formatted here, on the server, in the gym's zone. The card
 * receives strings and does no date work, so an owner reading his inbox
 * from a hotel in another country still sees when a message arrived in
 * Jersey City.
 */

export const metadata = { title: "Enquiries" };

export default async function AdminEnquiriesPage() {
  await requireAdmin();

  const { waiting, handled } = await getInbox();

  const lead =
    waiting.length > 0
      ? `${waiting.length} ${waiting.length === 1 ? "message needs" : "messages need"} a reply. Oldest first.`
      : "Messages sent through the contact form on the website.";

  return (
    <AdminShell current="/admin/enquiries" heading="Enquiries" lead={lead}>
      {waiting.length === 0 && handled.length === 0 ? (
        <div className="mt-10 max-w-prose text-sm leading-relaxed text-text-2">
          <p>
            <strong className="font-semibold text-text">
              Nothing here yet.
            </strong>{" "}
            Nobody has sent a message through the contact form.
          </p>
          {/*
            Said out loud because an empty inbox has two causes and they
            need opposite responses. The gym should not have to guess which
            one it is looking at — and if messages were being lost, an
            empty page that looked normal is exactly how it would stay
            hidden.
          */}
          <p className="mt-4">
            An empty inbox is normal for a site this new, but it looks the same
            as one that is not receiving. If you expected a message and it is
            not here, say so — the form itself is verified, so the thing to
            check would be the keys on the live site.
          </p>
        </div>
      ) : null}

      {waiting.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Waiting ({waiting.length})
          </h2>
          <ul role="list" className="mt-3 flex flex-col gap-3">
            {waiting.map((enquiry) => (
              <EnquiryCard
                key={enquiry.id}
                enquiry={enquiry}
                receivedLabel={formatInstant(enquiry.receivedAt, site.timeZone)}
                handledLabel={null}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {handled.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
            Dealt with ({handled.length})
          </h2>
          {/*
            Kept on the page rather than hidden behind a filter. Nothing in
            this system deletes an enquiry, and "what did that person ask
            us last month" is the question the archive exists to answer.
          */}
          <ul role="list" className="mt-3 flex flex-col gap-3">
            {handled.map((enquiry) => (
              <EnquiryCard
                key={enquiry.id}
                enquiry={enquiry}
                receivedLabel={formatInstant(enquiry.receivedAt, site.timeZone)}
                handledLabel={
                  enquiry.handledAt
                    ? formatInstant(enquiry.handledAt, site.timeZone)
                    : null
                }
              />
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
