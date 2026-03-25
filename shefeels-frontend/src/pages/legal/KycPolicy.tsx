import GenericPolicy from "./GenericPolicy";

export default function KycPolicy() {
  const toc = [
    { id: "purpose", label: "1. Purpose" },
    { id: "scope", label: "2. Scope" },
    { id: "entity", label: "3. Responsible Entity" },
    { id: "information", label: "4. Information Collected for Verification" },
    { id: "procedures", label: "5. Verification Procedures" },
    { id: "retention", label: "6. Data Retention" },
    { id: "refusal", label: "7. Refusal or Termination" },
    { id: "confidentiality", label: "8. Confidentiality and Data Protection" },
    { id: "updates", label: "9. Updates to This Policy" },
    { id: "contact", label: "10. Contact Us" },
  ];

  return (
    <GenericPolicy title="KYC Policy" updated="11/11/2025" toc={toc}>
      <p>
        HoneyLove ("HoneyLove," "we," "our," or "us") operates the AI-powered software platform available at
        https://honeylove.ai (the "Platform"). This Know Your Customer (KYC) Policy explains how HONEY SYS LLC, a Delaware
        limited liability company, verifies the identity of users and business partners in compliance with applicable laws
        and payment processing regulations.
      </p>

      <section id="purpose" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Purpose</h3>
        <p className="text-sm">
          The purpose of this KYC Policy is to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prevent money laundering, fraud, terrorist financing, and other illegal activities.</li>
          <li>Ensure the legitimacy of transactions processed by HONEY SYS LLC.</li>
          <li>Protect the integrity and trust of the HoneyLove ecosystem.</li>
        </ul>
        <p className="text-sm">This policy forms part of HoneyLove’s broader compliance framework, which includes the Privacy Notice, Terms of Service, and Blocked Content Policy.</p>
      </section>

      <section id="scope" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. Scope</h3>
        <p className="text-sm">This KYC Policy applies to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All users making financial transactions (including subscriptions or payouts) on the Platform.</li>
          <li>Business partners, affiliates, and vendors receiving or processing funds through HONEY SYS LLC.</li>
          <li>All employees or contractors involved in user verification or payment compliance.</li>
        </ul>
      </section>

      <section id="entity" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Responsible Entity</h3>
        <div className="text-sm space-y-1">
          <div>HONEY SYS LLC</div>
          <div>254 Chapman Rd, Ste 208 #24555</div>
          <div>Newark, Delaware 19702, USA</div>
          <div>📧 Email: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a></div>
        </div>
        <p className="text-sm">HONEY SYS LLC handles payment processing on behalf of Honey Prod Limited, the parent and intellectual property owner of the Platform.</p>
      </section>

      <section id="information" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Information Collected for Verification</h3>
        <p className="text-sm">To comply with regulatory requirements and processor policies, we may collect the following information:</p>

        <h4 className="mt-2 font-semibold">For Individual Users:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Full legal name</li>
          <li>Date of birth</li>
          <li>Residential address</li>
          <li>Government-issued identification (e.g., passport or driver’s license)</li>
          <li>Payment method verification (e.g., card or account match)</li>
        </ul>

        <h4 className="mt-2 font-semibold">For Businesses or Legal Entities:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Registered business name and address</li>
          <li>Incorporation or registration documents</li>
          <li>Authorized representative’s ID</li>
          <li>Beneficial ownership details (if applicable)</li>
          <li>Payment and tax information</li>
        </ul>

        <p className="text-sm">All data is handled in accordance with our Privacy Notice.</p>
      </section>

      <section id="procedures" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Verification Procedures</h3>
        <p className="text-sm">Initial Verification:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>At account creation or prior to processing transactions, users may be required to complete identity verification via secure upload of ID and proof of address.</li>
        </ul>
        <p className="text-sm">Ongoing Monitoring:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Transactions may be reviewed periodically for unusual activity or discrepancies.</li>
        </ul>
        <p className="text-sm">Enhanced Due Diligence (EDD):</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>In cases of high-risk transactions, large payment volumes, or cross-border activity, additional documentation may be requested.</li>
        </ul>
        <p className="text-sm">Third-Party Processors:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>HONEY SYS LLC may use regulated payment service providers (e.g., SegBill, CCPay) that implement their own KYC/AML checks.</li>
        </ul>
      </section>

      <section id="retention" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Data Retention</h3>
        <p className="text-sm">KYC records are stored securely and retained for a minimum of five (5) years after the end of the business relationship or as required by applicable law. All information is encrypted and accessible only to authorized compliance personnel.</p>
      </section>

      <section id="refusal" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Refusal or Termination</h3>
        <p className="text-sm">HoneyLove reserves the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Refuse service or suspend accounts that fail KYC verification.</li>
          <li>Terminate or block accounts linked to suspicious, fraudulent, or illegal activity.</li>
          <li>Report suspected violations to regulatory or law enforcement authorities when legally required.</li>
        </ul>
      </section>

      <section id="confidentiality" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">8. Confidentiality and Data Protection</h3>
        <p className="text-sm">All information provided for KYC purposes is treated as confidential and protected in accordance with the Privacy Notice and applicable data protection laws (including GDPR and CCPA where relevant).</p>
      </section>

      <section id="updates" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">9. Updates to This Policy</h3>
        <p className="text-sm">We may update this KYC Policy periodically to reflect changes in legal or operational requirements. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
        <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">10. Contact Us</h3>
        <div className="text-sm space-y-1">
          <div>HONEY SYS LLC</div>
          <div>254 Chapman Rd, Ste 208 #24555</div>
          <div>Newark, Delaware 19702, USA</div>
          <div>📧 support@honeylove.ai</div>
        </div>
      </section>
    </GenericPolicy>
  );
}
