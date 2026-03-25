import React from "react";
import { Link } from "react-router-dom";
import footerLogo from "../assets/figma/home/footer/footer-logo.svg";
import socialInstagramOutline from "../assets/figma/home/footer/social-instagram-outline.svg";
import socialInstagramBase from "../assets/figma/home/footer/social-instagram-base.svg";
import socialInstagramDot from "../assets/figma/home/footer/social-instagram-dot.svg";
import socialFacebook from "../assets/figma/home/footer/social-facebook.svg";
import socialX from "../assets/figma/home/footer/social-x.svg";
import dmcaBadge from "../assets/figma/home/footer/dmca.png";
import paymentBank from "../assets/figma/home/footer/payment-bank.svg";
import paymentAmex from "../assets/figma/home/footer/payment-amex.svg";
import paymentCard from "../assets/figma/home/footer/payment-card.png";

const FEATURE_LINKS = [
  { label: "Cum Facial Generator", to: "/cum-facial-generator" },
  { label: "AI Sex Simulator", to: "/ai-sex-simulator" },
  { label: "NSFW AI Image Generator", to: "/nsfw-ai-image-generator" },
  { label: "AI Slut", to: "/ai-slut" },
  { label: "NSFW AI Chatbot", to: "/nsfw-ai-chatbot" },
];

const RESOURCE_LINKS = [
  { label: "About", to: "/about" },
  { label: "Press & announcements", to: "/press" },
  { label: "Careers at Finder", to: "/careers" },
  { label: "Contact us", to: "/contact-center" },
  { label: "Terms of use", to: "/terms-of-service" },
];

const FOOTER_LEGAL_LINKS = [
  { label: "Terms & Condition", to: "/terms-of-service" },
  { label: "Refund Policy", to: "/refund-policy" },
  { label: "Privacy Policy", to: "/privacy-policy" },
];

const InstagramIcon = () => (
  <span className="relative h-[14px] w-[14px] shrink-0">
    <img src={socialInstagramOutline} alt="" className="absolute inset-0 h-full w-full" />
    <img src={socialInstagramBase} alt="" className="absolute inset-0 h-full w-full" />
    <img src={socialInstagramDot} alt="" className="absolute inset-0 h-full w-full" />
  </span>
);

const SocialIconButton = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[16px] bg-white/10">
    {children}
  </span>
);

const SOCIAL_LINKS = [
  { label: "Instagram", icon: <InstagramIcon /> },
  { label: "Facebook", icon: <img src={socialFacebook} alt="" className="h-[14px] w-[14px]" /> },
  { label: "Twiter", icon: <img src={socialX} alt="" className="h-[14px] w-[14px]" /> },
  { label: "Instagram", icon: <InstagramIcon /> },
];

const SiteFooter: React.FC<{ gender?: string }> = () => {
  return (
    <footer className="w-full border-t border-[#815cf0] bg-[radial-gradient(86%_128%_at_50%_0%,rgba(149,113,255,0.2)_0%,rgba(11,8,19,0.98)_28%,rgba(0,0,0,1)_42%,rgba(86,18,42,0.94)_100%)] pb-20 md:pb-0">
      <div className="mx-auto w-full max-w-[1670px] px-4 pt-10 sm:px-6 md:px-[34px] md:pt-[50px]">
        <div className="flex flex-col gap-10 md:gap-12">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[311px_1fr] md:gap-[178px]">
            <div className="flex flex-col gap-5">
              <img src={footerLogo} alt="honey love" className="h-[60px] w-[127px]" />
              <p className="max-w-[300px] text-[16px] leading-7 tracking-[0.02em] text-white">
                HoneyLove AI offers unlimited and realistic AI companions, uncensored chats, and immersive roleplay.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 md:gap-[134px]">
              <div className="max-w-[243px]">
                <h5 className="text-[20px] font-semibold leading-7 text-white">Features</h5>
                <ul className="mt-6 space-y-2 text-[16px] leading-[22px] text-white">
                  {FEATURE_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link to={item.to}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="max-w-[196px]">
                <h5 className="text-[20px] font-semibold leading-7 text-white">Resources</h5>
                <ul className="mt-6 space-y-2 text-[16px] leading-[22px] text-white">
                  {RESOURCE_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link to={item.to}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="max-w-[228px]">
                <h5 className="text-[20px] font-semibold leading-7 text-white">Social Media</h5>
                <ul className="mt-6 space-y-2 text-[16px] leading-[22px] text-white">
                  {SOCIAL_LINKS.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                      <SocialIconButton>{item.icon}</SocialIconButton>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-t border-white/20 py-5 text-[15px] text-white/80 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-[110px]">
              <span className="leading-[22px]">© All rights reserved.</span>
              <div className="flex flex-wrap items-center gap-6 md:gap-[110px]">
                {FOOTER_LEGAL_LINKS.map((item) => (
                  <Link key={item.label} to={item.to} className="leading-7">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <img src={dmcaBadge} alt="DMCA" className="h-10 w-[97px] rounded-[6px] object-cover" />
              <img src={paymentBank} alt="Bank" className="h-10 w-[60px]" />
              <img src={paymentAmex} alt="Amex" className="h-10 w-[60px]" />
              <img src={paymentCard} alt="Card" className="h-10 w-[58px] rounded-[8px] object-cover" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
