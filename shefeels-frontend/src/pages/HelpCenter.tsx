import type { ReactNode } from "react";
import { Link } from 'react-router-dom';
import { useThemeStyles } from "../utils/theme";
import { useTheme } from "../contexts/ThemeContext";
import Card from "../components/Card";

function H2({ id, children }: { id: string; children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <h2
      id={id}
      className={`text-lg sm:text-xl font-semibold tracking-tight ${
        isDark ? "text-[var(--primary,#FFC54D)]" : "text-[var(--primary,#FFC54D)]"
      }`}
    >
      {children}
    </h2>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  return <li className={`pl-2 text-sm leading-relaxed ${
    isDark ? "text-white/70" : "text-gray-700"
  }`}>{children}</li>;
}

type Section = {
  id: string;
  title: string;
  body?: ReactNode;
  bullets?: string[];
};

const sections: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <p className="text-sm text-white/70 leading-relaxed">
        Welcome to Honey Love — here's a quick guide to get you started. Create an account,
        verify your age, then explore features like Generate Image and Create Character.
      </p>
    ),
  },
  {
    id: "account-and-billing",
    title: "Account & billing",
    bullets: [
      "Update your profile and payment method in Profile → Settings.",
      "Subscription billing is charged in advance; cancel anytime from the Premium page.",
      "See Refund Policy for refund eligibility and steps.",
    ],
  },
  {
    id: "safety-and-content",
    title: "Content & safety",
    bullets: [
      "Do not upload illegal or abusive content.",
      "Model outputs may be similar between users; exclusivity is not guaranteed.",
      "If you see a terms violation, contact support via Contact Center.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: (
      <>
        <p className="text-sm text-white/70 leading-relaxed">
          If something's not working, try clearing cache, checking your connection, or
          logging out and back in. For persistent issues, reach out through the <Link to="/contact-center" className="underline">Contact Center</Link>.
        </p>
      </>
    ),
  },
];

export default function HelpCenter() {
  const { colors } = useThemeStyles();
  const heading = "text-2xl font-semibold " + colors.text;
  
  return (
  <div className="max-w-7xl mx-auto px-0 sm:px-7 pt-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={heading}>Help Center</h1>
          {/* <p className={sub}>Find answers, guides, and support resources.</p> */}
        </div>
      </div>

  <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-y-4 gap-x-6">
        {/* Main content */}
        <main className="lg:col-span-8 space-y-6">
          <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white">Looking for help?</h3>
                {/* <p className="text-sm text-white/70 mt-1">Search FAQs or browse topics below.</p> */}
              </div>

              <div className="flex items-center gap-2 w-full max-w-[640px]">
                <label htmlFor="hc-search" className="sr-only">Search help</label>
                <input
                  id="hc-search"
                  placeholder="Search help articles"
                  className="flex-1 min-w-0 text-white/80 px-4 py-2.5 rounded-full border border-white/20 bg-[rgba(255,255,255,0.03)] focus:outline-none focus:border-[var(--secondary,#C09B62)] transition-colors placeholder:text-white/40"
                />
                <button
                  className="flex-none !text-black px-6 py-2.5 rounded-full border border-white/50 bg-[linear-gradient(90deg,#FFC54D_0%,#FFD784_100%)] whitespace-nowrap font-medium hover:opacity-90 transition-opacity"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-6">
                <h4 className="text-white font-semibold">Get started</h4>
                <p className="text-white/70 text-sm mt-2">How to create your first character and generate images.</p>
              </Card>
              <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-6">
                <h4 className="text-white font-semibold">Account & billing</h4>
                <p className="text-white/70 text-sm mt-2">Manage subscriptions, payments, and invoices.</p>
              </Card>
              <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-6">
                <h4 className="text-white font-semibold">Safety & content</h4>
                <p className="text-white/70 text-sm mt-2">Rules and how to report violations.</p>
              </Card>
              <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-6">
                <h4 className="text-white font-semibold">Contact support</h4>
                <p className="text-white/70 text-sm mt-2">Reach us via Contact Center for live help.</p>
              </Card>
            </div>
          </Card>

          {sections.map((s) => (
            <Card key={s.id}>
              <H2 id={s.id}>{s.title}</H2>
              <div className="mt-1">
                {s.body}
                {s.bullets && (
                  <ul className="mt-2 list-disc pl-4 space-y-0">
                    {s.bullets.map((b, i) => (
                      <Bullet key={i}>{b}</Bullet>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </main>

        {/* Right rail – helpful links / toc */}
        <aside className="lg:col-span-4 space-y-3">
          <Card noBase className="rounded-2xl border border-[var(--secondary,#C09B62)] bg-[var(--gradiant,linear-gradient(126deg,#000_28.96%,rgba(255,197,77,0)_262.7%))] p-3">
            <h3 className="text-white font-semibold">Topics</h3>
            <nav className="mt-3 grid gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-sm text-white/70 rounded-md px-2 py-1 transition hover:bg-[var(--primary,#FFC54D)] hover:text-black active:bg-[var(--primary,#FFC54D)] active:text-black focus:outline-none focus:bg-[var(--primary,#FFC54D)] focus:text-black"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>

          <Card>
            <h3 className="text-white font-semibold">Need more help?</h3>
            <p className="text-white/70 text-sm mt-2">If you can't find an answer, contact our support team.</p>
            <div className="mt-4">
              <Link
                to="/contact-center"
                className="inline-block !text-black font-normal px-4 py-2 rounded-[60px] border border-white/50 bg-[linear-gradient(90deg,#FFC54D_0%,#FFD784_100%)]"
              >
                Contact Center
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
