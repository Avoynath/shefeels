import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import Card from "../components/Card";

// Helper components for theme-aware styling
function BodyText({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <div className={`space-y-2 text-sm leading-relaxed ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </div>
  );
}

function BodyList({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <ul className={`list-disc pl-5 space-y-2 text-sm ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </ul>
  );
}

type Section = { id: string; title: string; body: React.ReactNode };

const effectiveDate = "11/11/25"; // Update when finalized

const sections: Section[] = [
  {
    id: "who-we-are",
    title: "1. Who We Are",
    body: (
      <BodyText>
        <p>
          <strong>HONEY SYS LLC</strong>, a Delaware limited liability company, acts as the data controller for customer
          payment information and account management.
        </p>
        <p>
          <strong>Honey Prod Limited</strong>, a Hong Kong company, acts as the data controller for intellectual property,
          service ownership, and overall platform operations.
        </p>
        <p>
          For any privacy-related questions, please contact: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a>
        </p>
      </BodyText>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information We Collect",
    body: (
      <BodyList>
        <li><strong>Account Information:</strong> Name, email, username, password.</li>
        <li><strong>Payment Information:</strong> Credit/debit card details and billing information (processed by third-party providers, handled by HONEY SYS LLC).</li>
        <li><strong>Usage Data:</strong> Interactions with the Platform, logs, device identifiers, and IP addresses.</li>
        <li><strong>Content Data:</strong> Inputs, outputs, or files you upload to the Platform.</li>
        <li><strong>Communication Data:</strong> Support requests, feedback, or other correspondence.</li>
      </BodyList>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Information",
    body: (
      <BodyList>
        <li>Providing and improving services.</li>
        <li>Processing payments and managing subscriptions.</li>
        <li>Communicating with you about updates, security, and support.</li>
        <li>Ensuring compliance with laws and policies.</li>
        <li>Analyzing usage trends to enhance the Platform.</li>
      </BodyList>
    ),
  },
  {
    id: "legal-bases",
    title: "4. Legal Bases for Processing (GDPR Users)",
    body: (
      <BodyList>
        <li>Performance of a contract (providing services you requested).</li>
        <li>Legitimate interests (service improvement, security).</li>
        <li>Legal obligations (compliance with financial/accounting rules).</li>
        <li>Consent (marketing communications, cookies).</li>
      </BodyList>
    ),
  },
  {
    id: "sharing",
    title: "5. Sharing of Information",
    body: (
      <div className="text-sm text-white/70 space-y-2">
        <ul className="list-disc pl-5 space-y-1">
          <li>Payment processors for subscription handling (on behalf of HONEY SYS LLC).</li>
          <li>Service providers who support platform operations (cloud hosting, analytics, security).</li>
          <li>Legal authorities when required by law.</li>
          <li>Corporate affiliates (Honey Prod Limited and subsidiaries).</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </div>
    ),
  },
  {
    id: "transfers",
    title: "6. International Data Transfers",
    body: (
      <p className="text-sm text-white/70">
        Your data may be transferred and stored in the United States, Hong Kong, and other jurisdictions where we or our
        providers operate. We use safeguards such as contractual protections (e.g., Standard Contractual Clauses) for
        international transfers.
      </p>
    ),
  },
  {
    id: "retention",
    title: "7. Data Retention",
    body: (
      <ul className="list-disc pl-5 space-y-2 text-sm text-white/70">
        <li><strong>Account and usage data:</strong> retained as long as you maintain an account.</li>
        <li><strong>Payment data:</strong> retained as required by financial regulations (typically 7 years).</li>
        <li><strong>Support and communication data:</strong> retained for up to 2 years.</li>
        <li>You may request deletion of your account and associated data (subject to legal obligations).</li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "8. Your Rights",
    body: (
      <div className="text-sm text-white/70 space-y-2">
        <ul className="list-disc pl-5 space-y-1">
          <li>Access your personal data.</li>
          <li>Request correction or deletion.</li>
          <li>Restrict or object to processing.</li>
          <li>Request portability of your data.</li>
          <li>Withdraw consent at any time.</li>
        </ul>
        <p>
          To exercise rights, contact: <a className="underline" href="mailto:support@honeylove.ai">support@honeylove.ai</a>
        </p>
      </div>
    ),
  },
  {
    id: "cookies",
    title: "9. Cookies and Tracking",
    body: (
      <div className="text-sm text-white/70 space-y-2">
        <p>We use cookies and similar technologies for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Authentication and login security.</li>
          <li>Service functionality.</li>
          <li>Analytics and performance.</li>
          <li>Marketing (with your consent, where required).</li>
        </ul>
        <p>You can manage cookie preferences through your browser settings.</p>
      </div>
    ),
  },
  {
    id: "children",
    title: "10. Children’s Privacy",
    body: (
      <p className="text-sm text-white/70">
        HoneyLove is not intended for individuals under 18. We do not knowingly collect data from children. If we learn we
        have collected personal information from a minor, we will delete it.
      </p>
    ),
  },
  {
    id: "security",
    title: "11. Security",
    body: (
      <p className="text-sm text-white/70">
        We implement industry-standard safeguards (encryption, access controls, monitoring) to protect your personal data.
        However, no system is 100% secure, and we cannot guarantee absolute protection.
      </p>
    ),
  },
  {
    id: "changes",
    title: "12. Changes to this Privacy Notice",
    body: (
      <p className="text-sm text-white/70">
        We may update this Privacy Notice periodically. Updates will be posted on https://honeylove.ai with a revised
        effective date.
      </p>
    ),
  },
  {
    id: "contact",
    title: "13. Contact Us",
    body: (
      <div className="text-sm text-white/70 space-y-3">
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
    ),
  },
];

export default function PrivacyPolicy() {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>Privacy Notice</h1>
          <p className={sub}>Effective Date: {effectiveDate}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 space-y-6">
          <Card>
            <div className="space-y-8">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="space-y-3">
                  <h2 className={`text-lg sm:text-xl font-semibold tracking-tight ${
                    isDark ? "text-[var(--hl-gold)]" : "text-[var(--hl-gold)]"
                  }`}>{s.title}</h2>
                  {s.body}
                </section>
              ))}
            </div>
          </Card>
        </main>

        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}>On this page</h3>
            </div>
            <nav className="mt-4 grid gap-2">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={`rounded-xl px-3 py-2 text-sm ring-1 ${
                  isDark 
                    ? "text-white/80 ring-white/10 hover:ring-white/25 hover:bg-white/5" 
                    : "text-gray-600 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50"
                }`}>
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>
        </aside>
      </div>
    </div>
  );
}
