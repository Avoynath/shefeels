import React, { useEffect, useRef, useState } from "react";
import Button from "./Button";
import ageWarningIcon from "../assets/figma/age-gate/age-warning-icon.png";

const STORAGE_KEY = "shefeels_age_verified_v1";

const AgeGate: React.FC = () => {
  // OPTIMIZATION: Check localStorage synchronously to avoid flash
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleExit();
      if (e.key === "Enter") handleContinue();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleContinue = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch { }
    // notify other components in the same window that age verification passed
    try {
      window.dispatchEvent(new CustomEvent("shefeels:age-verified"));
    } catch { }
    setOpen(false);
  };

  const handleExit = () => {
    window.location.href = "https://www.google.com";
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/75 backdrop-blur-[10px] sm:bg-black/70 sm:backdrop-blur-[14px]"
      style={{ willChange: "opacity" }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Age verification"
        className="relative z-10 w-[92%] max-w-md overflow-hidden rounded-[28px] border border-[rgba(158,130,243,0.3)] bg-[#0f0e16] px-8 py-9 text-center shadow-[0_4px_50px_rgba(0,0,0,0.25)] sm:max-w-[560px] sm:rounded-[24px] sm:px-[42px] sm:py-[36px]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#9e82f3]/55 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-8 h-32 rounded-full bg-[#7f5af0]/10 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-[26px] sm:gap-6">
          <img
            src={ageWarningIcon}
            alt="18+ warning"
            className="h-20 w-20 object-contain sm:h-[76px] sm:w-[76px]"
          />

          <h3 className="text-[18px] font-bold tracking-[0.01em] text-[#7f5af0] sm:text-[22px] sm:leading-[28px]">
            Warning 18 +
          </h3>

          <p className="max-w-[572px] text-[13px] leading-[20px] text-white sm:max-w-[470px] sm:text-[14px] sm:leading-[22px]">
            Our AI Companion experience is intended for adults only. Please
            confirm you are 18 years or older before continuing.
          </p>

          <div className="mt-1 flex w-full max-w-[572px] flex-col items-center gap-3 sm:max-w-[480px] sm:gap-4">
            <Button
              onClick={handleContinue}
              variant="agePrimary"
              className="h-11 w-full rounded-[8px] border border-[rgba(255,255,255,0.35)] bg-[radial-gradient(circle_at_12%_18%,rgba(240,220,255,0.85),transparent_34%),radial-gradient(circle_at_84%_26%,rgba(215,170,255,0.55),transparent_28%),linear-gradient(90deg,#b890f3_0%,#7f5af0_50%,#b78fe0_100%)] px-5 py-0 text-[16px] font-medium leading-[28px] text-white shadow-[inset_0_0_8.078px_rgba(227,222,255,0.2),inset_0_20px_20.196px_rgba(202,172,255,0.3),inset_0_1px_2.222px_rgba(255,255,255,1),inset_0_8px_11.31px_rgba(255,255,255,0.1)] hover:brightness-105 sm:h-[52px] sm:rounded-[10px] sm:text-[15px]"
            >
              I am over 18- Continue
            </Button>

            <Button
              onClick={handleExit}
              variant="ageSecondary"
              className="h-11 w-full rounded-[8px] border border-[rgba(255,255,255,0.3)] bg-[rgba(0,0,0,0.08)] px-5 py-0 text-[16px] font-medium leading-[28px] text-white backdrop-blur-[20px] hover:bg-[rgba(255,255,255,0.03)] sm:h-[52px] sm:rounded-[10px] sm:text-[15px]"
            >
              I am NOT over 18- Exit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgeGate;

