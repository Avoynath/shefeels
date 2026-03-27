import GenericPolicy from "./GenericPolicy";

export default function ContentRemovalPolicy() {
  const toc = [
    { id: "grounds", label: "1. Grounds for Removal" },
    { id: "methods", label: "2. Methods of Removal" },
    { id: "reporting", label: "3. Reporting Content" },
    { id: "appeals", label: "4. Appeals" },
    { id: "repeat", label: "5. Repeat Violations" },
    { id: "updates", label: "6. Updates" },
    { id: "contact", label: "7. Contact Us" },
  ];
  return (
    <GenericPolicy title="Content Removal Policy" updated="11/11/25" toc={toc}>
      <p>
        SheFeels (“SheFeels,” “we,” “our,” or “us”) is committed to maintaining a safe, respectful, and legally compliant
        platform at https://shefeels.ai (the “Platform”). This Content Removal Policy explains when and how we may remove content.
      </p>

      <section id="grounds" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Grounds for Content Removal</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Violates our Terms of Service or Community Guidelines.</li>
          <li>Contains illegal material (e.g., child exploitation, terrorism-related content, or other unlawful activity).</li>
          <li>Infringes intellectual property rights or violates privacy rights.</li>
          <li>Constitutes harassment, hate speech, threats, or abusive conduct.</li>
          <li>Is spam, fraudulent, misleading, or promotes harmful products or services.</li>
          <li>Poses a security risk (e.g., malware, phishing, or unauthorized access attempts).</li>
        </ul>
      </section>

      <section id="methods" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. Methods of Removal</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>User-Initiated Removal:</strong> Users may delete their own content at any time.</li>
          <li><strong>SheFeels Removal:</strong> We may remove content proactively or in response to reports.</li>
          <li><strong>Legal Removal:</strong> Content may be removed in compliance with court orders, DMCA notices, or other legal requests.</li>
        </ul>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Reporting Content</h3>
  <p className="text-sm">If you believe content violates our policies or the law, report it to 📧 <a className="underline" href="mailto:support@shefeels.ai">support@shefeels.ai</a> and include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A description of the content.</li>
          <li>The reason for your request.</li>
          <li>Supporting documentation (e.g., proof of rights ownership, screenshots).</li>
        </ul>
  <p className="text-sm">We will review and act on reports in a timely manner.</p>
      </section>

      <section id="appeals" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Appeals</h3>
  <p className="text-sm">If your content is removed and you believe it was an error, you may appeal by contacting us at 📧 <a className="underline" href="mailto:support@shefeels.ai">support@shefeels.ai</a>. We will review appeals fairly and notify you of our decision.</p>
      </section>

      <section id="repeat" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Repeat Violations</h3>
  <p className="text-sm">Accounts engaging in repeated or serious violations may be suspended or terminated in accordance with our Terms of Service.</p>
      </section>

      <section id="updates" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Updates to This Policy</h3>
  <p className="text-sm">We may update this Content Removal Policy from time to time. Updates will be posted on https://shefeels.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Contact Us</h3>
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


