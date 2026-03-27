import GenericPolicy from "./GenericPolicy";

export default function BlockedContentPolicy() {
  const toc = [
    { id: "zero-tolerance", label: "1. Zero-Tolerance Policy" },
    { id: "prevention", label: "2. Prevention and Moderation" },
    { id: "reporting", label: "3. Mandatory Reporting" },
    { id: "cooperation", label: "4. Cooperation with Law Enforcement" },
  ];
  return (
    <GenericPolicy title="Child Protection Policy" updated="March 17, 2026" toc={toc}>
      <section id="zero-tolerance" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. Zero-Tolerance Policy</h3>
  <p className="text-sm">
          JLHL MANAGEMENT LTD maintains an absolute zero-tolerance policy for child sexual abuse material (CSAM) or any content depicting, involving, or exploiting minors. This applies to all user interactions and platforms we operate.
        </p>
      </section>

      <section id="prevention" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. Prevention and Moderation</h3>
  <p className="text-sm">
          shefeels.ai uses multiple layers of protection: AI safety filters, keyword filtering, human audit review, and proactive content scanning.
        </p>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. Mandatory Reporting</h3>
  <p className="text-sm">
          Any attempt to generate, upload, or share content involving minors results in account termination and report to the National Center for Missing & Exploited Children (NCMEC) or Cybertips.
        </p>
      </section>

      <section id="cooperation" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. Cooperation with Law Enforcement</h3>
  <p className="text-sm">
          We cooperate fully with law enforcement agencies and provide all necessary information for criminal investigations related to child protection.
        </p>
        <p className="text-sm">
          Report any concerns to <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>.
        </p>
      </section>
    </GenericPolicy>
  );
}
