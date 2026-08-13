/**
 * ComplianceFooter — V32.9 / RA 10173
 *
 * HONEST compliance footer. Design-claim chips reflect how the system is built;
 * certification badges are opt-in flags (all off by default — only enable when
 * the organisation actually holds the certification).
 *
 * Server-safe: no hooks, pure JSX. Drop into any server page or client component.
 */

const COMPLIANCE_CONFIG = {
  /** Things that are actually true about how the system is engineered. */
  designClaims: {
    securityByDefault: true,
    phDpaAligned: true,
    wcagTarget: true,
  },
  /**
   * Held certifications — OFF unless the organisation has obtained them.
   * Rendering a badge you don't hold is a misrepresentation; keep these false.
   */
  certBadges: {
    iso27001: false,
    soc2: false,
    pci: false,
  },
};

const DESIGN_CLAIM_LABELS: Record<keyof typeof COMPLIANCE_CONFIG.designClaims, string> = {
  securityByDefault: "Built with security by default",
  phDpaAligned: "Aligned with PH Data Privacy Act (RA 10173)",
  wcagTarget: "Targets WCAG 2.2 AA",
};

const CERT_BADGE_LABELS: Record<keyof typeof COMPLIANCE_CONFIG.certBadges, string> = {
  iso27001: "ISO 27001 Certified",
  soc2: "SOC 2 Type II",
  pci: "PCI DSS Compliant",
};

export function ComplianceFooter() {
  const year = new Date().getFullYear();

  const activeDesignClaims = (
    Object.keys(COMPLIANCE_CONFIG.designClaims) as Array<keyof typeof COMPLIANCE_CONFIG.designClaims>
  ).filter((key) => COMPLIANCE_CONFIG.designClaims[key]);

  const activeCertBadges = (
    Object.keys(COMPLIANCE_CONFIG.certBadges) as Array<keyof typeof COMPLIANCE_CONFIG.certBadges>
  ).filter((key) => COMPLIANCE_CONFIG.certBadges[key]);

  return (
    <footer
      aria-label="Compliance and legal information"
      className="border-t border-border bg-background px-6 py-8"
    >
      <div className="mx-auto max-w-5xl space-y-4 text-center">
        {/* Design-claim chips */}
        {activeDesignClaims.length > 0 && (
          <div
            role="list"
            aria-label="Design and compliance claims"
            className="flex flex-wrap justify-center gap-2"
          >
            {activeDesignClaims.map((key) => (
              <span
                key={key}
                role="listitem"
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
              >
                {DESIGN_CLAIM_LABELS[key]}
              </span>
            ))}
          </div>
        )}

        {/* Certification badges — only rendered if truly held */}
        {activeCertBadges.length > 0 && (
          <div
            role="list"
            aria-label="Held certifications"
            className="flex flex-wrap justify-center gap-2"
          >
            {activeCertBadges.map((key) => (
              <span
                key={key}
                role="listitem"
                className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
              >
                {CERT_BADGE_LABELS[key]}
              </span>
            ))}
          </div>
        )}

        {/* Privacy link + copyright */}
        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground sm:flex-row sm:justify-center sm:gap-3">
          <a
            href="/privacy"
            className="hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm transition-colors"
          >
            Privacy Policy
          </a>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>© {year} Powerbyte IT Solutions</span>
        </div>
      </div>
    </footer>
  );
}
