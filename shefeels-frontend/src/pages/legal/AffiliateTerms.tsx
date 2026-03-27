import GenericPolicy from "./GenericPolicy";

export default function AffiliateTerms() {
  const toc = [
    { id: "enrollment", label: "1. Enrollment" },
    { id: "responsibilities", label: "2. Responsibilities" },
    { id: "commissions", label: "3. Commissions & Payments" },
    { id: "tracking", label: "4. Tracking & Attribution" },
    { id: "termination", label: "5. Termination" },
    { id: "ip", label: "6. Intellectual Property" },
    { id: "contractor", label: "7. Independent Contractor" },
    { id: "liability", label: "8. Limitation of Liability" },
    { id: "modifications", label: "9. Modifications" },
    { id: "law", label: "10. Governing Law" },
    { id: "contact", label: "11. Contact Us" },
  ];
  return (
    <GenericPolicy title="Affiliate Terms" updated="11/11/25" toc={toc}>
      <p>
        These Affiliate Terms (“Agreement”) govern participation in the SheFeels Affiliate Program (“Program”). By
        enrolling, you (“Affiliate,” “you,” or “your”) agree to the following terms with SheFeels (“SheFeels,” “we,” “our,” or
        “us”). The Program is operated by JLHL MANAGEMENT LTD (HE 484306).
      </p>

      <section id="enrollment" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Enrollment in the Program</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submit a completed affiliate application.</li>
          <li>We may approve or reject applications at our discretion.</li>
          <li>Affiliates must be at least 18 years old.</li>
        </ul>
      </section>

      <section id="responsibilities" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. Affiliate Responsibilities</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Promote SheFeels lawfully, ethically, and positively.</li>
          <li>No spamming, misleading advertising, or false claims.</li>
          <li>No use of trademarks without approval (except official materials provided).</li>
          <li>No targeting minors or promoting on illegal/harmful sites.</li>
        </ul>
      </section>

      <section id="commissions" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Commissions and Payments</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Earn commission on qualified purchases by referred users.</li>
          <li>Rates/structures appear in your affiliate dashboard.</li>
          <li>Paid in USD by JLHL MANAGEMENT LTD, subject to payout thresholds.</li>
          <li>No commissions on fraudulent, refunded, or chargeback transactions.</li>
        </ul>
      </section>

      <section id="tracking" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Tracking and Attribution</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Purchases must complete through valid affiliate links.</li>
          <li>Tracking via cookies or equivalent technologies.</li>
          <li>We are not liable for lost commissions due to cookie deletion or outages.</li>
        </ul>
      </section>

      <section id="termination" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Termination</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>We may suspend/terminate for violations, reputational harm, or fraud/abuse.</li>
          <li>Valid unpaid commissions earned pre-termination will be paid per schedule.</li>
        </ul>
      </section>

      <section id="ip" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Intellectual Property</h3>
  <p className="text-sm">All rights in SheFeels trademarks, logos, and content belong to JLHL MANAGEMENT LTD. Use only approved materials.</p>
      </section>

      <section id="contractor" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Independent Contractor Relationship</h3>
  <p className="text-sm">Affiliates are independent contractors responsible for their own taxes, registrations, and compliance.</p>
      </section>

      <section id="liability" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">8. Limitation of Liability</h3>
  <p className="text-sm">SheFeels will not be liable for indirect, incidental, or consequential damages. Our liability is limited to properly earned but unpaid commissions.</p>
      </section>

      <section id="modifications" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">9. Modifications</h3>
  <p className="text-sm">We may update these terms at any time. Updates will be posted on https://shefeels.ai. Continued participation constitutes acceptance.</p>
      </section>

      <section id="law" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">10. Governing Law</h3>
  <p className="text-sm">Cyprus law applies to this Agreement.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">11. Contact Us</h3>
  <div className="text-sm space-y-1">
          <div className="font-semibold">JLHL MANAGEMENT LTD (HE 484306)</div>
          <div>Georgiou Karaiskaki 11-13,</div>
          <div>Carisa Salonica Court, Office 102,</div>
          <div>7560 Pervolia, Larnaca, Cyprus</div>
          <div>📧 Email: <a className="underline" href="mailto:support@shefeels.ai">support@shefeels.ai</a></div>
        </div>
      </section>
    </GenericPolicy>
  );
}


