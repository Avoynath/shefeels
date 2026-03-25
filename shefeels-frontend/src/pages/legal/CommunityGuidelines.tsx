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

export default function CommunityGuidelines() {
  const toc = [
    { id: "respect", label: "1. Respect Others" },
    { id: "illegal", label: "2. No Illegal or Harmful Content" },
    { id: "ip", label: "3. Intellectual Property Respect" },
    { id: "authentic", label: "4. Authentic and Honest Use" },
    { id: "integrity", label: "5. Platform Integrity" },
    { id: "age", label: "6. Age Restrictions" },
    { id: "enforcement", label: "7. Enforcement" },
    { id: "reporting", label: "8. Reporting Violations" },
    { id: "updates", label: "9. Updates" },
    { id: "contact", label: "10. Contact Us" },
  ];
  return (
    <GenericPolicy title="Community Guidelines" updated="11/11/25" toc={toc}>
      <p>
        At HoneyLove (“HoneyLove,” “we,” “our,” or “us”), we strive to provide a safe, respectful, and positive environment
        for everyone using https://honeylove.ai (the “Platform”). These Community Guidelines set out the standards of
        behavior expected from all users.
      </p>
      <p>By using HoneyLove, you agree to follow these rules in addition to our Terms of Service and related policies.</p>

      <section id="respect" className="space-y-2">
  <H3 id="respect">1. Respect Others</H3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Treat all users with courtesy and respect.</li>
          <li>Do not harass, bully, threaten, or abuse others.</li>
          <li>Do not engage in hate speech, including discriminatory remarks based on protected characteristics.</li>
        </ul>
      </section>

      <section id="illegal" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. No Illegal or Harmful Content</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Illegal material (including terrorism, trafficking, or drug-related content).</li>
          <li>CSAM or any depiction of minors in a sexual context.</li>
          <li>Non-consensual sexual material (e.g., revenge porn, deepfakes without consent).</li>
          <li>Violent, graphic, or excessively gory content.</li>
          <li>Malicious software, phishing, or scams.</li>
        </ul>
      </section>

      <section id="ip" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Intellectual Property Respect</h3>
  <p className="text-sm">Do not upload or share content that infringes on copyrights, trademarks, or other intellectual property rights.</p>
      </section>

      <section id="authentic" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Authentic and Honest Use</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not impersonate other individuals, brands, or organizations.</li>
          <li>Do not spread misinformation, fraudulent claims, or misleading content.</li>
          <li>Do not use HoneyLove for spam, advertising, or solicitation without permission.</li>
        </ul>
      </section>

      <section id="integrity" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Platform Integrity</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not attempt to hack, disrupt, or reverse engineer HoneyLove.</li>
          <li>Do not misuse the AI tools to generate or disseminate harmful, abusive, or illegal outputs.</li>
          <li>Use the Platform responsibly and as intended.</li>
        </ul>
      </section>

      <section id="age" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Age Restrictions</h3>
  <p className="text-sm">HoneyLove is for users 18 years or older. Underage use is strictly prohibited (see our Underage Policy).</p>
      </section>

      <section id="enforcement" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Enforcement</h3>
  <p className="text-sm">Violations may result in content removal, warnings, restrictions, account suspension/termination, and reports to law enforcement when required.</p>
      </section>

      <section id="reporting" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">8. Reporting Violations</h3>
  <p className="text-sm">Report violations to 📧 <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a>. Reports are reviewed confidentially.</p>
      </section>

      <section id="updates" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">9. Updates to These Guidelines</h3>
  <p className="text-sm">We may update these Community Guidelines periodically. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">10. Contact Us</h3>
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


