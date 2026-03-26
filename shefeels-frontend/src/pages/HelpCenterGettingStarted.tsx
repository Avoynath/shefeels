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
    <div className="mx-auto w-full max-w-[1670px] px-0 pb-12 pt-5 md:pt-8">
      <h1 className="text-[34px] font-semibold leading-[1.15] text-white md:text-[48px]">Help Center</h1>

      <div className="mt-8 grid gap-6 xl:grid-cols-[386px_minmax(0,1fr)] xl:items-start">
        <aside className="rounded-[24px] bg-[linear-gradient(180deg,#161320_0%,#120F19_100%)] p-4 md:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-[54px] w-full rounded-full border border-white/12 bg-[rgba(255,255,255,0.05)] pl-12 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#7F5AF0]/70"
            />
          </div>

          <div className="mt-4">
            {filteredTopics.map((topic) => {
              const isActive = topic.id === "getting-started";
              return (
                <Link
                  key={topic.id}
                  to={topic.to}
                  className={`mt-2 flex min-h-[60px] items-center rounded-lg px-5 py-4 text-[18px] leading-[26px] text-white transition first:mt-0 ${
                    isActive
                      ? "bg-[#7F5AF0] shadow-[0_12px_30px_rgba(127,90,240,0.2)]"
                      : "bg-transparent text-white/90 hover:bg-white/5"
                  }`}
                >
                  {topic.label}
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(20,17,29,0.98)_0%,rgba(16,13,24,0.98)_54%,rgba(72,18,49,0.72)_100%)] px-6 py-8 md:px-10 md:py-12">
          <div className="pointer-events-none absolute" />
          <div className="max-w-[940px]">
            <h2 className="text-[26px] font-semibold uppercase leading-9 text-[#7F5AF0] md:text-[34px]">
              Getting Started
            </h2>

            <ul className="mt-6 space-y-6 text-[18px] leading-[30px] text-white/80 md:text-[20px]">
              {gettingStartedBullets.map((bullet) => (
                <li key={bullet} className="flex gap-4">
                  <span className="mt-[11px] h-2 w-2 shrink-0 rounded-full bg-white/85" />
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
