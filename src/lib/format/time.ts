/**
 * Time helpers for the class schedule.
 *
 * Schedule times are stored as 24-hour "HH:MM" strings rather than the
 * display strings the mockup used ("9–10a · 5–6p"). Display strings cannot
 * be sorted, compared against the current time, or reused by the booking
 * system — every consumer would have to re-parse them, and each parser
 * would drift. Storing the machine form and formatting at the edge means
 * one representation feeds the schedule table, the "in session now" check
 * and, later, the booking rows.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight. Throws on malformed input. */
export function toMinutes(hhmm: string): number {
  const match = TIME_PATTERN.exec(hhmm);
  if (!match) {
    throw new Error(
      `Invalid time "${hhmm}" — expected 24-hour "HH:MM", e.g. "09:00" or "19:30".`,
    );
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Duration of a session in minutes. */
export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

function meridiem(hhmm: string): "AM" | "PM" {
  return toMinutes(hhmm) < 12 * 60 ? "AM" : "PM";
}

/** "09:00" -> "9:00 AM" */
export function formatTime(hhmm: string): string {
  const total = toMinutes(hhmm);
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem(hhmm)}`;
}

/**
 * "09:00", "10:00" -> "9:00 – 10:00 AM"
 * "11:00", "12:30" -> "11:00 AM – 12:30 PM"
 *
 * The shared suffix is dropped when both ends fall in the same half of the
 * day. Repeating "AM" twice in a four-word range is noise, and the schedule
 * grid is read as a scannable column.
 */
export function formatRange(start: string, end: string): string {
  const from = formatTime(start);
  const to = formatTime(end);
  if (meridiem(start) === meridiem(end)) {
    return `${from.replace(/ (AM|PM)$/, "")} – ${to}`;
  }
  return `${from} – ${to}`;
}

/** "09:00" -> "9"; "16:45" -> "4:45". Drops a zero minute and the suffix. */
function clockLabel(hhmm: string): string {
  const total = toMinutes(hhmm);
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes === 0
    ? String(hours12)
    : `${hours12}:${String(minutes).padStart(2, "0")}`;
}

/**
 * "09:00", "10:00" -> "9–10 AM"
 * "11:00", "12:30" -> "11 AM–12:30 PM"
 *
 * The dense form, for the schedule grid where four of these stack inside a
 * single card. ":00" carries no information — nobody reads "9 AM" as
 * ambiguous — and dropping it takes the longest line from 33 characters to
 * 16, which is the difference between the grid fitting a phone and needing
 * a sideways scroll.
 */
export function formatRangeCompact(start: string, end: string): string {
  const from =
    meridiem(start) === meridiem(end)
      ? clockLabel(start)
      : `${clockLabel(start)} ${meridiem(start)}`;
  return `${from}–${clockLabel(end)} ${meridiem(end)}`;
}

/** "90" -> "90 min"; a range collapses when both ends match. */
export function formatDurationRange(min: number, max: number): string {
  return min === max ? `${min} min` : `${min}–${max} min`;
}
