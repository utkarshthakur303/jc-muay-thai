# Contact form — the two steps that make it live

The form is built, validated, rate-limited and wired. It does **not** silently
pretend to work: until step 1 below is done, submitting it returns

> Something went wrong saving your message. Please try again in a moment.

which is the truth. It will never show "message sent" unless a row was
actually committed. That is the one behaviour worth protecting — the design
mockup's version told everyone their message had been sent and sent nothing.

---

## Step 1 — Create the table (required)

The migration is checked in at:

```
web/supabase/migrations/20260805120000_contact_messages.sql
```

Easiest route — **Supabase dashboard → SQL Editor → New query**, paste the file
contents, Run. It is idempotent (`create table if not exists`), so running it
twice is harmless.

Or from the CLI, with the database password from project creation:

```bash
cd web
supabase db push \
  --db-url "postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
```

> If that connection times out, the direct host is IPv6-only. Use the
> **session pooler** string from Supabase → Project Settings → Database
> instead (it is IPv4 and works from any network).

**Verify it worked:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/contact_messages?select=id&limit=1" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

`200` = ready. `404` = not applied yet.

Then submit the real form once and confirm the row lands in
**Table Editor → contact_messages**.

### About the access model

RLS is enabled and there are **no policies**, deliberately. A table with RLS on
and no policy denies everything, so the publishable key every visitor holds
cannot read enquiries, insert them, or count them. The only way in is the
`sb_secret_*` key, server-side.

This is what makes the rate limit real. Had anonymous inserts been allowed, the
5-per-hour limit would be one `curl` loop away from irrelevant.

---

## Step 2 — Turn on notification email (recommended before launch)

Without this the enquiry is still **stored safely** — nothing is lost — but
nobody is told about it, so someone has to open the Supabase table to find it.
That is fine for a day and not fine for a month.

Set these three in **Vercel → Project → Settings → Environment Variables**, then
redeploy:

| Variable | Value | Questionnaire |
|---|---|---|
| `RESEND_API_KEY` | From resend.com, after domain verification | Q1.9 |
| `CONTACT_FROM_EMAIL` | A verified sender, e.g. `noreply@jcmuaythai.com` | Q1.9 |
| `CONTACT_NOTIFICATION_EMAIL` | Where enquiries should land | Q1.10 |

All three are required together; with any one missing the code logs
`Enquiry stored but not emailed` and carries on. Replies go to the enquirer,
not to the no-reply sender, because the notification sets `reply_to`.

---

## Also required in Vercel

`SUPABASE_SECRET_KEY` must be present in the Vercel project. It is what the
form writes with. If it is missing in production the form returns an honest
error rather than failing quietly — but it returns it to every visitor.

Check with `vercel env ls` before deploying.

---

## Publishing the contact details

`web/src/content/contact` lives in `src/content/site.ts` as `contactChannels`.
Every entry is currently `confirmed: false`, so **none of them render**. The
email address, phone number, Instagram handle and street address in the mockup
were all invented placeholders, and a wrong phone number on a live site sends
real customers to a stranger.

Once the client answers Q2.1–Q2.4, change the value and flip `confirmed` to
`true`. Nothing else needs touching — the contact panel picks them up, links
them correctly (`mailto:`, `tel:`, Instagram) and stops showing the "listed
here shortly" line on its own.

---

## What is deliberately not built

**Bot protection beyond the honeypot.** `TURNSTILE_SECRET_KEY` and
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` slots exist in `.env.local.example` but no
Turnstile widget is wired up. The honeypot plus the per-IP hourly limit is the
right first line; a visible CAPTCHA costs conversions and should only be added
if spam actually arrives.

**A read interface.** There is no admin screen for the inbox yet — the Supabase
Table Editor is it. Building one properly needs the admin decision in
questionnaire Q3.5.
