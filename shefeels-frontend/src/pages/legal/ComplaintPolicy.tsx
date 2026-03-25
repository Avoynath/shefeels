import GenericPolicy from "./GenericPolicy";

export default function ComplaintPolicy() {
  const toc = [
    { id: "scope", label: "1. Scope of Complaints" },
    { id: "submit", label: "2. How to Submit a Complaint" },
    { id: "process", label: "3. Our Process" },
    { id: "appeals", label: "4. Appeals" },
    { id: "misuse", label: "5. Misuse of Complaint Process" },
    { id: "rights", label: "6. Regulatory Rights" },
    { id: "updates", label: "7. Updates" },
    { id: "contact", label: "8. Contact Us" },
  ];
  return (
    <GenericPolicy title="Complaint Policy" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) values transparency and accountability. We are committed to handling
        complaints fairly, promptly, and consistently. This Complaint Policy explains how users of https://honeylove.ai (the
        “Platform”) can submit complaints and how we address them.
      </p>

      <section id="scope" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Scope of Complaints</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Violations of our Terms of Service, Privacy Notice, or Community Guidelines.</li>
          <li>Content that may be unlawful, harmful, or infringing.</li>
          <li>User conduct, including harassment, abuse, or misuse of the Platform.</li>
          <li>Concerns about data protection or misuse of personal information.</li>
          <li>Technical or service-related issues.</li>
        </ul>
      </section>

      <section id="submit" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. How to Submit a Complaint</h3>
  <p className="text-sm">To submit a complaint, contact us at 📧 <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a> and include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your full name and contact information.</li>
          <li>A clear description of the issue or concern.</li>
          <li>Any relevant supporting information (e.g., screenshots, URLs, correspondence).</li>
          <li>The outcome you are seeking (e.g., removal of content, clarification, refund review).</li>
        </ul>
  <p className="text-sm">Complaints may also be submitted in writing to our business addresses listed below.</p>
      </section>

      <section id="process" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Our Process</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acknowledgment:</strong> We will acknowledge receipt of your complaint within 5 business days.</li>
          <li><strong>Review:</strong> Complaints will be reviewed by our compliance or support team.</li>
          <li><strong>Investigation:</strong> If necessary, we may request additional information from you.</li>
          <li><strong>Decision:</strong> We will provide a written response within 30 days of receiving all necessary details.</li>
          <li><strong>Resolution:</strong> If action is required, we will take steps promptly and notify you.</li>
        </ul>
      </section>

      <section id="appeals" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Appeals</h3>
  <p className="text-sm">If you are not satisfied with our decision, you may appeal by replying to our response and explaining why you believe the complaint was not resolved appropriately. Appeals will be reviewed by a different team member or manager.</p>
      </section>

      <section id="misuse" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Misuse of Complaint Process</h3>
  <p className="text-sm">Submitting false, abusive, or bad-faith complaints may result in rejection of the complaint and possible suspension of your account.</p>
      </section>

      <section id="rights" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Regulatory Rights</h3>
  <p className="text-sm">Nothing in this policy limits your rights to file complaints with applicable regulatory authorities in your jurisdiction.</p>
      </section>

      <section id="updates" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Updates to This Policy</h3>
  <p className="text-sm">We may update this Complaint Policy from time to time. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">8. Contact Us</h3>
  <div className="text-sm space-y-1">
          <div>HONEY SYS LLC</div>
          <div>254 Chapman Rd, Ste 208 #24555</div>
          <div>Newark, Delaware 19702, USA</div>
          <div>EIN: 39-4239108</div>
          <div>Honey Prod Limited</div>
          <div>Unit 1603, 16th Floor, The L. Plaza</div>
          <div>367–375 Queen's Road Central, Sheung Wan, Hong Kong</div>
          <div>Company No.: 78640969</div>
          <div>📧 Email: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a></div>
        </div>
      </section>
    </GenericPolicy>
  );
}


