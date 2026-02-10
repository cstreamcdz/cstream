import { cn } from "../lib/utils";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { useNotifications } from "../hooks/useNotifications";
import { useSiteLogo, initializeSiteLogo } from "../hooks/useSiteLogo";
import { useI18n } from "../lib/i18n";
import { useUserSettings } from "../hooks/useUserSettings";
import { useThemeMode } from "../hooks/useThemeMode";
import { usePresence } from "../hooks/usePresence";
import { UnifiedSearch } from "./UnifiedSearch";
import { LanguageSelector } from "./LanguageSelector";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { RoleBadge } from "./RoleBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Bell,
  Settings,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  Film,
  Tv,
  Play,
  Sparkles,
  Home,
  Calendar,
  MessageCircle,
  Mail,
  Pin,
  PinOff,
  Trophy,
  Bot,
  LayoutDashboard,
  Radio as RadioIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { NotificationsPanel } from "./NotificationsPanel";
import { ChangelogWidget, ChangelogBadge } from "./ChangelogWidget";

// Configuration constants
const SCROLL_THRESHOLD = 20;

// Navigation links configuration
const getNavLinks = (t: (key: string) => string) => [
  { href: "/", label: t("nav.home"), icon: Home },
  { href: "/movies", label: t("nav.movies"), icon: Film },
  { href: "/tv", label: t("nav.tv"), icon: Tv },
  { href: "/anime", label: t("nav.anime"), icon: Sparkles },
  { href: "/live", label: "Live", icon: Play, beta: true },
  { href: "/agent", label: "Agent AI", icon: Bot, hideOnDesktop: true },
];

// Animation variants
const animations = {
  header: {
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.4 },
  },
  logo: {
    hover: { scale: 1.12, rotate: 5 },
    tap: { scale: 0.92 },
  },
};

interface UserProfile {
  username: string;
  avatar_url: string | null;
}

// Status Badge Component
const PresenceStatusBadge = ({ userId }: { userId: string }) => {
  const { presence } = usePresence();
  const userPresence = presence[userId];
  const status = userPresence?.status || "offline";

  const statusMap: Record<
    string,
    { emoji: string; label: string; color: string }
  > = {
    online: { emoji: "🟢", label: "Online", color: "bg-green-500/30" },
    away: { emoji: "🟡", label: "Away", color: "bg-yellow-500/30" },
    dnd: { emoji: "🔴", label: "DND", color: "bg-red-500/30" },
    offline: { emoji: "⚫", label: "Offline", color: "bg-gray-500/30" },
    watching: { emoji: "🟣", label: "Watching", color: "bg-primary/30" },
    typing: { emoji: "🔵", label: "Typing...", color: "bg-blue-500/30" },
  };

  const info = statusMap[status];
  return (
    <Badge className={`${info.color} text-xs border-border`}>
      {info.emoji} {info.label}
    </Badge>
  );
};

