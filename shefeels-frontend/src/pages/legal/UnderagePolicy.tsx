import GenericPolicy from "./GenericPolicy";

export default function UnderagePolicy() {
  const toc = [
    { id: "access", label: "1. Access Restriction" },
    { id: "verification", label: "2. Verification Methods" },
    { id: "parental", label: "3. Parental Responsibility" },
    { id: "rta", label: "4. RTA Label" },
    { id: "contact", label: "5. Contact" },
  ];
  return (
    <GenericPolicy title="Age Verification" updated="March 17, 2026" toc={toc}>
      <section id="access" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. Access Restriction</h3>
  <p className="text-sm">
          shefeels.ai contains AI-generated adult content and is strictly intended for adults only. You must be at least 18 years of age, or the age of legal majority in your jurisdiction (whichever is higher), to access or use the Service.
        </p>
      </section>

      <section id="verification" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. Verification Methods</h3>
  <p className="text-sm">
          Shefeels.ai employs age confirmation during registration and uses payment info as an additional layer of verification. We reserve the right to implement third-party verification solutions at any time.
        </p>
      </section>

      <section id="parental" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. Parental Responsibility</h3>
  <p className="text-sm">
          Parents are responsible for preventing minors from accessing adult content. We recommend parental control tools such as:
        </p>
        <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
          <li>Net Nanny (netnanny.com)</li>
          <li>Qustodio (qustodio.com)</li>
          <li>Operating system and browser controls</li>
        </ul>
      </section>

      <section id="rta" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. RTA Label</h3>
  <p className="text-sm">
          shefeels.ai has voluntarily adopted the Restricted to Adults (RTA) label to assist parental control software in identifying adult content.
        </p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">5. Contact</h3>
  <p className="text-sm">
          If you believe a minor has gained access to the Service, please contact us immediately at <a className="underline" href="mailto:legal@shefeels.ai">legal@shefeels.ai</a>.
        </p>
      </section>
    </GenericPolicy>
  );
}
