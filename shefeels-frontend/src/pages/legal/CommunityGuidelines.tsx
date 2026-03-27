import GenericPolicy from "./GenericPolicy";

export default function CommunityGuidelines() {
  const toc = [
    { id: "purpose", label: "1. Purpose" },
    { id: "prohibited", label: "2. Prohibited Content and Activities" },
    { id: "enforcement", label: "3. Enforcement" },
    { id: "reporting", label: "4. Reporting Violations" },
  ];
  return (
    <GenericPolicy title="Acceptable Use Policy" updated="March 17, 2026" toc={toc}>
      <section id="purpose" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. Purpose</h3>
  <p className="text-sm">
          This Acceptable Use Policy ("AUP") supplements the shefeels.ai Terms of Service and governs your use of the Platform, its features, and all content generated through the Service.
        </p>
      </section>

      <section id="prohibited" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. Prohibited Content and Activities</h3>
  <div className="text-sm space-y-3">
          <div>
            <strong>2.1 Content Involving Minors</strong>
            <p>Absolutely prohibited: any sexual, suggestive, romantic, or exploitative content depicting minors. Violation results in immediate account termination and reporting to law enforcement.</p>
          </div>
          <div>
            <strong>2.2 Non-Consensual and Harmful Content</strong>
            <p>Prohibited: non-consensual intimate imagery, deepfakes of real individuals, and content promoting sexual violence.</p>
          </div>
          <div>
            <strong>2.3 Illegal Activities</strong>
            <p>Prohibited: distribution of malware, fraud, or activities violating local or international laws.</p>
          </div>
          <div>
            <strong>2.4 Abuse and Harassment</strong>
            <p>Prohibited: harassment, threats, stalking, or inciting hatred/discrimination.</p>
          </div>
          <div>
            <strong>2.5 System Abuse</strong>
            <p>Prohibited: unauthorized access, use of bots/scrapers, or bypassing safety mechanisms.</p>
          </div>
        </div>
      </section>

      <section id="enforcement" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. Enforcement</h3>
  <p className="text-sm">
          shefeels.ai employs automated systems and human review. Enforcement actions include warnings, account suspension, or permanent termination and reporting to law enforcement.
        </p>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. Reporting Violations</h3>
  <p className="text-sm">
          If you encounter any content or activity violating this AUP, report it immediately to <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>.
        </p>
      </section>
    </GenericPolicy>
  );
}
