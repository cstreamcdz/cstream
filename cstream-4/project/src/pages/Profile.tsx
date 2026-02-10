import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { DiscordWidget } from "@/components/DiscordWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/RoleBadge";
import { roleConfig } from "@/lib/roles";
import {
  User,
  Camera,
  Loader2,
  Heart,
  Film,
  Star,
  Clock,
  Check,
  Settings,
  X,
  Calendar,
  Tv,
  Play,
  Bold,
  Link as LinkIcon,
  Palette,
  RotateCw,
  Users,
  Sparkles,
  Copy,
  Search,
  UserPlus,
  ArrowRight,
  Handshake,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { cn } from "@/lib/utils";

const BioLink = ({ href, children }: { href?: string; children: any }) => {
  if (!href) return <span>{children}</span>;

  try {
    const url = new URL(href);
    const domain = url.hostname.replace("www.", "");
    const name = domain.split(".")[0];
    const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] transition-all no-underline align-middle mx-0.5 group"
      >
        <img
          src={iconUrl}
          alt=""
          className="w-3.5 h-3.5 rounded-sm filter grayscale group-hover:grayscale-0 transition-all"
        />
        <span className="text-xs font-bold text-zinc-300 group-hover:text-white capitalize tracking-tight">
          {name}
        </span>
      </a>
    );
  } catch (e) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
};

const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <BioLink href={props.href}>{props.children}</BioLink>
  ),
  p: ({ children }) => (
    <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
  ),
};

const MediaCard = ({ item, type }: { item: any; type: "movie" | "tv" }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{ x: 4, scale: 1.01 }}
      onClick={() => navigate(`/${item.media_type}/${item.tmdb_id}`)}
      className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/10 transition-all duration-300 cursor-pointer group"
    >
      <div className="relative w-10 h-14 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
        {item.poster_path && (
          <img
            src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate text-white group-hover:text-purple-400 transition-colors">
          {item.title}
        </p>
        {type === "tv" && (
          <p className="text-[10px] text-zinc-500 mt-0.5">
            S{item.season || 1} E{item.episode || 1}
          </p>
        )}
        <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(item.progress || 0) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              type === "movie" ? "bg-purple-500" : "bg-blue-500",
            )}
          />
        </div>
      </div>
      <Play
        className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors"
        strokeWidth={2.5}
      />
    </motion.div>
  );
};

