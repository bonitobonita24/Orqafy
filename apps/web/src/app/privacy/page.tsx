/**
 * Public Privacy Policy page — V32.9 / RA 10173 (Philippine Data Privacy Act)
 * Static server component. No client-side JS required.
 */
import type { Metadata } from "next";
import { ComplianceFooter } from "@/components/compliance-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Orqafy Privacy Policy — how we handle your data under RA 10173.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — Orqafy",
    description: "Orqafy Privacy Policy — how we handle your data under RA 10173.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <main
        id="main-content"
        aria-label="Privacy Policy"
        className="mx-auto max-w-3xl px-6 py-16 text-foreground"
      >
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Last updated: June 2026 · Effective under the Philippine Data Privacy Act (Republic Act No. 10173)
        </p>

        {/* 1. Who we are */}
        <section aria-labelledby="section-who" className="mb-10 space-y-3">
          <h2 id="section-who" className="text-xl font-semibold">1. Who We Are</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Powerbyte IT Solutions</strong> ("we", "us", "our")
            is the Personal Information Controller (PIC) for all personal data processed through the
            Orqafy platform. We are registered with and subject to the jurisdiction of the National
            Privacy Commission (NPC) of the Philippines.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Data Protection Officer contact:{" "}
            <a
              href="mailto:bonitobonita24@gmail.com"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              bonitobonita24@gmail.com
            </a>
          </p>
        </section>

        {/* 2. What data we collect */}
        <section aria-labelledby="section-collect" className="mb-10 space-y-3">
          <h2 id="section-collect" className="text-xl font-semibold">2. What Data We Collect</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We collect and process the following categories of personal data:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Identity data:</strong> Full name, display name,
              employee number, government IDs (as required by Philippine labour law).
            </li>
            <li>
              <strong className="text-foreground">Contact data:</strong> Email address, phone number.
            </li>
            <li>
              <strong className="text-foreground">Employment data:</strong> Department, position,
              employment status, attendance records, leave requests, payroll and compensation data.
            </li>
            <li>
              <strong className="text-foreground">System data:</strong> Login timestamps, IP
              addresses, audit log entries (actions performed within the platform).
            </li>
            <li>
              <strong className="text-foreground">Financial data:</strong> Bank account details,
              payroll amounts, expense claims (where applicable).
            </li>
          </ul>
        </section>

        {/* 3. Lawful bases */}
        <section aria-labelledby="section-bases" className="mb-10 space-y-3">
          <h2 id="section-bases" className="text-xl font-semibold">3. Lawful Bases for Processing</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We process your personal data on the following lawful bases under Section 12 of RA 10173:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Contractual necessity:</strong> Processing is
              required for the performance of your employment contract or the service agreement
              between your organisation and Powerbyte IT Solutions (Section 12[b]).
            </li>
            <li>
              <strong className="text-foreground">Legal obligation:</strong> Processing is required
              to comply with applicable Philippine laws (e.g., BIR, SSS, PhilHealth, Pag-IBIG
              reporting obligations) (Section 12[c]).
            </li>
            <li>
              <strong className="text-foreground">Legitimate interests:</strong> Processing for
              platform security, fraud prevention, and audit log maintenance, where these interests
              are not overridden by your rights (Section 12[f]).
            </li>
          </ul>
        </section>

        {/* 4. Your rights */}
        <section aria-labelledby="section-rights" className="mb-10 space-y-3">
          <h2 id="section-rights" className="text-xl font-semibold">4. Your Rights Under RA 10173</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            As a data subject you have the following rights under the Philippine Data Privacy Act
            (Sections 16–18, 34):
          </p>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Right to be informed</strong> — You have the right
              to know whether your personal data is being, has been, or will be processed, and to
              receive information about how it is used.
            </li>
            <li>
              <strong className="text-foreground">Right to access</strong> — You may request a copy
              of your personal data that we hold about you.
            </li>
            <li>
              <strong className="text-foreground">Right to rectification</strong> — You may request
              correction of inaccurate or incomplete personal data.
            </li>
            <li>
              <strong className="text-foreground">Right to erasure or blocking</strong> — You may
              request that we erase or block your personal data. Note: ERP and payroll records are
              subject to statutory retention periods (see Section 5 below); such requests are
              reviewed, not acted on automatically.
            </li>
            <li>
              <strong className="text-foreground">Right to data portability</strong> — You may
              request your personal data in a structured, commonly used, machine-readable format
              (Section 18).
            </li>
            <li>
              <strong className="text-foreground">Right to object</strong> — You may object to
              processing of your personal data for specific purposes (Section 34).
            </li>
            <li>
              <strong className="text-foreground">Right to damages</strong> — You are entitled to
              claim compensation for damages sustained due to inaccurate, incomplete, or outdated
              personal information.
            </li>
            <li>
              <strong className="text-foreground">Right to file a complaint with the NPC</strong> —
              If you believe your rights have been violated, you may file a complaint with the
              National Privacy Commission at{" "}
              <a
                href="https://www.privacy.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                www.privacy.gov.ph
              </a>
              .
            </li>
          </ol>
        </section>

        {/* 5. Data retention */}
        <section aria-labelledby="section-retention" className="mb-10 space-y-3">
          <h2 id="section-retention" className="text-xl font-semibold">5. Data Retention</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We retain personal data only for as long as necessary for the purposes described above,
            or as required by law:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Payroll and financial records:</strong> 7 years
              (BIR statutory requirement).
            </li>
            <li>
              <strong className="text-foreground">Audit logs and security records:</strong> 5 years
              (NPC recommendation).
            </li>
            <li>
              <strong className="text-foreground">General profile and activity data:</strong> 3 years
              after your last activity or contract end, whichever is later.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            After the applicable retention period, data is securely deleted or anonymised.
          </p>
        </section>

        {/* 6. Security */}
        <section aria-labelledby="section-security" className="mb-10 space-y-3">
          <h2 id="section-security" className="text-xl font-semibold">6. Security Measures</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We implement appropriate technical and organisational measures to protect your personal
            data against unauthorised access, alteration, disclosure, or destruction. These include:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>Encryption of data in transit (TLS 1.2+) and at rest.</li>
            <li>Role-based access control (RBAC) — each user accesses only the data their role permits.</li>
            <li>Tenant data isolation — data belonging to one organisation cannot be accessed by another.</li>
            <li>Comprehensive audit logging of all sensitive data operations.</li>
            <li>Regular security reviews against OWASP standards.</li>
          </ul>
        </section>

        {/* 7. DPO Contact */}
        <section aria-labelledby="section-dpo" className="mb-10 space-y-3">
          <h2 id="section-dpo" className="text-xl font-semibold">7. Data Protection Officer</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            For privacy-related queries, complaints, or to exercise any of your rights, contact our
            Data Protection Officer:
          </p>
          <address className="not-italic text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Powerbyte IT Solutions — DPO</strong>
            <br />
            Email:{" "}
            <a
              href="mailto:bonitobonita24@gmail.com"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              bonitobonita24@gmail.com
            </a>
          </address>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We will respond to all verifiable requests within 15 business days, as required by the
            NPC.
          </p>
        </section>

        {/* 8. How to exercise your rights */}
        <section aria-labelledby="section-exercise" className="mb-10 space-y-3">
          <h2 id="section-exercise" className="text-xl font-semibold">8. How to Exercise Your Rights</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you are a registered user of Orqafy, you can exercise most rights directly from
            within the platform:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              Sign in to your workspace, then navigate to{" "}
              <strong className="text-foreground">Settings → Privacy &amp; My Data</strong> to view
              your data, export it, request corrections, request erasure, or object to processing.
            </li>
            <li>
              Alternatively, contact our DPO directly at the email above with your full name and
              workspace identifier.
            </li>
          </ul>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may ask you to verify your identity before processing your request.
          </p>
        </section>
      </main>

      <ComplianceFooter />
    </>
  );
}
