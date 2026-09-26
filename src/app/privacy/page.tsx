import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Privacy Policy" };

const CONTACT =
  "https://github.com/auliasochib/remotefromapac/issues";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: September 26, 2026 · Applies to
          remotefromapac.vercel.app (&quot;RemoteFromAPAC&quot;, &quot;we&quot;)
        </p>

        <Section title="1. Data we collect">
          <p>
            <strong className="text-foreground">Account data.</strong> When you
            sign in with GitHub or Google, we store your email address, display
            name and profile image URL from that provider. We never see your
            provider password.
          </p>
          <p>
            <strong className="text-foreground">Resume data.</strong> If you
            upload a resume, we extract its text (capped) and derived signals —
            detected skills and stated years of experience. The file itself is
            never stored on our servers. You can delete the stored resume at any
            time from the Dashboard.
          </p>
          <p>
            <strong className="text-foreground">Saved jobs and alerts.</strong>{" "}
            Jobs you bookmark, and keyword alerts you create, are stored
            associated with your account.
          </p>
          <p>
            <strong className="text-foreground">Payment records.</strong> For
            premium purchases we store the Midtrans order ID, amount, status and
            resulting entitlement. <strong>We never receive or store your card
            number or other payment credentials</strong> — those are handled
            entirely by Midtrans.
          </p>
          <p>
            <strong className="text-foreground">Server logs.</strong> Standard
            request logs (including IP address) are kept by our hosting provider
            for security and abuse prevention.
          </p>
        </Section>

        <Section title="2. How your data is used">
          <p>
            Account data identifies you and stores your preferences. Resume
            text and derived skills power job matching, the resume review and
            cover letter generation. Saved jobs and alerts power your bookmarks
            and notifications. Payment records track your premium entitlement.
          </p>
          <p>We do not sell your personal data, and we do not run
            advertising or third-party analytics trackers on the site.
          </p>
        </Section>

        <Section title="3. Third parties we share data with">
          <p>
            <strong className="text-foreground">Authentication providers</strong>{" "}
            (GitHub / Google) — sign-in only; we receive your basic profile.
          </p>
          <p>
            <strong className="text-foreground">Midtrans</strong> — payment
            processing. Card numbers and payment credentials go directly to
            Midtrans under its own privacy policy.
          </p>
          <p>
            <strong className="text-foreground">
              AI provider (currently DeepSeek)
            </strong>{" "}
            — when you use premium AI features (resume review, cover letter),
            the stored text of your resume and the relevant job description are
            sent to the AI provider to generate the output. This is disclosed
            in the product. Job matching scores and the rule-based review run
            on our own infrastructure and involve no third-party AI.
          </p>
          <p>
            <strong className="text-foreground">Hosting</strong> — Vercel, Inc.
            (application and logs) and MongoDB Atlas (database).
          </p>
        </Section>

        <Section title="4. Retention and deletion">
          <p>
            Your stored resume (text and derived skills) is kept until you
            delete it — the Dashboard has a one-click{" "}
            <strong className="text-foreground">Remove</strong> button that
            erases it immediately and permanently.
          </p>
          <p>
            Saved jobs and alerts are kept until you remove them. Payment
            records are retained as required for accounting. To delete your
            entire account data, contact us (below) and we will erase it within
            7 days.
          </p>
        </Section>

        <Section title="5. Cookies">
          <p>
            We set a single essential cookie for your sign-in session
            (Auth.js). We use no advertising, tracking or analytics cookies.
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>
            You can access, correct or delete your data at any time: delete your
            resume from the Dashboard, manage saved jobs and alerts in the app,
            or contact us for full account erasure. Depending on your
            jurisdiction (including Indonesia&apos;s PDP Law and Singapore&apos;s
            PDPA) you may have additional statutory rights over your personal
            data.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            All traffic is served over HTTPS. Secrets are stored encrypted in
            the hosting provider&apos;s environment and never committed to the
            public repository. Database access is restricted by credentials.
            No system is perfectly secure — please do not upload resumes
            containing information you would not share publicly.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Questions, data requests or complaints: open an issue at{" "}
            <a
              href={CONTACT}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              github.com/auliasochib/remotefromapac
            </a>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}