export const Navbar = () => {
  const { user, isAdmin, isCreator, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAgentPage = location.pathname === "/agent";
  const { unreadCount } = useNotifications();
  const { logoUrl } = useSiteLogo();
  const { t } = useI18n();
  const { settings, setCustomGradient } = useUserSettings();
  const { mode } = useThemeMode();

  // State management
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Computed values
  const isNavbarAttached = settings.customGradient.enabled;
  const navLinks = useMemo(() => getNavLinks(t), [t]);

  // Profile fetching
  const fetchProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [user]);

  // Effects
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    initializeSiteLogo();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handlers
  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleBackgroundToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const newState = !isNavbarAttached;
      setCustomGradient({
        enabled: newState,
        primaryColor: settings.customGradient.primaryColor,
        backgroundColor: settings.customGradient.backgroundColor,
      });
      toast.success(newState ? "Navbar épinglée" : "Navbar flottante", {
        duration: 2000,
      });
    },
    [isNavbarAttached, settings.customGradient, setCustomGradient],
  );

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Dynamic class names
  const headerClasses = useMemo(() => {
    const baseClasses = "py-1.5 px-3 md:px-6 transition-all duration-500";
    const bgClass =
      mode === "dark"
        ? "bg-[#0a0b14]/30 backdrop-blur-md"
        : isNavbarAttached
          ? "bg-gradient-to-r from-gray-50/40 via-blue-50/40 to-gray-50/40 border-blue-300/20"
          : "bg-gradient-to-r from-white/40 via-blue-50/30 to-white/40 backdrop-blur-md border-blue-300/15";
    const shadowClass = "shadow-none";
    return `${baseClasses} ${bgClass} border ${shadowClass}`;
  }, [isNavbarAttached, mode]);

  // User initials
  const userInitial = useMemo(
    () =>
      profile?.username?.charAt(0).toUpperCase() ||
      user?.email?.charAt(0).toUpperCase() ||
      "?",
    [profile?.username, user?.email],
  );

  return (
    <>
      <AnimatePresence>
        {(
          <motion.header
            {...animations.header}
            className="fixed z-50 transition-all duration-500 ease-in-out"
            exit={{ y: -100, opacity: 0 }}
            style={{
              top: isNavbarAttached ? "0" : "12px",
              left: "0",
              right: "0",
              width: "100%",
              padding: isNavbarAttached ? "0" : "0 16px",
            }}
          >
            <div
              className={`${isNavbarAttached ? "max-w-full" : "mx-auto max-w-[95%] xl:max-w-[1400px]"} ${headerClasses} ${isNavbarAttached ? "rounded-none" : "rounded-2xl"} overflow-visible transition-all duration-500 ease-in-out`}
            >
              <div className="flex items-center justify-between gap-2 px-2 sm:px-4">
                {/* Logo */}
                <Link
                  to="/"
                  className="flex items-center gap-2 group shrink-0"
                  aria-label="CStream Home"
                >
                  <motion.div
                    whileHover={animations.logo.hover}
                    whileTap={animations.logo.tap}
                    className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 relative group"
                  >
                    <div
                      className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background:
                          "conic-gradient(from 0deg, var(--tw-gradient-from) 0%, var(--tw-gradient-via) 25%, var(--tw-gradient-to) 50%, var(--tw-gradient-from) 75%, var(--tw-gradient-via) 100%)",
                        filter: "blur(8px)",
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-primary opacity-0 group-hover:opacity-50 blur-lg transition-opacity duration-300" />
                    <div
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 shadow-2xl shadow-primary/50 backdrop-blur-md group-hover:shadow-3xl group-hover:shadow-primary/80 transition-all duration-300 ${!isNavbarAttached
                        ? "border-2 border-primary/80 group-hover:border-primary"
                        : "border-0"
                        }`}
                    />
                    <motion.img
                      src={logoUrl}
                      alt="CStream"
                      className="w-full h-full object-contain p-1 drop-shadow-2xl filter brightness-110 relative z-10 transition-all duration-300 group-hover:drop-shadow-[0_0_16px_rgba(var(--theme-primary-rgb),0.6)]"
                    />
                  </motion.div>
                  <div className="hidden sm:flex flex-col justify-center">
                    <span
                      className={`text-sm font-bold whitespace-nowrap transition-colors duration-300 ${mode === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      CStream
                    </span>
                    <span
                      className={`text-[10px] whitespace-nowrap transition-colors duration-300 ${mode === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Streaming
                    </span>
                  </div>
                </Link>

                {/* Search */}
                <div className="hidden lg:flex flex-1 min-w-0 px-2 items-center">
                  <div className="w-full min-w-0">
                    <UnifiedSearch />
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-1 md:gap-2 shrink-0 relative z-40">
                  <div className="flex lg:hidden mr-1">
                    <UnifiedSearch />
                  </div>
                  {user && (
                    <nav className="hidden md:flex items-center gap-0.5 px-2 md:px-0 py-0.5 transition-all duration-300 overflow-hidden">
                      {navLinks.filter(link => !link.hideOnDesktop).map((link) => {
                        const isActive = location.pathname === link.href;
                        const Icon = link.icon;

                        if (link.label === "Live") {
                          return (
                            <DropdownMenu key={link.href}>
                              <DropdownMenuTrigger asChild>
                                <motion.div whileHover={{ scale: 1.02 }}>
                                  <button
                                    className={`relative px-2 md:px-3 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold transition-all duration-250 flex items-center gap-1.5 md:gap-2 group ${isActive
                                      ? "text-white"
                                      : mode === "dark"
                                        ? "text-gray-400 hover:text-white"
                                        : "text-gray-700 hover:text-gray-950"
                                      }`}
                                  >
                                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    <span className="whitespace-nowrap">{link.label}</span>
                                    <Badge variant="outline" className="px-1 py-0.5 text-[8px] font-bold bg-amber-500/40 text-amber-300 rounded-full border border-amber-400/50">BETA</Badge>
                                  </button>
                                </motion.div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-40 rounded-xl bg-black/80 backdrop-blur-md p-2 border border-white/10 shadow-2xl" align="start">
                                <DropdownMenuItem onClick={() => navigate("/live/sport")} className="rounded-lg cursor-pointer text-white hover:bg-white/10 flex items-center gap-2 p-3 transition-all">
                                  <Trophy className="w-4 h-4 text-orange-400" />
                                  <span>Sport</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/live/tv")} className="rounded-lg cursor-pointer text-white hover:bg-white/10 flex items-center gap-2 p-3 transition-all">
                                  <Tv className="w-4 h-4 text-blue-400" />
                                  <span>TV</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/radio")} className="rounded-lg cursor-pointer text-white hover:bg-white/10 flex items-center gap-2 p-3 transition-all">
                                  <RadioIcon className="w-4 h-4 text-emerald-400" />
                                  <span className="flex items-center gap-1.5">
                                    Radio
                                    <Badge variant="outline" className="px-1 py-0 text-[7px] font-bold bg-amber-500/20 text-amber-400 border-amber-500/30 uppercase">BETA</Badge>
                                  </span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        }

                        if (["Home", "Films", "Séries", "Animes", "Live"].includes(link.label) || link.href === "/" || link.href === "/movies" || link.href === "/tv" || link.href === "/anime" || link.href === "/live") {
                          return (
                            <motion.div key={link.href} whileHover={{ scale: 1.02 }}>
                              <Link
                                to={link.href}
                                className={`relative px-2 md:px-3 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold transition-all duration-250 flex items-center gap-1.5 md:gap-2 group ${isActive
                                  ? "text-primary"
                                  : mode === "dark" ? "text-gray-400 hover:text-primary" : "text-gray-700 hover:text-primary"
                                  }`}
                              >
                                <span className="relative z-10 flex items-center gap-1.5 md:gap-2">
                                  <span className="whitespace-nowrap capitalize">{link.label}</span>
                                </span>
                              </Link>
                            </motion.div>
                          );
                        }

                        return null;
                      })}
                    </nav>
                  )}

                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex md:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 hover:border-primary/50 transition-all z-[60]"
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                      {mobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
                    </Button>
                  </motion.div>

                  <LanguageSelector />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:flex w-8 h-8 rounded-lg bg-secondary/30 hover:bg-secondary/50 border border-border transition-all"
                    onClick={handleBackgroundToggle}
                  >
                    {isNavbarAttached ? <Pin className="w-4 h-4 text-muted-foreground" /> : <PinOff className="w-4 h-4 text-muted-foreground/60" />}
                  </Button>


                  {user ? (
                    <>
                      <div className="flex items-center gap-1">
                        <ChangelogBadge onClick={() => setChangelogOpen(true)} />
                      </div>
                      <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.88 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative w-8 h-8 rounded-lg transition-all z-40 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 shadow-lg flex items-center justify-center overflow-visible"
                          onClick={() => setNotificationsOpen(true)}
                        >
                          <Bell className="w-5 h-5 text-primary stroke-[2.5]" />
                          <svg className="absolute -bottom-1 -right-1 w-3 h-3 text-primary animate-bounce" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
                          {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-[9px] font-black text-white rounded-full flex items-center justify-center border-2 border-[#0a0b14] z-50 shadow-sm animate-pulse">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </Button>
                      </motion.div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="cursor-pointer">
                            <Avatar className="w-8 h-8 border border-primary/50 shadow-lg transition-all">
                              <AvatarImage src={profile?.avatar_url || ""} />
                              <AvatarFallback className="bg-primary/20 text-primary font-bold">{userInitial}</AvatarFallback>
                            </Avatar>
                          </motion.div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl bg-card/95 backdrop-blur-xl p-2 border border-border shadow-2xl" align="end">
                          <div className="px-3 py-3 mb-2 rounded-lg bg-secondary/50">
                            <p className="text-sm font-semibold truncate">{profile?.username || user.email}</p>
                            <div className="mt-2 flex gap-1 flex-wrap items-center">
                              {user?.email === 'chemsdine.kachid@gmail.com' ? (
                                <RoleBadge role="creator" size="sm" />
                              ) : user?.email === 'laylamayacoub@gmail.com' ? (
                                <RoleBadge role="admin" size="sm" />
                              ) : isAdmin ? (
                                <RoleBadge role="admin" size="sm" />
                              ) : (
                                <RoleBadge role={role} size="sm" />
                              )}
                              <PresenceStatusBadge userId={user.id} />
                            </div>
                          </div>
                          <DropdownMenuItem onClick={() => navigate("/app")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            {t("nav.dashboard")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/agent")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground flex items-center">
                            <Bot className="w-4 h-4 mr-2 text-purple-400" />
                            <span className="flex-1 text-left">{t("nav.ai_agent")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <User className="w-4 h-4 mr-2" />
                            {t("nav.profile")}
                            <span className="ml-auto px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">BETA</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/settings")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <Settings className="w-4 h-4 mr-2" />
                            {t("nav.settings")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/planning")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Planning & APIs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2 bg-border/30" />
                          <DropdownMenuItem onClick={() => navigate("/agent")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <Bot className="w-4 h-4 mr-2 text-purple-400" />
                            Agent AI
                            <span className="ml-auto px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">NEW</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/contact")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                            <Mail className="w-4 h-4 mr-2" />
                            {t("nav.contact")}
                          </DropdownMenuItem>
                          {(isAdmin || isCreator || user?.email === 'chemsdine.kachid@gmail.com' || user?.email === 'laylamayacoub@gmail.com') && (
                            <>
                              <DropdownMenuSeparator className="my-2 bg-border/30" />
                              {(isAdmin || user?.email === 'laylamayacoub@gmail.com') && (
                                <DropdownMenuItem onClick={() => navigate("/admin")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                                  <Shield className="w-4 h-4 mr-2" />
                                  {t("nav.admin")}
                                </DropdownMenuItem>
                              )}
                              {(isCreator || user?.email === 'chemsdine.kachid@gmail.com') && (
                                <DropdownMenuItem onClick={() => navigate("/creator")} className="rounded-lg cursor-pointer text-muted-foreground hover:text-foreground">
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Outils Créateur
                                  <span className="ml-auto px-1.5 py-0.5 text-[8px] font-bold bg-gradient-to-r from-primary/30 to-accent/30 text-primary rounded-full border border-primary/30">NEW</span>
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuSeparator className="my-2 bg-border/30" />
                          <DropdownMenuItem onClick={handleSignOut} className="rounded-lg cursor-pointer text-destructive hover:bg-destructive/10">
                            <LogOut className="w-4 h-4 mr-2" />
                            {t("nav.logout")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-shrink-0">
                        <Button variant="ghost" onClick={() => navigate("/auth")} className="text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all">
                          {t("nav.signIn")}
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-shrink-0">
                        <Button onClick={() => navigate("/auth?mode=signup")} className="bg-primary hover:bg-primary/90 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs text-white font-bold shadow-lg shadow-primary/20 border border-primary/50">
                          {t("nav.signUp")}
                        </Button>
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeMobileMenu} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[55]" />
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-[64px] left-4 right-4 bg-[#1a1a2e]/95 backdrop-blur-2xl rounded-2xl border border-primary/30 shadow-2xl z-[60] p-6 lg:hidden overflow-y-auto max-h-[calc(100vh-100px)]">
              <div className="flex flex-col h-full space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-primary/50 shadow-lg shadow-primary/20"><AvatarImage src={profile?.avatar_url || ""} /><AvatarFallback className="bg-primary/20 text-primary font-bold">{userInitial}</AvatarFallback></Avatar>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-lg truncate max-w-[150px]">{profile?.username || user?.email?.split('@')[0]}</span>
                      {user && <RoleBadge role={role} size="sm" />}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={closeMobileMenu} className="rounded-full bg-white/5 hover:bg-white/10"><X className="w-6 h-6 text-white" /></Button>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2 mb-4">Navigation</p>
                  {navLinks.map((link, idx) => {
                    const isActive = location.pathname === link.href;
                    if (link.label === "Live") {
                      return (
                        <div key={link.href} className="space-y-2 mb-4">
                          <div className="flex items-center gap-3 px-2 py-2 text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">
                            <Play className="w-3 h-3" />
                            Live & Media
                          </div>
                          <Link to="/live/tv" onClick={closeMobileMenu} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-gray-300">
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><Tv className="w-5 h-5" /></div>
                            <span className="font-bold text-base">TV Direct</span>
                          </Link>
                          <Link to="/live/sport" onClick={closeMobileMenu} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-gray-300">
                            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400"><Trophy className="w-5 h-5" /></div>
                            <span className="font-bold text-base">Sports Live</span>
                          </Link>
                          <Link to="/radio" onClick={closeMobileMenu} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-gray-300">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><RadioIcon className="w-5 h-5" /></div>
                            <div className="flex flex-col">
                              <span className="font-bold text-base">Radio Music</span>
                              <span className="text-[8px] text-amber-500 font-black uppercase tracking-widest">Version Beta</span>
                            </div>
                          </Link>
                        </div>
                      );
                    }
                    return (
                      <motion.div key={link.href} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }}>
                        <Link to={link.href} onClick={closeMobileMenu} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-primary/20 border border-primary/30 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                          <div className={`p-2 rounded-xl ${isActive ? 'bg-primary text-white' : 'bg-white/5'}`}><link.icon className="w-5 h-5" /></div>
                          <span className="font-bold text-base capitalize">{link.label}</span>
                          {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgb(var(--color-primary))]" />}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-2 mb-4">Paramètres</p>
                  {isAdmin && <Link to="/admin" onClick={closeMobileMenu} className="flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"><div className="p-2 rounded-xl bg-amber-500/20 text-amber-500"><Shield className="w-5 h-5" /></div><span className="font-bold text-base">Admin Panel</span></Link>}
                  <Link to="/settings" onClick={closeMobileMenu} className="flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all"><div className="p-2 rounded-xl bg-white/5"><Settings className="w-5 h-5" /></div><span className="font-bold text-base">Paramètres</span></Link>
                  {user ? <button onClick={handleSignOut} className="flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all w-full text-left"><div className="p-2 rounded-xl bg-red-500/10"><LogOut className="w-5 h-5" /></div><span className="font-bold text-base">Déconnexion</span></button> : null}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <ChangelogWidget open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
};

export default Navbar;
