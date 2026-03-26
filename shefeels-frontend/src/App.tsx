import "./index.css";

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { PerformanceProvider } from "./contexts/PerformanceContext";
import AppLayout from "./components/AppLayout";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import PageSkeleton from "./components/PageSkeleton";
import CookieBanner from "./components/CookieBanner.tsx";
import AdsFunnel from "./pages/AdsFunnel";
import PaymentFunnel from "./pages/PaymentFunnel";

// Lazy load all pages for aggressive code splitting
const CreateCharacter = lazy(() => import("./pages/CreateCharacter"));
const Gallery = lazy(() => import("./pages/Gallery"));
const GenerateImage = lazy(() => import("./pages/GenerateImage"));
const CharacterSelect = lazy(() => import("./pages/CharacterSelect"));
const PrivateContent = lazy(() => import("./pages/PrivateContent"));
const PrivateContentPackMedia = lazy(() => import("./pages/PrivateContentPackMedia"));
const MyAI = lazy(() => import("./pages/MyAI"));
const Premium = lazy(() => import("./pages/Premium"));
const Verify = lazy(() => import("./pages/Verify"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess"));
const BuyTokens = lazy(() => import("./pages/BuyTokens"));
const Profile = lazy(() => import("./pages/Profile"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const Chat = lazy(() => import("./pages/Chat"));
const Login = lazy(() => import("./pages/Login"));
const CharacterProfile = lazy(() => import("./pages/CharacterProfile"));
const TermsAndCondition = lazy(() => import("./pages/TermsAndCondition"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ContactCenter = lazy(() => import("./pages/ContactCenter"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const HelpCenterGettingStarted = lazy(() => import("./pages/HelpCenterGettingStarted"));
const AdminHost = lazy(() => import("./admin/AdminHost"));

// Legal hub + additional policies - lazy loaded
const LegalIndex = lazy(() => import("./pages/legal/LegalIndex"));
const AffiliateTerms = lazy(() => import("./pages/legal/AffiliateTerms"));
const BlockedContentPolicy = lazy(() => import("./pages/legal/BlockedContentPolicy"));
const CommunityGuidelines = lazy(() => import("./pages/legal/CommunityGuidelines"));
const ComplaintPolicy = lazy(() => import("./pages/legal/ComplaintPolicy"));
const ContentRemovalPolicy = lazy(() => import("./pages/legal/ContentRemovalPolicy"));
const CookiesNotice = lazy(() => import("./pages/legal/CookiesNotice"));
const DmcaPolicy = lazy(() => import("./pages/legal/DmcaPolicy"));
const UnderagePolicy = lazy(() => import("./pages/legal/UnderagePolicy"));
const Exemption2257 = lazy(() => import("./pages/legal/Exemption2257"));
const KycPolicy = lazy(() => import("./pages/legal/KycPolicy"));

const RouteSkeletonFallback = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isFunnelRoute = ["/4902w", "/ads-funnel", "/payment-funnel"].includes(location.pathname);

  if (isAdminRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
      </div>
    );
  }

  if (isFunnelRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101010] text-white">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#FF9C00]/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#FF9C00] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <PageSkeleton />
    </AppLayout>
  );
};

import { injectScripts } from "./services/codeInjectionService";

// ... existing imports ...

export default function App() {
  useEffect(() => {
    // Inject custom scripts (GTM, etc.)
    injectScripts();

    if (typeof window === "undefined") return;

    const preloadRoutes = () => {
      const loaders = [
        () => import("./pages/CreateCharacter"),
        () => import("./pages/GenerateImage"),
        () => import("./pages/MyAI"),
      ];

      loaders.forEach((load) => {
        load().catch(() => {});
      });
    };

    const win = window as typeof window & {
      requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    if (typeof win.requestIdleCallback === "function") {
      idleHandle = win.requestIdleCallback(() => {
        preloadRoutes();
      }, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(preloadRoutes, 1200);
    }

    return () => {
      if (idleHandle != null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, []);

  return (
    <ErrorBoundary>
      <PerformanceProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <ScrollToTop />
              <CookieBanner />
              <Suspense fallback={<RouteSkeletonFallback />}>
          <Routes>
            <Route path="/" element={<AppLayout />} />
            <Route path="/ai-girlfriend" element={<AppLayout />} />
            <Route path="/ai-boyfriend" element={<AppLayout />} />
            <Route path="/ai-transgender" element={<AppLayout />} />
            <Route path="/4902w" element={<AdsFunnel />} />
            <Route path="/create-character" element={<AppLayout><CreateCharacter /></AppLayout>} />
            <Route path="/gallery" element={<AppLayout><Gallery /></AppLayout>} />
            <Route path="/generate-image" element={<AppLayout><GenerateImage /></AppLayout>} />
            <Route path="/generate-image/characters" element={<AppLayout><CharacterSelect /></AppLayout>} />
            <Route path="/private-content" element={<Navigate to="/private-content/select-character" replace />} />
            {/* Select character page used when user wants to choose which character's private packs to browse */}
            <Route path="/private-content/select-character" element={<AppLayout><CharacterSelect /></AppLayout>} />
            {/* New, cleaner slugs for private content */}
            <Route path="/private-content/character/:characterId/packs" element={<AppLayout><PrivateContent /></AppLayout>} />
            <Route path="/private-content/pack/:packId/media" element={<AppLayout><PrivateContentPackMedia /></AppLayout>} />
            {/* Backwards-compat: old packs route redirects to the selector */}
            <Route path="/private-content/packs" element={<Navigate to="/private-content/select-character" replace />} />
            {/* Keep old pack media route working */}
            <Route path="/private-content/:packId/media" element={<AppLayout><PrivateContentPackMedia /></AppLayout>} />
            <Route path="/my-ai" element={<AppLayout><MyAI /></AppLayout>} />
            <Route path="/buy-tokens" element={<AppLayout><BuyTokens /></AppLayout>} />
            <Route path="/order-history" element={<AppLayout><OrderHistory /></AppLayout>} />
            <Route path="/premium" element={<AppLayout><Premium /></AppLayout>} />
            <Route path="/verify" element={<AppLayout><Verify /></AppLayout>} />
            <Route path="/subscription-success" element={<AppLayout><SubscriptionSuccess /></AppLayout>} />
            <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
            <Route path="/login" element={<AppLayout><Login /></AppLayout>} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            {/* Chat routes with dynamic character and pack slugs */}
            <Route path="/chat" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="/chat/:characterSlug" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="/chat/:characterSlug/private-pack" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="/chat/:characterSlug/pack/:packSlug" element={<AppLayout><Chat /></AppLayout>} />
            <Route path="/character/:slug" element={<AppLayout><CharacterProfile /></AppLayout>} />
            {/* Backwards-compat: legacy route kept but prefer canonical /character/:characterId */}
            <Route path="/character-profile" element={<AppLayout><CharacterProfile /></AppLayout>} />
            {/* Legal hub and documents */}
            <Route path="/legal" element={<AppLayout><LegalIndex /></AppLayout>} />
            {/* Redirect old slug to canonical Terms of Service */}
            <Route path="/terms-and-condition" element={<Navigate to="/terms-of-service" replace />} />
            <Route path="/terms-of-service" element={<AppLayout><TermsAndCondition /></AppLayout>} />
            <Route path="/refund-policy" element={<AppLayout><RefundPolicy /></AppLayout>} />
            <Route path="/privacy-policy" element={<AppLayout><PrivacyPolicy /></AppLayout>} />
            <Route path="/cookies-notice" element={<AppLayout><CookiesNotice /></AppLayout>} />
            <Route path="/dmca-policy" element={<AppLayout><DmcaPolicy /></AppLayout>} />
            <Route path="/community-guidelines" element={<AppLayout><CommunityGuidelines /></AppLayout>} />
            <Route path="/blocked-content-policy" element={<AppLayout><BlockedContentPolicy /></AppLayout>} />
            <Route path="/content-removal-policy" element={<AppLayout><ContentRemovalPolicy /></AppLayout>} />
            <Route path="/complaint-policy" element={<AppLayout><ComplaintPolicy /></AppLayout>} />
            <Route path="/affiliate-terms" element={<AppLayout><AffiliateTerms /></AppLayout>} />
            <Route path="/underage-policy" element={<AppLayout><UnderagePolicy /></AppLayout>} />
            <Route path="/2257-exemption" element={<AppLayout><Exemption2257 /></AppLayout>} />
            <Route path="/kyc-policy" element={<AppLayout><KycPolicy /></AppLayout>} />
            <Route path="/contact-center" element={<AppLayout><ContactCenter /></AppLayout>} />
            <Route path="/help-center" element={<AppLayout><HelpCenter /></AppLayout>} />
            <Route path="/help-center/get-started" element={<AppLayout><HelpCenterGettingStarted /></AppLayout>} />
            <Route path="/admin/*" element={<AdminHost />} />
          </Routes>
          </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
      </PerformanceProvider>
    </ErrorBoundary>
  );
}
