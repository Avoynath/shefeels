import React from "react";
import figmaDefaultSplit from "../assets/figma/home/lower/info-split-main.png";
import femaleAnime from "../assets/home/info-split/female/anime.webp";
import femaleRealistic from "../assets/home/info-split/female/realistic.webp";
import maleAnime from "../assets/home/info-split/male/anime.jpg";
import maleRealistic from "../assets/home/info-split/male/realistic.jpg";

type Props = {
  gender?: string;
  style?: string;
};

const CONTENT = {
  default: {
    heading: "Shape Your Ideal AI Companion",
    points: [
      {
        title: "Choose the energy you want",
        text: "Build a companion that feels soft, intense, playful, or fully unfiltered. The tone follows your mood from the very first message.",
      },
      {
        title: "Train every little detail",
        text: "Looks, attitude, vibe, and chemistry can all be adjusted so the experience feels personal instead of generic.",
      },
      {
        title: "Keep coming back to her",
        text: "The design is built around fantasy, memory, and repetition so your favorite character still feels familiar every time you return.",
      },
    ],
  },
  male: {
    heading: "Build An AI Boyfriend Around Your Taste",
    points: [
      {
        title: "Pick his look and vibe",
        text: "Decide how soft, bold, romantic, or teasing he should feel so the connection starts in exactly the tone you want.",
      },
      {
        title: "Make him match your mood",
        text: "He can react warmly on low days or switch into something more playful and flirty when that is what you need.",
      },
      {
        title: "Keep the chemistry consistent",
        text: "Instead of random replies, the experience stays emotionally steady and tailored to the style you shaped for him.",
      },
    ],
  },
  trans: {
    heading: "Create A Trans AI Character That Feels Personal",
    points: [
      {
        title: "Design the exact visual style",
        text: "Control the body type, expression, energy, and overall mood so the character feels aligned with your imagination.",
      },
      {
        title: "Make every response feel warm",
        text: "The personality adapts to your tone and gives you a private space that feels safe, direct, and genuinely attentive.",
      },
      {
        title: "Keep the experience fully yours",
        text: "From casual chats to bold fantasy, every interaction can stay private, specific, and built around your own preferences.",
      },
    ],
  },
};

const InfoSplit: React.FC<Props> = ({ gender, style = "realistic" }) => {
  const g = String(gender || "").toLowerCase();
  const isMale = g === "male";
  const isTrans = g.startsWith("trans");
  const isAnime = style === "anime";

  const content = isMale ? CONTENT.male : isTrans ? CONTENT.trans : CONTENT.default;
  const imageSrc = isMale
    ? (isAnime ? maleAnime : maleRealistic)
    : isAnime
      ? femaleAnime
      : isTrans
        ? femaleRealistic
        : figmaDefaultSplit;

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-2">
      <h2 className="mb-6 text-center text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight text-white">
        {content.heading}
      </h2>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1fr_380px] md:gap-8">
        <div className="overflow-hidden rounded-[20px]">
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className="h-[200px] w-full rounded-[20px] object-cover md:h-[320px]"
          />
        </div>

        <div className="flex max-w-[721px] flex-col">
          {content.points.map((point, index) => (
            <div
              key={point.title}
              className={`relative pl-[31px] ${index < content.points.length - 1 ? "mb-5 border-b border-dashed border-white/16 pb-5" : ""}`}
            >
              <div>
                <span className="absolute left-0 top-[8px] h-[9px] w-[11px] rounded-[2px] bg-white" />
                <h3 className="text-lg md:text-xl font-semibold leading-snug tracking-[0.02em] text-white">
                  {point.title}
                </h3>
                <p className="mt-2 text-xs md:text-sm leading-relaxed text-white/70">
                  {point.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InfoSplit;
