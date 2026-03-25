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

export default function BlockedContentPolicy() {
  const toc = [
    { id: "prohibited", label: "1. Prohibited Content" },
    { id: "enforcement", label: "2. Enforcement" },
    { id: "reporting", label: "3. Reporting Blocked Content" },
    { id: "appeals", label: "4. Appeals" },
    { id: "updates", label: "5. Updates to This Policy" },
    { id: "contact", label: "6. Contact Us" },
  ];
  return (
    <GenericPolicy title="Blocked Content Policy" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) is committed to maintaining a safe and responsible environment on
        https://honeylove.ai (the “Platform”). This Blocked Content Policy explains the types of content that are prohibited
        and may be blocked, restricted, or prevented from being uploaded, shared, or generated on our Platform.
      </p>

      <section id="prohibited" className="space-y-2">
        <H3 id="prohibited">1. Prohibited Content</H3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Illegal Content:</strong> material that violates applicable laws, including CSAM, human trafficking, terrorism, or promotion of illegal drugs.</li>
          <li><strong>Sexual Exploitation of Minors:</strong> any attempt to depict, solicit, or promote underage sexual content.</li>
          <li><strong>Non-Consensual Content:</strong> revenge pornography, deepfakes without consent, or other non-consensual sexual material.</li>
          <li><strong>Hate Speech and Harassment:</strong> content promoting violence, discrimination, or hatred against protected classes.</li>
          <li><strong>Violent or Graphic Content:</strong> gratuitous gore, extreme violence, or content designed to shock.</li>
          <li><strong>Fraudulent or Misleading Content:</strong> phishing, scams, impersonation, or deceptive practices.</li>
          <li><strong>Malicious Content:</strong> viruses, malware, or software designed to harm.</li>
          <li><strong>Intellectual Property Violations:</strong> unauthorized use of copyrighted works, trademarks, or trade secrets.</li>
        </ul>
      </section>

      <section id="enforcement" className="space-y-2">
  <H3 id="enforcement">2. Enforcement</H3>
  <p className="text-sm">We may use automated tools, human review, and reporting mechanisms to detect and block prohibited content. Users may receive warnings, suspensions, or permanent account termination. Repeated violations will result in stricter enforcement.</p>
      </section>

      <section id="reporting" className="space-y-2">
  <H3 id="reporting">3. Reporting Blocked Content</H3>
  <p className="text-sm">Report content that should be blocked to 📧 <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a> with a description, location (URL or screenshot), and reason.</p>
      </section>

      <section id="appeals" className="space-y-2">
  <H3 id="appeals">4. Appeals</H3>
  <p className="text-sm">If your content was mistakenly blocked, you may appeal by contacting us. Appeals will be reviewed fairly, and we will notify you of the outcome.</p>
      </section>

      <section id="updates" className="space-y-2">
  <H3 id="updates">5. Updates to This Policy</H3>
  <p className="text-sm">We may update this Blocked Content Policy from time to time. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <H3 id="contact">6. Contact Us</H3>
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


