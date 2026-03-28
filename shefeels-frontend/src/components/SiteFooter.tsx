import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import footerLogo from "../assets/figma/home/footer/footer-logo.svg";
import socialInstagram from "../assets/figma/home/footer/social-instagram-custom.svg";
import socialFacebook from "../assets/figma/home/footer/social-facebook.svg";
import socialX from "../assets/figma/home/footer/social-x.svg";
import dmcaBadge from "../assets/figma/home/footer/dmca.png";
import paymentBank from "../assets/figma/home/footer/payment-bank.svg";
import paymentAmex from "../assets/figma/home/footer/payment-amex.svg";
import paymentCard from "../assets/figma/home/footer/payment-fourth.svg";

const SiteFooter: React.FC<{ gender?: string }> = ({ gender }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isMale = gender === 'Male';
  const isFemale = gender === 'Female';
  const label = isMale ? 'boyfriend' : isFemale ? 'girlfriend' : 'companion';

  return (
    <footer className={`w-full pb-20 md:pb-0 ${
      isDark 
        ? "bg-linear-to-r from-[#170B2E] to-[#0c0c0e]" 
        : "bg-linear-to-r from-[#F5F1FF] via-purple-50 to-pink-50"
    }`}>
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-8 md:px-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <img 
                src={footerLogo} 
                alt="SheFeels" 
                className="block shrink-0" 
                style={{ width: "93.866px", height: "44.262px", flexShrink: 0 }}
              />
            </div>
            <p className={`mt-3 text-sm max-w-md ${isDark ? "text-white/80" : "text-gray-600"}`}>
              SheFeels AI offers unlimited &amp; realistic AI {label}, nsfw ai chat online, and interactive AI companion fun.
            </p>
            <div className={`mt-4 text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
              <p>JLHL MANAGEMENT LTD (HE 484306)</p>
              <p>Georgiou Karaiskaki 11-13, Carisa Salonica Court, Office 102</p>
              <p>7560 Pervolia, Larnaca, Cyprus</p>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h5 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Resources</h5>
            <ul className={`mt-3 space-y-2 text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
              <li><Link to="/contact-center" className="hover:underline">Contact us</Link></li>
              <li><Link to="/help-center" className="hover:underline">Help Center</Link></li>
              <li><Link to="/terms-of-service" className="hover:underline">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h5 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Social Media</h5>
            <ul className={`mt-3 space-y-2 text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
              <li className="flex items-center gap-2">
                <img src={socialInstagram} alt="" className="w-4 h-4" /> SheFeels AI on Instagram
              </li>
              <li className="flex items-center gap-2">
                <img src={socialFacebook} alt="" className="w-4 h-4" /> SheFeels AI on Facebook
              </li>
              <li className="flex items-center gap-2">
                <img src={socialX} alt="" className="w-4 h-4" /> SheFeels AI on Twitter
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`mt-8 border-t pt-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs ${
          isDark 
            ? "border-white/10 text-white/60" 
            : "border-gray-200 text-gray-500"
        }`}>
          <div>© 2026 shefeels.ai. All rights reserved.</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/legal" className="hover:underline">Legal Documentation</Link>
            <Link to="/terms-of-service" className="hover:underline">Terms</Link>
            <Link to="/privacy-policy" className="hover:underline">Privacy</Link>
            <Link to="/cookies-notice" className="hover:underline">Cookies</Link>
            <Link to="/dmca-policy" className="hover:underline">DMCA</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="block h-10 w-[108px] shrink-0">
              <img src={dmcaBadge} alt="DMCA" className="h-full w-full rounded-[8px] object-contain" />
            </span>
            <span className="block h-10 w-[58px] shrink-0">
              <img src={paymentBank} alt="Bank" className="h-full w-full object-contain" />
            </span>
            <span className="block h-10 w-[64px] shrink-0">
              <img src={paymentAmex} alt="Amex" className="h-full w-full object-contain" />
            </span>
            <span className="block h-10 w-[58px] shrink-0">
              <img src={paymentCard} alt="Card" className="h-full w-full object-contain" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
