import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";

type HelpCard = {
  id: string;
  title: string;
  description: string;
  to: string;
  featured?: boolean;
};

const helpCards: HelpCard[] = [
  {
    id: "getting-started",
    title: "Get Started",
    description: "Create an account, verify your profile, and start building your first AI companion.",
    to: "/help-center/get-started",
    featured: true,
  },
  {
    id: "generate-images",
    title: "Generate Images",
    description: "Learn how prompts, styles, and credits work when creating AI images.",
    to: "/generate-image",
  },
  {
    id: "billing",
    title: "Account & Billing",
    description: "Manage subscriptions, billing cycles, token purchases, and payment questions.",
    to: "/premium",
  },
  {
    id: "my-ai",
    title: "My AI",
    description: "Organize your characters, revisit conversations, and manage saved companions.",
    to: "/my-ai",
  },
  {
    id: "gallery",
    title: "Gallery & Content",
    description: "Browse creations, review content guidelines, and understand moderation rules.",
    to: "/gallery",
  },
  {
    id: "support",
    title: "Contact Support",
    description: "Reach our support team if you need help with account access or technical issues.",
    to: "/contact-center",
  },
];

function HelpCardTile({ card }: { card: HelpCard }) {
  return (
    <Link
      to={card.to}
      className={`group relative flex min-h-[132px] flex-col items-center justify-center overflow-hidden rounded-2xl border px-4 py-5 text-center transition duration-200 ${
        card.featured
          ? "border-[#8D67FF]/70 bg-[linear-gradient(180deg,rgba(138,100,255,0.95)_0%,rgba(227,47,137,0.88)_100%)] shadow-[0_18px_70px_rgba(129,92,240,0.22)]"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.08)_100%)] hover:border-[#8D67FF]/35 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.1)_100%)]"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%)] opacity-80" />
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(129,92,240,0.18)] text-(--sf-purple-light)">
        <Sparkles className="h-4 w-4" />
      </div>
      <h2 className="relative mt-3 text-[18px] font-semibold leading-6 text-white">{card.title}</h2>
      <p className="relative mt-1.5 max-w-[295px] text-[13px] leading-relaxed tracking-[0.01em] text-white/70">
        {card.description}
      </p>
    </Link>
  );
}

export default function HelpCenter() {
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return helpCards;

    return helpCards.filter((card) => {
      const haystack = `${card.title} ${card.description}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-1 sm:px-4 md:px-6 pt-1 pb-6 sm:pt-2 sm:pb-10 md:pb-16">
      <div className="rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,#15131F_0%,#120F19_100%)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-white md:text-[28px]">Help Center</h1>

        <section className="relative mt-5 overflow-hidden rounded-[20px] border border-white/5 bg-[linear-gradient(180deg,rgba(20,17,29,0.98)_0%,rgba(16,13,24,0.98)_55%,rgba(58,15,41,0.62)_100%)] px-4 py-6 md:px-8 md:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(127,90,240,0.32),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent_0%,rgba(132,29,83,0.18)_100%)]" />

          <div className="relative mx-auto max-w-[1160px]">
            <div className="text-center">
              <h2 className="text-[22px] font-semibold tracking-tight text-white md:text-[30px]">
                Looking for help?
              </h2>
            </div>

            <div className="mx-auto mt-7 flex max-w-[480px] flex-col gap-3 sm:flex-row sm:items-center">
              <label htmlFor="help-center-search" className="sr-only">
                Search help articles
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                <input
                  id="help-center-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search here"
                  className="h-11 w-full rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] pl-11 pr-4 text-[14px] text-white outline-none transition placeholder:text-white/25 focus:border-[#8D67FF]/65 focus:bg-[rgba(255,255,255,0.08)]"
                />
              </div>
              <button
                type="button"
                className="h-11 rounded-full bg-[linear-gradient(90deg,#7F5AF0_0%,#8D67FF_100%)] px-7 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(127,90,240,0.28)] transition hover:brightness-110"
              >
                Search Now
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map((card) => (
                <HelpCardTile key={card.id} card={card} />
              ))}
            </div>

            {filteredCards.length === 0 && (
              <div className="mt-12 rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.06)] px-6 py-12 text-center">
                <p className="text-lg font-medium text-white">No help articles matched that search.</p>
                <p className="mt-2 text-sm text-white/60">
                  Try a broader keyword or open the Contact Support article for direct help.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
