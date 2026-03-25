import GenericPolicy from "./GenericPolicy";
import { useTheme } from "../../contexts/ThemeContext";

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <h3 id={id} className={`mt-4 text-lg sm:text-xl font-semibold tracking-tight ${
      isDark ? "text-[var(--hl-gold)]" : "text-[var(--hl-gold)]"
    }`}>
      {children}
    </h3>
  );
}

export default function DmcaPolicy() {
  const toc = [
    { id: "reporting", label: "1. Reporting Infringement" },
    { id: "agent", label: "2. Designated Copyright Agent" },
    { id: "counter", label: "3. Counter-Notification" },
    { id: "repeat", label: "4. Repeat Infringers" },
    { id: "good-faith", label: "5. Good Faith Requirement" },
    { id: "intl", label: "6. International Users" },
    { id: "updates", label: "7. Updates" },
    { id: "contact", label: "8. Contact Us" },
  ];
  return (
    <GenericPolicy title="DMCA Policy" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) respects the intellectual property rights of others and expects our
        users to do the same. In accordance with the Digital Millennium Copyright Act (“DMCA”) and other applicable laws,
        we have adopted the following policy regarding copyright infringement.
      </p>

      <section id="reporting" className="space-y-2">
        <H3 id="reporting">1. Reporting Copyright Infringement</H3>
  <p className="text-sm">If you believe that material on the Platform infringes your copyright, please send a written notice to our Designated Copyright Agent that includes (17 U.S.C. § 512):</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A physical or electronic signature of the copyright owner or authorized representative.</li>
          <li>Identification of the copyrighted work claimed to have been infringed.</li>
          <li>Identification of the infringing material and information reasonably sufficient to permit us to locate it (e.g., URL, screenshot).</li>
          <li>Your contact information (name, address, phone number, email).</li>
          <li>A statement that you have a good faith belief the use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement, under penalty of perjury, that the information is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
        </ul>
      </section>

      <section id="agent" className="space-y-2">
        <H3 id="agent">2. Designated Copyright Agent</H3>
  <div className="text-sm space-y-1">
          <div>Copyright Agent</div>
          <div>HONEY SYS LLC</div>
          <div>254 Chapman Rd, Ste 208 #24555</div>
          <div>Newark, Delaware 19702, USA</div>
          <div>📧 Email: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a></div>
        </div>
      </section>

      <section id="counter" className="space-y-2">
        <H3 id="counter">3. Counter-Notification</H3>
  <p className="text-sm">If your material was removed or access was disabled in error, you may submit a counter-notification to our Copyright Agent including:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your physical or electronic signature.</li>
          <li>Identification of the removed or disabled material and its location before removal.</li>
          <li>A statement under penalty of perjury that you believe the material was removed due to mistake or misidentification.</li>
          <li>Your name, address, phone number, and email.</li>
          <li>A statement that you consent to the jurisdiction of the federal court in Delaware, USA, and that you will accept service of process from the original complainant or their agent.</li>
        </ul>
  <p className="text-sm">If we receive a valid counter-notification, we may restore the removed content unless the copyright owner files a court action within 10 business days.</p>
      </section>

      <section id="repeat" className="space-y-2">
        <H3 id="repeat">4. Repeat Infringers</H3>
  <p className="text-sm">HoneyLove may terminate accounts of users who are repeat infringers of intellectual property rights.</p>
      </section>

      <section id="good-faith" className="space-y-2">
        <H3 id="good-faith">5. Good Faith Requirement</H3>
  <p className="text-sm">Submitting false or misleading DMCA notices or counter-notifications may result in liability for damages (including costs and attorney’s fees) under Section 512(f) of the DMCA.</p>
      </section>

      <section id="intl" className="space-y-2">
        <H3 id="intl">6. International Users</H3>
  <p className="text-sm">While the DMCA is a U.S. law, HoneyLove also accepts copyright complaints from outside the United States. International notices should include equivalent information to that required under the DMCA.</p>
      </section>

      <section id="updates" className="space-y-2">
        <H3 id="updates">7. Updates to This Policy</H3>
  <p className="text-sm">We may update this DMCA Policy from time to time. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
        <H3 id="contact">8. Contact Us</H3>
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


