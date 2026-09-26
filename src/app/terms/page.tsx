import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Terms of Service" };

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

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: September 26, 2026 · Applies to
          remotefromapac.vercel.app (&quot;RemoteFromAPAC&quot;, &quot;we&quot;)
        </p>

        <Section title="1. The service">
          <p>
            RemoteFromAPAC aggregates publicly available remote job postings
            from job boards and company career pages, presents them in one
            searchable dashboard focused on the Asia-Pacific region, and offers
            optional AI-assisted tools (job matching, resume review, cover
            letters) powered by third-party AI providers.
          </p>
        </Section>

        <Section title="2. No guarantee of employment or accuracy">
          <p>
            Job listings come from third-party sources and may be outdated,
            inaccurate or withdrawn without notice — always verify details on
            the original posting before applying. We do not guarantee that use
            of the service will result in employment, interviews or any
            outcome.
          </p>
          <p>
            AI-generated output (match scores, reviews, cover letters) is
            automated and may contain errors or omissions. Treat it as
            assistance, not advice — you are responsible for verifying facts
            and for anything you submit to an employer.
          </p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <p>
            scrape, harvest or systematically download data from the service;
            resell or redistribute the aggregated data; attempt to circumvent
            rate limits, access controls or payment; upload files that are not
            your own resume; or use the service in violation of applicable law
            or the terms of the underlying data sources.
          </p>
        </Section>

        <Section title="4. Accounts">
          <p>
            You are responsible for activity under your sign-in. You may stop
            using the service at any time; see the Privacy Policy for data
            deletion.
          </p>
        </Section>

        <Section title="5. Payments">
          <p>
            Paid features are offered as (a) a single AI search credit, or (b)
            a 30-day premium pass, processed by Midtrans. Prices are shown
            before purchase. Search credits do not expire and are consumed only
            by successful AI-powered searches. The premium pass is active for 30
            days from payment and does not auto-renew.
          </p>
          <p>
            Because premium entitlements activate immediately after a
            successful payment, purchases are generally non-refundable; where
            consumer protection law in your jurisdiction requires a refund,
            contact us and we will handle it in accordance with that law. If a
            paid feature is materially unavailable for more than 24 hours, ask
            for a remedy and we will extend your entitlement or refund it.
          </p>
        </Section>

        <Section title="6. Intellectual property">
          <p>
            Job content belongs to the originating employers and job boards and
            is displayed with attribution and links to the original postings.
            The site&apos;s code and design are published under the license in
            the public repository.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            The service is provided &quot;as is&quot; without warranties of any
            kind. To the maximum extent permitted by law, we are not liable for
            indirect, incidental or consequential damages, or for any loss
            arising from reliance on aggregated listings or AI-generated
            content.
          </p>
        </Section>

        <Section title="8. Changes">
          <p>
            We may update these terms; material changes will be reflected in
            the &quot;last updated&quot; date. Continued use after changes means
            acceptance. Governing law: Indonesian law, without prejudice to
            mandatory consumer protections in your country of residence.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions: open an issue at{" "}
            <a
              href="https://github.com/auliasochib/remotefromapac/issues"
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
