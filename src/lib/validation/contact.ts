import { z } from "zod";

import { emailSchema } from "@/lib/validation/fields";

/**
 * The contact enquiry.
 *
 * Three fields, matching the approved design. Every extra field on a
 * contact form costs completions, and a gym does not need a subject line
 * to answer "when can I come in?".
 *
 * The bounds are not decoration — they are mirrored by CHECK constraints
 * on the table, so the same limits hold whether a message arrives through
 * this form or through anything else that ever writes to that table. The
 * upper bounds also cap what a single request can push into the database,
 * which is the cheapest possible defence against someone posting a
 * megabyte of text a thousand times.
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(80, "That name is too long"),
  email: emailSchema,
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least a sentence")
    .max(2000, "Please keep it under 2000 characters"),
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * Honeypot field name.
 *
 * Rendered, visually hidden, and left empty by anyone using a browser
 * normally. Bots fill every input they find, so a non-empty value here is
 * a near-certain signal — and the response to that signal is a normal
 * success message with nothing written, because telling a bot it was
 * caught only teaches whoever wrote it to stop filling the field.
 *
 * "website" rather than something obviously fake: naming it `honeypot`
 * defeats the point.
 */
export const HONEYPOT_FIELD = "website";
