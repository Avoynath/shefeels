import React from "react";
import { useNavigate } from "react-router-dom";
import bannerBg from "../assets/figma/home/banner/banner-bg.png";
import cardLeftA from "../assets/figma/home/banner/card-left-a.png";
import cardLeftB from "../assets/figma/home/banner/card-left-b.png";
import cardCenter from "../assets/figma/home/banner/card-center.png";
import buttonChatIcon from "../assets/figma/home/banner/button-chat.svg";
import cardChatIcon from "../assets/figma/home/banner/card-chat.svg";
import maskLeft from "../assets/figma/home/banner/mask-left.svg";
import maskRight from "../assets/figma/home/banner/mask-right.svg";

type Props = {
  gender?: string;
  style?: string;
  fullWidth?: boolean;
};

const overlayCardClass =
  "relative h-[160px] w-[124px] overflow-hidden rounded-[12px] after:absolute after:inset-0 after:rounded-[12px] after:bg-[rgba(229,49,112,0.2)] after:content-['']";

const CreateBanner: React.FC<Props> = () => {
  const navigate = useNavigate();

  return (
    <section className="relative h-[240px] w-full overflow-hidden rounded-[24px]">
      <img
        src={bannerBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div
        className="pointer-events-none absolute left-[582px] top-[-88px] h-[454.533px] w-[112px] bg-[#fd3985] blur-[25px]"
        style={{ maskImage: `url(${maskLeft})`, WebkitMaskImage: `url(${maskLeft})` }}
      />
      <div
        className="pointer-events-none absolute left-[1470px] top-[-88px] h-[454.533px] w-[100px] bg-[#ca0063] blur-[25px]"
        style={{ maskImage: `url(${maskRight})`, WebkitMaskImage: `url(${maskRight})` }}
      />

      <div className="absolute left-[40px] top-[32px] flex w-[400px] flex-col items-start gap-6">
        <div className="flex w-full flex-col items-start gap-2 text-white">
          <p className="w-full text-2xl font-bold leading-tight">
            Best NSFW AI Chatbot
          </p>
          <p className="w-full text-sm leading-relaxed text-white/90">
            Our AI Girlfriend isn&apos;t just smart; she&apos;s emotionally intuitive, and uniquely tailored to understand you.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white/50 bg-[#815cf0] px-6 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-95"
        >
          <img src={buttonChatIcon} alt="" className="h-5 w-5" />
          Chat Now
        </button>
      </div>

      <div className="absolute left-[520px] top-[15px] flex items-center gap-4">
        <div className={overlayCardClass}>
          <img src={cardLeftA} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>

        <div className={overlayCardClass}>
          <img src={cardLeftB} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>

        <div className="relative flex h-[190px] w-[146px] flex-col justify-end overflow-hidden rounded-[12px] px-2.5 py-4">
          <img src={cardCenter} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.21)]" />

          <div className="relative flex w-[152px] flex-col items-start gap-[10px]">
            <p className="w-full text-base font-semibold leading-tight text-white">
              Valentina, 20
            </p>

            <span className="inline-flex h-7 items-center justify-center rounded-md bg-[#815cf0] px-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-white">
                <img src={cardChatIcon} alt="" className="h-4 w-4" />
                Chat
              </span>
            </span>
          </div>
        </div>

        <div className={overlayCardClass}>
          <img src={cardLeftA} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>

        <div className={overlayCardClass}>
          <img src={cardLeftB} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>
      </div>
    </section>
  );
};

export default CreateBanner;
