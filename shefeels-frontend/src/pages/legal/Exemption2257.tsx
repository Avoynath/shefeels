import GenericPolicy from "./GenericPolicy";

export default function Exemption2257() {
  const toc = [
    { id: "exempt", label: "1. Exempt Status" },
    { id: "third-party", label: "2. Third-Party Content" },
    { id: "reporting", label: "3. Reporting Concerns" },
    { id: "updates", label: "4. Updates" },
    { id: "contact", label: "5. Contact Us" },
  ];
  return (
    <GenericPolicy title="18 U.S.C. 2257 Exemption Statement" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) operates https://honeylove.ai (the “Platform”). This statement is made in
        compliance with 18 U.S.C. § 2257 and related regulations concerning the record-keeping requirements for producers of
        sexually explicit material.
      </p>

      <section id="exempt" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Exempt Status</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>HoneyLove is not a producer (primary or secondary) of any visual content depicting actual sexually explicit conduct as defined in 18 U.S.C. § 2257 or 28 C.F.R. 75.1.</li>
          <li>The Platform provides AI-powered tools, software, and interactive experiences.</li>
          <li>Any depictions or outputs on the Platform are computer-generated and do not involve real human performers.</li>
          <li>No images or videos of actual human beings engaged in sexually explicit conduct are created, published, or hosted by HoneyLove.</li>
          <li>Accordingly, HoneyLove is exempt from the record-keeping and labeling requirements under 18 U.S.C. § 2257.</li>
        </ul>
      </section>

      <section id="third-party" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. Third-Party Content</h3>
  <p className="text-sm">Users who upload or share third-party material are solely responsible for ensuring such content complies with all applicable laws, including 18 U.S.C. § 2257. HoneyLove does not permit the posting or distribution of unlawful sexually explicit material and enforces this through our Blocked Content Policy and Content Removal Policy.</p>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Reporting Concerns</h3>
  <p className="text-sm">If you believe content on the Platform violates our policies or applicable laws, including 18 U.S.C. § 2257, contact us at 📧 <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a> with details.</p>
      </section>

      <section id="updates" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Updates to This Statement</h3>
  <p className="text-sm">We may update this 18 U.S.C. 2257 Exemption Statement from time to time. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Contact Us</h3>
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


