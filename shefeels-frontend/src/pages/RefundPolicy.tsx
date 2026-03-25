import type { PropsWithChildren, ReactNode } from "react";
import { Link } from 'react-router-dom';
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import Card from "../components/Card";

function H2({ id, children }: PropsWithChildren<{ id: string }>) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <h2 id={id} className={`text-lg sm:text-xl font-semibold tracking-tight ${
      isDark ? "text-[var(--hl-gold)]" : "text-[var(--hl-gold)]"
    }`}>
      {children}
    </h2>
  );
}

function Bullet({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return <li className={`pl-2 text-sm leading-relaxed ${
    isDark ? "text-white/70" : "text-gray-700"
  }`}>{children}</li>;
}

function BodyText({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return <p className={`text-sm leading-relaxed ${
    isDark ? "text-white/70" : "text-gray-700"
  }`}>{children}</p>;
}

type Section = {
  id: string;
  title: string;
  body?: ReactNode;
  bullets?: string[];
};

const sections: Section[] = [
  {
    id: "overview",
    title: "Overview",
    body: (
      <BodyText>
        We want you to be satisfied with your purchase. This Refund Policy explains when refunds are available,
        how to request one, and any conditions that apply. Please read carefully.
      </BodyText>
    ),
  },
  {
    id: "eligibility",
    title: "Eligibility",
    bullets: [
      "Refunds are available only for paid subscriptions and purchases made directly through our platform.",
      "One-time purchases may be eligible within 14 days if no significant usage has occurred.",
      "Promotional, discounted, or gift purchases may have different terms — check the offer details.",
    ],
  },
  {
    id: "process",
    title: "How to Request a Refund",
    body: (
      <div className="space-y-2">
        <BodyText>To request a refund, contact our support team with your order details and reason for the request.</BodyText>
        <BodyText>
          We'll review your request and respond within 5 business days. Approved refunds are processed to the original
          payment method and may take 5–10 business days to appear on your statement.
        </BodyText>
      </div>
    ),
  },
  {
    id: "non-refundable",
    title: "Non-Refundable Items",
    bullets: [
      "Content that has been downloaded or consumed is generally non-refundable.",
      "Refunds are not provided for change of mind after extensive use of premium features.",
      "Fraudulent transactions will be investigated; successful fraud claims may be refunded per card issuer rules.",
    ],
  },
  {
    id: "chargebacks",
    title: "Chargebacks & Disputes",
    body: (
      <BodyText>
        If you file a chargeback with your bank or card issuer, we may temporarily suspend your account while we
        investigate. We will provide evidence to the issuer; if the chargeback is reversed in our favor, you may be
        responsible for fees and reinstatement conditions.
      </BodyText>
    ),
  },
  {
    id: "contact",
    title: "Contact & Support",
    body: (
      <BodyText>
        Questions? Visit the Help Center or reach out to our <Link to="/contact-center" className="underline">Contact Center</Link> for assistance.
      </BodyText>
    ),
  },
];

export default function RefundPolicy() {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;
  
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>Refund Policy</h1>
          <p className={sub}>Please read our refund policy carefully. Last updated: Apr 8, 2025.</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <main className="lg:col-span-8 space-y-6">
          <Card>
            <div className="space-y-6">
              {sections.map((s) => (
                <div key={s.id} className="space-y-3" id={s.id}>
                  <H2 id={s.id}>{s.title}</H2>
                  {s.body}
                  {s.bullets && (
                    <ul className={`list-disc list-inside space-y-1 text-sm pl-4 ${
                      isDark ? "text-white/70" : "text-gray-700"
                    }`}>
                      {s.bullets.map((b, i) => (
                        <Bullet key={i}>{b}</Bullet>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </main>

        <aside className="lg:col-span-4 space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">On this page</h3>
            </div>
            <nav className="mt-4 grid gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:ring-white/25 hover:bg-white/5"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>

          <Card>
            <h3 className="text-white font-semibold">Need help?</h3>
            <p className="text-sm text-white/60 mt-2">
              Visit the Help Center or contact us if you have questions about refunds, billing, or account issues.
            </p>
            <div className="mt-4 flex gap-3">
              <Link to="/help-center" className="rounded-xl px-4 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/10 hover:ring-white/30 hover:bg-white/5">Help Center</Link>
              <Link to="/contact-center" className="rounded-xl px-4 py-2 text-sm font-semibold text-black bg-gradient-to-b from-[var(--hl-gold)] to-[var(--hl-gold-strong)] shadow-lg hover:from-[var(--hl-gold)] hover:to-[var(--hl-gold-strong)] active:scale-[0.98]">Contact Us</Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}