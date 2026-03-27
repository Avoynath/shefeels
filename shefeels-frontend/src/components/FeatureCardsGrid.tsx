import React from "react";
import FeatureSparkleIcon from "../assets/figma/home/lower/feature-sparkle.svg";

const CARD_CONTENT = [
  {
    title: "Always ready for you",
    text: "Jump from one fantasy to the next with a companion that stays available, responsive, and tuned to your preferred vibe.",
  },
  {
    title: "Built around chemistry",
    text: "Every interaction feels sharper when the visuals, prompts, and replies all reinforce the same mood and tension.",
  },
  {
    title: "Made to feel personal",
    text: "The whole experience is customizable enough to feel like your own space instead of a generic AI chat surface.",
  },
];

const FeatureCardsGrid: React.FC<{ gender?: string }> = () => {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-2">
      <h2 className="mb-8 text-center text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-white">
        Why This Experience Feels Better
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {CARD_CONTENT.map((card) => (
          <article
            key={card.title}
            className="rounded-xl p-6"
            style={{ backgroundImage: "linear-gradient(180.136deg, #7f5af0 3.02%, #e53170 98.45%)" }}
          >
            <div className="flex h-full flex-col gap-[26px]">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-white/8">
                  <img src={FeatureSparkleIcon} alt="" className="h-8 w-8 object-contain" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold leading-snug text-white">
                  {card.title}
                </h3>
              </div>

              <p className="text-xs md:text-sm leading-relaxed text-white">
                {card.text}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default FeatureCardsGrid;
