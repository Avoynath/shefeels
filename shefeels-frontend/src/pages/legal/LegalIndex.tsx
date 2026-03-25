import { Link } from "react-router-dom";
import Card from "../../components/Card";
import { useThemeStyles } from "../../utils/theme";
import { useTheme } from "../../contexts/ThemeContext";

export default function LegalIndex() {
  const { colors } = useThemeStyles();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const heading = "text-3xl font-bold " + colors.text;
  const sub = "mt-2 " + colors.textSecondary;

  const links = [
    { to: "/terms-of-service", label: "Terms of Service" },
    { to: "/privacy-policy", label: "Privacy Policy" },
    { to: "/refund-policy", label: "Refund Policy" },
    { to: "/cookies-notice", label: "Cookies Notice" },
    { to: "/dmca-policy", label: "DMCA Policy" },
    { to: "/community-guidelines", label: "Community Guidelines" },
    { to: "/blocked-content-policy", label: "Blocked Content Policy" },
    { to: "/content-removal-policy", label: "Content Removal Policy" },
    { to: "/complaint-policy", label: "Complaint Policy" },
    { to: "/affiliate-terms", label: "Affiliate Terms" },
    { to: "/kyc-policy", label: "KYC Policy" },
    { to: "/underage-policy", label: "Underage Policy" },
    { to: "/2257-exemption", label: "18 U.S.C. 2257 Exemption" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Card>
        <h1 className={heading}>Legal &amp; Compliance</h1>
        <p className={sub}>Find all our policies and legal notices in one place.</p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`rounded-xl px-4 py-3 text-sm ring-1 hover:bg-opacity-10 ${
                colors.text
              } ${
                isDark 
                  ? "ring-white/10 hover:ring-white/30 hover:bg-white/5" 
                  : "ring-gray-200 hover:ring-gray-300 hover:bg-gray-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className={`pt-6 text-xs ${colors.textSecondary}`}>Last updated: Nov 11, 2025</div>
      </Card>
    </div>
  );
}
