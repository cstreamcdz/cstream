import { Suspense, lazy, useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { initializeFontSettings } from "@/hooks/useFontSettings";
import { initializeI18n, useI18n, autoDetectAndSetLanguage } from "@/lib/i18n";
import { CookieConsent } from "@/components/CookieConsent";
import { ScrollProgress } from "@/components/ScrollProgress";
import { useBetaSettings } from "@/hooks/useBetaSettings";
import { useSettingsStore } from "@/hooks/useUserSettings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SparklesCore } from "@/components/ui/sparkles";
import { applyTheme, initializeTheme, THEMES } from "@/lib/themes";
import { blockExternalLinks } from "@/lib/blockExternalLinks";
import { RadioOverlay } from "@/components/RadioOverlay";
import { VPNOverlay } from "@/components/VPNOverlay";
// import { LanguageOverlay } from "@/components/LanguageOverlay";

// Defer non-critical lazy components
const DeferredComponent = lazy(() => import("./pages/NotFound"));

// Load AdSense script
const loadAdSense = () => {
  if (typeof window !== 'undefined' && !(window as any).adsbygoogle) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxxxxxxxxxx';
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }
};

// Optimized lazy loading with faster prefetching
const Home = lazy(() => import("./pages/Home"));
const Test = lazy(() => import("./pages/Test"));
const TestPage = lazy(() => import("./pages/TestPage"));
const Movies = lazy(() => import("./pages/Movies"));
const TV = lazy(() => import("./pages/TV"));
const Anime = lazy(() => import("./pages/Anime"));
const MovieDetail = lazy(() => import("./pages/MovieDetail"));
const TVDetail = lazy(() => import("./pages/TVDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const Radio = lazy(() => import("./pages/Radio"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const WatchPage = lazy(() => import("./pages/WatchPage"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const Trending = lazy(() => import("./pages/Trending"));
const Sports = lazy(() => import("./pages/Live"));
const LiveTV = lazy(() => import("./pages/LiveTV"));
const ConsumetTest = lazy(() => import("./pages/ConsumetTest"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Agent = lazy(() => import("./pages/Agent"));
const AnimeAnilistDetail = lazy(() => import("./pages/AnimeAnilistDetail"));
const Manga = lazy(() => import("./pages/Manga"));
const Actors = lazy(() => import("./pages/Actors"));
const PersonDetail = lazy(() => import("./pages/PersonDetail"));
const AddFriend = lazy(() => import("./pages/AddFriend"));
const Contact = lazy(() => import("./pages/Contact"));
const Planning = lazy(() => import("./pages/Planning"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Creator = lazy(() => import("./pages/Creator"));
const Beta = lazy(() => import("./pages/Beta"));
const Verify = lazy(() => import("./pages/Verify"));
const MangaScraper = lazy(() => import("./pages/test/MangaScraper"));
const Stats = lazy(() => import("./pages/Stats"));
const NotFound = lazy(() => import("./pages/NotFound"));

const prefetchRoute = (path: string) => {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = path;
  document.head.appendChild(link);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'always',
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return children;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AdSenseLoader = () => {
  const { adsRemoved } = useBetaSettings();

  useEffect(() => {
    if (!adsRemoved) {
      loadAdSense();
    }
  }, [adsRemoved]);

  return null;
};

const ThemeApplier = () => {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
};

const NavigationParticles = () => {
  const particlesEnabled = useSettingsStore((state) => state.particlesEnabled);
  const themeId = useSettingsStore((state) => state.theme);

  const particleConfig = useMemo(() => {
    const theme = THEMES.find(t => t.id === themeId) || THEMES.find(t => t.id === 'premium-violet');
    const isVerified = themeId === 'premium-verified';

    return {
      color: theme?.colors.primary || '#A855F7',
      density: isVerified ? 80 : 40,
      speed: isVerified ? 0.4 : 0.2,
      minSize: isVerified ? 0.6 : 0.4,
      maxSize: isVerified ? 1.4 : 1.2
    };
  }, [themeId]);

  if (!particlesEnabled) return null;

  return (
    <div key={`${themeId}-${particleConfig.color}`} className="fixed top-0 left-0 right-0 h-20 md:h-24 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
      <SparklesCore
        background="transparent"
        minSize={particleConfig.minSize}
        maxSize={particleConfig.maxSize}
        particleDensity={particleConfig.density}
        speed={particleConfig.speed}
        particleColor={particleConfig.color}
        responsiveDensity
      />
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test-premium" element={<TestPage />} />
        <Route path="/test/manga-scraper" element={<MangaScraper />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Movies />} />
        <Route path="/movie/:id" element={<MovieDetail />} />
        <Route path="/tv" element={<TV />} />
        <Route path="/tv/:id" element={<TVDetail />} />
        <Route path="/anilist/:id" element={<AnimeAnilistDetail />} />
        <Route path="/anime" element={<Anime />} />
        <Route path="/manga" element={<Manga />} />
        <Route path="/actors" element={<Actors />} />
        <Route path="/person/:id" element={<PersonDetail />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/add-friend/:profileId" element={<AddFriend />} />
        <Route path="/add-friend" element={<AddFriend />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent"
          element={
            <ProtectedRoute>
              <Agent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/watch"
          element={
            <ProtectedRoute>
              <WatchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/:id"
          element={
            <ProtectedRoute>
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route path="/trending" element={<Trending />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/live/sport" element={<Sports />} />
        <Route path="/live/tv" element={<LiveTV />} />
        <Route path="/sports" element={<Sports />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/radio" element={<Radio />} />
        <Route
          path="/creator"
          element={
            <ProtectedRoute>
              <Creator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/beta"
          element={
            <ProtectedRoute>
              <Beta />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    prompt(): Promise<void>;
  }
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
  }
}

const App = () => {
  useEffect(() => {
    initializeTheme();
    initializeI18n();
    initializeFontSettings();
    autoDetectAndSetLanguage();
    blockExternalLinks();

    // Prefetch critical pages for instant transition
    const criticalRoutes = ["/", "/movies", "/tv", "/anime", "/radio", "/trending"];
    criticalRoutes.forEach(route => prefetchRoute(route));

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      window.deferredPrompt = e;
      console.log('PWA install prompt captured');
    };

    const handleAppInstalled = () => {
      window.deferredPrompt = null;
      console.log('PWA installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const trackVisit = async () => {
      try {
        let visitorId = localStorage.getItem('cstream_visitor_id');
        if (!visitorId) {
          visitorId = Math.random().toString(36).substring(2, 9);
          localStorage.setItem('cstream_visitor_id', visitorId);
        }

        // Get user info if available (hook useAuth is inside AppRoutes, so we can't use it here easily without moving logic)
        // However, we can use supabase.auth.getSession() directly or just rely on the backend to match IP if needed.
        // For now, let's just send what we have.

        await fetch('/api/analytics/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            platform: navigator.platform,
            language: navigator.language,
            username: null // Will be handled if we had auth here, but we'll improve this
          })
        });
      } catch (err) {
        console.warn('Silent visit tracking failed');
      }
    };

    trackVisit();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const activeTheme = useSettingsStore((state) => state.theme);

  const themeGradients = useMemo(() => {
    const theme = THEMES.find(t => t.id === activeTheme) || THEMES.find(t => t.id === 'premium-violet');
    const primary = theme?.colors.primary || '#D946EF';
    const bg = theme?.colors.background || '#050505';

    return {
      primary,
      bg,
      gradient: `linear-gradient(180deg, 
        ${primary}26 0%, 
        ${bg} 40%, 
        ${bg} 60%, 
        ${primary}1a 100%
      )`
    };
  }, [activeTheme]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <Sonner
            position={typeof window !== 'undefined' && window.innerWidth < 768 ? "bottom-center" : "top-right"}
            closeButton
            duration={3000}
            toastOptions={{
              style: {
                background: '#0b0f14',
                border: '1px solid rgba(255,255,255,0.05)',
                color: '#fff',
                backdropFilter: 'blur(20px)',
              },
            }}
          />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <ThemeApplier />
              <AdSenseLoader />
              <NavigationParticles />
              <div className="min-h-screen relative w-full overflow-x-hidden bg-[#06080b]">
                <div
                  className="fixed inset-0 pointer-events-none transition-colors duration-700"
                  style={{
                    background: themeGradients.gradient,
                    zIndex: -100
                  }}
                />
                {/* Content */}
                <div className="relative pt-16 sm:pt-20" style={{ zIndex: 10 }}>
                  <ScrollProgress />
                  <AppRoutes />
                  <RadioOverlay />
                  <VPNOverlay />
                  {/* <LanguageOverlay /> */}
                  <CookieConsent />
                </div>
              </div>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
