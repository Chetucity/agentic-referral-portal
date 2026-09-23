import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Fill } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = {
  title: "Privacy policy",
  description: `How ${env.appName} collects, uses and deletes your personal data.`,
};

/**
 * Privacy policy.
 *
 * Google Play requires a privacy policy at a public URL that loads without
 * signing in, and the Data safety form in the Play Console has to agree with
 * what this page says. The section headings below map onto that form
 * deliberately — "What we collect" is the data-types list, "Who we share it
 * with" is the third-party section, and "Deleting your data" is the URL Play
 * asks for separately.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated={LEGAL.lastUpdated}>
      <Section heading="Who we are">
        <p>
          {env.appName} is operated by <Fill value={LEGAL.operatorName} />, at{" "}
          <Fill value={LEGAL.address} />. You can reach us at{" "}
          <Fill value={LEGAL.supportEmail} /> or <Fill value={LEGAL.phone} />.
        </p>
        <p>
          This policy explains what we collect when you use {env.appName}, why,
          and what you can do about it.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>
          <strong>Account details.</strong> Your name, email address and
          password. The password is never stored in a readable form — it is
          hashed with scrypt and a per-account random salt.
        </p>
        <p>
          <strong>Profile details you choose to add.</strong> Your headline,
          location, skills, experience summary, LinkedIn or portfolio link, and
          a short bio.
        </p>
        <p>
          <strong>Resumes you build here.</strong> If you use the resume
          builder, the contents of the resume are stored against your account so
          you can come back to them and attach them to a referral request.
        </p>
        <p>
          <strong>Referral activity.</strong> Which openings you asked about,
          who you asked, the note you sent, and every status change with its
          timestamp. This history is the product — it is what lets everyone
          involved see where a request stands.
        </p>
        <p>
          <strong>Company and posting details</strong>, if you are a recruiter
          or an employee linked to a company.
        </p>
        <p>
          We do not collect location data, contacts, photos, device identifiers
          for advertising, or anything from other apps on your device.
        </p>
      </Section>

      <Section heading="Who can see what">
        <p>
          Your profile, your headline and your skills are visible to other
          signed-in users. Your email address is not shown publicly.
        </p>
        <p>
          A resume you build here stays private until you attach it to a
          referral request. Attaching it makes it readable by the specific
          employee you asked and by recruiters at that company — nobody else,
          and not your other resumes.
        </p>
        <p>
          A referral and its history are visible to the three parties it
          involves: you, the employee you asked, and the recruiting team at that
          company.
        </p>
      </Section>

      <Section heading="Who we share it with">
        <p>
          We do not sell your personal data, and we do not share it with
          advertisers.
        </p>
        <p>
          We use service providers to run the product — hosting and a managed
          database. They process data on our instructions only. We may disclose
          data if we are legally required to.
        </p>
      </Section>

      <Section heading="How it is protected">
        <p>
          Data is encrypted in transit using HTTPS. Sessions use signed,
          HTTP-only cookies. Every action that reads or writes your data checks
          on the server who is asking, rather than trusting the app.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          We keep your account data until you delete your account. Referral
          history is retained while the account exists, because it is a shared
          record — the other people on a referral can see it too.
        </p>
      </Section>

      <Section heading="Deleting your data">
        <p>
          You can delete your account and everything attached to it at{" "}
          <Link href="/account/delete" className="text-brand-700 underline">
            {env.siteUrl}/account/delete
          </Link>
          . Deletion removes your profile, your resumes, your notifications and
          your referral requests.
        </p>
        <p>
          Where a referral involved another person, the record of the status
          changes may be retained in anonymised form so their own history stays
          coherent. It will no longer identify you.
        </p>
        <p>
          You can also email <Fill value={LEGAL.supportEmail} /> and ask us to
          do it for you.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can access, correct, export or delete your personal data. Most of
          this you can do yourself from your profile; for anything else, email{" "}
          <Fill value={LEGAL.supportEmail} /> and we will respond within 30
          days.
        </p>
      </Section>

      <Section heading="Children">
        <p>
          {env.appName} is not intended for anyone under 18, and we do not
          knowingly collect data from children.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes materially we will update the date at the top
          and, where the change affects how we use data you have already given
          us, tell you in the app.
        </p>
      </Section>
    </LegalPage>
  );
}
