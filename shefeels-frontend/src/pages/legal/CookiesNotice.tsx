import GenericPolicy from "./GenericPolicy";

export default function CookiesNotice() {
  const toc = [
    { id: "what-are-cookies", label: "1. What Are Cookies" },
    { id: "how-we-use", label: "2. How We Use Cookies" },
    { id: "choices", label: "3. Your Choices" },
    { id: "third-party", label: "4. Third-Party Cookies" },
    { id: "contact", label: "5. Contact" },
  ];
  return (
    <GenericPolicy title="Cookie Policy" updated="March 17, 2026" toc={toc}>
      <p>
        shefeels.ai ("we", "us", or "our") uses cookies and similar technologies to operate our Platform, enhance your experience, and analyze usage patterns. This Cookie Policy explains what cookies we use, why we use them, and how you can manage your preferences.
      </p>

      <section id="what-are-cookies" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">1. What Are Cookies</h3>
  <p className="text-sm">
          Cookies are small text files that are placed on your device (computer, tablet, or mobile phone) when you visit a website. They allow a website to recognize your device, remember your preferences, and understand how you interact with the service.
        </p>
      </section>

      <section id="how-we-use" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">2. How We Use Cookies</h3>
  <div className="text-sm space-y-3">
          <div>
            <strong>2.1 Strictly Necessary Cookies</strong>
            <p>These cookies are essential for the operation of our Platform and cannot be disabled.</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>session_id — Authentication: maintains your logged-in state (Session duration)</li>
              <li>csrf_token — Security: prevents cross-site request forgery attacks (Session duration)</li>
              <li>cookie_consent — Stores your cookie consent preferences (12 months)</li>
            </ul>
          </div>
          <div>
            <strong>2.2 Functional Cookies</strong>
            <p>Functional cookies enable enhanced functionality and personalization.</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>language — Remembers your preferred language setting (12 months)</li>
              <li>theme — Stores your preferred display theme (12 months)</li>
            </ul>
          </div>
          <div>
            <strong>2.3 Analytics Cookies</strong>
            <p>Analytics cookies help us understand how visitors interact with our Platform.</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>_plausible — Privacy-focused analytics: tracks anonymous usage data (Session)</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="choices" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">3. Your Choices</h3>
  <p className="text-sm">
          When you first visit our Platform, you will be presented with a consent banner that allows you to manage your cookie preferences. You may choose from: Accept All, Necessary Only, or Manage Preferences.
        </p>
      </section>

      <section id="third-party" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">4. Third-Party Cookies</h3>
  <p className="text-sm">
          We do not use third-party advertising cookies. However, payment processors may set their own cookies when you interact with their payment forms.
        </p>
      </section>

      <section id="contact" className="space-y-2">
  <h3 className="mt-4 text-lg sm:text-xl font-semibold text-[#B8A3F6] tracking-tight">5. Contact</h3>
  <p className="text-sm">
          If you have any questions about this Cookie Policy, please contact us at: <a className="underline" href="mailto:privacy@shefeels.ai">privacy@shefeels.ai</a>
        </p>
      </section>
    </GenericPolicy>
  );
}
