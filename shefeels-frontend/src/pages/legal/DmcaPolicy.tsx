import GenericPolicy from "./GenericPolicy";

export default function DmcaPolicy() {
  const toc = [
    { id: "introduction", label: "1. Introduction" },
    { id: "reporting", label: "2. Reporting Copyright Infringement" },
    { id: "ai-note", label: "3. AI-Generated Content Note" },
    { id: "counter-notification", label: "4. Counter-Notification" },
    { id: "agent", label: "5. Designated Agent" },
  ];
  return (
    <GenericPolicy title="DMCA Policy" updated="March 17, 2026" toc={toc}>
      <section id="introduction" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. Introduction</h3>
  <p className="text-sm">
          JLHL MANAGEMENT LTD ("Company", "we", "us", or "our"), the operator of shefeels.ai, respects the intellectual property rights of others and is committed to complying with the Digital Millennium Copyright Act of 1998 ("DMCA").
        </p>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. Reporting Copyright Infringement</h3>
  <p className="text-sm">
          To file a DMCA takedown notice, please send a written communication to our Designated Agent at <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a> that includes:
        </p>
        <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
          <li>A physical or electronic signature of the copyright owner.</li>
          <li>Identification of the copyrighted work claimed to have been infringed.</li>
          <li>Identification of the material that is claimed to be infringing.</li>
          <li>Information reasonably sufficient to permit us to contact you.</li>
          <li>A statement of good faith belief that use of the material is not authorized.</li>
          <li>A statement that the information in the notification is accurate.</li>
        </ul>
      </section>

      <section id="ai-note" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. AI-Generated Content Note</h3>
  <p className="text-sm">
          All visual content on shefeels.ai is entirely AI-generated. No real human beings are depicted in any content on our Platform. Our AI models are trained exclusively on licensed datasets and do not reproduce or derive from specific copyrighted works.
        </p>
      </section>

      <section id="counter-notification" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. Counter-Notification</h3>
  <p className="text-sm">
          If you believe that material you posted on the Service was removed or access to it was disabled by mistake, you may file a counter-notification with our Designated Agent at <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>.
        </p>
      </section>

      <section id="agent" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">5. Designated Agent</h3>
  <p className="text-sm">
          Our Designated Agent for receiving DMCA notifications and counter-notifications is:
        </p>
        <div className="text-sm mt-1 p-4 bg-white/5 rounded-xl border border-white/10">
          <strong>JLHL MANAGEMENT LTD — Attn: DMCA Agent</strong><br />
          Georgiou Karaiskaki, 11-13, Carisa Salonica Court, Office 102, 7560 Pervolia, Larnaca, Cyprus<br />
          Email: <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>
        </div>
      </section>
    </GenericPolicy>
  );
}
