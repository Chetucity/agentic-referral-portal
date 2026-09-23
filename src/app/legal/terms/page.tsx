import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Fill } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = {
  title: "Terms of use",
  description: `The terms you agree to when using ${env.appName}.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated={LEGAL.lastUpdated}>
      <Section heading="Agreement">
        <p>
          These terms govern your use of {env.appName}, operated by{" "}
          <Fill value={LEGAL.operatorName} />. By creating an account you agree
          to them.
        </p>
      </Section>

      <Section heading="What the service does">
        <p>
          {env.appName} lists job openings, shows which employees at a company
          have volunteered to refer candidates, and tracks a referral request
          through to its outcome.
        </p>
        <p>
          We are not an employer, a recruitment agency, or a party to any hiring
          decision. We do not guarantee that a referral will be accepted, that
          an interview will follow, or that any job exists as described — the
          companies posting them are responsible for their own listings.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You are responsible for what happens under your account and for
          keeping your password to yourself. Tell us at{" "}
          <Fill value={LEGAL.supportEmail} /> if you think someone else has
          access to it.
        </p>
        <p>
          You must be at least 18. One person, one account. Do not impersonate
          anyone, and do not claim to work at a company you do not work at —
          that claim is the entire basis on which someone decides whether to
          trust a referral.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>send referral requests in bulk or automate them;</li>
          <li>post an opening that does not exist, or that you are not authorised to post;</li>
          <li>upload anything unlawful, misleading, or that infringes someone else&apos;s rights;</li>
          <li>harvest other users&apos; details, by scraping or otherwise;</li>
          <li>offer or accept payment in exchange for a referral;</li>
          <li>attempt to access data belonging to anyone else.</li>
        </ul>
        <p>
          We can suspend or remove an account that does any of these, without
          notice where the behaviour is causing harm.
        </p>
      </Section>

      <Section heading="Content you provide">
        <p>
          You keep ownership of everything you write or upload — your profile,
          your resumes, your messages. You grant us the licence needed to store
          it and show it to the people the product is designed to show it to,
          and nothing broader.
        </p>
        <p>
          You are responsible for the accuracy of what you say about yourself.
        </p>
      </Section>

      <Section heading="Referrals between users">
        <p>
          A referral is a voluntary act between two people. An employee is under
          no obligation to accept a request, and may decline without giving a
          reason. We do not mediate disputes about referrals, and we do not
          compensate anyone for a referral that did not lead to a hire.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          The service is provided as-is. We do not promise it will be
          uninterrupted or error-free, and we may change or withdraw features.
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          To the extent the law allows, we are not liable for indirect or
          consequential loss, including lost employment opportunities, lost
          earnings, or loss of data. Nothing here excludes liability that cannot
          lawfully be excluded.
        </p>
      </Section>

      <Section heading="Ending your use">
        <p>
          You can delete your account at any time from{" "}
          <span className="font-medium">/account/delete</span>. We may close an
          account that breaches these terms.
        </p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by the laws of India, and the courts of{" "}
          {LEGAL.jurisdiction} have exclusive jurisdiction.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          <Fill value={LEGAL.operatorName} />, <Fill value={LEGAL.address} />.
          Email <Fill value={LEGAL.supportEmail} />.
        </p>
      </Section>
    </LegalPage>
  );
}
