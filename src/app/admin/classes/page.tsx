import { AdminShell } from "@/components/admin/AdminShell";
import { ClassCalendar, type ClassMeta } from "@/components/admin/ClassCalendar";
import { site } from "@/content/site";
import { listClasses } from "@/lib/admin/classes";
import { requireAdmin } from "@/lib/admin/guard";
import { buildCalendar } from "@/lib/booking/calendar";
import { BOOKING_WINDOW_DAYS } from "@/lib/booking/horizon";

/**
 * Classes, picked off a calendar rather than scrolled through.
 *
 * The window is {@link BOOKING_WINDOW_DAYS}, matching /book exactly, so the
 * gym is looking at the same span its members are. Anything past that is
 * not shown because it is not reliably generated — see the horizon
 * invariant.
 */

export const metadata = { title: "Classes" };

export default async function AdminClassesPage() {
  await requireAdmin();

  const classes = await listClasses(BOOKING_WINDOW_DAYS);

  /**
   * Every date is formatted here, on the server, in the gym's zone. The
   * calendar component receives strings and does no date work at all — if
   * it did, the owner checking the timetable while travelling would be
   * shown his own local times for classes happening in Jersey City.
   */
  const model = buildCalendar(
    classes.map((klass) => ({
      id: klass.id,
      startsAt: klass.startsAt,
      endsAt: klass.endsAt,
      level: klass.level,
      spotsLeft: klass.spotsLeft,
      /*
        Meaningless here — it means "the viewer holds a booking on this",
        and the gym is not a participant. Passed false rather than plumbing
        an optional through a model that four other things depend on.
      */
      booked: false,
    })),
    {
      now: new Date(),
      timeZone: site.timeZone,
      windowDays: BOOKING_WINDOW_DAYS,
    },
  );

  /** Occupancy and cancellation, which the booking-shaped model omits. */
  const meta: Record<string, ClassMeta> = {};
  for (const klass of classes) {
    meta[klass.id] = {
      capacity: klass.capacity,
      bookedCount: klass.bookedCount,
      cancelled: klass.cancelled,
      note: klass.cancellationNote,
    };
  }

  return (
    <AdminShell
      current="/admin/classes"
      heading="Classes"
      lead={`Pick a day to see what is on and who is coming. ${model.totalClasses} ${
        model.totalClasses === 1 ? "class" : "classes"
      } over the next ${BOOKING_WINDOW_DAYS} days.`}
    >
      <ClassCalendar model={model} meta={meta} />
    </AdminShell>
  );
}
