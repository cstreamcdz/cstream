import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Settings as SettingsIcon,
  Palette,
  Bell,
  Globe,
  Check,
  Play,
  Save,
  Loader2,
  Monitor,
  Smartphone,
  MapPin,
  Clock,
  Sun,
  Sparkles,
  Download,
  Trash2,
  AlertTriangle,
  Type,
  Zap,
  EyeOff,
  User,
  Shield,
  Smartphone as DeviceIcon,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n, SUPPORTED_LANGUAGES, SupportedLanguage } from "@/lib/i18n";
import {
  useUserSettings,
  DisplayDensity,
  BadgeStyle,
} from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import {
  useFontSettings,
  availableFonts,
  initializeFontSettings,
} from "@/hooks/useFontSettings";
import { useBetaSettings } from "@/hooks/useBetaSettings";
import { applyTheme, THEMES } from "@/lib/themes";
import { useWatchPartyStore } from "@/lib/watchParty";

interface SessionInfo {
  ip: string;
  city: string;
  country: string;
  device: string;
  browser: string;
  lastLogin: string;
}

const Settings = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { t, language: currentLanguage, setLanguage } = useI18n();
  const { enabled: wpEnabled, enableAsHost, disable: disableWP } = useWatchPartyStore();

  const {
    settings,
    setTheme,
    setNotifications,
    setAutoplay,
    setBrightness,
    setCustomGradient,
    setDisplayDensity,
    setBadgeStyle,
    setSnowflakesEnabled,
    setParticlesEnabled,
    saving,
    updateSettings,
  } = useUserSettings();

  const { selectedFontId, fontSize, setFont, setFontSize } = useFontSettings();
  const { betaMode, adsRemoved, setBetaMode, setAdsRemoved } = useBetaSettings();

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showBetaConfirm, setShowBetaConfirm] = useState(false);

  const selectedTheme = settings.theme;
  const notifications = settings.notifications;
  const autoPlay = settings.autoplay;
  const brightness = settings.brightness;
  const customGradient = settings.customGradient;
  const displayDensity = settings.displayDensity;

  useEffect(() => {
    initializeFontSettings();
    fetchSessionInfo();
  }, []);

  const fetchSessionInfo = async () => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      const data = await response.json();
      const userAgent = navigator.userAgent;

      let browser = "Navigateur moderne";
      if (userAgent.includes("Firefox")) browser = "Firefox";
      else if (userAgent.includes("Chrome")) browser = "Chrome";
      else if (userAgent.includes("Safari")) browser = "Safari";

      setSessionInfo({
        ip: data.ip || "Inconnue",
        city: data.city || "Inconnue",
        country: data.country_name || "Inconnu",
        device: /Mobile|Android|iPhone/i.test(userAgent) ? "Mobile" : "Ordinateur",
        browser,
        lastLogin: new Date().toLocaleString(),
      });
    } catch (e) {
      console.error("Session info error", e);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
    applyTheme(themeId);
    toast.success("Thème mis à jour");
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    toast.success("Langue mise à jour");
  };

  const handleFontChange = async (fontId: string) => {
    await setFont(fontId);
    toast.success("Police mise à jour");
  };

  const handleBrightnessChange = (value: number[]) => {
    setBrightness(value[0]);
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <SEO title="Paramètres - CStream" description="Gérez vos préférences CStream" />
      <Navbar />

      <main className="container mx-auto px-4 pt-32 pb-20 max-w-4xl">
        <header className="mb-12">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h1 className="text-5xl font-black tracking-tighter mb-4 bg-gradient-to-r from-primary to-primary/40 bg-clip-text text-transparent">
              PARAMÈTRES
            </h1>
            <p className="text-muted-foreground font-medium text-lg italic">Personnalisez votre expérience de streaming</p>
          </motion.div>
        </header>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-8"
        >
          {/* Section Profil & Sécurité */}
          <motion.section variants={itemVariants} className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary/60 px-2">Compte & Sécurité</h2>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl overflow-hidden group">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">{user.email}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Utilisateur Standard</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">État du compte</p>
                      <p className="text-sm font-bold">Sécurisé</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
                    <DeviceIcon className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Dernière connexion</p>
                      <p className="text-sm font-bold">{sessionInfo?.lastLogin || 'Chargement...'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Section Apparence */}
          <motion.section variants={itemVariants} className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary/60 px-2">Interface & Thèmes</h2>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl">
              <CardContent className="p-6 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Thème Visuel</Label>
                    <Select value={selectedTheme} onValueChange={handleThemeChange}>
                      <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 rounded-xl hover:border-primary/50 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 rounded-xl">
                        {THEMES.map(theme => (
                          <SelectItem key={theme.id} value={theme.id} className="focus:bg-primary/20">
                            {theme.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Luminosité de l'interface ({brightness}%)</Label>
                    <div className="px-2 pt-2">
                      <Slider
                        value={[brightness]}
                        onValueChange={handleBrightnessChange}
                        min={50} max={150} step={5}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Langue globale</Label>
                    <Select value={currentLanguage} onValueChange={(v) => handleLanguageChange(v as SupportedLanguage)}>
                      <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span> {lang.nativeName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Police d'écriture</Label>
                    <Select value={selectedFontId} onValueChange={handleFontChange}>
                      <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        {availableFonts.map(font => (
                          <SelectItem key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                            {font.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Section Expérimentale */}
          <motion.section variants={itemVariants} className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-amber-500/60 px-2 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Labo Beta
            </h2>
            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.03] to-orange-500/[0.03] backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div className="grid md:grid-cols-[1fr,120px] gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 transition-all">
                      <div>
                        <h4 className="font-bold">Accès Beta</h4>
                        <p className="text-xs text-muted-foreground">Activez les dernières fonctionnalités en test</p>
                      </div>
                      <Switch checked={betaMode} onCheckedChange={(v) => setBetaMode(v)} />
                    </div>

                    {betaMode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <div>
                          <h4 className="font-bold text-emerald-400">Bloqueur de pub (Experimental)</h4>
                          <p className="text-xs text-emerald-500/70">Masque automatiquement les overlays publicitaires</p>
                        </div>
                        <Switch checked={adsRemoved} onCheckedChange={(v) => setAdsRemoved(v)} />
                      </motion.div>
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                      <a
                        href="https://drift.rip/cdz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block rounded-xl overflow-hidden border border-white/10 bg-black p-4 hover:border-amber-500/50 transition-all z-[100] flex items-center justify-center group/btn"
                        title="Click here"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <span className="font-bold text-lg text-white group-hover/btn:text-amber-500 transition-colors">
                          CLICK HERE
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Section Préférences Lecture */}
          <motion.section variants={itemVariants} className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary/60 px-2">Lecteur Vidéo</h2>
            <Card className="border-white/5 bg-white/[0.02] backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-3">
                    <Play className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-bold">Lecture automatique</h4>
                      <p className="text-xs text-muted-foreground">Lance l'épisode suivant automatiquement</p>
                    </div>
                  </div>
                  <Switch checked={autoPlay} onCheckedChange={(v) => setAutoplay(v)} />
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default Settings;