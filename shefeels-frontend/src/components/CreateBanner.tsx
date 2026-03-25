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
  "relative h-[200px] w-[154px] overflow-hidden rounded-[12px] after:absolute after:inset-0 after:rounded-[12px] after:bg-[rgba(229,49,112,0.2)] after:content-['']";

const CreateBanner: React.FC<Props> = () => {
  const navigate = useNavigate();

  return (
    <section className="relative h-[280px] w-full overflow-hidden rounded-[30px]">
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

      <div className="absolute left-[53px] top-[38px] flex w-[487px] flex-col items-start gap-[30px]">
        <div className="flex w-full flex-col items-start gap-3 text-white">
          <p className="w-full text-[36px] font-bold leading-[46px]">
            Best NSFW AI Chatbot
          </p>
          <p className="w-full text-[20px] leading-[28px] text-white">
            Our AI Girlfriend isn&apos;t just smart; she&apos;s emotionally intuitive, and uniquely tailored to understand you.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="inline-flex h-[60px] items-center justify-center gap-[10px] rounded-[12px] border border-white/50 bg-[#815cf0] px-[34px] py-3 text-[18px] font-medium leading-[28px] text-white"
        >
          <img src={buttonChatIcon} alt="" className="h-6 w-6" />
          Chat Now
        </button>
      </div>

      <div className="absolute left-[635px] top-[20px] flex items-center gap-5">
        <div className={overlayCardClass}>
          <img src={cardLeftA} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>

        <div className={overlayCardClass}>
          <img src={cardLeftB} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        </div>

        <div className="relative flex h-[240px] w-[184px] flex-col justify-end overflow-hidden rounded-[12px] px-[10px] py-4">
          <img src={cardCenter} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(0,0,0,0.21)]" />

          <div className="relative flex w-[152px] flex-col items-start gap-[10px]">
            <p className="w-full text-[18px] font-semibold leading-[26px] text-white">
              Valentina, 20
            </p>

            <span className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[#815cf0] px-[15px] py-[7px]">
              <span className="inline-flex items-center gap-[6px] text-[14px] leading-5 text-white">
                <img src={cardChatIcon} alt="" className="h-5 w-5" />
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
