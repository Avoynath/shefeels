import type { PropsWithChildren, ReactNode } from "react";
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import { Link } from 'react-router-dom';
import Card from "../components/Card";
import SEOHead from "../components/SEOHead";

// Small helpers ------------------------------------------------
function H2({ id, children }: PropsWithChildren<{ id: string }>) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <h2
      id={id}
      className={`text-lg sm:text-xl font-semibold tracking-tight ${
        isDark ? "text-[var(--hl-gold)]" : "text-[var(--hl-gold)]"
      }`}
    >
      {children}
    </h2>
  );
}

function Bullet({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <li className={`pl-2 text-sm leading-relaxed ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>{children}</li>
  );
}

function BodyText({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <div className={`text-sm leading-relaxed space-y-3 ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </div>
  );
}

function BodyParagraph({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <p className={`text-sm leading-relaxed ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </p>
  );
}

function BodyList({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <ul className={`list-disc pl-5 space-y-1 text-sm leading-relaxed ${
      isDark ? "text-white/70" : "text-gray-700"
    }`}>
      {children}
    </ul>
  );
}

// Data ---------------------------------------------------------
type Section = {
  id: string;
  title: string;
  body?: ReactNode;
  bullets?: string[];
};

const effectiveDate = "11/11/25"; // Replace when you finalize the effective date

const sections: Section[] = [
  {
    id: "introduction",
    title: "1. Introduction",
    body: (
      <BodyText>
        <p>
          Welcome to HoneyLove (“HoneyLove,” “we,” “our,” or “us”). HoneyLove provides access to AI-powered tools,
          software, and online services through https://honeylove.ai (the “Platform”).
        </p>
        <p>
          These Terms of Service (“Terms”) constitute a binding agreement between you (“you,” “your,” “User”) and:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>HONEY SYS LLC</strong>, a Delaware limited liability company, responsible for payment processing and
            customer transactions.
          </li>
          <li>
            <strong>Honey Prod Limited</strong>, a Hong Kong company, owner of the intellectual property and parent company of
            HONEY SYS LLC.
          </li>
        </ul>
        <p>
          By accessing or using the Platform, you agree to these Terms and our Privacy Policy. If you do not agree, do not
          use HoneyLove.
        </p>
      </BodyText>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    bullets: [
      "You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Platform.",
      "By using HoneyLove, you represent and warrant that you meet these requirements and have the legal capacity to enter into this agreement.",
    ],
  },
  {
    id: "account",
    title: "3. Account Registration",
    bullets: [
      "To use certain features, you must create an account and provide accurate information.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.",
      "Notify us immediately of unauthorized use of your account.",
    ],
  },
  {
    id: "services",
    title: "4. Services",
    bullets: [
      "HoneyLove provides AI-based software tools, applications, and online platforms.",
      "We may update, improve, or discontinue services at any time without prior notice.",
      "Access to some features requires a paid subscription.",
    ],
  },
  {
    id: "payments",
    title: "5. Payments and Subscriptions",
    body: (
      <BodyText>
        <p>
          All payments are processed by HONEY SYS LLC, 254 Chapman Rd, Ste 208 #24555, Newark, Delaware 19702, USA.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fees, billing cycles, and subscription terms are disclosed at the point of purchase.</li>
          <li>By purchasing, you authorize us to charge your payment method on a recurring basis until cancellation.</li>
          <li>Subscriptions automatically renew unless you cancel prior to the renewal date.</li>
        </ul>
      </BodyText>
    ),
  },
  {
    id: "ip",
    title: "6. Intellectual Property",
    body: (
      <BodyText>
        <p>
          All intellectual property rights in the Platform, software, trademarks, and content belong to Honey Prod Limited,
          Unit 1603, 16th Floor, The L. Plaza, 367–375 Queen's Road Central, Sheung Wan, Hong Kong.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Users are granted a limited, non-exclusive, non-transferable, revocable license to access and use HoneyLove for
            personal, non-commercial purposes.
          </li>
          <li>
            You may not copy, modify, distribute, sell, or lease any part of our services without written consent.
          </li>
        </ul>
      </BodyText>
    ),
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable Use",
    bullets: [
      "Do not use the Platform for unlawful, harmful, or abusive purposes.",
      "Do not upload, share, or generate content that violates laws, infringes intellectual property, or contains harassment, hate speech, or explicit illegal material.",
      "Do not attempt to hack, disrupt, or reverse engineer the Platform.",
      "Violation of these rules may result in suspension or termination of your account.",
    ],
  },
  {
    id: "termination",
    title: "8. Termination and Suspension",
    bullets: [
      "We may suspend or terminate your access at our discretion if you violate these Terms or engage in conduct harmful to HoneyLove or other users.",
      "Upon termination, your license to use our services ends immediately.",
    ],
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    bullets: [
      "HoneyLove is provided ‘as is’ and ‘as available’ without warranties of any kind.",
      "We do not guarantee uninterrupted service, error-free operation, or accuracy of AI-generated outputs.",
      "Use of HoneyLove is at your own risk.",
    ],
  },
  {
    id: "liability",
    title: "10. Limitation of Liability",
    bullets: [
      "To the fullest extent permitted by law, HoneyLove, HONEY SYS LLC, and Honey Prod Limited are not liable for indirect, incidental, special, or consequential damages.",
      "Our total liability to you for any claims related to the Platform shall not exceed the amount you paid in the 12 months preceding the claim.",
    ],
  },
  {
    id: "governing-law",
    title: "11. Governing Law",
    body: (
      <BodyList>
        <li>For payment-related matters, these Terms are governed by the laws of Delaware, USA.</li>
        <li>For intellectual property and ownership matters, these Terms are governed by the laws of Hong Kong.</li>
        <li>You agree to submit to the exclusive jurisdiction of the courts located in Delaware or Hong Kong, as applicable.</li>
      </BodyList>
    ),
  },
  {
    id: "changes",
    title: "12. Changes to These Terms",
    body: (
      <BodyParagraph>
        We may update these Terms from time to time. The updated version will be posted on https://honeylove.ai with a new
        effective date. Continued use of the Platform constitutes acceptance of the revised Terms.
      </BodyParagraph>
    ),
  },
  {
    id: "contact",
    title: "13. Contact Information",
    body: (
      <BodyText>
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
      </BodyText>
    ),
  },
] as const;

// Page ---------------------------------------------------------
export default function TermsAndConditions() {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;
  
  return (
    <>
      <SEOHead 
        title="Terms of Service - SheFeels AI"
        description="Read HoneyLove's Terms of Service and understand our legal agreements, user obligations, and service policies for our AI-powered platform."
        keywords="terms of service, terms and conditions, legal agreement, HoneyLove, AI platform, user agreement"
        canonical="/terms-and-conditions"
      />
      <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>Terms of Service</h1>
          <p className={sub}>Effective Date: {effectiveDate}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main content */}
        <main className="lg:col-span-8 space-y-6">
          {/* Terms card */}
          <Card>
            <div className="space-y-8">
              {sections.map((s) => (
                <div key={s.id} className="space-y-3">
                  <H2 id={s.id}>{s.title}</H2>
                  {s.body}
                  {s.bullets && (
                    <ul className="list-disc list-outside pl-5 space-y-2">
                      {s.bullets.map((b, i) => (
                        <Bullet key={`${s.id}-${i}`}>{b}</Bullet>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </main>

        {/* Right rail – helpful links / toc */}
        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${colors.text}`}>On this page</h3>
            </div>
            <nav className="mt-4 grid gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`rounded-xl px-3 py-2 text-sm ring-1 hover:bg-opacity-10 ${
                    colors.textSecondary
                  } ${
                    theme === "dark" 
                      ? "ring-white/10 hover:ring-white/25 hover:bg-white/5" 
                      : "ring-gray-200 hover:ring-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>

          <Card>
            <h3 className={`font-semibold ${colors.text}`}>Need help?</h3>
            <p className={`text-sm mt-2 ${colors.textSecondary}`}>
              Visit the Help Center or contact us if you have questions about your account or billing.
            </p>
              <div className="mt-4 flex gap-3">
                <Link to="/help-center" className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 hover:bg-opacity-10 ${
                  colors.text
                } ${
                  theme === "dark" 
                    ? "ring-white/10 hover:ring-white/30 hover:bg-white/5" 
                    : "ring-gray-200 hover:ring-gray-300 hover:bg-gray-100"
                }`}>Help Center</Link>
                <Link to="/contact-center" className="rounded-xl px-4 py-2 text-sm font-semibold text-black bg-gradient-to-b from-[var(--hl-gold)] to-[var(--hl-gold-strong)] shadow-lg hover:from-[var(--hl-gold)] hover:to-[var(--hl-gold-strong)] active:scale-[0.98]">Contact Us</Link>
              </div>
          </Card>
        </aside>
      </div>

  {/* footer provided by layout */}
      </div>
    </>
  );
}
