import { ContactDetails } from "@/components/contact/ContactDetails";
import { ContactForm } from "@/components/contact/ContactForm";
import { Section } from "@/components/layout/Section";
import { site } from "@/content/site";

/**
 * Contact.
 *
 * The form leads and takes the wider column, because it is the only
 * channel this site can currently guarantee — every direct detail in the
 * mockup was a placeholder, and the panel beside it shows only what has
 * been confirmed.
 *
 * The two columns swap to a single stack below lg with the form first, so
 * a phone user reaches the thing that works without scrolling past the
 * thing that is waiting on the client.
 */
export function ContactSection() {
  return (
    <Section
      id="contact"
      title="CONTACT"
      /* Stated, not promised. "We answer every message" would be a
         commitment made on the gym's behalf that nothing here can keep. */
      meta={site.firstClassFree ? "Your first class is free" : undefined}
      intro="Questions about a class, a level, or booking your first free session — send them here."
    >
      {/*
        `lg:items-start` so the details panel sizes to its own content
        instead of stretching to match the form. Stretched, it renders as
        a mostly-empty card the height of a five-field form, which reads
        as something that failed to load rather than something with less
        to say.
      */}
      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-6">
        <ContactForm />
        <ContactDetails />
      </div>
    </Section>
  );
}
