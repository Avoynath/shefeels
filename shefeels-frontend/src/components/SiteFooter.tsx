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
import paymentCard from "../assets/figma/home/footer/payment-card.png";

const SiteFooter: React.FC<{ gender?: string }> = ({ gender }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isMale = gender === 'Male';
  const isFemale = gender === 'Female';
  const label = isMale ? 'boyfriend' : isFemale ? 'girlfriend' : 'companion';

  return (
    <footer className={`w-full pb-20 md:pb-0 ${
      isDark 
        ? "bg-linear-to-r from-[#2b1a3d] to-[#0c0c0e]" 
        : "bg-linear-to-r from-[#e8d8f8] via-purple-50 to-pink-50"
    }`}>
      <div className="mx-auto w-full max-w-screen-2xl px-3 sm:px-4 md:px-6 py-8 md:px-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <img src={footerLogo} alt="honey love" className="h-8" />
            </div>
            <p className={`mt-3 text-sm ${isDark ? "text-white/80" : "text-gray-600"}`}>
              SheFeels AI offers unlimited &amp; realistic AI {label}, nsfw ai chat online, and interactive AI companion fun.
            </p>
          </div>

          {/* Resources */}
          <div>
            <h5 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Resources</h5>
            <ul className={`mt-3 space-y-2 text-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
              <li><Link to="/contact-center" className="hover:underline">Contact us</Link></li>
              <li><Link to="/terms-of-service" className="hover:underline">Terms of Service</Link></li>
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
          <div>© All rights reserved.</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/legal" className="hover:underline">Legal</Link>
            <Link to="/terms-of-service" className="hover:underline">Terms of Service</Link>
            <Link to="/refund-policy" className="hover:underline">Refund Policy</Link>
            <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
            <Link to="/contact-center" className="hover:underline">Contact Center</Link>
            <Link to="/help-center" className="hover:underline">Help Center</Link>
          </div>
          <div className={`flex gap-3 ${isDark ? "text-white/60" : "text-gray-500"}`}>
            <span className="w-6 h-6 block">
              <img src={dmcaBadge} alt="DMCA" className="w-6 h-6 rounded object-cover" />
            </span>
            <span className="w-6 h-6 block">
              <img src={paymentBank} alt="Bank" className="w-6 h-6" />
            </span>
            <span className="w-6 h-6 block">
              <img src={paymentAmex} alt="Amex" className="w-6 h-6" />
            </span>
            <span className="w-6 h-6 block">
              <img src={paymentCard} alt="Card" className="w-6 h-6 rounded object-cover" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
