import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

type Topic = {
  id: string;
  label: string;
  to: string;
};

const topics: Topic[] = [
  { id: "getting-started", label: "Get Started", to: "/help-center/get-started" },
  { id: "generate-images", label: "Generate Images", to: "/generate-image" },
  { id: "account-billing", label: "Account & Billing", to: "/premium" },
  { id: "my-ai", label: "My AI", to: "/my-ai" },
  { id: "gallery", label: "Gallery & Content", to: "/gallery" },
];

const gettingStartedBullets = [
  "Create your account and complete the required verification flow so your profile is ready for chats, image generation, and saved characters.",
  "Open Create Character to customize your AI companion's look, personality, and style, then save it to your library for later conversations.",
  "Use Generate Image when you want visuals, and visit Premium or Buy Tokens if you need more credits for higher-volume image creation.",
];

export default function HelpCenterGettingStarted() {
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return topics;
    return topics.filter((topic) => topic.label.toLowerCase().includes(search));
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 pb-8 pt-4 sm:px-4 md:px-6 md:pt-6">
      <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">Help Center</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-start">
        <aside className="lg:col-span-4 rounded-2xl bg-[#161320] p-4 md:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides..."
              className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#7F5AF0]/50"
            />
          </div>

          <div className="mt-4">
            {filteredTopics.map((topic) => {
              const isActive = topic.id === "getting-started";
              return (
                <Link
                  key={topic.id}
                  to={topic.to}
                  className={`mt-1.5 flex h-10 items-center rounded-lg px-4 text-sm font-medium transition first:mt-0 ${
                    isActive
                      ? "bg-[#7F5AF0] text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {topic.label}
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="lg:col-span-8 overflow-hidden rounded-2xl border border-white/5 bg-[linear-gradient(180deg,rgba(20,17,29,0.98)_0%,rgba(16,13,24,0.98)_54%,rgba(229,49,112,0.15)_100%)] p-6 md:p-8">
          <div className="max-w-[800px]">
            <h2 className="text-xl font-bold uppercase tracking-tight text-[#7F5AF0] md:text-2xl">
              Getting Started
            </h2>

            <ul className="mt-5 space-y-5 text-sm leading-relaxed text-white/70 md:text-base">
              {gettingStartedBullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7F5AF0]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
