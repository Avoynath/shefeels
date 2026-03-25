import GenericPolicy from "./GenericPolicy";

export default function UnderagePolicy() {
  const toc = [
    { id: "age", label: "1. Age Restrictions" },
    { id: "no-collection", label: "2. No Collection of Children’s Data" },
    { id: "parental", label: "3. Parental Responsibility" },
    { id: "enforcement", label: "4. Enforcement" },
    { id: "updates", label: "5. Updates" },
    { id: "contact", label: "6. Contact Us" },
  ];
  return (
    <GenericPolicy title="Underage Policy" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) is committed to protecting young people online. This Underage Policy
        explains our rules regarding access to https://honeylove.ai (the “Platform”) by minors.
      </p>

  <section id="age" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. Age Restrictions</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>HoneyLove is intended for individuals 18 years of age or older (or the age of majority in your jurisdiction).</li>
          <li>If you are under 18, you may not register for or use HoneyLove.</li>
        </ul>
      </section>

  <section id="no-collection" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. No Collection of Children’s Data</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not knowingly collect or solicit personal information from anyone under 18.</li>
          <li>If we discover that we have collected personal information from a minor, we will promptly delete it.</li>
        </ul>
      </section>

  <section id="parental" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Parental Responsibility</h3>
        <p>
          Parents and guardians are responsible for supervising their children’s online activities. If you believe a minor has
          created an account or provided information to HoneyLove, please contact us immediately.
        </p>
      </section>

  <section id="enforcement" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. Enforcement</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Accounts found to be registered or used by individuals under 18 will be suspended or terminated.</li>
          <li>Any associated data will be deleted in compliance with applicable laws.</li>
        </ul>
      </section>

  <section id="updates" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Updates to This Policy</h3>
        <p>
          We may update this Underage Policy from time to time. Updates will be posted on https://honeylove.ai with a revised
          effective date.
        </p>
      </section>

  <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Contact Us</h3>
        <div className="space-y-3">
          <div>
            <strong>HONEY SYS LLC</strong><br />
            254 Chapman Rd, Ste 208 #24555<br />
            Newark, Delaware 19702, USA<br />
            EIN: 39-4239108
          </div>
          <div>
            <strong>Honey Prod Limited</strong><br />
            Unit 1603, 16th Floor, The L. Plaza<br />
            367–375 Queen's Road Central, Sheung Wan, Hong Kong<br />
            Company No.: 78640969
          </div>
          <div>
            📧 Email: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a>
          </div>
        </div>
      </section>
    </GenericPolicy>
  );
}

