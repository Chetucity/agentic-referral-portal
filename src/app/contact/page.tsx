import { LEGAL } from "@/lib/legal";
import { LegalPage, Section, Fill } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = {
  title: "Contact",
  description: `How to reach the team behind ${env.appName}.`,
};

/**
 * Contact page.
 *
 * Reachable without signing in, on purpose: Play's review, and anyone trying
 * to exercise a data right, needs to be able to find a way to reach a human
 * without first creating an account.
 */
export default function ContactPage() {
  return (
    <LegalPage title="Contact" updated={LEGAL.lastUpdated}>
      <Section heading="Get in touch">
        <p>
          {env.appName} is operated by <Fill value={LEGAL.operatorName} />.
        </p>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </dt>
            <dd className="mt-0.5 text-slate-800">
              <Fill value={LEGAL.supportEmail} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Phone
            </dt>
            <dd className="mt-0.5 text-slate-800">
              <Fill value={LEGAL.phone} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Address
            </dt>
            <dd className="mt-0.5 text-slate-800">
              <Fill value={LEGAL.address} />
            </dd>
          </div>
        </dl>
      </Section>

      <Section heading="Privacy and data requests">
        <p>
          To access, correct, export or delete your data, email{" "}
          <Fill value={LEGAL.supportEmail} /> — or delete your account yourself
          at <span className="font-medium">/account/delete</span>. We respond to
          data requests within 30 days.
        </p>
      </Section>

      <Section heading="Reporting a problem">
        <p>
          If someone is misusing the platform — claiming to work somewhere they
          do not, or asking for payment in exchange for a referral — tell us at{" "}
          <Fill value={LEGAL.supportEmail} /> and we will look into it.
        </p>
      </Section>
    </LegalPage>
  );
}
