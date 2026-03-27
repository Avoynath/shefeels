import GenericPolicy from "./GenericPolicy";

export default function KycPolicy() {
  const toc = [
    { id: "prevention", label: "1. Prevention of Exploitation" },
    { id: "human-trafficking", label: "2. Anti-Human Trafficking" },
    { id: "monitoring", label: "3. Monitoring and Compliance" },
    { id: "contact", label: "4. Contact" },
  ];
  return (
    <GenericPolicy title="Anti-Trafficking Policy" updated="March 17, 2026" toc={toc}>
      <section id="prevention" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. Prevention of Exploitation</h3>
  <p className="text-sm">
          shefeels.ai is committed to preventing all forms of human trafficking, forced labor, and modern slavery on our Platform. Our AI-only model ensures no real individuals are depicted, reducing the risk of exploitation.
        </p>
      </section>

      <section id="human-trafficking" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. Anti-Human Trafficking</h3>
  <p className="text-sm">
          We strictly prohibit any user from using shefeels.ai to promote human trafficking, advertise commercial sex acts, or solicit non-consensual content.
        </p>
      </section>

      <section id="monitoring" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. Monitoring and Compliance</h3>
  <p className="text-sm">
          shefeels.ai employs monitoring systems to detect and prevent misuse for commercial solicitation or exploitation. Any detected violation results in immediate reporting and account termination.
        </p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. Contact</h3>
  <p className="text-sm">
          If you have information regarding potential human trafficking, please contact us immediately at <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>.
        </p>
      </section>
    </GenericPolicy>
  );
}
