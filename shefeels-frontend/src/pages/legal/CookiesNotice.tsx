import GenericPolicy from "./GenericPolicy";

export default function CookiesNotice() {
  const toc = [
    { id: "what-are-cookies", label: "1. What Are Cookies?" },
    { id: "types", label: "2. Types of Cookies We Use" },
    { id: "third-party", label: "3. Third-Party Cookies" },
    { id: "use", label: "4. How We Use Cookies" },
    { id: "manage", label: "5. Managing Cookies" },
    { id: "legal", label: "6. Legal Basis (GDPR Users)" },
    { id: "changes", label: "7. Changes to This Notice" },
    { id: "contact", label: "8. Contact Us" },
  ];
  return (
    <GenericPolicy title="Cookies Notice" updated="11/11/25" toc={toc}>
      <p>
        HoneyLove (“HoneyLove,” “we,” “our,” or “us”) uses cookies and similar technologies on https://honeylove.ai (the
        “Platform”). This Cookies Notice explains what cookies are, how we use them, and how you can manage your preferences.
      </p>

      <section id="what-are-cookies" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">1. What Are Cookies?</h3>
  <p className="text-sm">
          Cookies are small text files stored on your device when you visit a website. They allow websites to recognize your
          device and store certain information about your preferences or past actions. We also use similar technologies such as
          pixels, tags, and local storage, which function like cookies.
        </p>
      </section>

      <section id="types" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">2. Types of Cookies We Use</h3>
  <div className="text-sm space-y-3">
          <div>
            <strong>Strictly Necessary Cookies</strong>
            <ul className="list-disc pl-5 space-y-1">
              <li>Required for core functionality (e.g., login, security, payment processing).</li>
              <li>Without these, the Platform cannot function properly.</li>
            </ul>
          </div>
          <div>
            <strong>Performance and Analytics Cookies</strong>
            <ul className="list-disc pl-5 space-y-1">
              <li>Help us understand how visitors use HoneyLove.</li>
              <li>Collect aggregated data on usage, load times, and errors.</li>
            </ul>
          </div>
          <div>
            <strong>Functionality Cookies</strong>
            <ul className="list-disc pl-5 space-y-1">
              <li>Remember your preferences (e.g., language, account settings).</li>
              <li>Enhance user experience.</li>
            </ul>
          </div>
          <div>
            <strong>Advertising and Marketing Cookies</strong>
            <ul className="list-disc pl-5 space-y-1">
              <li>Used to deliver relevant ads and measure campaign effectiveness.</li>
              <li>May be set by us or third-party partners.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="third-party" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">3. Third-Party Cookies</h3>
  <p className="text-sm">
          We may allow third-party service providers to place cookies on your device, including analytics providers, payment
          processors, and advertising partners. These third parties may collect information about your browsing activities
          across different websites and services.
        </p>
      </section>

      <section id="use" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">4. How We Use Cookies</h3>
  <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Authenticate users and secure sessions.</li>
          <li>Enable smooth checkout and subscription processing.</li>
          <li>Improve Platform performance and stability.</li>
          <li>Analyze traffic and measure service effectiveness.</li>
          <li>Deliver personalized experiences and relevant content.</li>
        </ul>
      </section>

      <section id="manage" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">5. Managing Cookies</h3>
  <div className="text-sm space-y-2">
          <p>You can manage or disable cookies in several ways:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Browser Settings:</strong> Most browsers allow you to block or delete cookies.</li>
            <li><strong>Cookie Banners/Preferences:</strong> On your first visit, select preferences via our cookie banner.</li>
            <li><strong>Opt-Out Tools:</strong> For advertising cookies, you may opt out via tools like www.youronlinechoices.com.</li>
          </ul>
          <p>Note: Disabling certain cookies may affect site functionality.</p>
        </div>
      </section>

      <section id="legal" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">6. Legal Basis (GDPR Users)</h3>
  <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Strictly necessary cookies are processed under legitimate interests.</li>
          <li>Performance, functionality, and advertising cookies are used only with your consent, which you can withdraw at any time.</li>
        </ul>
      </section>

      <section id="changes" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">7. Changes to This Notice</h3>
  <p className="text-sm">We may update this Cookies Notice from time to time. Updates will be posted on https://honeylove.ai with a revised effective date.</p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[var(--hl-gold)] tracking-tight">8. Contact Us</h3>
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


