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
    <section className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-2">
      <h2 className="mb-8 text-center text-2xl md:text-2xl lg:text-3xl font-semibold leading-tight text-white">
        Visual Highlights That Keep The Mood
      </h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {CARDS.map((card) => (
          <article key={card.image} className="flex flex-col gap-7 lg:max-w-[736px]">
            <img
              src={card.image}
              alt=""
              aria-hidden="true"
              className="h-[200px] w-full rounded-[20px] object-cover md:h-[240px]"
            />
            <p className="text-sm md:text-base leading-relaxed text-white">
              {card.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default HighlightsTriple;
