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
    <section className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-8">
      <div className="relative grid grid-cols-1 gap-6 rounded-[24px] p-6 ring-1 md:grid-cols-[1fr_340px] md:p-10 theme-transition bg-[#0c0c0e] ring-white/10 overflow-hidden">
        {/* Background Gradients (SheFeels Purple/Pink) */}
        <div className="pointer-events-none absolute inset-0 rounded-[24px] opacity-[0.25] [background:radial-gradient(100%_90%_at_10%_20%,rgba(127,90,240,0.2),transparent_35%),radial-gradient(90%_120%_at_100%_0%,rgba(229,49,112,0.15),transparent_55%)]" />
        
        {/* Left Side - Content */}
        <div className="relative z-10 flex flex-col justify-center">
          <h2 className="mb-8 text-2xl md:text-3xl lg:text-4xl font-bold leading-tight text-white max-w-xl">
            {content.heading}
          </h2>

          <div className="flex flex-col gap-6 max-w-2xl">
            {content.points.map((point) => (
              <div key={point.title} className="group relative pl-6">
                {/* Accent line/dot picker */}
                <div className="absolute left-0 top-[6px] h-full w-[2px] bg-white/10 group-last:h-[12px]">
                  <div className="h-[12px] w-full rounded-full bg-[#815CF0] shadow-[0_0_12px_rgba(129,92,240,0.6)]" />
                </div>
                
                <h3 className="text-lg md:text-xl font-semibold leading-snug text-white group-hover:text-[#9A7AF4] transition-colors">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-white/60">
                  {point.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Image Card */}
        <div className="relative z-10 mx-auto md:ml-auto w-full max-w-[340px]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10">
            <img
              src={imageSrc}
              alt={content.heading}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
            {/* Visual overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#7F5AF0]/10 via-transparent to-[#E53170]/5" />
          </div>
          
          {/* Decorative element behind image */}
          <div className="absolute -z-10 -bottom-4 -right-4 h-full w-full rounded-[28px] border-2 border-white/5 opacity-40 translate-x-1 translate-y-1" />
        </div>
      </div>
    </section>
  );
};

export default InfoSplit;
