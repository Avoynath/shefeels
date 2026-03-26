import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  gender?: string;
};

const playIcon = "https://www.figma.com/api/mcp/asset/d7c3bd6e-b9c3-4dae-ae0e-44918992b687";
const buttonSparkIcon = "https://www.figma.com/api/mcp/asset/2efd1a83-b1cc-4b6d-98c3-1a9793259a6e";
const floatingCard = "https://www.figma.com/api/mcp/asset/f7700852-5936-4309-bc3c-b33c72205594";
const rightFloating = "https://www.figma.com/api/mcp/asset/595bea80-dfda-47fa-a362-14f6dd2ff869";
const leftCharacter = "https://www.figma.com/api/mcp/asset/83bd9571-0a9e-410f-8ea8-2d25146dc8bf";
const rightCharacter = "https://www.figma.com/api/mcp/asset/9e22c63c-861e-4632-ab4c-e4fd8e6907a8";
const rightExtraCard = "https://www.figma.com/api/mcp/asset/03845b51-3a60-49e7-87f1-031018767222";
const cloudIcon = "https://www.figma.com/api/mcp/asset/eeb6bc3b-622f-40e3-ba91-3b2111beff4b";

function HeroCard({
  title,
  onClick,
  character,
  characterClass,
  rightTopCardClass,
  rightBottomIconClass,
  leftPlay,
  rightExtra,
}: {
  title: string;
  onClick: () => void;
  character: string;
  characterClass: string;
  rightTopCardClass: string;
  rightBottomIconClass: string;
  leftPlay?: boolean;
  rightExtra?: boolean;
}) {
  return (
    <article className="relative h-[300px] overflow-hidden rounded-[20px] border-2 border-[#E53170] bg-[linear-gradient(180deg,rgba(75,1,27,0.20)_0%,rgba(229,49,112,0.20)_100%)]">
      <div className="pointer-events-none absolute right-[174px] top-[68px] h-[72px] w-[72px] rotate-[-33deg] overflow-hidden rounded-[8px] opacity-20 sm:right-[182px]">
        <img src={floatingCard} alt="" className="h-full w-full object-cover" />
      </div>

      <div className={rightTopCardClass}>
        <img src={rightFloating} alt="" className="h-full w-full object-cover opacity-20" />
      </div>

      <div className={rightBottomIconClass}>
        <img src={cloudIcon} alt="" className="h-full w-full" />
      </div>

      {rightExtra && (
        <div className="pointer-events-none absolute right-[220px] top-[140px] h-[81px] w-[81px] overflow-hidden rounded-[8px]">
          <img src={rightExtraCard} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <img src={character} alt="" className={characterClass} />

      {leftPlay && (
        <div className="pointer-events-none absolute right-[245px] top-[150px] h-[60px] w-[60px]">
          <img src={playIcon} alt="" className="h-full w-full" />
        </div>
      )}

      <div className="absolute left-[32px] top-[58px] z-10 flex max-w-[402px] flex-col gap-[30px] sm:left-[50px] sm:top-[103px]">
        <h2 className="m-0 max-w-[359px] text-[40px] leading-[1.05] font-bold text-white sm:text-[36px] sm:leading-[46px]">
          {title}
        </h2>

        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-[60px] w-fit items-center justify-center gap-[10px] rounded-[12px] border border-[rgba(255,255,255,0.50)] bg-[#E53170] px-[34px] py-3 text-[18px] leading-[28px] font-medium text-white"
        >
          <img src={buttonSparkIcon} alt="" className="h-6 w-6" />
          Chat Now
        </button>
      </div>
    </article>
  );
}

const HeroSection: React.FC<Props> = ({ gender: _gender }) => {
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-[1670px] px-4 pt-4 sm:px-6 md:px-[34px] md:pt-6">
      <div className="grid grid-cols-1 gap-[34px] lg:grid-cols-2">
        <HeroCard
          title="Best NSFW AI New Chatbot"
          onClick={() => navigate("/chat")}
          character={leftCharacter}
          characterClass="pointer-events-none absolute bottom-[-4px] right-[18px] h-[324px] w-auto max-w-none -scale-x-100 object-contain object-bottom"
          rightTopCardClass="pointer-events-none absolute right-[-22px] top-[8px] h-[45px] w-[45px] overflow-hidden rounded-[8px]"
          rightBottomIconClass="pointer-events-none absolute right-[14px] bottom-[20px] h-10 w-10"
          leftPlay
        />

        <HeroCard
          title="Best NSFW AI New Chatbot"
          onClick={() => navigate("/chat")}
          character={rightCharacter}
          characterClass="pointer-events-none absolute bottom-[-2px] right-[14px] h-[320px] w-auto max-w-none object-contain object-bottom"
          rightTopCardClass="pointer-events-none absolute right-[-18px] top-[170px] h-[56px] w-[56px] overflow-hidden rounded-[8px]"
          rightBottomIconClass="pointer-events-none absolute right-[146px] bottom-[14px] h-10 w-10"
          rightExtra
        />
      </div>
    </section>
  );
};

export default HeroSection;