const Profile = () => {
  const { user, role: authRole } = useAuth();
  const navigate = useNavigate();
  const { userId: viewingUserId } = useParams<{ userId?: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { history } = useWatchHistory();

  const CREATOR_EMAILS = ['chemsdine.kachid@gmail.com', 'laylamayacoub@gmail.com'];
  const isCreatorEmail = user?.email && CREATOR_EMAILS.includes(user.email);

  const isOwnProfile = !viewingUserId || viewingUserId === user?.id;
  const targetUserId = viewingUserId || user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<any[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState<boolean | 'social'>(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [searchingFriend, setSearchingFriend] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [activeSocialTab, setActiveSocialTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      // 1. Fetch from profiles (main table)
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", targetUserId)
        .maybeSingle(); // Use maybeSingle to avoid throw on empty

      if (error) console.warn("[Profile] Error fetching profile:", error);

      let finalProfile = data ? { ...data } : { id: targetUserId };

      // 2. Fetch/Fallback: Fetch from 'users' table as primary source for display_code
      try {
        // Try to find the user in the users table by either auth_id (UUID) or pk id (UUID)
        let { data: userData } = await (supabase as any)
          .from("users")
          .select("*")
          .or(`auth_id.eq.${targetUserId},id.eq.${targetUserId}`)
          .maybeSingle();

        // If not found and targetUserId is numeric, it might be an integer ID (legacy)
        if (!userData && /^\d+$/.test(targetUserId)) {
          console.log("[Profile] Attempting fetch by integer id:", targetUserId);
          const { data: byId } = await (supabase as any)
            .from("users")
            .select("*")
            .eq("id", parseInt(targetUserId))
            .maybeSingle();
          userData = byId;
        }

        if (userData) {
          console.log("[Profile] Found authoritative data in users table:", userData);
          finalProfile = { ...finalProfile, ...userData };
          // Ensure display_code is prioritized from users table
          finalProfile.display_code = userData.display_code || userData.user_code || finalProfile.display_code;
        }
      } catch (err) {
        console.error("[Profile] Failed to fetch from users table:", err);
      }

      console.log("[Profile] Final combined profile:", finalProfile);

      // FORCE CREATOR STATUS FOR SPECIFIC EMAILS
      if (CREATOR_EMAILS.includes(finalProfile.email)) {
        finalProfile.level = "Creator";
        finalProfile.role = "creator";
        finalProfile.is_verified = true;
        finalProfile.premium = true;
        finalProfile.all_badges = true;
      }

      setProfile(finalProfile);
      setUsername(finalProfile.username || "");
      setBio(finalProfile.bio || "");
      setLinks(finalProfile.links || []);
    } catch (error) {
      console.error("[Profile] Global fetch error:", error);
      toast.error("Erreur de chargement du profil");
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  // Unified code for display and copy
  const getDisplayCode = () => {
    if (!profile) return null;
    const code = profile.display_code || profile.user_code || profile.friend_code;
    if (code === undefined || code === null || code === '' || code === '...') return null;
    return code.toString().padStart(5, '0');
  };

  const handleSaveLinks = async (updatedLinks: any[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ links: updatedLinks } as any)
        .eq("id", user.id);
      if (error) throw error;
      setLinks(updatedLinks);
      toast.success("Liens mis à jour");
    } catch (error: any) {
      toast.error("Erreur liens: " + error.message);
    }
  };

  const addLink = () => {
    if (!newLinkUrl) return;

    let url = newLinkUrl;
    if (!url.startsWith("http")) url = "https://" + url;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace("www.", "");
      const siteName = domain.split(".")[0];

      const newLink = {
        id: Date.now().toString(),
        title:
          newLinkTitle.trim() ||
          siteName.charAt(0).toUpperCase() + siteName.slice(1),
        url: url,
        domain: domain,
      };

      const updatedLinks = [...links, newLink];
      handleSaveLinks(updatedLinks);
      setNewLinkTitle("");
      setNewLinkUrl("");
      setIsAddingLink(false);
    } catch (e) {
      toast.error("URL invalide");
    }
  };

  const removeLink = (id: string) => {
    const updatedLinks = links.filter((l) => l.id !== id);
    handleSaveLinks(updatedLinks);
  };

  const fetchSocialData = useCallback(async () => {
    if (!user || !isOwnProfile) return;
    try {
      // Fetch friends
      const { data: friendsData } = await (supabase as any)
        .from('friendships')
        .select('*, friend:profiles!friendships_friend_id_fkey(*)')
        .eq('user_id', user.id);

      const { data: friendsData2 } = await (supabase as any)
        .from('friendships')
        .select('*, friend:profiles!friendships_user_id_fkey(*)')
        .eq('friend_id', user.id);

      setFriendsList([...(friendsData || []), ...(friendsData2 || [])]);

      // Fetch requests
      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      setFriendRequests(requestsData || []);
    } catch (error) {
      console.error("Social fetch error:", error);
    }
  }, [user, isOwnProfile]);

  const generateFriendCode = async () => {
    if (!user) return;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ friend_code: code } as any)
        .eq('id', user.id);
      if (error) throw error;
      setFriendCode(code);
      toast.success("Nouveau code généré");
    } catch (e) {
      toast.error("Erreur génération code");
    }
  };

  const sendFriendRequest = async (targetId: string, targetCode: string) => {
    if (!user) return;

    // Check if already friends
    const isFriend = friendsList.some(f =>
      (f.user_id === user.id && f.friend_id === targetId) ||
      (f.friend_id === user.id && f.user_id === targetId)
    );

    if (isFriend) {
      toast.error("Cet utilisateur est déjà votre ami !");
      return;
    }

    try {
      // Check for existing request (in either direction)
      const { data: existing, error: existingError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pending') {
          toast.info("Une demande est déjà en attente");
        } else {
          toast.info("Vous êtes déjà connectés ou la demande a été traitée");
        }
        return;
      }

      // Ensure sender profile exists (fixes FK constraint)
      const { data: senderProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileCheckError || !senderProfile) {
        toast.error("Configurez votre profil d'abord pour ajouter des amis");
        return;
      }

      const { error } = await (supabase as any)
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: targetId,
          receiver_code: targetCode,
          status: 'pending'
        });

      if (error) {
        if (error.message?.includes('friend_requests_receiver_id_fkey')) {
          toast.error("Le profil destinataire n'existe pas (Erreur FK)");
          return;
        }
        if (error.message?.includes('friend_requests_sender_id_fkey')) {
          toast.error("Votre profil est incomplet (Erreur FK Sender). Allez sur votre profil et sauvegardez.");
          return;
        }
        if (error.message?.includes('foreign key constraint')) {
          // Fallback if constraint name isn't in message
          toast.error("Erreur de liaison (Profil inexistant)");
          return;
        }
        throw error;
      }
      toast.success("Demande d'ami envoyée !");
    } catch (e: any) {
      console.error("Friend request error:", e);
      if (e.message?.includes('violates row-level security')) {
        toast.error("Erreur de permission : Impossible d'envoyer la demande (Bêta)");
      } else {
        toast.error("Erreur lors de l'envoi : " + (e.message || "Erreur inconnue"));
      }
    }
  };

  const acceptFriendRequest = async (requestId: string, senderId: string) => {
    if (!user) return;
    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. Add to friendships table
      // Check if connection already exists to avoid duplicates
      const { data: existingFriend } = await (supabase as any)
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${senderId}),and(user_id.eq.${senderId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (!existingFriend) {
        const { error: insertError } = await (supabase as any)
          .from('friendships')
          .insert([
            { user_id: user.id, friend_id: senderId },
          ]);

        if (insertError) throw insertError;
      }

      toast.success("Ami ajouté avec succès !");
      fetchSocialData();
    } catch (e: any) {
      console.error("Accept friend error:", e);
      toast.error("Erreur lors de l'acceptation : " + e.message);
    }
  };

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) fetchSocialData();
  }, [fetchProfile, fetchSocialData, isOwnProfile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          bio: bio.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profil mis à jour");
      setEditing(false);
      await fetchProfile();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Erreur de sauvegarde: ${error.message || "Inconnue"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Avatar mis à jour");
      fetchProfile();
    } catch (error: any) {
      console.error("Avatar error:", error);
      toast.error("Erreur avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const insertTag = (tag: string, endTag: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + tag + selection + (endTag || tag) + after;
    setBio(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, end + tag.length);
    }, 0);
  };

  const userRole = (isCreatorEmail && isOwnProfile) ? "creator" : (profile?.role || authRole || "member");
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })
    : "Date inconnue";

  const stats = {
    watched: history?.length || 0,
    favorites: profile?.favorites_count || 0,
    reviews: profile?.reviews_count || 0,
    watchTime: Math.round(
      (history?.reduce((acc, item) => acc + (item.progress || 0), 0) || 0) / 60,
    ),
  };

  const recentMovies =
    history?.filter((h) => h.media_type === "movie").slice(0, 3) || [];
  const recentShows =
    history?.filter((h) => h.media_type === "tv").slice(0, 3) || [];

  const BadgeItem = ({ has, label, icon, color }: { has: boolean; label: string; icon: React.ReactNode; color: string }) => (
    <div className="group relative flex items-center justify-center">
      {has && (
        <div className={cn(
          "absolute inset-0 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          color === "blue" && "bg-blue-500/30",
          color === "purple" && "bg-purple-500/30",
          color === "orange" && "bg-orange-500/30",
          color === "pink" && "bg-pink-500/30"
        )} />
      )}
      <div className={cn(
        "relative p-2.5 rounded-xl border transition-all duration-300 shadow-lg flex items-center justify-center",
        has
          ? "bg-white/5 border-white/10 hover:border-white/20 text-white shadow-white/5"
          : "bg-black/20 border-white/5 text-white/10 grayscale opacity-40"
      )}>
        <div className={cn(
          "w-5 h-5 flex items-center justify-center transition-transform group-hover:scale-110",
          has && "filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
        )}>
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-zinc-900 border border-white/10 text-[9px] font-black uppercase text-white opacity-0 group-hover:opacity-100 transition-all z-50 whitespace-nowrap shadow-2xl">
        {label} {!has && "(Bloqué)"}
      </div>
    </div>
  );

  const BadgesSection = () => (
    <div className="flex flex-wrap items-center gap-3 py-4">
      <BadgeItem
        has={profile?.is_verified || profile?.verified || profile?.role === 'creator'}
        label="Vérifié"
        color="blue"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-500"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
      />
      <BadgeItem
        has={profile?.is_premium || profile?.role === 'premium' || profile?.role === 'creator'}
        label="Premium"
        color="purple"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-purple-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
      />
      <BadgeItem
        has={profile?.all_badges || profile?.role === 'creator'}
        label="Beta"
        color="orange"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-orange-500"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>}
      />
      <BadgeItem
        has={profile?.all_badges || profile?.role === 'creator'}
        label="Donateur"
        color="pink"
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-pink-500"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
      />
    </div>
  );

  const nextLevelInfo = (() => {
    if (profile?.level === "Creator") return null;
    const currentLevel = parseInt(profile?.level || "1");
    const xp = profile?.xp || 0;
    const nextLevel = currentLevel + 1;
    const currentLevelData = [
      { level: 1, min: 0, max: 100, color: "from-orange-500 to-orange-700" },
      { level: 2, min: 100, max: 500, color: "from-zinc-300 to-zinc-500" },
      { level: 3, min: 500, max: 1000, color: "from-yellow-400 to-yellow-600" },
      { level: 4, min: 1000, max: 2500, color: "from-blue-400 to-blue-600" },
      {
        level: 5,
        min: 2500,
        max: 5000,
        color: "from-purple-400 to-purple-600",
      },
      { level: 6, min: 5000, max: 10000, color: "from-red-500 to-red-700" },
      {
        level: 7,
        min: 10000,
        max: 25000,
        color: "from-indigo-500 to-indigo-700",
      },
      { level: 8, min: 25000, max: 1000000, color: "from-white to-zinc-400" },
    ];

    const info = currentLevelData.find((d) => d.level === currentLevel) || currentLevelData[0];
    const progress = Math.min(
      100,
      Math.max(0, ((xp - info.min) / (info.max - info.min)) * 100),
    );
    return { ...info, progress, nextMax: info.max };
  })();

  if (!user && !viewingUserId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <h2 className="text-xl font-medium text-white/50">Connexion requise</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased">
      <Navbar />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .rgb-text {
          background: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: rgb-move 5s linear infinite;
          background-size: 200% auto;
        }
        @keyframes rgb-move {
          to { background-position: 200% center; }
        }
        .spin-text {
          display: inline-block;
          animation: spin-anim 3s linear infinite;
        }
        @keyframes spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
        }}
      />

      <main className="container mx-auto px-4 pt-24 pb-24">
        <div className="max-w-3xl mx-auto space-y-10">
          {loading ? (
            <div className="flex items-center justify-center py-40">
              <Loader2 className="w-5 h-5 animate-spin text-white/20" />
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 border-b border-white/5 pb-10 relative">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                  <div className="relative group">
                    <Avatar className="w-20 h-20 md:w-28 md:h-28 ring-1 ring-white/10 shadow-xl">
                      <AvatarImage
                        src={profile?.avatar_url || ""}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-zinc-900 text-xl font-bold">
                        {username?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {isOwnProfile && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full backdrop-blur-sm"
                      >
                        <Camera className="w-4 h-4 text-white/70" />
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-1">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                      <h1
                        className={cn(
                          "text-2xl md:text-3xl font-bold tracking-tight",
                          profile?.level === "Creator" && "rgb-text",
                        )}
                      >
                        {profile?.username || "Utilisateur"}
                      </h1>
                      <div className="flex items-center gap-1.5 translate-y-0.5">
                        <RoleBadge role={userRole as UserRole} size="sm" />
                        {profile?.level === "Creator" && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-black uppercase text-yellow-500">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            Creator
                          </div>
                        )}
                      </div>
                    </div>

                    {/* XP Bar */}
                    {profile?.level === "Creator" ? (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 animate-pulse" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
                          Niveau Infini
                        </span>
                      </div>
                    ) : (
                      nextLevelInfo && (
                        <div className="space-y-1.5 mt-2">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-zinc-500">
                            <span>Level {profile?.level}</span>
                            <span>
                              {profile?.xp || 0} / {nextLevelInfo.nextMax} XP
                            </span>
                          </div>
                          <div className="h-1.5 w-full md:w-64 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${nextLevelInfo.progress}%` }}
                              className={cn(
                                "h-full rounded-full bg-gradient-to-r",
                                nextLevelInfo.color,
                              )}
                            />
                          </div>
                        </div>
                      )
                    )}

                    <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center md:justify-start gap-1.5">
                      <Calendar className="w-3 h-3" /> {memberSince}
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block w-72 shrink-0 space-y-4">
                  <DiscordWidget />
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <a
                      href="https://drift.rip/cdz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block rounded-2xl overflow-hidden border border-white/10 bg-black p-1 hover:border-primary/50 transition-all z-[100] cursor-pointer"
                      title="click here"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="w-full aspect-[3/1] bg-gradient-to-br from-primary/20 to-purple-600/20 flex flex-col items-center justify-center p-6 text-center group-hover:from-primary/30 group-hover:to-purple-600/30 transition-all">
                        <span className="text-primary font-black text-xl uppercase tracking-tighter mb-1">
                          Rejoindre
                        </span>
                        <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest group-hover:text-white/80 transition-colors">
                          Notre Discord
                        </span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>

              {isOwnProfile && !editing && (
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <Button
                    onClick={() => setEditing(true)}
                    className="bg-white text-black hover:bg-zinc-200 rounded-2xl h-10 px-6 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-white/5 transition-all active:scale-95"
                  >
                    Éditer le Profil
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setShowDetails(!showDetails)}
                      variant="outline"
                      className={cn(
                        "bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl h-10 px-4 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
                        showDetails && "bg-white/20 border-white/30",
                      )}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Détails
                    </Button>
                    <Button
                      onClick={() => navigate("/settings")}
                      variant="outline"
                      className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl h-10 w-10 p-0 transition-all active:scale-95"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className={cn(
                        "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-400 rounded-2xl h-10 px-4 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
                        (showDetails as any) === 'social' && "bg-purple-500/20 border-purple-500/40"
                      )}
                      onClick={() => setShowDetails((showDetails as any) === 'social' ? false : 'social')}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Social ({friendsList.length})
                    </Button>
                  </div>
                </div>
              )}

              {/* Bio Section */}
              <div className="space-y-6">
                <AnimatePresence>
                  {showDetails === true && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6"
                    >
                      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                          <Clock className="w-3 h-3" /> Temps de Visionnage
                        </div>
                        <p className="text-sm font-medium text-white">
                          Vous avez passé environ{" "}
                          <span className="text-purple-400 font-bold">
                            {stats.watchTime} heures
                          </span>{" "}
                          à regarder du contenu sur CStream.
                        </p>
                      </div>
                      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                          <Heart className="w-3 h-3" /> Engagement
                        </div>
                        <p className="text-sm font-medium text-white">
                          Inscrit depuis le{" "}
                          <span className="text-blue-400 font-bold">
                            {memberSince}
                          </span>{" "}
                          avec {stats.reviews} avis publiés.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {(showDetails as any) === 'social' && isOwnProfile && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 pb-10"
                    >
                      <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-6 space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold">Système Social</h3>
                            <p className="text-xs text-zinc-500">Gérez vos amis et vos connexions</p>
                          </div>
                          <div className="flex items-center gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 overflow-x-auto max-w-full scrollbar-hide">
                            <button
                              onClick={() => setActiveSocialTab('friends')}
                              className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", activeSocialTab === 'friends' ? "bg-white text-black" : "text-zinc-500 hover:text-white")}
                            >Amis</button>
                            <button
                              onClick={() => setActiveSocialTab('requests')}
                              className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap", activeSocialTab === 'requests' ? "bg-white text-black" : "text-zinc-500 hover:text-white")}
                            >
                              Demandes
                              {friendRequests.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-[8px] flex items-center justify-center text-white border-2 border-black">{friendRequests.length}</span>}
                            </button>
                            <button
                              onClick={() => setActiveSocialTab('search')}
                              className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", activeSocialTab === 'search' ? "bg-white text-black" : "text-zinc-500 hover:text-white")}
                            >Chercher</button>
                            <button
                              onClick={fetchSocialData}
                              className="px-3 py-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                              title="Actualiser"
                            >
                              <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            </button>
                          </div>
                        </div>

                        {activeSocialTab === 'friends' && (
                          <div className="space-y-4">
                            {friendsList.length === 0 ? (
                              <div className="py-12 text-center space-y-4">
                                <Users className="w-12 h-12 text-white/5 mx-auto" />
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-black">Vous n'avez pas encore d'amis</p>
                                <Button size="sm" onClick={() => setActiveSocialTab('search')} variant="outline" className="rounded-xl text-[10px] font-black uppercase">Trouver des amis</Button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {friendsList.map((f, i) => (
                                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer" onClick={() => navigate(`/profile/${f.friend?.id}`)}>
                                    <Avatar className="w-10 h-10 border border-white/10">
                                      <AvatarImage src={f.friend?.avatar_url} />
                                      <AvatarFallback>{f.friend?.username?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate">{f.friend?.username}</p>
                                      <RoleBadge role={f.friend?.role} size="sm" />
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-zinc-700" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {activeSocialTab === 'requests' && (
                          <div className="space-y-4">
                            {friendRequests.length === 0 ? (
                              <div className="py-12 text-center space-y-4">
                                <Handshake className="w-12 h-12 text-white/5 mx-auto" />
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-black">Aucune demande en attente</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {friendRequests.map((req) => (
                                  <div key={req.id} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                                    <Avatar className="w-10 h-10">
                                      <AvatarImage src={req.sender?.avatar_url} />
                                      <AvatarFallback>{req.sender?.username?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <p className="text-sm font-bold">{req.sender?.username}</p>
                                      <p className="text-[10px] text-zinc-500 uppercase font-black">Souhaite devenir votre ami</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" className="bg-white text-black hover:bg-zinc-200 rounded-xl px-4" onClick={() => acceptFriendRequest(req.id, req.sender_id)}>Accepter</Button>
                                      <Button size="icon" variant="ghost" className="rounded-xl text-zinc-500 hover:text-red-500 h-9 w-9"><X className="w-4 h-4" /></Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {activeSocialTab === 'search' && (
                          <div className="space-y-6">
                            <div className="p-6 rounded-3xl bg-purple-500/5 border border-purple-500/10 flex flex-col md:flex-row items-center justify-between gap-6">
                              <div className="space-y-1 text-center md:text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Votre Code Ami</p>
                                <p className="text-4xl font-black tracking-tighter text-white font-mono">
                                  {getDisplayCode() ? `#${getDisplayCode()}` : "..."}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" className="rounded-2xl h-12 border-white/10 bg-white/5 active:scale-95 transition-transform" onClick={() => {
                                  const code = getDisplayCode();
                                  if (code) {
                                    navigator.clipboard.writeText(code)
                                      .then(() => toast.success(`Code ${code} copié !`))
                                      .catch(() => toast.error("Erreur lors de la copie"));
                                  } else {
                                    toast.error("Aucun code disponible à copier");
                                    console.log("[Profile] Copy requested but profile data is:", profile);
                                  }
                                }}>
                                  <Copy className="w-4 h-4 mr-2" /> Copier
                                </Button>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-purple-500 transition-colors" />
                                <Input
                                  placeholder="Entrer le code à 5 chiffres (ex: 12345)..."
                                  value={searchCode}
                                  onChange={(e) => {
                                    // Only allow numbers
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 5) setSearchCode(val);
                                  }}
                                  className="pl-12 h-14 bg-black/40 border-white/5 rounded-2xl text-xl font-mono tracking-widest focus:ring-1 focus:ring-purple-500/50 placeholder:text-zinc-600 placeholder:text-sm placeholder:font-sans placeholder:tracking-normal"
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (searchCode.length < 5) {
                                        toast.error("Code incomplet (5 chiffres requis)");
                                        return;
                                      }

                                      setSearchingFriend(true);
                                      try {
                                        // Parse int to remove leading zeros for DB query
                                        const codeInt = parseInt(searchCode, 10);
                                        const { data, error } = await (supabase as any)
                                          .from('users')
                                          .select('*')
                                          .eq('display_code', codeInt)
                                          .maybeSingle();

                                        if (error) throw error;

                                        if (data) {
                                          const targetId = data.auth_id || data.id;
                                          if (targetId === user?.id) {
                                            toast.error("C'est votre propre code !");
                                          } else {
                                            await sendFriendRequest(targetId, (data.display_code || data.user_code).toString().padStart(5, '0'));
                                          }
                                        } else {
                                          toast.error("Aucun utilisateur trouvé avec ce code");
                                        }
                                      } catch (e) {
                                        console.error("Search error:", e);
                                        toast.error("Erreur de recherche");
                                      } finally {
                                        setSearchingFriend(false);
                                      }
                                    }
                                  }}
                                />
                              </div>
                              <Button
                                onClick={async () => {
                                  if (searchCode.length < 5) return;
                                  // Duplicate logic from onKeyDown - simplified for button click
                                  setSearchingFriend(true);
                                  try {
                                    const codeInt = parseInt(searchCode, 10);
                                    const { data } = await (supabase as any)
                                      .from('users')
                                      .select('*')
                                      .eq('display_code', codeInt)
                                      .maybeSingle();

                                    if (data) {
                                      const targetId = data.auth_id || data.id;
                                      if (targetId === user?.id) toast.error("C'est vous !");
                                      else await sendFriendRequest(targetId, (data.display_code || data.user_code).toString().padStart(5, '0'));
                                    } else {
                                      toast.error("Code introuvable");
                                    }
                                  } catch (e) { toast.error("Erreur de recherche") }
                                  finally { setSearchingFriend(false); }
                                }}
                                disabled={searchingFriend || searchCode.length < 5}
                                className="h-14 px-6 rounded-2xl bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-wider"
                              >
                                {searchingFriend ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ajouter"}
                              </Button>
                            </div>
                            <p className="text-[10px] text-zinc-500 text-center font-bold uppercase tracking-widest">Appuyez sur Entrée pour rechercher</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <BadgesSection />

                {editing ? (
                  <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-5 backdrop-blur-xl">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                        Pseudo
                      </Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-white/5 border-white/5 h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                          Bio
                        </Label>
                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() => insertTag("__", "__")}
                          >
                            <Bold className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() => insertTag("[Lien](https://", ")")}
                          >
                            <LinkIcon className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() => insertTag("~~", "~~")}
                          >
                            <div className="h-3 w-3 border-b-2 border-current" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() => insertTag("### ", "")}
                          >
                            <span className="text-[10px] font-bold">H</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() =>
                              insertTag('<span class="rgb-text">', "</span>")
                            }
                          >
                            <Palette className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={() =>
                              insertTag('<span class="spin-text">', "</span>")
                            }
                          >
                            <RotateCw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        ref={textareaRef}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Parlez de vous... (Markdown & HTML supportés)"
                        className="bg-white/5 border-white/5 min-h-[120px] text-sm resize-none focus:ring-1 focus:ring-white/10"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-white text-black hover:bg-zinc-200 rounded-full h-9 px-6 font-bold text-[10px] uppercase tracking-wider"
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Sauvegarder"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(false)}
                        className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-wider"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  profile?.bio && (
                    <div className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl prose prose-invert prose-zinc prose-sm md:prose-base prose-a:no-underline">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={markdownComponents}
                      >
                        {profile.bio}
                      </ReactMarkdown>
                    </div>
                  )
                )}
              </div>

              {/* Links Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-0.5 h-3 bg-white/20 rounded-full" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                      Réseaux & Liens
                    </h2>
                  </div>
                  {isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingLink(!isAddingLink)}
                      className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
                    >
                      {isAddingLink ? (
                        <X className="w-3 h-3 mr-1" />
                      ) : (
                        <LinkIcon className="w-3 h-3 mr-1" />
                      )}
                      {isAddingLink ? "Fermer" : "Ajouter"}
                    </Button>
                  )}
                </div>

                <AnimatePresence>
                  {isAddingLink && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                            Nom du site (optionnel)
                          </Label>
                          <Input
                            value={newLinkTitle}
                            onChange={(e) => setNewLinkTitle(e.target.value)}
                            placeholder="ex: Instagram"
                            className="bg-white/5 border-white/5 h-10 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                            URL
                          </Label>
                          <Input
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            placeholder="instagram.com/pseudo"
                            className="bg-white/5 border-white/5 h-10 text-sm"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={addLink}
                        className="w-full bg-white text-black hover:bg-zinc-200 rounded-2xl h-10 font-black text-[10px] uppercase tracking-widest"
                      >
                        Ajouter le lien
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="group relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300"
                    >
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${link.domain}&sz=64`}
                          alt=""
                          className="w-4 h-4 rounded-sm filter grayscale group-hover:grayscale-0 transition-all"
                          onError={(e) => {
                            (e.target as any).src = "";
                            (e.target as any).parentElement.innerHTML =
                              '<div class="w-4 h-4 flex items-center justify-center"><LinkIcon class="w-3 h-3 text-zinc-500" /></div>';
                          }}
                        />
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-xs font-bold text-zinc-400 group-hover:text-white transition-colors truncate pr-8"
                      >
                        {link.title}
                      </a>
                      {isOwnProfile && (
                        <button
                          onClick={() => removeLink(link.id)}
                          className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-500 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {links.length === 0 && !isAddingLink && (
                    <div className="col-span-full py-8 text-center rounded-3xl border border-dashed border-white/5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
                        Aucun lien public
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Watch History */}
              <div className="space-y-6 pt-6">
                <div className="flex items-center gap-2">
                  <div className="w-0.5 h-3 bg-purple-500/50 rounded-full" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Reprendre la lecture
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                        Films récents
                      </span>
                      <span className="text-[9px] font-bold text-purple-400/50">
                        {recentMovies.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {recentMovies.map((item) => (
                        <MediaCard key={item.id} item={item} type="movie" />
                      ))}
                      {recentMovies.length === 0 && (
                        <div className="p-10 text-center rounded-3xl bg-white/[0.01] border border-white/5">
                          <Film
                            className="w-5 h-5 text-zinc-800 mx-auto mb-3"
                            strokeWidth={1.5}
                          />
                          <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
                            Aucun film
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                        Séries récentes
                      </span>
                      <span className="text-[9px] font-bold text-blue-400/50">
                        {recentShows.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {recentShows.map((item) => (
                        <MediaCard key={item.id} item={item} type="tv" />
                      ))}
                      {recentShows.length === 0 && (
                        <div className="p-10 text-center rounded-3xl bg-white/[0.01] border border-white/5">
                          <Tv
                            className="w-5 h-5 text-zinc-800 mx-auto mb-3"
                            strokeWidth={1.5}
                          />
                          <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-bold">
                            Aucune série
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-10 border-t border-white/5">
                  <div className="bg-zinc-900/40 rounded-3xl p-8 border border-white/5 text-center space-y-4">
                    <Sparkles className="w-12 h-12 text-primary mx-auto opacity-20" />
                    <p className="text-zinc-500 text-sm italic">Espace communautaire bientôt disponible.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mt-12 pt-10 border-t border-white/5 space-y-6 lg:hidden">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Espace communautaire bientôt disponible.
              </p>
            </div>
            <DiscordWidget />
          </div>
        </div>
      </main >
    </div >
  );
};

export default Profile;
