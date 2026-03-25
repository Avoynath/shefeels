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
    <section className="mx-auto w-full max-w-[1602px] px-4 py-12 sm:px-6 md:px-0 md:py-[50px]">
      <h2 className="mb-10 text-center text-[30px] font-bold leading-[1.2] text-white md:mb-[50px] md:text-[40px] md:leading-[50px]">
        Why This Experience Feels Better
      </h2>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-[30px]">
        {CARD_CONTENT.map((card) => (
          <article
            key={card.title}
            className="min-h-[279px] rounded-[20px] p-8"
            style={{ backgroundImage: "linear-gradient(180.136deg, #7f5af0 3.02%, #e53170 98.45%)" }}
          >
            <div className="flex h-full flex-col gap-[26px]">
              <div className="flex items-center gap-5">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[47px] bg-white/8">
                  <img src={FeatureSparkleIcon} alt="" className="h-7 w-7 object-contain" />
                </div>
                <h3 className="max-w-[220px] text-[24px] font-medium leading-9 tracking-[0.02em] text-white md:text-[26px]">
                  {card.title}
                </h3>
              </div>

              <p className="text-[18px] leading-[30px] tracking-[0.02em] text-white">
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
