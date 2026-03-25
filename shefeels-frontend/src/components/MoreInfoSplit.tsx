import React from "react";
import { useNavigate } from "react-router-dom";
import CtaSparkleIcon from "../assets/figma/home/lower/cta-sparkle.svg";

type Props = {
  gender?: string;
  style?: string;
};

const MoreInfoSplit: React.FC<Props> = () => {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-[1602px] px-4 py-12 sm:px-6 md:px-0 md:py-[60px]">
      <div
        className="relative overflow-hidden rounded-[20px] border border-white/16 px-6 py-10 md:min-h-[514px] md:px-[60px] md:py-[60px]"
        style={{
          background:
            "radial-gradient(86% 128% at 50% 0%, rgba(149,113,255,0.2) 0%, rgba(11,8,19,0.98) 28%, rgba(0,0,0,1) 42%, rgba(86,18,42,0.94) 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(149,113,255,0.12),transparent_24%),linear-gradient(180deg,transparent_0%,rgba(229,49,112,0.08)_100%)]" />
        <div className="relative mx-auto flex max-w-[1482px] flex-col items-center justify-center gap-10 text-center md:gap-[40px]">
          <h2 className="w-full text-[30px] font-bold leading-[1.2] text-white md:text-[40px] md:leading-[50px]">
            Start Generating Without Limits
          </h2>

          <div className="flex w-full flex-col items-center gap-8 md:gap-[50px]">
            <p className="max-w-[1454px] text-[18px] leading-[30px] tracking-[-0.01em] text-white/82 md:text-[20px] md:leading-[32px]">
              Build a custom companion, shape the fantasy, and jump straight into a faster, hotter workflow made around chat, image generation, and private roleplay.
            </p>

            <button
              type="button"
              onClick={() => navigate("/generate-image")}
              className="inline-flex h-[62px] w-full max-w-[250px] items-center justify-center gap-[10px] rounded-[12px] border px-[32px] text-[18px] font-semibold leading-[28px] text-white transition hover:brightness-110"
              style={{
                background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
                borderColor: 'rgba(255,255,255,0.20)',
                boxShadow: 'inset 0 0 8.078px rgba(227,222,255,0.2), inset 0 20px 20.196px rgba(202,172,255,0.3), inset 0 1px 2.222px rgba(255,255,255,1), inset 0 8px 11.31px rgba(255,255,255,0.1)',
                backdropFilter: 'blur(5.049px)',
                WebkitBackdropFilter: 'blur(5.049px)',
              }}
            >
              <img src={CtaSparkleIcon} alt="" className="h-6 w-6" />
              <span className="whitespace-nowrap">Generate Now</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MoreInfoSplit;
