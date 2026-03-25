import React from "react";
import highlightLeft from "../assets/figma/home/highlights/highlight-left.png";
import highlightRight from "../assets/figma/home/highlights/highlight-right.png";

const CARDS = [
  {
    image: highlightLeft,
    text: "Polish the visual story with sections that feel intentional, image-led, and far less like a generic landing page template.",
  },
  {
    image: highlightRight,
    text: "Use bolder artwork, stronger framing, and cleaner text rhythm so the lower page keeps the same atmosphere as the hero and grid.",
  },
];

const HighlightsTriple: React.FC<{ gender?: string }> = () => {
  return (
    <section className="mx-auto w-full max-w-[1602px] px-4 py-12 sm:px-6 md:px-0 md:py-[50px]">
      <h2 className="mb-10 text-center text-[30px] font-bold leading-[1.2] text-white md:mb-[50px] md:text-[40px] md:leading-[50px]">
        Visual Highlights That Keep The Mood
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:justify-between lg:gap-[60px]">
        {CARDS.map((card) => (
          <article key={card.image} className="flex flex-col gap-7 lg:max-w-[736px]">
            <img
              src={card.image}
              alt=""
              aria-hidden="true"
              className="h-[240px] w-full rounded-[20px] object-cover md:h-[300px] lg:h-[300px] lg:w-[736px]"
            />
            <p className="text-[18px] leading-[30px] text-white md:text-[20px] md:leading-[32px]">
              {card.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default HighlightsTriple;
