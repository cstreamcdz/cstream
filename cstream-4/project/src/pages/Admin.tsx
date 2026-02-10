import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Plus, Trash2, Edit, Users, Link as LinkIcon, Save,
  Loader2, Settings, Shield, Search, Film, Tv, Eye, EyeOff,
  Calendar, Star, Globe, Copy, CheckCircle2, AlertCircle, Info,
  TrendingUp, Database, X, ExternalLink, BarChart3, Upload, FileText,
  Mail, MessageCircle, HelpCircle, Bug, Lightbulb, Heart, Check, Clock,
  ChevronDown, ChevronRight, LayoutGrid, LayoutList, Play, Activity, Zap,
  RefreshCw, Bot, Key, Sparkles, Power, Cookie, ScrollText, UserCheck, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleBadge } from '@/components/RoleBadge';
import type { UserRole } from '@/hooks/useAuth';
import { useSiteLogo } from '@/hooks/useSiteLogo';
import { Image } from 'lucide-react';
import { useCustomLanguages } from '@/hooks/useCustomLanguages';
import { detectHost } from '@/lib/hostDetector';
import type { AdminStats, GroupedReader } from './Admin/shared/types';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import { AdvancedFilters, FilterState, defaultFilters, applyFilters, type FilterConfig } from '@/components/admin/AdvancedFilters';
import { RealtimeNotifications } from '@/components/admin/RealtimeNotifications';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { MonitoringTab } from '@/components/admin/MonitoringTab';
import { RoleManagementDialog, getRoleConfig } from '@/components/admin/RoleManagementPanel';
import { UserStatusDot, UserStatusBadge, LastSeenDisplay, OnlineUsersCounter } from '@/components/admin/UserStatusIndicator';

import { ContactMessagesTab } from '@/components/admin/ContactMessagesTab';

/* ============================ Types ============================ */
type MediaType = 'movie' | 'tv' | 'anime';

interface Reader {
  id: string;
  label: string;
  url: string;
  media_type: MediaType | string;
  language: string;
  enabled: boolean;
  tmdb_id?: number | null;
  season_number?: number | null;
  episode_number?: number | null;
  order_index?: number | null;
  created_at?: string;
}

type UserStatus = 'online' | 'offline' | 'dnd' | 'away';

interface UserData {
  id: string;
  username: string;
  avatar_url: string | null;
  friend_code: string;
  created_at: string;
  is_admin?: boolean;
  role?: string;
  email?: string;
  status?: UserStatus;
  last_seen?: string;
  level?: string;
  xp?: number;
}

interface TMDBResult {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
}

interface TMDBSeason {
  season_number: number;
  name?: string;
  episode_count?: number;
}

interface ContactMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: 'pending' | 'read' | 'replied';
  created_at: string;
}

/* ============================ Utilities ============================ */
const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value);
    return !!u.protocol && !!u.host;
  } catch {
    return false;
  }
};

const normalizeBaseUrl = (url: string) => {
  if (!url) return url;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const buildFinalUrl = (
  baseUrl: string,
  mediaType: MediaType | string,
  season?: number | null,
  episode?: number | null
) => {
  const base = normalizeBaseUrl(baseUrl);
  if ((mediaType === 'series' || mediaType === 'tv' || mediaType === 'anime') && (season || episode)) {
    const parts: string[] = [base];
    if (season && Number.isFinite(season)) parts.push(`season/${season}`);
    if (episode && Number.isFinite(episode)) parts.push(`episode/${episode}`);
    return parts.join('/');
  }
  return base;
};

const getMediaTypeIcon = (type: string) => {
  switch (type) {
    case 'movie': return <Film className="w-4 h-4" />;
    case 'series': return <Tv className="w-4 h-4" />;
    case 'tv': return <Tv className="w-4 h-4" />;
    case 'anime': return <Star className="w-4 h-4" />;
    default: return <Film className="w-4 h-4" />;
  }
};

const getMediaTypeLabel = (type: string) => {
  switch (type) {
    case 'movie': return 'Film';
    case 'series': return 'Série';
    case 'tv': return 'TV';
    case 'anime': return 'Anime';
    default: return type;
  }
};

const getMediaTypeColor = (type: string) => {
  switch (type) {
    case 'movie': return 'text-blue-500';
    case 'series': return 'text-purple-500';
    case 'tv': return 'text-green-500';
    case 'anime': return 'text-pink-500';
    default: return 'text-gray-500';
  }
};

const normalizeMediaType = (type: string): MediaType => {
  if (type === 'series') return 'tv';
  if (type === 'movie' || type === 'tv' || type === 'anime') return type;
  return 'tv';
};

const extractBaseSourceName = (label: string): string => {
  if (!label) return 'Source inconnue';
  const cleaned = label
    .replace(/\s*-?\s*S\d{1,2}E\d{1,3}\s*$/i, '')
    .replace(/\s*S\d{1,2}\s*E\d{1,3}\s*$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();
  return cleaned || label;
};

const formatEpisodeRange = (readers: Reader[]): string => {
  if (!readers.length) return '';

  const seasonEpisodes = new Map<number, Set<number>>();

  readers.forEach(r => {
    const season = r.season_number ?? 1;
    const episode = r.episode_number ?? 0;
    if (!seasonEpisodes.has(season)) {
      seasonEpisodes.set(season, new Set());
    }
    if (episode > 0) {
      seasonEpisodes.get(season)!.add(episode);
    }
  });

  if (seasonEpisodes.size === 0) return '';

  const sortedSeasons = [...seasonEpisodes.keys()].sort((a, b) => a - b);

  const formatRange = (episodes: number[]): string => {
    if (episodes.length === 0) return '';
    if (episodes.length === 1) return `E${String(episodes[0]).padStart(2, '0')}`;
    const sorted = [...episodes].sort((a, b) => a - b);
    return `E${String(sorted[0]).padStart(2, '0')}-E${String(sorted[sorted.length - 1]).padStart(2, '0')}`;
  };

  if (sortedSeasons.length === 1) {
    const season = sortedSeasons[0];
    const episodes = [...(seasonEpisodes.get(season) || [])];
    if (episodes.length === 0) return `S${String(season).padStart(2, '0')}`;
    return `S${String(season).padStart(2, '0')} ${formatRange(episodes)}`;
  }

  const parts: string[] = [];
  sortedSeasons.forEach(season => {
    const episodes = [...(seasonEpisodes.get(season) || [])];
    if (episodes.length === 0) {
      parts.push(`S${String(season).padStart(2, '0')}`);
    } else {
      parts.push(`S${String(season).padStart(2, '0')} ${formatRange(episodes)}`);
    }
  });

  return parts.join(' | ');
};

/* ============================ TMDB API ============================ */
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const useDebounced = (value: string, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const searchTMDB = async (query: string, filterType?: 'all' | 'movie' | 'tv'): Promise<TMDBResult[]> => {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key || !query.trim()) return [];

  let endpoint = 'search/multi';
  let searchUrl = `${TMDB_BASE}/${endpoint}?api_key=${key}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false&page=1`;

  if (filterType && filterType !== 'all') {
    endpoint = `search/${filterType}`;
    searchUrl = `${TMDB_BASE}/${endpoint}?api_key=${key}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false&page=1`;
  }

  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error('TMDB search failed');
  const json = await res.json();

  let results = json.results || [];

  if (filterType === 'all' || !filterType) {
    results = results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
  } else {
    results = results.map((r: any) => ({ ...r, media_type: filterType }));
  }

  return results
    .slice(0, 10)
    .map((r: any) => ({
      id: r.id,
      media_type: r.media_type || filterType,
      title: r.title,
      name: r.name,
      release_date: r.release_date,
      first_air_date: r.first_air_date,
      poster_path: r.poster_path,
      vote_average: r.vote_average,
      overview: r.overview,
    }));
};

const fetchTMDBById = async (tmdbId: number, mediaType: 'movie' | 'tv'): Promise<TMDBResult | null> => {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key) return null;
  try {
    const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${key}&language=fr-FR`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return {
      id: json.id,
      media_type: mediaType,
      title: json.title,
      name: json.name,
      release_date: json.release_date,
      first_air_date: json.first_air_date,
      poster_path: json.poster_path,
      vote_average: json.vote_average,
      overview: json.overview,
    };
  } catch {
    return null;
  }
};

const fetchTMDBSeasons = async (tmdbId: number): Promise<TMDBSeason[]> => {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key) return [];
  const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${key}&language=fr-FR`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.seasons || []).map((s: any) => ({
    season_number: s.season_number,
    name: s.name,
    episode_count: s.episode_count,
  }));
};

/* ============================ Components ============================ */
const StatsCard = memo(({ title, value, icon, description, trend }: {
  title: string;
  value: number | string;
  icon: JSX.Element;
  description?: string;
  trend?: { label: string; value: number; color?: string };
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="hover:shadow-lg transition-all hover:border-primary/50 border-l-4 border-l-primary bg-gradient-to-br from-card to-card/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2 font-semibold uppercase tracking-wide">{title}</p>
            <p className="text-4xl font-bold mb-2 text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {trend && (
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${trend.color || 'bg-emerald-500/20 text-emerald-400'}`}>
                  {trend.label}: {trend.value.toLocaleString()}
                </span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground/80">{description}</p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-primary/15 text-primary/80 group-hover:text-primary transition-colors">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
));

const ServiceStatusCard = memo(() => {
  const [serviceStatus, setServiceStatus] = useState({
    tmdb: false,
    groq: false,
    github: false,
    discordBot: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/service-status');
        if (response.ok) {
          const data = await response.json();
          setServiceStatus({
            tmdb: data.tmdb || !!import.meta.env.VITE_TMDB_API_KEY,
            groq: data.groq || false,
            github: data.github || false,
            discordBot: data.discordBot || false,
          });
        } else {
          setServiceStatus({
            tmdb: !!import.meta.env.VITE_TMDB_API_KEY,
            groq: false,
            github: false,
            discordBot: false,
          });
        }
      } catch {
        setServiceStatus({
          tmdb: !!import.meta.env.VITE_TMDB_API_KEY,
          groq: false,
          github: false,
          discordBot: false,
        });
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const services = [
    { key: 'tmdb', label: 'TMDB', status: serviceStatus.tmdb },
    { key: 'groq', label: 'Groq AI', status: serviceStatus.groq },
    { key: 'github', label: 'GitHub', status: serviceStatus.github },
    { key: 'discordBot', label: 'Discord Bot', status: serviceStatus.discordBot },
  ];

  const configuredCount = Object.values(serviceStatus).filter(Boolean).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
    >
      <Card className="relative overflow-hidden bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-xl border border-green-500/20">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold">Services API</h3>
            </div>
            <Badge variant="outline" className={configuredCount >= 3 ? 'border-green-500/50 text-green-500' : 'border-yellow-500/50 text-yellow-500'}>
              {configuredCount}/4 configurés
            </Badge>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {services.map((service) => (
                <div key={service.key} className={`flex items-center gap-2 p-2 rounded-lg ${service.status ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                  <div className={`w-2 h-2 rounded-full ${service.status ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-xs font-medium">{service.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

const ReaderRow = memo(({
  reader,
  onEdit,
  onDelete,
  onToggle,
  onCopyUrl,
  onDuplicate,
  isSelected,
  onSelect,
}: {
  reader: Reader;
  onEdit: (r: Reader) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onCopyUrl: (url: string) => void;
  onDuplicate?: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) => (
  <TableRow className={`hover:bg-secondary/20 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
    {onSelect && (
      <TableCell className="w-[40px]">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(reader.id)}
        />
      </TableCell>
    )}
    <TableCell className="font-medium">
      <div className="flex items-center gap-2">
        <div className={getMediaTypeColor(reader.media_type)}>
          {getMediaTypeIcon(reader.media_type)}
        </div>
        <div>
          <div className="font-medium">{reader.label}</div>
          <div className="text-xs text-muted-foreground">
            {reader.created_at && formatDate(reader.created_at)}
          </div>
        </div>
      </div>
    </TableCell>
    <TableCell className="max-w-[300px]">
      <div className="flex items-center gap-2">
        <span className="truncate text-muted-foreground text-sm font-mono bg-secondary/50 px-2 py-1 rounded">
          {reader.url}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onCopyUrl(reader.url)}
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => window.open(reader.url, '_blank')}
        >
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant="outline" className="capitalize gap-1">
        {getMediaTypeIcon(reader.media_type)}
        {getMediaTypeLabel(reader.media_type)}
      </Badge>
    </TableCell>
    <TableCell>
      <Badge variant="secondary" className="uppercase font-mono">
        {reader.language}
      </Badge>
    </TableCell>
    <TableCell>
      {reader.tmdb_id ? (
        <Badge variant="default" className="gap-1">
          <Database className="w-3 h-3" />
          {reader.tmdb_id}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <AlertCircle className="w-3 h-3" />
          Non lié
        </Badge>
      )}
    </TableCell>
    <TableCell>
      {reader.season_number || reader.episode_number ? (
        <Badge variant="secondary" className="font-mono">
          {reader.season_number && `S${String(reader.season_number).padStart(2, '0')}`}
          {reader.episode_number && `E${String(reader.episode_number).padStart(2, '0')}`}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <Switch
          checked={reader.enabled}
          onCheckedChange={(checked) => onToggle(reader.id, checked)}
        />
        {reader.enabled ? (
          <Eye className="w-4 h-4 text-green-500" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </TableCell>
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        {onDuplicate && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(reader.id)}
            className="h-8 w-8 hover:bg-blue-500/10 text-blue-500"
            title="Dupliquer pour un autre média"
          >
            <Copy className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(reader)}
          className="h-8 w-8 hover:bg-primary/10"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(reader.id)}
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
));

const getStatusColor = (status?: UserStatus, lastSeen?: string) => {
  const effectiveStatus = determineEffectiveStatus(status, lastSeen);
  switch (effectiveStatus) {
    case 'online': return 'bg-green-500';
    case 'dnd': return 'bg-orange-500';
    case 'away': return 'bg-yellow-500';
    case 'offline':
    default: return 'bg-gray-400';
  }
};

const getStatusLabel = (status?: UserStatus, lastSeen?: string) => {
  const effectiveStatus = determineEffectiveStatus(status, lastSeen);
  switch (effectiveStatus) {
    case 'online': return 'En ligne';
    case 'dnd': return 'Ne pas déranger';
    case 'away': return 'Absent';
    case 'offline':
    default: return 'Hors ligne';
  }
};

const determineEffectiveStatus = (status?: UserStatus, lastSeen?: string): UserStatus => {
  if (status && status !== 'offline') {
    return status;
  }

  if (!lastSeen) {
    return 'offline';
  }

  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 2) {
    return 'online';
  } else if (diffMinutes < 10) {
    return 'away';
  }

  return 'offline';
};

const getUserRole = (userData: UserData): UserRole => {
  if (userData.role === 'creator') return 'creator';
  if (userData.role === 'reine') return 'reine';
  if (userData.role === 'super_admin') return 'super_admin';
  if (userData.role === 'admin' || userData.is_admin) return 'admin';
  if (userData.role === 'moderator') return 'moderator';
  if (userData.role === 'editor') return 'editor';
  return 'member';
};

const UserRow = memo(({ userData, onManageRole }: { userData: UserData; onManageRole?: (user: UserData) => void }) => {
  const userRole = getUserRole(userData);
  const roleConfig = getRoleConfig(userRole);

  const handleUpdateLevel = async (userId: string, newLevel: string) => {
    try {
      const levelInt = parseInt(newLevel);
      const xpValues = [0, 100, 500, 1000, 2500, 5000, 10000, 25000];
      const newXp = levelInt > 0 && levelInt <= xpValues.length ? xpValues[levelInt - 1] : 0;

      const { error } = await supabase
        .from('profiles')
        .update({
          level: newLevel,
          xp: newXp
        } as any)
        .eq('id', userId);

      if (error) throw error;
      toast.success('Niveau mis à jour');

      // Update local state to reflect change immediately
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, level: newLevel, xp: newXp } : u));
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    }
  };

  return (
    <TableRow className={`hover:bg-secondary/20 transition-colors border-l-2 ${roleConfig.borderColor}`}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative">
            {userData.avatar_url ? (
              <img
                src={userData.avatar_url}
                alt={userData.username}
                className="w-10 h-10 rounded-full object-cover shadow-md ring-2 ring-offset-2 ring-offset-background"
                style={{ borderColor: roleConfig.borderColor }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 text-white flex items-center justify-center font-bold text-lg shadow-md">
                {userData.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <UserStatusDot
              status={userData.status || 'offline'}
              size="md"
              className="absolute -bottom-0.5 -right-0.5 border-2 border-background"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{userData.username}</span>
              <RoleBadge role={userRole} size="sm" />
            </div>
            {userData.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {userData.email}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <UserStatusBadge status={userData.status || 'offline'} size="sm" />
          <LastSeenDisplay lastSeen={userData.last_seen || null} status={userData.status || 'offline'} compact />
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono">{userData.friend_code}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          {formatDate(userData.created_at)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">Lvl {userData.level || '1'}</Badge>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateLevel(userData.id, String(Math.max(1, parseInt(userData.level || '1') - 1)))}>
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateLevel(userData.id, String(parseInt(userData.level || '1') + 1))}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {onManageRole && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onManageRole(userData)}
            className={`gap-1 ${roleConfig.bgColor} hover:${roleConfig.bgColor}`}
          >
            <Shield className="w-3 h-3" />
            Gérer
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
});

/* ============================ Cookie Consents Tab ============================ */
interface CookieConsent {
  id: string;
  user_email: string | null;
  username: string | null;
  ip_address: string | null;
  preferences: {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  language: string | null;
  platform: string | null;
  screen_resolution: string | null;
  timezone: string | null;
  referrer: string | null;
  is_logged_in: boolean;
  created_at: string;
}

const CookieConsentsTab = memo(() => {
  const [consents, setConsents] = useState<CookieConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        setError('Vous devez être connecté pour voir les consentements');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/cookie-consents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConsents(data.consents || []);
      } else if (response.status === 401) {
        setError('Session expirée. Veuillez vous reconnecter.');
      } else if (response.status === 403) {
        setError('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || `Erreur serveur (${response.status})`);
      }
    } catch (err: any) {
      console.error('Error fetching cookie consents:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const deleteConsent = async (id: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`/api/admin/cookie-consents/${id}`, {
        method: 'DELETE',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });

      if (response.ok) {
        setConsents(prev => prev.filter(c => c.id !== id));
        toast.success('Consentement supprimé');
      } else {
        toast.error('Erreur: permission refusée');
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <Card className="bg-card/50 border-white/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5" />
              Consentements cookies
            </CardTitle>
            <CardDescription>
              Historique des consentements cookies des utilisateurs
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConsents}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500 opacity-70" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchConsents}>
              Réessayer
            </Button>
          </div>
        ) : consents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cookie className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun consentement enregistré</p>
            <p className="text-xs mt-2">Les consentements cookies apparaîtront ici lorsque des utilisateurs accepteront les cookies.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Préférences</TableHead>
                  <TableHead>Plateforme</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consents.map((consent) => (
                  <TableRow key={consent.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {consent.is_logged_in ? (
                          <UserCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <Users className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{consent.username || consent.user_email || 'Visiteur'}</p>
                          {consent.user_email && <p className="text-xs text-muted-foreground">{consent.user_email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {consent.ip_address || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge variant={consent.preferences?.analytics ? 'default' : 'secondary'} className="text-xs">
                          Analytics {consent.preferences?.analytics ? '✓' : '✗'}
                        </Badge>
                        <Badge variant={consent.preferences?.marketing ? 'default' : 'secondary'} className="text-xs">
                          Marketing {consent.preferences?.marketing ? '✓' : '✗'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{consent.platform || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDate(consent.created_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteConsent(consent.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

/* ============================ Logs Tab ============================ */
interface LogEntry {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  details: any;
}

const LogsTab = memo(() => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/admin/logs');
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => log.type === filter);
  }, [logs, filter]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'user_activity': return <Activity className="w-4 h-4 text-green-500" />;
      case 'user_created': return <Users className="w-4 h-4 text-blue-500" />;
      case 'cookie_consent': return <Cookie className="w-4 h-4 text-amber-500" />;
      default: return <ScrollText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'user_activity': return 'border-l-green-500';
      case 'user_created': return 'border-l-blue-500';
      case 'cookie_consent': return 'border-l-amber-500';
      default: return 'border-l-gray-500';
    }
  };

  return (
    <Card className="bg-card/50 border-white/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Logs d'activité
            </CardTitle>
            <CardDescription>
              Historique des événements du site
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les logs</SelectItem>
              <SelectItem value="user_activity">Activité utilisateurs</SelectItem>
              <SelectItem value="user_created">Nouveaux utilisateurs</SelectItem>
              <SelectItem value="cookie_consent">Consentements</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun log disponible</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border-l-4 ${getLogColor(log.type)}`}
              >
                <div className="mt-0.5">{getLogIcon(log.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(log.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

/* ============================ Settings Tab ============================ */
const SettingsTab = memo(() => {
  const { logoUrl, uploadLogo, removeLogo: removeLogoFromStore } = useSiteLogo();
  const { languages: customLanguages, addLanguage, removeLanguage, updateLanguage } = useCustomLanguages();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newLangCode, setNewLangCode] = useState('');
  const [newLangLabel, setNewLangLabel] = useState('');
  const [newLangColor, setNewLangColor] = useState('#6366F1');
  const [showAddLangForm, setShowAddLangForm] = useState(false);
  const [editingLang, setEditingLang] = useState<string | null>(null);
  const [editLangLabel, setEditLangLabel] = useState('');
  const [editLangColor, setEditLangColor] = useState('#6366F1');

  const handleAddLanguage = () => {
    if (!newLangCode.trim()) {
      toast.error('Le code de langue est requis');
      return;
    }
    const result = addLanguage(newLangCode, newLangLabel, newLangColor);
    if (result) {
      toast.success(`Langue "${result.code}" ajoutée`);
      setNewLangCode('');
      setNewLangLabel('');
      setNewLangColor('#6366F1');
      setShowAddLangForm(false);
    } else {
      toast.error('Cette langue existe déjà ou le code est invalide');
    }
  };

  const handleRemoveLanguage = (id: string) => {
    if (removeLanguage(id)) {
      toast.success('Langue supprimée');
    } else {
      toast.error('Impossible de supprimer cette langue par défaut');
    }
  };

  const handleUpdateLanguage = (id: string) => {
    if (updateLanguage(id, { label: editLangLabel, color: editLangColor })) {
      toast.success('Langue mise à jour');
      setEditingLang(null);
    } else {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const startEditLang = (lang: { id: string; label: string; color: string }) => {
    setEditingLang(lang.id);
    setEditLangLabel(lang.label);
    setEditLangColor(lang.color);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadLogo(file);
      if (result) {
        toast.success('Logo mis à jour avec succès - visible par tous les utilisateurs');
      } else {
        toast.error('Erreur lors du téléchargement du logo');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Erreur lors du téléchargement du logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setRemoving(true);
    try {
      await removeLogoFromStore();
      toast.success('Logo supprimé');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Erreur lors de la suppression du logo');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card className="bg-card/50 border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Paramètres du site
        </CardTitle>
        <CardDescription>
          Personnalisez l'apparence de votre site
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Logo du site (Navbar)
          </Label>

          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border/50 bg-secondary/20 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-2">
                    <Image className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Aucun logo</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Téléchargement...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Télécharger un logo
                    </>
                  )}
                </Button>

                {logoUrl && (
                  <Button
                    variant="destructive"
                    onClick={handleRemoveLogo}
                    disabled={removing}
                    className="gap-2"
                  >
                    {removing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Supprimer
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Format recommandé: PNG ou SVG avec fond transparent. Taille max: 2 Mo.
                Le logo sera affiché dans la barre de navigation.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
            <div className="p-2 bg-primary/10 rounded-full">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Prévisualisation</p>
              <div className="flex items-center gap-2 mt-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo preview" className="w-8 h-8 object-contain" />
                ) : (
                  <motion.div
                    className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600 via-zinc-500 to-zinc-700 flex items-center justify-center"
                  >
                    <Play className="w-3.5 h-3.5 text-white fill-current" />
                  </motion.div>
                )}
                <span className="text-lg font-bold bg-gradient-to-r from-white via-zinc-300 to-white bg-clip-text text-transparent">
                  CStream
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Langues de contenu
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Gérez les langues disponibles pour l'import de contenu (VF, VOSTFR, etc.)
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowAddLangForm(!showAddLangForm)}
              className="gap-1"
            >
              {showAddLangForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddLangForm ? 'Annuler' : 'Ajouter'}
            </Button>
          </div>

          <AnimatePresence>
            {showAddLangForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-2 block">Code (ex: VF2)</Label>
                    <Input
                      value={newLangCode}
                      onChange={(e) => setNewLangCode(e.target.value.toUpperCase())}
                      placeholder="VF2"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Description</Label>
                    <Input
                      value={newLangLabel}
                      onChange={(e) => setNewLangLabel(e.target.value)}
                      placeholder="Version Française 2"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Couleur</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={newLangColor}
                      onChange={(e) => setNewLangColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={newLangColor}
                      onChange={(e) => setNewLangColor(e.target.value)}
                      className="flex-1 font-mono"
                    />
                    <Button onClick={handleAddLanguage} className="gap-1">
                      <Plus className="w-4 h-4" />
                      Créer
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {customLanguages.map((lang) => (
              <motion.div
                key={lang.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-secondary/30 border border-border/50 relative group"
              >
                {editingLang === lang.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editLangLabel}
                      onChange={(e) => setEditLangLabel(e.target.value)}
                      placeholder="Description"
                      className="text-xs h-8"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editLangColor}
                        onChange={(e) => setEditLangColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleUpdateLanguage(lang.id)}>
                        <Check className="w-3 h-3 mr-1" />
                        Sauvegarder
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingLang(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: lang.color }}
                      />
                      <span className="font-bold text-sm">{lang.code}</span>
                      {lang.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">Par défaut</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{lang.label}</p>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditLang(lang)}
                        className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      {!lang.isDefault && (
                        <button
                          onClick={() => handleRemoveLanguage(lang.id)}
                          className="w-6 h-6 rounded-full bg-destructive/20 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

/* ============================ Main Component ============================ */
const Admin = () => {
  const { user, isAdmin, profile, role } = useAuth();
  const navigate = useNavigate();
  const { languages: customLanguages } = useCustomLanguages();

  const [readers, setReaders] = useState<Reader[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .range(0, 4999) // Increase limit to fetch all users
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<Reader | null>(null);

  const [searchReaders, setSearchReaders] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [filterMediaType, setFilterMediaType] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [tmdbCache, setTmdbCache] = useState<Record<string, TMDBResult>>({});
  const [selectedReaders, setSelectedReaders] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    label: '',
    baseUrl: '',
    media_type: 'movie' as MediaType,
    language: 'VOSTFR',
    season: '',
    episode: '',
    enabled: true,
    tmdb_id: null as number | null,
    tmdb: null as TMDBResult | null,
    source_type: 'synchronized' as 'local' | 'synchronized',
  });

  const [tmdbSearchMode, setTmdbSearchMode] = useState<'search' | 'id'>('search');
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbIdInput, setTmdbIdInput] = useState('');
  const [tmdbMediaTypeForId, setTmdbMediaTypeForId] = useState<'movie' | 'tv'>('movie');
  const [tmdbSearchTypeFilter, setTmdbSearchTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const debouncedQuery = useDebounced(tmdbQuery, 400);
  const [tmdbResults, setTmdbResults] = useState<TMDBResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbSeasons, setTmdbSeasons] = useState<TMDBSeason[]>([]);
  const [showTmdbDropdown, setShowTmdbDropdown] = useState(false);
  const tmdbRef = useRef<HTMLDivElement | null>(null);

  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning'>('info');
  const [sendingNotification, setSendingNotification] = useState(false);

  const [discordBotStatus, setDiscordBotStatus] = useState<{
    connected: boolean;
    botUser: { id: string; tag: string; username: string } | null;
    channelId: string | null;
    guilds: Array<{ id: string; name: string; memberCount: number }>;
  } | null>(null);
  const [discordChannels, setDiscordChannels] = useState<Array<{
    id: string;
    name: string;
    guildId: string;
    guildName: string;
  }>>([]);
  const [selectedDiscordChannel, setSelectedDiscordChannel] = useState<string>('');
  const [discordMessage, setDiscordMessage] = useState('');
  const [sendingDiscordMessage, setSendingDiscordMessage] = useState(false);
  const [loadingDiscordStatus, setLoadingDiscordStatus] = useState(false);

  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedColor, setEmbedColor] = useState('#7C3AED');
  const [embedImageUrl, setEmbedImageUrl] = useState('');
  const [embedThumbnailUrl, setEmbedThumbnailUrl] = useState('');
  const [embedFooter, setEmbedFooter] = useState('CStream');
  const [embedFields, setEmbedFields] = useState<{ name: string; value: string; inline: boolean }[]>([]);
  const [sendingEmbed, setSendingEmbed] = useState(false);

  const [discordMembers, setDiscordMembers] = useState<Array<{
    id: string;
    username: string;
    tag: string;
    displayName: string;
    avatar: string;
  }>>([]);
  const [selectedDMUser, setSelectedDMUser] = useState<string>('');
  const [dmMessage, setDmMessage] = useState('');
  const [sendingDM, setSendingDM] = useState(false);

  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');
  const [bulkImportLabel, setBulkImportLabel] = useState('');
  const [bulkImportLanguage, setBulkImportLanguage] = useState('VOSTFR');
  const [bulkImportSeason, setBulkImportSeason] = useState('1');
  const [bulkImportTmdbId, setBulkImportTmdbId] = useState<number | null>(null);
  const [bulkImportTmdb, setBulkImportTmdb] = useState<TMDBResult | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState({ current: 0, total: 0 });
  const [bulkImportMediaType, setBulkImportMediaType] = useState<'tv' | 'anime'>('tv');

  const [dualLangDialogOpen, setDualLangDialogOpen] = useState(false);
  const [dualLangInputs, setDualLangInputs] = useState<Array<{ langCode: string; data: string }>>([]);
  const [dualLangLabel, setDualLangLabel] = useState('');
  const [dualLangSeason, setDualLangSeason] = useState('1');
  const [dualLangTmdbId, setDualLangTmdbId] = useState<number | null>(null);
  const [dualLangTmdb, setDualLangTmdb] = useState<TMDBResult | null>(null);
  const [dualLangImporting, setDualLangImporting] = useState(false);
  const [dualLangProgress, setDualLangProgress] = useState({ current: 0, total: 0 });
  const [dualLangMediaType, setDualLangMediaType] = useState<'tv' | 'anime'>('tv');
  const [dualLangSeasons, setDualLangSeasons] = useState<TMDBSeason[]>([]);

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageStatusFilter, setMessageStatusFilter] = useState<string>('all');
  const [messageCategoryFilter, setMessageCategoryFilter] = useState<string>('all');

  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(defaultFilters);

  const debouncedSearchReaders = useDebounced(searchReaders, 300);

  const handleRealtimeEvent = useCallback((event: import('@/hooks/useAdminRealtime').RealtimeEvent) => {
    if (event.table === 'readers') {
      if (event.type === 'INSERT' && event.new) {
        setReaders(prev => [event.new as Reader, ...prev]);
      } else if (event.type === 'UPDATE' && event.new) {
        setReaders(prev => prev.map(r => r.id === event.new.id ? event.new as Reader : r));
      } else if (event.type === 'DELETE' && event.old) {
        setReaders(prev => prev.filter(r => r.id !== event.old.id));
        setSelectedReaders(prev => {
          const next = new Set(prev);
          next.delete(event.old.id);
          return next;
        });
      }
    } else if (event.table === 'contact_messages') {
      if (event.type === 'INSERT' && event.new) {
        setContactMessages(prev => [event.new as ContactMessage, ...prev]);
      } else if (event.type === 'UPDATE' && event.new) {
        setContactMessages(prev => prev.map(m => m.id === event.new.id ? event.new as ContactMessage : m));
      } else if (event.type === 'DELETE' && event.old) {
        setContactMessages(prev => prev.filter(m => m.id !== event.old.id));
      }
    }
  }, []);

  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotifications, addNotification } = useAdminRealtime(
    ['readers', 'profiles', 'contact_messages'],
    handleRealtimeEvent
  );

  const fetchContactMessages = useCallback(async (showNotification = false) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Contact messages error:', error.message);
        return;
      }
      const prevCount = contactMessages.filter(m => m.status === 'pending').length;
      const newCount = (data || []).filter((m: ContactMessage) => m.status === 'pending').length;
      if (showNotification && newCount > prevCount) {
        toast.success(`${newCount - prevCount} nouveau(x) message(s) reçu(s) !`);
      }
      setContactMessages(data || []);
    } catch (err) {
      console.log('Contact messages not available');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const updateMessageStatus = async (id: string, status: 'pending' | 'read' | 'replied') => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setContactMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      toast.success(`Statut mis à jour: ${status === 'read' ? 'Lu' : status === 'replied' ? 'Répondu' : 'En attente'}`);
    } catch (err) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setContactMessages(prev => prev.filter(m => m.id !== id));
      toast.success('Message supprimé');
      setMessageDialogOpen(false);
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'help': return <HelpCircle className="w-4 h-4 text-blue-500" />;
      case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
      case 'suggestion': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case 'contribute': return <Heart className="w-4 h-4 text-pink-500" />;
      default: return <MessageCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'help': return 'Aide';
      case 'bug': return 'Bug';
      case 'suggestion': return 'Suggestion';
      case 'contribute': return 'Contribution';
      default: return 'Autre';
    }
  };

  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [readersRes, usersRes] = await Promise.all([
        supabase.from('readers').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*', { count: 'exact' }).range(0, 4999).order('created_at', { ascending: false })
      ]);

      let usersTableData: any[] = [];
      try {
        const usersTableRes = await supabase.from('users').select('id, is_online, last_seen, status');
        if (!usersTableRes.error && usersTableRes.data) {
          usersTableData = usersTableRes.data;
        }
      } catch {
        // Users table not accessible, continue without it
      }

      const usersOnlineMap = new Map<string, { is_online?: boolean; last_seen?: string; status?: string }>();
      usersTableData.forEach((u: any) => {
        usersOnlineMap.set(u.id, { is_online: u.is_online, last_seen: u.last_seen, status: u.status });
      });

      if (readersRes.error) throw readersRes.error;
      setReaders((readersRes.data || []) as Reader[]);

      if (usersRes.error) throw usersRes.error;

      const mappedUsers = (usersRes.data || []).map((u: any) => {
        const usersTableData = usersOnlineMap.get(u.id);
        let derivedStatus: UserStatus = 'offline';

        const statusFromTable = usersTableData?.status || u.status;
        const isOnline = usersTableData?.is_online;
        const lastSeen = usersTableData?.last_seen || u.updated_at;

        if (statusFromTable && statusFromTable !== 'offline') {
          derivedStatus = statusFromTable as UserStatus;
        } else if (isOnline) {
          derivedStatus = 'online';
        } else if (lastSeen) {
          const lastSeenDate = new Date(lastSeen);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
          if (diffMinutes < 5) derivedStatus = 'online';
          else if (diffMinutes < 15) derivedStatus = 'away';
          else derivedStatus = 'offline';
        }

        return {
          id: u.id,
          username: u.username || '',
          avatar_url: u.avatar_url || null,
          friend_code: u.display_code || u.user_code || u.friend_code || '',
          created_at: u.created_at,
          is_admin: u.is_admin || false,
          role: u.role || 'member',
          email: u.email || null,
          status: derivedStatus,
          last_seen: lastSeen || null,
        };
      });
      setUsers(mappedUsers as UserData[]);
    } catch (err: any) {
      toast.error(`Erreur de chargement: ${err.message || 'inconnue'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return;

    Promise.all([fetchData(), fetchContactMessages()]);

    const usersChannel = supabase
      .channel('users_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setUsers(prev => prev.map(u => {
              if (u.id !== updated.id) return u;
              let derivedStatus: UserStatus = 'offline';
              if (updated.status) {
                derivedStatus = updated.status as UserStatus;
              } else if (updated.updated_at) {
                const lastSeen = new Date(updated.updated_at);
                const now = new Date();
                const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
                if (diffMinutes < 5) derivedStatus = 'online';
                else if (diffMinutes < 15) derivedStatus = 'away';
              }
              return {
                ...u,
                username: updated.username || u.username,
                avatar_url: updated.avatar_url,
                role: updated.role || u.role,
                is_admin: updated.is_admin || false,
                status: derivedStatus,
                last_seen: updated.updated_at,
              };
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
    };
  }, [user, isAdmin, fetchData, fetchContactMessages]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!debouncedQuery.trim()) {
        setTmdbResults([]);
        setTmdbLoading(false);
        return;
      }
      setTmdbLoading(true);
      try {
        const res = await searchTMDB(debouncedQuery.trim(), tmdbSearchTypeFilter);
        if (!mounted) return;
        setTmdbResults(res);
        setShowTmdbDropdown(res.length > 0);
      } catch (err) {
        console.error(err);
        setTmdbResults([]);
      } finally {
        if (mounted) setTmdbLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [debouncedQuery, tmdbSearchTypeFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (tmdbRef.current && !tmdbRef.current.contains(e.target as Node)) {
        setShowTmdbDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const stats = useMemo(() => {
    const totalReaders = readers.length;
    const readersEnabled = readers.filter((r) => r.enabled).length;
    const readersDisabled = totalReaders - readersEnabled;
    const readersWithTmdb = readers.filter((r) => r.tmdb_id).length;
    const readersWithoutTmdb = totalReaders - readersWithTmdb;

    const totalUsers = users.length;
    const adminUsers = users.filter((u) => u.is_admin).length;
    const onlineUsers = users.filter((u) => u.status === 'online').length;

    const movieReaders = readers.filter((r) => r.media_type === 'movie').length;
    const seriesReaders = readers.filter((r) => r.media_type === 'series' || r.media_type === 'tv').length;
    const animeReaders = readers.filter((r) => r.media_type === 'anime').length;

    const languageStats = customLanguages.map(lang => {
      const count = readers.filter(r => r.language?.toLowerCase() === lang.code.toLowerCase()).length;
      return { ...lang, count };
    });

    const totalMessages = contactMessages.length;
    const pendingMessages = contactMessages.filter((m) => m.status === 'pending').length;
    const readMessages = contactMessages.filter((m) => m.status === 'read').length;

    return {
      totalReaders, readersEnabled, readersDisabled, readersWithTmdb, readersWithoutTmdb,
      totalUsers, adminUsers, onlineUsers,
      movieReaders, seriesReaders, animeReaders,
      totalMessages, pendingMessages, readMessages,
      languageStats
    };
  }, [readers, users, contactMessages]);

  const filterConfig: FilterConfig = useMemo(() => ({
    availableLanguages: customLanguages.map(l => ({ code: l.code, label: l.label, color: l.color })),
    availableHosts: [...new Set(readers.map(r => { try { return new URL(r.url).hostname; } catch { return ''; } }).filter(Boolean))],
    stats: stats
  }), [customLanguages, readers, stats]);

  const handleResetFilters = useCallback(() => {
    setAdvancedFilters(defaultFilters);
  }, []);

  const normalizedFilterPayload = useMemo(() => JSON.stringify({
    mediaType: filterMediaType,
    enabled: filterEnabled,
    advanced: advancedFilters
  }), [filterMediaType, filterEnabled, advancedFilters]);

  const filteredReaders = useMemo(() => {
    let list = applyFilters(readers, advancedFilters);

    const q = debouncedSearchReaders.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          r.media_type.toLowerCase().includes(q) ||
          r.language.toLowerCase().includes(q) ||
          (r.tmdb_id && String(r.tmdb_id).includes(q))
      );
    }

    if (filterMediaType !== 'all') {
      if (filterMediaType === 'tv') {
        list = list.filter((r) => r.media_type === 'tv' || r.media_type === 'series');
      } else if (filterMediaType === 'movie') {
        list = list.filter((r) => r.media_type === 'movie');
      } else if (filterMediaType === 'anime') {
        list = list.filter((r) => r.media_type === 'anime');
      } else {
        list = list.filter((r) => r.media_type === filterMediaType);
      }
    }

    if (filterEnabled === 'enabled') {
      list = list.filter((r) => r.enabled);
    } else if (filterEnabled === 'disabled') {
      list = list.filter((r) => !r.enabled);
    }

    return list;
  }, [readers, debouncedSearchReaders, normalizedFilterPayload, advancedFilters]);

  const groupedReaders = useMemo(() => {
    const groups: Record<string, {
      tmdbId: number | null;
      mediaType: string;
      readers: Reader[];
      bySource: Record<string, { byLanguage: Record<string, Reader[]> }>;
    }> = {};

    filteredReaders.forEach((reader) => {
      const normalizedType = reader.media_type === 'series' ? 'tv' : reader.media_type;
      const key = reader.tmdb_id ? `tmdb-${reader.tmdb_id}-${normalizedType}` : `no-tmdb-${reader.id}`;

      if (!groups[key]) {
        groups[key] = {
          tmdbId: reader.tmdb_id || null,
          mediaType: normalizedType,
          readers: [],
          bySource: {},
        };
      }
      groups[key].readers.push(reader);

      const sourceName = extractBaseSourceName(reader.label);
      if (!groups[key].bySource[sourceName]) {
        groups[key].bySource[sourceName] = { byLanguage: {} };
      }

      const language = reader.language || 'N/A';
      if (!groups[key].bySource[sourceName].byLanguage[language]) {
        groups[key].bySource[sourceName].byLanguage[language] = [];
      }
      groups[key].bySource[sourceName].byLanguage[language].push(reader);
    });

    Object.values(groups).forEach((group) => {
      group.readers.sort((a, b) => {
        if (a.label !== b.label) return a.label.localeCompare(b.label);
        if (a.season_number !== b.season_number) {
          return (a.season_number || 0) - (b.season_number || 0);
        }
        return (a.episode_number || 0) - (b.episode_number || 0);
      });

      Object.values(group.bySource).forEach((sourceData) => {
        Object.values(sourceData.byLanguage).forEach((langReaders) => {
          langReaders.sort((a, b) => {
            if (a.season_number !== b.season_number) {
              return (a.season_number || 0) - (b.season_number || 0);
            }
            return (a.episode_number || 0) - (b.episode_number || 0);
          });
        });
      });
    });

    const mediaTypeOrder: Record<string, number> = { movie: 0, tv: 1, anime: 2 };

    return Object.entries(groups).sort((a, b) => {
      if (a[1].tmdbId && !b[1].tmdbId) return -1;
      if (!a[1].tmdbId && b[1].tmdbId) return 1;
      const typeOrderA = mediaTypeOrder[a[1].mediaType] ?? 3;
      const typeOrderB = mediaTypeOrder[b[1].mediaType] ?? 3;
      if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
      return b[1].readers.length - a[1].readers.length;
    });
  }, [filteredReaders]);

  useEffect(() => {
    const fetchTmdbInfo = async () => {
      const tmdbIds = new Set<number>();
      readers.forEach((r) => {
        if (r.tmdb_id && !tmdbCache[`${r.media_type}-${r.tmdb_id}`]) {
          tmdbIds.add(r.tmdb_id);
        }
      });

      for (const tmdbId of tmdbIds) {
        const reader = readers.find((r) => r.tmdb_id === tmdbId);
        if (!reader) continue;

        const mediaType = reader.media_type === 'movie' ? 'movie' : 'tv';
        const result = await fetchTMDBById(tmdbId, mediaType);
        if (result) {
          setTmdbCache((prev) => ({
            ...prev,
            [`${mediaType}-${tmdbId}`]: result,
          }));
        }
      }
    };

    if (readers.length > 0) {
      fetchTmdbInfo();
    }
  }, [readers]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groupedReaders.map(([key]) => key)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  const filteredUsers = useMemo(() => {
    const q = searchUsers.trim().toLowerCase();
    return q ? users.filter((u) =>
      u.username?.toLowerCase().includes(q) ||
      u.friend_code?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    ) : users;
  }, [users, searchUsers]);

  const filteredMessages = useMemo(() => {
    let list = contactMessages;

    if (messageStatusFilter !== 'all') {
      list = list.filter((m) => m.status === messageStatusFilter);
    }

    if (messageCategoryFilter !== 'all') {
      list = list.filter((m) => m.category === messageCategoryFilter);
    }

    return list;
  }, [contactMessages, messageStatusFilter, messageCategoryFilter]);

  const messageStats = useMemo(() => {
    const byStatus = {
      pending: contactMessages.filter((m) => m.status === 'pending').length,
      read: contactMessages.filter((m) => m.status === 'read').length,
      replied: contactMessages.filter((m) => m.status === 'replied').length,
    };
    const byCategory = {
      help: contactMessages.filter((m) => m.category === 'help').length,
      bug: contactMessages.filter((m) => m.category === 'bug').length,
      suggestion: contactMessages.filter((m) => m.category === 'suggestion').length,
      contribute: contactMessages.filter((m) => m.category === 'contribute').length,
    };
    return { byStatus, byCategory };
  }, [contactMessages]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchDiscordBotStatus = async () => {
    setLoadingDiscordStatus(true);
    try {
      const response = await fetch('/api/discord/status');
      if (response.ok) {
        const data = await response.json();
        setDiscordBotStatus(data);
        if (data.channelId) {
          setSelectedDiscordChannel(data.channelId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Discord bot status:', error);
    } finally {
      setLoadingDiscordStatus(false);
    }
  };

  const fetchDiscordChannels = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/discord/channels', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDiscordChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Failed to fetch Discord channels:', error);
    }
  };

  const fetchDiscordMembers = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/discord/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDiscordMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch Discord members:', error);
    }
  };

  const sendDiscordDM = async () => {
    if (!selectedDMUser || !dmMessage.trim()) return;
    setSendingDM(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/discord/dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedDMUser,
          message: dmMessage,
        }),
      });
      if (response.ok) {
        toast.success('Message privé envoyé avec succès !');
        setDmMessage('');
        setSelectedDMUser('');
      } else {
        const error = await response.json();
        toast.error(`Erreur: ${error.error}`);
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message privé');
    } finally {
      setSendingDM(false);
    }
  };

  const setDiscordChannel = async (channelId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/discord/set-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ channelId }),
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedDiscordChannel(channelId);
        toast.success(`Canal Discord configuré: ${data.channel?.name}`);
        await fetchDiscordBotStatus();
      } else {
        const error = await response.json();
        toast.error(`Erreur: ${error.error}`);
      }
    } catch (error) {
      toast.error('Erreur lors de la configuration du canal Discord');
    }
  };

  const sendDiscordBotMessage = async () => {
    if (!discordMessage.trim()) {
      toast.warning('Le message est requis.');
      return;
    }
    if (!selectedDiscordChannel) {
      toast.warning('Veuillez sélectionner un canal Discord.');
      return;
    }
    setSendingDiscordMessage(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/discord/admin-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: discordMessage.trim(),
          adminName: profile?.username || 'Admin',
          channelId: selectedDiscordChannel,
        }),
      });
      if (response.ok) {
        toast.success('Message envoyé sur Discord !');
        setDiscordMessage('');
      } else {
        const error = await response.json();
        toast.error(`Erreur Discord: ${error.error}`);
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message Discord');
    } finally {
      setSendingDiscordMessage(false);
    }
  };

  useEffect(() => {
    fetchDiscordBotStatus();
    fetchDiscordChannels();
    fetchDiscordMembers();
  }, []);

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast.warning('Le titre et le message sont requis.');
      return;
    }
    setSendingNotification(true);
    try {
      // Site notifications table disabled - using broadcast
      const channel = supabase.channel('admin-notifications');
      await channel.send({
        type: 'broadcast',
        event: 'new_notification',
        payload: {
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          type: notificationType,
        }
      });

      const { useNotificationsStore } = await import('@/hooks/useNotifications');
      useNotificationsStore.getState().addNotification({
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
        type: notificationType as any,
      });

      if (selectedDiscordChannel && discordBotStatus?.connected) {
        try {
          const token = await getAuthToken();
          const response = await fetch('/api/discord/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              channelId: selectedDiscordChannel,
              embed: {
                title: `📢 ${notificationTitle.trim()}`,
                description: notificationMessage.trim(),
                color: notificationType === 'success' ? 0x22c55e : notificationType === 'warning' ? 0xf59e0b : 0x3b82f6,
                footer: 'CStream Admin',
              },
            }),
          });
          if (response.ok) {
            toast.success('Notification envoyée à tous les utilisateurs et à Discord !');
          } else {
            const error = await response.json();
            toast.warning(`Notification envoyée aux utilisateurs, mais erreur Discord: ${error.error}`);
          }
        } catch (discordErr) {
          console.error('Discord bot error:', discordErr);
          toast.warning('Notification envoyée aux utilisateurs, mais erreur Discord bot');
        }
      } else {
        toast.success('Notification envoyée à tous les utilisateurs !');
      }

      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationType('info');
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'inconnue'}`);
    } finally {
      setSendingNotification(false);
    }
  };

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('member');

  const openRoleDialog = (userData: UserData) => {
    setSelectedUserForRole(userData);
    setSelectedRole(userData.role || 'member');
    setRoleDialogOpen(true);
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      creator: 'Créateur',
      reine: 'Reine',
      super_admin: 'Super Admin',
      admin: 'Admin',
      moderator: 'Modérateur',
      editor: 'Éditeur',
      member: 'Membre',
    };
    return labels[role] || role;
  };

  const updateUserRole = async () => {
    if (!selectedUserForRole) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast.error('Vous devez être connecté pour modifier les rôles');
        return;
      }

      const response = await fetch(`/api/admin/users/${selectedUserForRole.id}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour');
      }

      const isAdmin = ['admin', 'super_admin', 'creator', 'reine', 'moderator'].includes(selectedRole);

      setUsers(prev => prev.map(u =>
        u.id === selectedUserForRole.id
          ? { ...u, role: selectedRole, is_admin: isAdmin }
          : u
      ));

      toast.success(`Rôle mis à jour: ${getRoleLabel(selectedRole)}`);
      setRoleDialogOpen(false);
      setSelectedUserForRole(null);
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'inconnue'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '', baseUrl: '', media_type: 'movie', language: 'VOSTFR',
      season: '', episode: '', enabled: true, tmdb_id: null, tmdb: null,
      source_type: 'synchronized',
    });
    setEditingReader(null);
    setTmdbQuery('');
    setTmdbIdInput('');
    setTmdbResults([]);
    setTmdbSeasons([]);
    setShowTmdbDropdown(false);
    setTmdbSearchMode('search');
  };

  const openCreateDialog = () => {
    resetForm();
    // Force enabled to true for new sources
    setFormData(prev => ({ ...prev, enabled: true }));
    setDialogOpen(true);
  };


  const openEditDialog = (r: Reader) => {
    setFormData({
      label: r.label,
      baseUrl: normalizeBaseUrl(r.url.replace(/\/(season|episode)\/\d+/gi, '')),
      media_type: r.media_type as MediaType,
      language: r.language,
      season: r.season_number ? String(r.season_number) : '',
      episode: r.episode_number ? String(r.episode_number) : '',
      enabled: r.enabled,
      tmdb_id: r.tmdb_id || null,
      tmdb: null,
      source_type: 'synchronized',
    });
    setEditingReader(r);
    setDialogOpen(true);

    if (r.tmdb_id && (r.media_type === 'tv' || r.media_type === 'series' || r.media_type === 'anime')) {
      fetchTMDBSeasons(r.tmdb_id).then(setTmdbSeasons).catch(() => setTmdbSeasons([]));
    }
  };

  const validateForm = () => {
    if (!formData.label.trim()) {
      toast.warning('Le nom est requis.');
      return false;
    }
    if (!formData.baseUrl.trim() || !isValidUrl(formData.baseUrl.trim())) {
      toast.warning('URL de base invalide.');
      return false;
    }
    if (!formData.tmdb_id) {
      toast.warning('Vous devez lier cette source à un média TMDB. Recherchez un film/série ou entrez un ID TMDB.');
      return false;
    }
    if (formData.season && (!/^\d+$/.test(formData.season) || Number(formData.season) < 0)) {
      toast.warning('Numéro de saison invalide.');
      return false;
    }
    if (formData.episode && (!/^\d+$/.test(formData.episode) || Number(formData.episode) < 0)) {
      toast.warning('Numéro d\'épisode invalide.');
      return false;
    }
    return true;
  };

  const upsertReader = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const seasonNum = formData.season ? Number(formData.season) : null;
      const episodeNum = formData.episode ? Number(formData.episode) : null;
      const finalUrl = buildFinalUrl(formData.baseUrl.trim(), formData.media_type, seasonNum, episodeNum);

      // Vérifier si une source identique existe déjà pour un autre média
      if (!editingReader) {
        const { data: existingSources, error: checkError } = await supabase
          .from('readers')
          .select('id, label, tmdb_id')
          .eq('url', finalUrl)
          .neq('tmdb_id', formData.tmdb_id);

        if (checkError) throw checkError;

        if (existingSources && existingSources.length > 0) {
          const otherMedia = existingSources[0];
          const confirmed = confirm(
            `⚠️ Cette URL existe déjà pour un autre média (TMDB ID: ${otherMedia.tmdb_id}).\n\n` +
            `Voulez-vous quand même créer cette source pour le média actuel (TMDB ID: ${formData.tmdb_id}) ?\n\n` +
            `Note: Chaque source sera exclusive à son média.`
          );
          if (!confirmed) {
            setSaving(false);
            return;
          }
        }
      }

      const payload: any = {
        label: formData.label.trim(),
        url: finalUrl,
        media_type: normalizeMediaType(formData.media_type),
        language: formData.language,
        enabled: editingReader ? formData.enabled : true, // Force enabled=true for new sources
        tmdb_id: formData.tmdb_id,
        season_number: seasonNum,
        episode_number: episodeNum,
      };

      if (editingReader) {
        // Si on change le TMDB ID d'une source existante
        if (editingReader.tmdb_id !== formData.tmdb_id) {
          const confirmed = confirm(
            `⚠️ Vous êtes sur le point de changer le média lié de cette source.\n\n` +
            `Ancien média: TMDB ID ${editingReader.tmdb_id}\n` +
            `Nouveau média: TMDB ID ${formData.tmdb_id}\n\n` +
            `Cette source ne sera plus visible pour l'ancien média. Continuer ?`
          );
          if (!confirmed) {
            setSaving(false);
            return;
          }
        }

        const { error } = await supabase.from('readers').update(payload).eq('id', editingReader.id);
        if (error) throw error;
        setReaders((prev) => prev.map((r) => (r.id === editingReader.id ? { ...r, ...payload } as Reader : r)));
        toast.success('Source mise à jour avec succès', { icon: <CheckCircle2 className="w-4 h-4" /> });
      } else {
        const { data, error } = await supabase.from('readers').insert(payload).select().single();
        if (error) throw error;
        setReaders((prev) => [data as Reader, ...prev]);
        toast.success(
          `Source ajoutée avec succès pour le média TMDB ID: ${formData.tmdb_id}`,
          { icon: <CheckCircle2 className="w-4 h-4" /> }
        );
      }

      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(`Erreur: ${err.message || 'inconnue'}`, { icon: <AlertCircle className="w-4 h-4" /> });
    } finally {
      setSaving(false);
    }
  };

  const deleteReader = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette source ? Cette action est irréversible.')) return;
    setSaving(true);
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error(`Format d'ID invalide: ${id}`);
      }

      const { error } = await supabase
        .from('readers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete error details:', error);
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          toast.error('Permissions insuffisantes pour supprimer cette source. Vérifiez vos droits admin dans Supabase.', {
            icon: <AlertCircle className="w-4 h-4" />,
            duration: 5000
          });
          return;
        }
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          toast.error('Session expirée. Veuillez vous reconnecter.', { icon: <AlertCircle className="w-4 h-4" /> });
          return;
        }
        throw new Error(error.message || `Erreur: ${error.code}`);
      }

      setReaders((prev) => prev.filter((r) => r.id !== id));
      setSelectedReaders((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Source supprimée avec succès', { icon: <Trash2 className="w-4 h-4" /> });
    } catch (err: any) {
      console.error('Delete reader error:', err);
      const errorMessage = err?.message || 'Erreur inconnue';
      toast.error(`Suppression impossible: ${errorMessage}`, {
        icon: <AlertCircle className="w-4 h-4" />,
        duration: 5000
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleReaderSelection = (id: string) => {
    setSelectedReaders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllReaders = () => {
    if (selectedReaders.size === filteredReaders.length) {
      setSelectedReaders(new Set());
    } else {
      setSelectedReaders(new Set(filteredReaders.map(r => r.id)));
    }
  };

  const clearSelection = () => {
    setSelectedReaders(new Set());
  };

  const bulkDeleteReaders = async () => {
    if (selectedReaders.size === 0) return;

    const itemCount = selectedReaders.size;
    const confirmMessage = itemCount > 100
      ? `Êtes-vous sûr de vouloir supprimer ${itemCount} sources ? Cette opération peut prendre quelques instants et est irréversible.`
      : `Êtes-vous sûr de vouloir supprimer ${itemCount} source(s) ? Cette action est irréversible.`;

    if (!confirm(confirmMessage)) return;

    setBulkDeleteProgress({ current: 0, total: itemCount, failed: 0 });
    setBulkDeleteDialogOpen(true);
    setBulkDeleting(true);

    const BATCH_SIZE = 100;
    const MAX_CONCURRENT = 3;
    const ids = [...selectedReaders];
    const batches: string[][] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    let successCount = 0;
    let failedCount = 0;
    const successfulIds = new Set<string>();

    const processBatch = async (batchIds: string[]): Promise<{ success: boolean; ids: string[] }> => {
      try {
        const { error } = await supabase
          .from('readers')
          .delete()
          .in('id', batchIds);

        if (error) {
          console.error('Batch delete error:', error);
          if (error.code === '42501' || error.message?.includes('row-level security')) {
            return { success: false, ids: batchIds };
          }
          return { success: false, ids: batchIds };
        }
        return { success: true, ids: batchIds };
      } catch (err) {
        console.error('Batch delete exception:', err);
        return { success: false, ids: batchIds };
      }
    };

    try {
      for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
        const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(concurrentBatches.map(processBatch));

        results.forEach(result => {
          if (result.success) {
            successCount += result.ids.length;
            result.ids.forEach(id => successfulIds.add(id));
          } else {
            failedCount += result.ids.length;
          }
        });

        setBulkDeleteProgress({
          current: successCount + failedCount,
          total: itemCount,
          failed: failedCount
        });
      }

      setReaders((prev) => prev.filter((r) => !successfulIds.has(r.id)));
      setSelectedReaders((prev) => {
        const next = new Set(prev);
        successfulIds.forEach(id => next.delete(id));
        return next;
      });

      if (failedCount === 0) {
        toast.success(`${successCount} source(s) supprimée(s) avec succès`, {
          icon: <Trash2 className="w-4 h-4" />
        });
        addNotification({
          message: `Suppression terminée: ${successCount} sources supprimées`,
          type: 'success',
          data: { action: 'bulk_delete', status: 'completed', success: successCount }
        });
      } else if (successCount > 0) {
        toast.warning(`${successCount} source(s) supprimée(s), ${failedCount} échec(s)`, {
          icon: <AlertCircle className="w-4 h-4" />,
          duration: 5000
        });
        addNotification({
          message: `Suppression partielle: ${successCount} réussies, ${failedCount} échecs`,
          type: 'warning',
          data: { action: 'bulk_delete', status: 'partial', success: successCount, failed: failedCount }
        });
      } else {
        toast.error('Suppression impossible. Vérifiez vos permissions.', {
          icon: <AlertCircle className="w-4 h-4" />,
          duration: 5000
        });
        addNotification({
          message: 'Suppression échouée: vérifiez vos permissions',
          type: 'error',
          data: { action: 'bulk_delete', status: 'failed' }
        });
      }
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      toast.error(`Suppression partielle: ${successCount} réussie(s), ${failedCount} échec(s)`, {
        icon: <AlertCircle className="w-4 h-4" />,
        duration: 5000
      });
    } finally {
      setBulkDeleting(false);
      setTimeout(() => {
        setBulkDeleteDialogOpen(false);
        setBulkDeleteProgress({ current: 0, total: 0, failed: 0 });
      }, 1500);
    }
  };

  const toggleReader = async (id: string, enabled: boolean) => {
    setReaders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      const { error } = await supabase.from('readers').update({ enabled }).eq('id', id);
      if (error) throw error;
      toast.success(enabled ? 'Source activée' : 'Source désactivée', {
        icon: enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
      });
    } catch {
      setReaders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)));
      toast.error('Impossible de changer l\'état', { icon: <AlertCircle className="w-4 h-4" /> });
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiée dans le presse-papier', { icon: <Copy className="w-4 h-4" /> });
  };

  const duplicateSourceForMedia = async (sourceId: string) => {
    const source = readers.find(r => r.id === sourceId);
    if (!source) return;

    // Ouvrir le dialog avec les données pré-remplies mais sans TMDB ID
    setFormData({
      label: `${source.label} (copie)`,
      baseUrl: normalizeBaseUrl(source.url.replace(/\/(season|episode)\/\d+/gi, '')),
      media_type: source.media_type as MediaType,
      language: source.language,
      season: source.season_number ? String(source.season_number) : '',
      episode: source.episode_number ? String(source.episode_number) : '',
      enabled: source.enabled,
      tmdb_id: null, // Forcer à sélectionner un nouveau média
      tmdb: null,
      source_type: 'synchronized',
    });
    setEditingReader(null);
    setDialogOpen(true);
    toast.info('Sélectionnez le média pour lequel dupliquer cette source', {
      icon: <Info className="w-4 h-4" />,
      duration: 4000
    });
  };

  const onSelectTMDB = async (item: TMDBResult) => {
    const title = item.media_type === 'movie' ? item.title || '' : item.name || '';
    const baseUrl = formData.baseUrl || `https://streaming.example.com/${item.media_type}/${item.id}`;

    setFormData((f) => ({
      ...f,
      label: title,
      baseUrl,
      media_type: item.media_type as MediaType,
      tmdb_id: item.id,
      tmdb: item,
    }));
    setShowTmdbDropdown(false);
    setTmdbQuery('');
    setTmdbResults([]);

    if (item.media_type === 'tv') {
      try {
        const seasons = await fetchTMDBSeasons(item.id);
        setTmdbSeasons(seasons);
      } catch {
        setTmdbSeasons([]);
      }
    } else {
      setTmdbSeasons([]);
    }
  };

  const fetchByTmdbId = async () => {
    const id = parseInt(tmdbIdInput);
    if (isNaN(id) || id <= 0) {
      toast.warning('ID TMDB invalide');
      return;
    }

    setTmdbLoading(true);
    try {
      const item = await fetchTMDBById(id, tmdbMediaTypeForId);
      if (!item) {
        toast.error('Aucun résultat trouvé pour cet ID');
        return;
      }
      await onSelectTMDB(item);
      toast.success('Film/Série trouvé !');
    } catch (err) {
      toast.error('Erreur lors de la recherche');
    } finally {
      setTmdbLoading(false);
    }
  };

  const previewUrl = useMemo(() => {
    const seasonNum = formData.season ? Number(formData.season) : null;
    const episodeNum = formData.episode ? Number(formData.episode) : null;
    return buildFinalUrl(formData.baseUrl || '', formData.media_type, seasonNum, episodeNum);
  }, [formData.baseUrl, formData.media_type, formData.season, formData.episode]);

  interface ParsedArray {
    arrayName: string;
    readerName: string;
    urls: string[];
  }

  const extractReaderNameFromUrl = (url: string): string => {
    const knownReaders: { pattern: string; name: string }[] = [
      { pattern: 'sibnet', name: 'Sibnet' },
      { pattern: 'vidomly', name: 'Vidomly' },
      { pattern: 'vidmoly', name: 'Vidmoly' },
      { pattern: 'vudeo', name: 'Vudeo' },
      { pattern: 'sendvid', name: 'SendVid' },
      { pattern: 'doodstream', name: 'DoodStream' },
      { pattern: 'dood.', name: 'Dood' },
      { pattern: 'streamtape', name: 'StreamTape' },
      { pattern: 'vidoza', name: 'Vidoza' },
      { pattern: 'mixdrop', name: 'MixDrop' },
      { pattern: 'upstream', name: 'UpStream' },
      { pattern: 'streamlare', name: 'StreamLare' },
      { pattern: 'filemoon', name: 'FileMoon' },
      { pattern: 'voe.sx', name: 'Voe' },
      { pattern: 'voe-', name: 'Voe' },
      { pattern: 'uqload', name: 'UQLoad' },
      { pattern: 'mp4upload', name: 'MP4Upload' },
      { pattern: 'yourupload', name: 'YourUpload' },
      { pattern: 'fembed', name: 'Fembed' },
      { pattern: 'streamwish', name: 'StreamWish' },
      { pattern: 'vtube', name: 'VTube' },
      { pattern: 'streamvid', name: 'StreamVid' },
      { pattern: 'filelions', name: 'FileLions' },
      { pattern: 'embedsito', name: 'EmbedSito' },
      { pattern: 'vembed', name: 'VEmbed' },
      { pattern: 'videovard', name: 'VideoVard' },
      { pattern: 'ok.ru', name: 'OK.ru' },
      { pattern: 'okru', name: 'OK.ru' },
      { pattern: 'dailymotion', name: 'Dailymotion' },
      { pattern: 'rutube', name: 'Rutube' },
      { pattern: 'vk.com', name: 'VK' },
      { pattern: 'vkvideo', name: 'VK Video' },
      { pattern: 'myvi', name: 'MyVI' },
      { pattern: 'netu', name: 'Netu' },
      { pattern: 'hqq', name: 'HQQ' },
      { pattern: 'waaw', name: 'Waaw' },
      { pattern: 'supervideo', name: 'SuperVideo' },
      { pattern: 'streamz', name: 'Streamz' },
      { pattern: 'streamsb', name: 'StreamSB' },
      { pattern: 'sbembed', name: 'SBEmbed' },
      { pattern: 'sbplay', name: 'SBPlay' },
      { pattern: 'cloudemb', name: 'CloudEmb' },
      { pattern: 'streamhub', name: 'StreamHub' },
      { pattern: 'embedgram', name: 'EmbedGram' },
      { pattern: 'vidsrc', name: 'VidSrc' },
      { pattern: 'vidbem', name: 'VidBem' },
      { pattern: 'vidcloud', name: 'VidCloud' },
      { pattern: 'gdrive', name: 'GDrive' },
      { pattern: 'gdtot', name: 'GDTot' },
      { pattern: 'aparat', name: 'Aparat' },
      { pattern: 'mega.nz', name: 'Mega' },
      { pattern: 'mega.co', name: 'Mega' },
      { pattern: 'uptobox', name: 'UpToBox' },
      { pattern: 'uptostream', name: 'UpToStream' },
      { pattern: 'vidlox', name: 'VidLox' },
      { pattern: 'wolfstream', name: 'WolfStream' },
      { pattern: 'evoload', name: 'EvoLoad' },
      { pattern: 'mcloud', name: 'MCloud' },
      { pattern: 'vidshar', name: 'VidShar' },
      { pattern: 'streamable', name: 'Streamable' },
      { pattern: 'jwplayer', name: 'JWPlayer' },
      { pattern: 'gounlimited', name: 'GoUnlimited' },
      { pattern: 'vupload', name: 'VUpload' },
      { pattern: 'fastupload', name: 'FastUpload' },
      { pattern: 'youdbox', name: 'YoudBox' },
      { pattern: 'cloudvideo', name: 'CloudVideo' },
      { pattern: 'playerx', name: 'PlayerX' },
      { pattern: 'ninjastream', name: 'NinjaStream' },
      { pattern: 'vidfast', name: 'VidFast' },
      { pattern: 'streamsss', name: 'StreamSSS' },
      { pattern: 'vidguard', name: 'VidGuard' },
      { pattern: 'lulustream', name: 'LuluStream' },
      { pattern: 'vidplay', name: 'VidPlay' },
      { pattern: 'mystream', name: 'MyStream' },
      { pattern: 'streamango', name: 'Streamango' },
      { pattern: 'rapidvideo', name: 'RapidVideo' },
      { pattern: 'openload', name: 'Openload' },
      { pattern: 'streamcherry', name: 'StreamCherry' },
      { pattern: 'flix555', name: 'Flix555' },
      { pattern: 'estream', name: 'EStream' },
      { pattern: 'videobin', name: 'VideoBin' },
      { pattern: 'streamhd', name: 'StreamHD' },
    ];

    const urlLower = url.toLowerCase();
    for (const { pattern, name } of knownReaders) {
      if (urlLower.includes(pattern)) {
        return name;
      }
    }

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '').replace(/^player\./, '').replace(/^embed\./, '');
      const parts = hostname.split('.');
      if (parts.length > 0 && parts[0].length > 1) {
        const name = parts[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch { }

    return '';
  };

  const extractUrlsFromContent = (content: string): string[] => {
    const urls: string[] = [];
    const urlPattern = /['"`](https?:\/\/[^'"`]+)['"`]/g;
    let match;

    while ((match = urlPattern.exec(content)) !== null) {
      const url = match[1].trim();
      if (url && isValidUrl(url)) {
        urls.push(url);
      }
    }

    return urls;
  };

  const extractReaderNameFromVarName = (varName: string): string => {
    const prefixes = /^(eps?|vid|vids|videos?|links?|urls?|players?|sources?|embed|streams?|lecteurs?|episode|episodes)_?/i;
    const cleaned = varName.replace(prefixes, '').trim();

    if (cleaned.length > 1) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return '';
  };

  const parseAllArrays = (input: string): ParsedArray[] => {
    const results: ParsedArray[] = [];

    const namedArrayPattern = /(var|const|let)\s+(\w+)\s*=\s*\[([\s\S]*?)\](?:\s*;|\s*$|\s*(?=var|const|let))/g;
    let match;

    while ((match = namedArrayPattern.exec(input)) !== null) {
      const arrayName = match[2];
      const arrayContent = match[3];
      const urls = extractUrlsFromContent(arrayContent);

      if (urls.length > 0) {
        const readerFromUrl = extractReaderNameFromUrl(urls[0]);
        const readerFromVarName = extractReaderNameFromVarName(arrayName);
        const readerName = readerFromUrl || readerFromVarName || arrayName;

        results.push({
          arrayName,
          readerName: readerName || 'Source',
          urls: [...new Set(urls)]
        });
      }
    }

    if (results.length === 0) {
      const standaloneArrayMatch = /^\s*\[([\s\S]*?)\]\s*$/m.exec(input);
      if (standaloneArrayMatch && standaloneArrayMatch[1]) {
        const urls = extractUrlsFromContent(standaloneArrayMatch[1]);

        if (urls.length > 0) {
          const readerName = extractReaderNameFromUrl(urls[0]);
          results.push({
            arrayName: 'default',
            readerName: readerName || 'Source',
            urls: [...new Set(urls)]
          });
        }
      }
    }

    if (results.length === 0) {
      const urls: string[] = [];
      const lines = input.split(/\n/);
      for (const line of lines) {
        const trimmed = line.replace(/['"`\[\];]/g, '').trim();
        if (trimmed && isValidUrl(trimmed)) {
          urls.push(trimmed);
        }
      }

      if (urls.length > 0) {
        const readerName = extractReaderNameFromUrl(urls[0]);
        results.push({
          arrayName: 'default',
          readerName: readerName || 'Source',
          urls: [...new Set(urls)]
        });
      }
    }

    return results;
  };

  const parseEpisodeUrls = (input: string): string[] => {
    const allArrays = parseAllArrays(input);
    const allUrls: string[] = [];
    for (const arr of allArrays) {
      allUrls.push(...arr.urls);
    }
    return [...new Set(allUrls)];
  };

  const detectMultipleArrays = (input: string): { count: number; names: string[]; arrays: ParsedArray[] } => {
    const arrays = parseAllArrays(input);
    return {
      count: arrays.length,
      names: arrays.map(a => a.arrayName),
      arrays
    };
  };

  const openBulkImportDialog = () => {
    setBulkImportData('');
    setBulkImportLabel('');
    setBulkImportLanguage('VOSTFR');
    setBulkImportSeason('1');
    setBulkImportTmdbId(null);
    setBulkImportTmdb(null);
    setBulkImportProgress({ current: 0, total: 0 });
    setBulkImportMediaType('tv');
    setBulkImportDialogOpen(true);
  };

  const handleBulkImport = async () => {
    if (!bulkImportTmdbId) {
      toast.warning('Veuillez sélectionner une série TMDB');
      return;
    }

    const allArrays = parseAllArrays(bulkImportData);

    if (allArrays.length === 0) {
      toast.error('Aucune URL valide trouvée dans les données');
      return;
    }

    const seasonNum = parseInt(bulkImportSeason) || 1;

    setBulkImporting(true);

    const allPayloads: {
      label: string;
      url: string;
      media_type: string;
      language: string;
      enabled: boolean;
      tmdb_id: number;
      season_number: number;
      episode_number: number;
    }[] = [];
    const invalidUrls: { episode: number; url: string; error: string }[] = [];

    for (const parsedArray of allArrays) {
      const autoReaderName = parsedArray.urls.length > 0 ? extractReaderNameFromUrl(parsedArray.urls[0]) : parsedArray.readerName;
      const baseLabel = bulkImportLabel.trim() || bulkImportTmdb?.name || 'Source';
      const readerLabel = allArrays.length > 1
        ? `${baseLabel} - ${autoReaderName || parsedArray.readerName}`
        : (autoReaderName ? `${baseLabel} - ${autoReaderName}` : baseLabel);

      for (let i = 0; i < parsedArray.urls.length; i++) {
        const episodeNum = i + 1;
        const url = parsedArray.urls[i];

        if (!url || !isValidUrl(url)) {
          invalidUrls.push({ episode: episodeNum, url: url || 'vide', error: 'URL invalide' });
          continue;
        }

        allPayloads.push({
          label: `${readerLabel} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`,
          url: url,
          media_type: normalizeMediaType(bulkImportMediaType),
          language: bulkImportLanguage,
          enabled: true,
          tmdb_id: bulkImportTmdbId,
          season_number: seasonNum,
          episode_number: episodeNum,
        });
      }
    }

    if (allPayloads.length === 0) {
      toast.error('Aucune URL valide trouvée dans les données');
      setBulkImporting(false);
      return;
    }

    setBulkImportProgress({ current: 0, total: allPayloads.length });

    addNotification({
      message: `Import en cours: ${allPayloads.length} sources à importer`,
      type: 'info',
      data: { action: 'bulk_import', status: 'started', total: allPayloads.length }
    });

    try {
      const BATCH_SIZE = 50;
      const newReaders: Reader[] = [];
      let successCount = 0;
      let errorCount = invalidUrls.length;

      for (let i = 0; i < allPayloads.length; i += BATCH_SIZE) {
        const batch = allPayloads.slice(i, i + BATCH_SIZE);

        try {
          const { data, error } = await supabase
            .from('readers')
            .insert(batch)
            .select();

          if (error) {
            console.error('Batch insert error:', error);
            for (const payload of batch) {
              try {
                const { data: singleData, error: singleError } = await supabase
                  .from('readers')
                  .insert([payload])
                  .select();

                if (singleError) {
                  errorCount++;
                  if (singleError.code === '23505') {
                    invalidUrls.push({ episode: payload.episode_number, url: payload.url, error: 'Doublon existant' });
                  } else {
                    invalidUrls.push({ episode: payload.episode_number, url: payload.url, error: singleError.message || 'Erreur RLS' });
                  }
                } else if (singleData && singleData.length > 0) {
                  newReaders.push(singleData[0] as Reader);
                  successCount++;
                }
              } catch (e: any) {
                errorCount++;
                invalidUrls.push({ episode: payload.episode_number, url: payload.url, error: e.message || 'Erreur inconnue' });
              }
            }
          } else if (data) {
            newReaders.push(...(data as Reader[]));
            successCount += data.length;
          }
        } catch (e: any) {
          console.error('Batch error:', e);
          errorCount += batch.length;
        }

        setBulkImportProgress({ current: Math.min(i + BATCH_SIZE, allPayloads.length), total: allPayloads.length });
      }

      if (successCount > 0) {
        setReaders(prev => [...newReaders, ...prev]);
        const readersImported = allArrays.length > 1
          ? `${allArrays.length} lecteurs (${successCount} épisodes)`
          : `${successCount} épisodes`;
        toast.success(
          `${readersImported} importés avec succès${errorCount > 0 ? ` (${errorCount} erreurs)` : ''}`,
          { icon: <CheckCircle2 className="w-4 h-4" /> }
        );
        addNotification({
          message: `Import terminé: ${successCount} sources ajoutées${errorCount > 0 ? `, ${errorCount} erreurs` : ''}`,
          type: errorCount > 0 ? 'warning' : 'success',
          data: { action: 'bulk_import', status: 'completed', success: successCount, errors: errorCount }
        });
      }

      if (errorCount > 0) {
        if (successCount === 0) {
          toast.error(`Échec de l'import: ${errorCount} erreurs`);
        }
        if (invalidUrls.length > 0) {
          const firstErrors = invalidUrls.slice(0, 5);
          const errorSummary = firstErrors.map(e => `E${e.episode}: ${e.error}`).join(', ');
          const moreCount = invalidUrls.length > 5 ? ` +${invalidUrls.length - 5} autres` : '';
          console.warn('Détails des erreurs d\'import:', invalidUrls);
          toast.warning(`Erreurs: ${errorSummary}${moreCount}`, { duration: 8000 });
        }
      }

      if (successCount > 0) {
        setBulkImportDialogOpen(false);
      }

    } catch (err: any) {
      console.error('Import error:', err);
      toast.error(`Erreur lors de l'import: ${err.message || 'inconnue'}`);
    } finally {
      setBulkImporting(false);
    }
  };

  const onSelectBulkTMDB = async (item: TMDBResult) => {
    if (item.media_type !== 'tv') {
      toast.warning('L\'import en masse est uniquement pour les séries TV');
      return;
    }

    const title = item.name || '';
    setBulkImportLabel(title);
    setBulkImportTmdbId(item.id);
    setBulkImportTmdb(item);
    setShowTmdbDropdown(false);
    setTmdbQuery('');
    setTmdbResults([]);

    try {
      const seasons = await fetchTMDBSeasons(item.id);
      setTmdbSeasons(seasons);
    } catch {
      setTmdbSeasons([]);
    }
  };

  const openDualLanguageImportDialog = () => {
    // Initialiser avec les 2 premières langues personnalisées ou vide
    const initialInputs = customLanguages.slice(0, 2).map(l => ({ langCode: l.code, data: '' }));
    if (initialInputs.length === 0) initialInputs.push({ langCode: 'VOSTFR', data: '' });

    setDualLangInputs(initialInputs);
    setDualLangLabel('');
    setDualLangSeason('1');
    setDualLangTmdbId(null);
    setDualLangTmdb(null);
    setDualLangProgress({ current: 0, total: 0 });
    setDualLangMediaType('tv');
    setDualLangSeasons([]);
    setDualLangDialogOpen(true);
  };

  const onSelectDualLangTMDB = async (item: TMDBResult) => {
    if (item.media_type !== 'tv') {
      toast.warning('L\'import double langue est uniquement pour les séries TV');
      return;
    }

    const title = item.name || '';
    setDualLangLabel(title);
    setDualLangTmdbId(item.id);
    setDualLangTmdb(item);
    setShowTmdbDropdown(false);
    setTmdbQuery('');
    setTmdbResults([]);

    try {
      const seasons = await fetchTMDBSeasons(item.id);
      setDualLangSeasons(seasons);
    } catch {
      setDualLangSeasons([]);
    }
  };

  const handleDualLanguageImport = async () => {
    if (!dualLangTmdbId) {
      toast.warning('Veuillez sélectionner une série TMDB');
      return;
    }

    const allImports = dualLangInputs.map(input => ({
      language: input.langCode,
      arrays: parseAllArrays(input.data)
    })).filter(imp => imp.arrays.length > 0 && imp.arrays.some(a => a.urls.length > 0));

    if (allImports.length === 0) {
      toast.error('Veuillez fournir au moins une liste d\'URLs');
      return;
    }

    const seasonNum = parseInt(dualLangSeason) || 1;

    setDualLangImporting(true);

    const allPayloads: {
      label: string;
      url: string;
      media_type: string;
      language: string;
      enabled: boolean;
      tmdb_id: number;
      season_number: number;
      episode_number: number;
    }[] = [];
    const invalidUrls: { episode: number; url: string; error: string }[] = [];

    for (const importData of allImports) {
      for (const parsedArray of importData.arrays) {
        const autoReaderName = parsedArray.urls.length > 0
          ? extractReaderNameFromUrl(parsedArray.urls[0])
          : parsedArray.readerName;
        const baseLabel = dualLangLabel.trim() || dualLangTmdb?.name || 'Source';
        const readerLabel = autoReaderName
          ? `${baseLabel} - ${autoReaderName}`
          : baseLabel;

        for (let i = 0; i < parsedArray.urls.length; i++) {
          const episodeNum = i + 1;
          const url = parsedArray.urls[i];

          if (!url || !isValidUrl(url)) {
            invalidUrls.push({ episode: episodeNum, url: url || 'vide', error: 'URL invalide' });
            continue;
          }

          allPayloads.push({
            label: `${readerLabel} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`,
            url: url,
            media_type: normalizeMediaType(dualLangMediaType),
            language: importData.language,
            enabled: true,
            tmdb_id: dualLangTmdbId,
            season_number: seasonNum,
            episode_number: episodeNum,
          });
        }
      }
    }

    if (allPayloads.length === 0) {
      toast.error('Aucune URL valide trouvée');
      setDualLangImporting(false);
      return;
    }

    setDualLangProgress({ current: 0, total: allPayloads.length });

    try {
      const BATCH_SIZE = 100;
      const newReaders: Reader[] = [];
      let successCount = 0;
      let errorCount = invalidUrls.length;

      for (let i = 0; i < allPayloads.length; i += BATCH_SIZE) {
        const batch = allPayloads.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
          .from('readers')
          .insert(batch)
          .select();

        if (error) {
          console.error('Batch insert error:', error);
          for (const payload of batch) {
            try {
              const { data: singleData, error: singleError } = await supabase
                .from('readers')
                .insert(payload)
                .select()
                .single();

              if (singleError) {
                errorCount++;
                if (singleError.code === '23505') {
                  invalidUrls.push({ episode: payload.episode_number, url: payload.url, error: 'Doublon existant' });
                }
              } else if (singleData) {
                newReaders.push(singleData as Reader);
                successCount++;
              }
            } catch {
              errorCount++;
            }
          }
        } else if (data) {
          newReaders.push(...(data as Reader[]));
          successCount += data.length;
        }

        setDualLangProgress({ current: Math.min(i + BATCH_SIZE, allPayloads.length), total: allPayloads.length });
      }

      if (successCount > 0) {
        setReaders(prev => [...newReaders, ...prev]);
        const langParts = allImports.map(imp => imp.language).filter(Boolean);
        const langInfo = langParts.length > 0 ? langParts.join(' + ') : 'Multi';
        toast.success(
          `${successCount} épisodes importés (${langInfo})${errorCount > 0 ? ` (${errorCount} erreurs)` : ''}`,
          { icon: <CheckCircle2 className="w-4 h-4" /> }
        );
      }

      if (errorCount > 0 && successCount === 0) {
        toast.error(`Échec de l'import: ${errorCount} erreurs`);
      }

      setDualLangDialogOpen(false);

    } catch (err: any) {
      toast.error(`Erreur lors de l'import: ${err.message || 'inconnue'}`);
    } finally {
      setDualLangImporting(false);
    }
  };

  // Early bailout for non-admin users (before rendering heavy UI)
  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
              <p className="text-muted-foreground mb-4">
                Vous n'avez pas les permissions nécessaires pour accéder à cette page.
              </p>
              <Button onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    const loadingSteps = [
      "Chargement des sources...",
      "Chargement des utilisateurs...",
      "Préparation de l'interface..."
    ];

    return (
      <div className="container mx-auto px-4 py-10 flex items-center justify-center min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-[400px] bg-card/95 backdrop-blur-sm border-primary/20 shadow-2xl">
            <CardContent className="pt-8 pb-8 px-8">
              <div className="flex flex-col items-center gap-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative p-4 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30">
                    <Shield className="w-10 h-10 text-primary" />
                  </div>
                </motion.div>

                <div className="text-center space-y-1">
                  <h3 className="font-semibold text-lg">Administration</h3>
                  <p className="text-sm text-muted-foreground">Initialisation du panneau</p>
                </div>

                <div className="w-full space-y-3">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={Math.floor(Date.now() / 1500) % 3}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{loadingSteps[Math.floor(Date.now() / 1500) % 3]}</span>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1, 0.8],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary" />
              Administration
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les sources de streaming et les utilisateurs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RealtimeNotifications
            notifications={notifications}
            unreadCount={unreadCount}
            isConnected={isConnected}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onClear={clearNotifications}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Sources totales"
          value={stats.totalReaders}
          icon={<Database className="w-7 h-7" />}
          description={`✅ ${stats.readersEnabled} actives • ❌ ${stats.readersDisabled} inactives`}
          trend={{ label: "Taux activation", value: Math.round((stats.readersEnabled / stats.totalReaders) * 100), color: "bg-emerald-500/20 text-emerald-400" }}
        />
        <StatsCard
          title="Liées à TMDB"
          value={stats.readersWithTmdb}
          icon={<Film className="w-7 h-7" />}
          description={`${stats.readersWithoutTmdb} sans liaison TMDB`}
          trend={{ label: "Couverture", value: Math.round((stats.readersWithTmdb / stats.totalReaders) * 100), color: "bg-blue-500/20 text-blue-400" }}
        />
        <StatsCard
          title="Utilisateurs"
          value={stats.totalUsers}
          icon={<Users className="w-7 h-7" />}
          description={`👤 ${stats.adminUsers} admin(s) • 🟢 ${stats.onlineUsers} en ligne`}
          trend={{ label: "Admin %", value: Math.round((stats.adminUsers / stats.totalUsers) * 100) || 0, color: "bg-amber-500/20 text-amber-400" }}
        />
        <StatsCard
          title="Types média"
          value={stats.movieReaders + stats.seriesReaders + stats.animeReaders}
          icon={<BarChart3 className="w-7 h-7" />}
          description={`🎬 ${stats.movieReaders} films • 📺 ${stats.seriesReaders} séries • ✨ ${stats.animeReaders} anime`}
          trend={{ label: "Plus courant", value: Math.max(stats.movieReaders, stats.seriesReaders, stats.animeReaders), color: "bg-purple-500/20 text-purple-400" }}
        />
        <StatsCard
          title="Langues"
          value={stats.languageStats.length}
          icon={<Globe className="w-7 h-7" />}
          description={stats.languageStats.map(l => `${l.code}: ${l.count}`).join(' • ')}
          trend={{
            label: "Couverture multi",
            value: Math.round((stats.languageStats.reduce((sum, l) => sum + l.count, 0) / stats.totalReaders) * 100) || 0,
            color: "bg-cyan-500/20 text-cyan-400"
          }}
        />
        <ServiceStatusCard />
      </div>

      <Tabs defaultValue="readers" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 w-full justify-start">
          <TabsTrigger value="readers" className="gap-2">
            <LinkIcon className="w-4 h-4" />
            Sources ({stats.totalReaders})
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Utilisateurs ({stats.totalUsers})
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2 relative">
            <Mail className="w-4 h-4" />
            Messages ({stats.totalMessages})
            {stats.pendingMessages > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {stats.pendingMessages}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cookies" className="gap-2">
            <Cookie className="w-4 h-4" />
            Cookies
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="w-4 h-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-2">
            <Bot className="w-4 h-4" />
            Bots IA
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Paramètres
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <Activity className="w-4 h-4" />
            Monitoring (Bêta)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readers" className="space-y-4">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="w-5 h-5" />
                    Gestion des sources
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Ajoutez, modifiez ou supprimez des sources de streaming
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={openDualLanguageImportDialog} variant="outline" className="gap-2">
                    <Globe className="w-4 h-4" />
                    Import double langue
                  </Button>
                  <Button onClick={openBulkImportDialog} variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Import en masse
                  </Button>
                  <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter une source
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom, URL, type..."
                    value={searchReaders}
                    onChange={(e) => setSearchReaders(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterMediaType} onValueChange={setFilterMediaType}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Type de média" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types ({stats.totalReaders})</SelectItem>
                    <SelectItem value="movie">
                      <div className="flex items-center gap-2">
                        <Film className="w-3 h-3 text-blue-500" />
                        Films ({stats.movieReaders})
                      </div>
                    </SelectItem>
                    <SelectItem value="tv">
                      <div className="flex items-center gap-2">
                        <Tv className="w-3 h-3 text-green-500" />
                        Séries TV ({stats.seriesReaders})
                      </div>
                    </SelectItem>
                    <SelectItem value="anime">
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-pink-500" />
                        Anime ({stats.animeReaders})
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterEnabled} onValueChange={setFilterEnabled}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="État" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="enabled">Activées</SelectItem>
                    <SelectItem value="disabled">Désactivées</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 border rounded-lg p-1 bg-secondary/30">
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grouped')}
                    className="gap-1.5"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Groupé
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="gap-1.5"
                  >
                    <LayoutList className="w-4 h-4" />
                    Table
                  </Button>
                </div>
              </div>

              <AdvancedFilters
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
                config={filterConfig}
                onReset={handleResetFilters}
              />

              {selectedReaders.size > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Checkbox
                    checked={selectedReaders.size === filteredReaders.length}
                    onCheckedChange={selectAllReaders}
                  />
                  <span className="text-sm font-medium">
                    {selectedReaders.size} source(s) sélectionnée(s)
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="gap-1"
                  >
                    <X className="w-4 h-4" />
                    Désélectionner
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={bulkDeleteReaders}
                    disabled={saving}
                    className="gap-1"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Supprimer ({selectedReaders.size})
                  </Button>
                </div>
              )}

              {viewMode === 'grouped' && groupedReaders.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAllGroups} className="gap-1">
                    <ChevronDown className="w-4 h-4" />
                    Tout déplier
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAllGroups} className="gap-1">
                    <ChevronRight className="w-4 h-4" />
                    Tout replier
                  </Button>
                  <Badge variant="secondary" className="ml-auto">
                    {groupedReaders.length} média(s) • {filteredReaders.length} source(s)
                  </Badge>
                </div>
              )}

              {filteredReaders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Aucune source trouvée</p>
                  <p className="text-sm">Essayez de modifier vos filtres ou d'ajouter une nouvelle source</p>
                </div>
              ) : viewMode === 'grouped' ? (
                <div className="space-y-3">
                  {groupedReaders.map(([key, group]) => {
                    const isExpanded = expandedGroups.has(key);
                    const mediaType = group.mediaType === 'movie' ? 'movie' : 'tv';
                    const cacheKey = `${mediaType}-${group.tmdbId}`;
                    const tmdbInfo = group.tmdbId ? tmdbCache[cacheKey] : null;
                    const title = tmdbInfo ? (tmdbInfo.title || tmdbInfo.name) : group.readers[0]?.label || 'Sans titre';

                    return (
                      <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleGroup(key)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                            <div className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>

                            {tmdbInfo?.poster_path ? (
                              <img
                                src={`${TMDB_IMG}/w92${tmdbInfo.poster_path}`}
                                alt=""
                                className="w-12 h-16 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-16 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                                {group.mediaType === 'movie' ? (
                                  <Film className="w-6 h-6 text-muted-foreground" />
                                ) : (
                                  <Tv className="w-6 h-6 text-muted-foreground" />
                                )}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold truncate">{title}</h4>
                                <Badge variant="outline" className={`text-xs gap-1 ${getMediaTypeColor(group.mediaType)}`}>
                                  {getMediaTypeIcon(group.mediaType)}
                                  {getMediaTypeLabel(group.mediaType)}
                                </Badge>
                                {group.tmdbId && (
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    TMDB: {group.tmdbId}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span>{Object.keys(group.bySource).length} lecteur(s)</span>
                                <span>•</span>
                                <span>{group.readers.length} source(s)</span>
                                {group.mediaType !== 'movie' && formatEpisodeRange(group.readers) && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-xs bg-secondary/50 px-1.5 py-0.5 rounded">
                                      {formatEpisodeRange(group.readers)}
                                    </span>
                                  </>
                                )}
                                <span>•</span>
                                <span className={group.readers.filter(r => r.enabled).length === group.readers.length ? 'text-green-500' : ''}>
                                  {group.readers.filter(r => r.enabled).length}/{group.readers.length} actif
                                </span>
                                {tmdbInfo?.vote_average && tmdbInfo.vote_average > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                      {tmdbInfo.vote_average.toFixed(1)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (group.tmdbId) {
                                    window.open(`/${group.mediaType === 'movie' ? 'movie' : 'tv'}/${group.tmdbId}`, '_blank');
                                  }
                                }}
                                title="Voir la page média"
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="ml-8 mt-2 space-y-2">
                            {Object.entries(group.bySource).map(([sourceName, sourceData]) => {
                              const allSourceReaders = Object.values(sourceData.byLanguage).flat();
                              const languages = Object.keys(sourceData.byLanguage);

                              return (
                                <div key={sourceName} className="rounded-lg border bg-card/50 overflow-hidden">
                                  <div className="flex items-center gap-3 p-3 bg-secondary/20 border-b">
                                    <Checkbox
                                      checked={allSourceReaders.every(r => selectedReaders.has(r.id))}
                                      onCheckedChange={() => {
                                        const allSelected = allSourceReaders.every(r => selectedReaders.has(r.id));
                                        setSelectedReaders(prev => {
                                          const next = new Set(prev);
                                          allSourceReaders.forEach(r => {
                                            if (allSelected) {
                                              next.delete(r.id);
                                            } else {
                                              next.add(r.id);
                                            }
                                          });
                                          return next;
                                        });
                                      }}
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Globe className="w-4 h-4 text-primary" />
                                        <span className="font-semibold">{sourceName}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {languages.length} langue{languages.length > 1 ? 's' : ''}
                                        </Badge>
                                        <Badge variant={allSourceReaders.every(r => r.enabled) ? 'default' : 'secondary'} className="text-xs">
                                          {allSourceReaders.filter(r => r.enabled).length}/{allSourceReaders.length} actif
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Language sections within source */}
                                  <div className="p-3 space-y-3">
                                    {Object.entries(sourceData.byLanguage).map(([language, langReaders]) => (
                                      <div key={language} className="border rounded-md bg-background/50">
                                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-secondary/10">
                                          <Checkbox
                                            checked={langReaders.every(r => selectedReaders.has(r.id))}
                                            className="h-3.5 w-3.5"
                                            onCheckedChange={() => {
                                              const allSelected = langReaders.every(r => selectedReaders.has(r.id));
                                              setSelectedReaders(prev => {
                                                const next = new Set(prev);
                                                langReaders.forEach(r => {
                                                  if (allSelected) {
                                                    next.delete(r.id);
                                                  } else {
                                                    next.add(r.id);
                                                  }
                                                });
                                                return next;
                                              });
                                            }}
                                          />
                                          <Badge variant="secondary" className="uppercase font-mono text-xs">
                                            {language}
                                          </Badge>
                                          {formatEpisodeRange(langReaders) && (
                                            <Badge variant="outline" className="text-xs font-mono">
                                              {formatEpisodeRange(langReaders)}
                                            </Badge>
                                          )}
                                          <span className="text-xs text-muted-foreground ml-auto">
                                            {langReaders.length} source{langReaders.length > 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div className="p-2">
                                          <div className="flex flex-wrap gap-1.5">
                                            {langReaders.map((reader) => (
                                              <div
                                                key={reader.id}
                                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors cursor-pointer hover:bg-accent ${selectedReaders.has(reader.id) ? 'bg-primary/10 border-primary' : 'bg-background border-border'
                                                  } ${!reader.enabled ? 'opacity-50' : ''}`}
                                                onClick={() => toggleReaderSelection(reader.id)}
                                              >
                                                <Checkbox
                                                  checked={selectedReaders.has(reader.id)}
                                                  className="h-3 w-3"
                                                  onClick={(e) => e.stopPropagation()}
                                                  onCheckedChange={() => toggleReaderSelection(reader.id)}
                                                />
                                                <span className="font-mono">
                                                  {reader.season_number ? `S${String(reader.season_number).padStart(2, '0')}` : ''}
                                                  {reader.episode_number ? `E${String(reader.episode_number).padStart(2, '0')}` : ''}
                                                  {!reader.season_number && !reader.episode_number && 'Tous'}
                                                </span>
                                                <div className="flex items-center gap-0.5">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 hover:bg-primary/10"
                                                    onClick={(e) => { e.stopPropagation(); openEditDialog(reader); }}
                                                  >
                                                    <Edit className="w-3 h-3" />
                                                  </Button>
                                                  <Switch
                                                    checked={reader.enabled}
                                                    className="scale-75"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onCheckedChange={(checked) => toggleReader(reader.id, checked)}
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={filteredReaders.length > 0 && selectedReaders.size === filteredReaders.length}
                            onCheckedChange={selectAllReaders}
                          />
                        </TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Langue</TableHead>
                        <TableHead>TMDB ID</TableHead>
                        <TableHead>S/E</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredReaders.map((reader) => (
                          <ReaderRow
                            key={reader.id}
                            reader={reader}
                            onEdit={openEditDialog}
                            onDelete={deleteReader}
                            onToggle={toggleReader}
                            onCopyUrl={copyUrl}
                            onDuplicate={duplicateSourceForMedia}
                            isSelected={selectedReaders.has(reader.id)}
                            onSelect={toggleReaderSelection}
                          />
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Utilisateurs et rôles
              </CardTitle>
              <CardDescription className="mt-1">
                Gérez les utilisateurs et leurs permissions admin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom d'utilisateur ou code ami..."
                  value={searchUsers}
                  onChange={(e) => setSearchUsers(e.target.value)}
                  className="pl-9"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Code ami</TableHead>
                        <TableHead>Inscrit le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((userData) => (
                        <TableRow key={userData.id} className="hover:bg-secondary/20 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                {userData.avatar_url ? (
                                  <img
                                    src={userData.avatar_url}
                                    alt={userData.username}
                                    className="w-10 h-10 rounded-full object-cover shadow-md"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 text-white flex items-center justify-center font-bold text-lg shadow-md">
                                    {userData.username?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                )}
                                <div
                                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${getStatusColor(userData.status, userData.last_seen)} ${determineEffectiveStatus(userData.status, userData.last_seen) === 'online' ? 'animate-pulse shadow-sm shadow-green-500/50' : ''}`}
                                  title={getStatusLabel(userData.status, userData.last_seen)}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{userData.username}</span>
                                  <RoleBadge role={getUserRole(userData)} size="sm" />
                                </div>
                                {userData.email ? (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {userData.email}
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground font-mono">{userData.id.slice(0, 8)}...</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(userData.status, userData.last_seen)} ${determineEffectiveStatus(userData.status, userData.last_seen) === 'online' ? 'animate-pulse' : ''}`} />
                                <span className="text-sm font-medium">{getStatusLabel(userData.status, userData.last_seen)}</span>
                              </div>
                              {userData.last_seen && determineEffectiveStatus(userData.status, userData.last_seen) !== 'online' && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(userData.last_seen).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{userData.friend_code}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              {formatDate(userData.created_at)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {userData.id !== user?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRoleDialog(userData)}
                                className="gap-1"
                              >
                                <Shield className="w-3 h-3" />
                                Gérer le rôle
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cookies" className="space-y-4">
          <CookieConsentsTab />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsTab />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <ContactMessagesTab />
        </TabsContent>

        <TabsContent value="bots" className="space-y-4">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                Gestion des Bots IA
              </CardTitle>
              <CardDescription className="mt-1">
                Configurez les assistants IA pour le chat et les fonctionnalités automatiques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">CAi - Assistant Principal</CardTitle>
                          <CardDescription>Propulsé par Groq (Llama 3.3 70B)</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Power className="w-3 h-3 mr-1" />
                        Actif
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Clé API Groq
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={"•".repeat(40)}
                          disabled
                          className="font-mono"
                        />
                        <Button variant="outline" size="icon" disabled>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gérez les clés API depuis les Secrets du projet
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-medium">Modèle utilisé</p>
                        <p className="text-xs text-muted-foreground">llama-3.3-70b-versatile</p>
                      </div>
                      <Badge variant="outline">Recommandé</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-medium">Recherche Web</p>
                        <p className="text-xs text-muted-foreground">Intégration Google Search activée</p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Actif</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Discord Bot</CardTitle>
                          <CardDescription>CStream Bot pour Discord</CardDescription>
                        </div>
                      </div>
                      <Badge className={discordBotStatus?.connected ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                        <Power className="w-3 h-3 mr-1" />
                        {discordBotStatus?.connected ? 'Connecté' : 'Déconnecté'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Token Discord
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={"•".repeat(60)}
                          disabled
                          className="font-mono"
                        />
                        <Button variant="outline" size="icon" disabled>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gérez les tokens depuis les Secrets du projet
                      </p>
                    </div>
                    {discordBotStatus?.connected && (
                      <>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                          <div>
                            <p className="text-sm font-medium">Bot</p>
                            <p className="text-xs text-muted-foreground">{discordBotStatus.botUser?.tag || 'CStream Bot'}</p>
                          </div>
                          <Badge variant="outline">Discord.js</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                          <div>
                            <p className="text-sm font-medium">Commandes Slash</p>
                            <p className="text-xs text-muted-foreground">/search, /trending, /help</p>
                          </div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Actives</Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card/50 border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Configuration des Services IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                          <Bot className="w-5 h-5 text-purple-400" />
                        </div>
                        <p className="text-sm font-medium">Groq API</p>
                        <Badge className="mt-2 bg-green-500/20 text-green-400 text-xs">Configuré</Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                          <Search className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-sm font-medium">Google Search</p>
                        <Badge className="mt-2 bg-green-500/20 text-green-400 text-xs">Configuré</Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center mb-2">
                          <MessageCircle className="w-5 h-5 text-indigo-400" />
                        </div>
                        <p className="text-sm font-medium">Discord Bot</p>
                        <Badge className={`mt-2 ${discordBotStatus?.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} text-xs`}>
                          {discordBotStatus?.connected ? 'Connecté' : 'Déconnecté'}
                        </Badge>
                      </div>
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-orange-500/20 flex items-center justify-center mb-2">
                          <Film className="w-5 h-5 text-orange-400" />
                        </div>
                        <p className="text-sm font-medium">TMDB API</p>
                        <Badge className="mt-2 bg-green-500/20 text-green-400 text-xs">Configuré</Badge>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">Gestion des clés API</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Pour modifier les clés API et tokens, accédez aux Secrets du projet dans les paramètres Replit.
                            Les clés sont chiffrées et sécurisées.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Envoyer une notification
              </CardTitle>
              <CardDescription className="mt-1">
                Envoyez des notifications à tous les utilisateurs et optionnellement à Discord
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre de la notification</Label>
                  <Input
                    placeholder="Nouvelle fonctionnalité disponible !"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Décrivez la notification en détail..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type de notification</Label>
                  <Select value={notificationType} onValueChange={(v) => setNotificationType(v as 'info' | 'success' | 'warning')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info (bleu)</SelectItem>
                      <SelectItem value="success">Succès (vert)</SelectItem>
                      <SelectItem value="warning">Attention (orange)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Canal Discord (Bot)
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${discordBotStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">
                      {discordBotStatus?.connected
                        ? `Bot connecté: ${discordBotStatus.botUser?.tag}`
                        : 'Bot déconnecté'}
                    </span>
                  </div>
                  {discordBotStatus?.connected && (
                    <Select
                      value={selectedDiscordChannel}
                      onValueChange={(v) => setDiscordChannel(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un canal Discord" />
                      </SelectTrigger>
                      <SelectContent>
                        {discordChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name} ({channel.guildName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Si un canal est sélectionné, la notification sera aussi envoyée sur Discord via le bot
                  </p>
                </div>

                <Button
                  onClick={sendNotification}
                  disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                  className="w-full gap-2"
                >
                  {sendingNotification ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      Envoyer la notification
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Message Discord (Bot)
              </CardTitle>
              <CardDescription className="mt-1">
                Envoyez un message directement sur votre serveur Discord via le bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className={`w-3 h-3 rounded-full ${discordBotStatus?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {discordBotStatus?.connected
                      ? `Bot connecté: ${discordBotStatus.botUser?.tag}`
                      : 'Bot Discord déconnecté'}
                  </p>
                  {discordBotStatus?.guilds && discordBotStatus.guilds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Serveurs: {discordBotStatus.guilds.map(g => g.name).join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchDiscordBotStatus();
                    fetchDiscordChannels();
                  }}
                  disabled={loadingDiscordStatus}
                >
                  {loadingDiscordStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>

              {discordBotStatus?.connected ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Canal de destination</Label>
                    <Select
                      value={selectedDiscordChannel}
                      onValueChange={(v) => setDiscordChannel(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un canal" />
                      </SelectTrigger>
                      <SelectContent>
                        {discordChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name} ({channel.guildName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Message</Label>
                    <textarea
                      className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Écrivez votre message pour Discord..."
                      value={discordMessage}
                      onChange={(e) => setDiscordMessage(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={sendDiscordBotMessage}
                    disabled={sendingDiscordMessage || !discordMessage.trim() || !selectedDiscordChannel}
                    className="w-full gap-2"
                  >
                    {sendingDiscordMessage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        Envoyer sur Discord
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Globe className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Le bot Discord n'est pas connecté. Vérifiez que le token est configuré correctement.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Message Privé Discord
              </CardTitle>
              <CardDescription className="mt-1">
                Envoyez un message privé directement à un utilisateur du serveur
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discordBotStatus?.connected ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Sélectionner un utilisateur</Label>
                    <Select
                      value={selectedDMUser}
                      onValueChange={(v) => setSelectedDMUser(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un utilisateur..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {discordMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <img src={member.avatar} alt="" className="w-5 h-5 rounded-full" />
                              <span>{member.displayName}</span>
                              <span className="text-muted-foreground text-xs">@{member.username}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Message</Label>
                    <textarea
                      className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Écrivez votre message privé..."
                      value={dmMessage}
                      onChange={(e) => setDmMessage(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={sendDiscordDM}
                    disabled={sendingDM || !dmMessage.trim() || !selectedDMUser}
                    className="w-full gap-2"
                  >
                    {sendingDM ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Envoyer en MP
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Le bot Discord doit être connecté pour envoyer des MP.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Personnalisation Embed Discord
              </CardTitle>
              <CardDescription className="mt-1">
                Créez et envoyez des embeds personnalisés avec aperçu en direct
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titre de l'embed</Label>
                    <Input
                      placeholder="Titre de votre embed..."
                      value={embedTitle}
                      onChange={(e) => setEmbedTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea
                      className="w-full min-h-[80px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      placeholder="Description de l'embed...\nUtilisez \n pour les retours à la ligne"
                      value={embedDescription}
                      onChange={(e) => setEmbedDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer border"
                        />
                        <Input
                          value={embedColor}
                          onChange={(e) => setEmbedColor(e.target.value)}
                          placeholder="#7C3AED"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Footer</Label>
                      <Input
                        placeholder="CStream"
                        value={embedFooter}
                        onChange={(e) => setEmbedFooter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>URL de l'image (optionnel)</Label>
                    <Input
                      placeholder="https://example.com/image.png"
                      value={embedImageUrl}
                      onChange={(e) => setEmbedImageUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL de la miniature (optionnel)</Label>
                    <Input
                      placeholder="https://example.com/thumbnail.png"
                      value={embedThumbnailUrl}
                      onChange={(e) => setEmbedThumbnailUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Champs personnalisés</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmbedFields([...embedFields, { name: '', value: '', inline: false }])}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Ajouter
                      </Button>
                    </div>
                    {embedFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-start p-2 border rounded-lg bg-secondary/20">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Nom du champ"
                            value={field.name}
                            onChange={(e) => {
                              const newFields = [...embedFields];
                              newFields[index].name = e.target.value;
                              setEmbedFields(newFields);
                            }}
                            className="h-8 text-xs"
                          />
                          <Input
                            placeholder="Valeur"
                            value={field.value}
                            onChange={(e) => {
                              const newFields = [...embedFields];
                              newFields[index].value = e.target.value;
                              setEmbedFields(newFields);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                          <label className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={field.inline}
                              onCheckedChange={(checked) => {
                                const newFields = [...embedFields];
                                newFields[index].inline = checked as boolean;
                                setEmbedFields(newFields);
                              }}
                            />
                            Inline
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => setEmbedFields(embedFields.filter((_, i) => i !== index))}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {discordBotStatus?.connected && (
                    <div className="space-y-2">
                      <Label>Canal de destination</Label>
                      <Select
                        value={selectedDiscordChannel}
                        onValueChange={(v) => setSelectedDiscordChannel(v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {discordChannels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name} ({channel.guildName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={async () => {
                      if (!embedTitle.trim() || !embedDescription.trim()) {
                        toast.warning('Titre et description requis');
                        return;
                      }
                      if (!selectedDiscordChannel || !discordBotStatus?.connected) {
                        toast.warning('Sélectionnez un canal Discord');
                        return;
                      }
                      setSendingEmbed(true);
                      try {
                        const token = await getAuthToken();
                        const response = await fetch('/api/discord/send', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            channelId: selectedDiscordChannel,
                            embed: {
                              title: embedTitle.trim(),
                              description: embedDescription.replace(/\\n/g, '\n'),
                              color: parseInt(embedColor.replace('#', ''), 16),
                              footer: embedFooter || 'CStream',
                              image: embedImageUrl || undefined,
                              thumbnail: embedThumbnailUrl || undefined,
                              fields: embedFields.filter(f => f.name && f.value),
                            },
                          }),
                        });
                        if (response.ok) {
                          toast.success('Embed envoyé sur Discord !');
                          setEmbedTitle('');
                          setEmbedDescription('');
                          setEmbedImageUrl('');
                          setEmbedThumbnailUrl('');
                          setEmbedFields([]);
                        } else {
                          const error = await response.json();
                          toast.error(`Erreur: ${error.error}`);
                        }
                      } catch (err) {
                        toast.error('Erreur lors de l\'envoi');
                      } finally {
                        setSendingEmbed(false);
                      }
                    }}
                    disabled={sendingEmbed || !embedTitle.trim() || !embedDescription.trim() || !selectedDiscordChannel}
                    className="w-full gap-2"
                  >
                    {sendingEmbed ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        Envoyer l'embed
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Aperçu en direct
                  </Label>
                  <div className="bg-[#36393f] rounded-lg p-4 min-h-[300px]">
                    <div
                      className="rounded overflow-hidden"
                      style={{ borderLeft: `4px solid ${embedColor}` }}
                    >
                      <div className="bg-[#2f3136] p-3 space-y-2">
                        {embedTitle && (
                          <h3 className="text-white font-semibold text-sm">
                            {embedTitle}
                          </h3>
                        )}
                        {embedDescription && (
                          <p className="text-gray-300 text-xs whitespace-pre-wrap">
                            {embedDescription.replace(/\\n/g, '\n')}
                          </p>
                        )}
                        {embedFields.length > 0 && embedFields.some(f => f.name && f.value) && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            {embedFields.filter(f => f.name && f.value).map((field, i) => (
                              <div key={i} className={field.inline ? '' : 'col-span-3'}>
                                <p className="text-xs font-semibold text-white">{field.name}</p>
                                <p className="text-xs text-gray-300">{field.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {embedImageUrl && (
                          <div className="mt-3">
                            <img
                              src={embedImageUrl}
                              alt="Preview"
                              className="max-w-full rounded max-h-[200px] object-cover"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}
                        {embedFooter && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-600">
                            <span className="text-gray-400 text-[10px]">{embedFooter}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {embedThumbnailUrl && (
                      <div className="absolute top-3 right-3">
                        <img
                          src={embedThumbnailUrl}
                          alt="Thumbnail"
                          className="w-16 h-16 rounded object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cet aperçu simule l'apparence de l'embed sur Discord
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <ContactMessagesTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SettingsTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <MonitoringTab />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingReader ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingReader ? 'Modifier la source' : 'Ajouter une source'}
            </DialogTitle>
            <DialogDescription>
              {editingReader
                ? 'Modifiez les informations de la source de streaming'
                : 'Ajoutez une nouvelle source de streaming à la base de données'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-full">
                    <Info className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Liaison TMDB obligatoire</p>
                    <p className="text-xs text-muted-foreground">
                      Chaque source doit être liée à un film/série spécifique
                    </p>
                  </div>
                </div>
              </div>

              <Label className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Lier à un média TMDB <span className="text-destructive">*</span>
              </Label>

              <Tabs value={tmdbSearchMode} onValueChange={(v) => setTmdbSearchMode(v as 'search' | 'id')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search">Recherche par nom</TabsTrigger>
                  <TabsTrigger value="id">Recherche par ID</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-2">
                  <div className="flex gap-2">
                    <Select value={tmdbSearchTypeFilter} onValueChange={(v: 'all' | 'movie' | 'tv') => setTmdbSearchTypeFilter(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="movie">Films</SelectItem>
                        <SelectItem value="tv">Séries</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1 relative" ref={tmdbRef}>
                      <Input
                        placeholder="Recherchez un film ou une série..."
                        value={tmdbQuery}
                        onChange={(e) => {
                          setTmdbQuery(e.target.value);
                          if (e.target.value.trim()) {
                            setShowTmdbDropdown(true);
                          }
                        }}
                        onFocus={() => tmdbResults.length > 0 && setShowTmdbDropdown(true)}
                      />
                      {tmdbLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}

                      {showTmdbDropdown && tmdbResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute z-50 w-full mt-2 bg-popover border rounded-lg shadow-xl max-h-[400px] overflow-y-auto"
                        >
                          {tmdbResults.map((item) => (
                            <div
                              key={`${item.media_type}-${item.id}`}
                              className="flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTMDB(item);
                              }}
                            >
                              {item.poster_path ? (
                                <img
                                  src={`${TMDB_IMG}/w92${item.poster_path}`}
                                  alt=""
                                  className="w-14 h-20 object-cover rounded flex-shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-20 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                                  <Film className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold">
                                    {item.media_type === 'movie' ? item.title : item.name}
                                  </p>
                                  <Badge variant="secondary" className="text-xs">
                                    {item.media_type === 'movie' ? 'Film' : 'Série'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.release_date || item.first_air_date || 'Date inconnue'}
                                </p>
                                {item.vote_average > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs font-medium">{item.vote_average.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Filtrez par type et recherchez le titre du film ou de la série
                  </p>
                </TabsContent>

                <TabsContent value="id" className="space-y-2">
                  <div className="flex gap-2">
                    <Select value={tmdbMediaTypeForId} onValueChange={(v: 'movie' | 'tv') => setTmdbMediaTypeForId(v)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="movie">Film</SelectItem>
                        <SelectItem value="tv">Série</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="ID TMDB (ex: 533535)"
                      value={tmdbIdInput}
                      onChange={(e) => setTmdbIdInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={fetchByTmdbId} disabled={tmdbLoading}>
                      {tmdbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Entrez l'ID TMDB exact (trouvable sur themoviedb.org dans l'URL)
                  </p>
                </TabsContent>
              </Tabs>

              {formData.tmdb && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
                >
                  {formData.tmdb.poster_path ? (
                    <img
                      src={`${TMDB_IMG}/w92${formData.tmdb.poster_path}`}
                      alt=""
                      className="w-16 h-24 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-24 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                      <Film className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <p className="font-semibold text-sm">Média sélectionné</p>
                        </div>
                        <p className="font-medium">
                          {formData.tmdb.media_type === 'movie' ? formData.tmdb.title : formData.tmdb.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {formData.tmdb.media_type === 'movie' ? 'Film' : 'Série'}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono">
                            ID: {formData.tmdb.id}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Cette source ne sera visible que pour ce média
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => {
                          setFormData((f) => ({ ...f, tmdb_id: null, tmdb: null }));
                          setTmdbSeasons([]);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">
                Nom de la source <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                placeholder="ex: Netflix HD VOSTFR"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl" className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                URL de base <span className="text-destructive">*</span>
              </Label>
              <Input
                id="baseUrl"
                placeholder="https://example.com/watch"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                L'URL de base sans les segments de saison/épisode
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mediaType">Type de média</Label>
                <Select
                  value={formData.media_type}
                  onValueChange={(value: MediaType) => setFormData({ ...formData, media_type: value })}
                >
                  <SelectTrigger id="mediaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">Film</SelectItem>
                    <SelectItem value="tv">Série TV</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Langue</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customLanguages.map((lang) => (
                      <SelectItem key={lang.id} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lang.color }} />
                          {lang.code}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(formData.media_type === 'tv' || formData.media_type === 'anime') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="season">Saison</Label>
                  {tmdbSeasons.length > 0 ? (
                    <Select
                      value={formData.season}
                      onValueChange={(value) => setFormData({ ...formData, season: value })}
                    >
                      <SelectTrigger id="season">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tmdbSeasons.map((s) => (
                          <SelectItem key={s.season_number} value={String(s.season_number)}>
                            {s.name || `Saison ${s.season_number}`}
                            {s.episode_count && ` (${s.episode_count} ép.)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="season"
                      type="number"
                      min="0"
                      placeholder="1"
                      value={formData.season}
                      onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="episode">Épisode</Label>
                  <Input
                    id="episode"
                    type="number"
                    min="0"
                    placeholder="1"
                    value={formData.episode}
                    onChange={(e) => setFormData({ ...formData, episode: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-green-500/20">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Source activée
                </Label>
                <p className="text-sm text-muted-foreground">
                  {editingReader ? 'Désactivez pour masquer cette source' : '✅ Les nouvelles sources sont automatiquement activées'}
                </p>
              </div>
              <Switch
                checked={editingReader ? formData.enabled : true}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                disabled={!editingReader}
              />
            </div>

            {previewUrl && isValidUrl(previewUrl) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Aperçu de l'URL finale
                </Label>
                <div className="p-3 bg-secondary/50 rounded-lg border">
                  <code className="text-sm break-all">{previewUrl}</code>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={upsertReader} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {editingReader ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={(open) => !bulkDeleting && setBulkDeleteDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Suppression en cours...
            </DialogTitle>
            <DialogDescription>
              Veuillez patienter pendant la suppression des sources sélectionnées.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${bulkDeleteProgress.failed > 0 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                initial={{ width: 0 }}
                animate={{
                  width: bulkDeleteProgress.total > 0
                    ? `${(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100}%`
                    : '0%'
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {bulkDeleteProgress.current} / {bulkDeleteProgress.total} traité(s)
              </span>
              <span className="font-medium">
                {bulkDeleteProgress.total > 0
                  ? Math.round((bulkDeleteProgress.current / bulkDeleteProgress.total) * 100)
                  : 0}%
              </span>
            </div>
            {bulkDeleteProgress.failed > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  {bulkDeleteProgress.failed} échec(s) - certaines sources n'ont pas pu être supprimées
                </span>
              </div>
            )}
            {!bulkDeleting && bulkDeleteProgress.current === bulkDeleteProgress.total && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Suppression terminée !
                </span>
              </div>
            )}
          </div>
          {bulkDeleting && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Traitement en cours, veuillez ne pas fermer cette fenêtre...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bulkImportDialogOpen} onOpenChange={setBulkImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import en masse d'épisodes
            </DialogTitle>
            <DialogDescription>
              Importez plusieurs épisodes à la fois en collant un tableau d'URLs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Info className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Format accepté</p>
                  <p className="text-xs text-muted-foreground">
                    var eps1 = ['url1', 'url2', ...] ou liste d'URLs
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Sélectionner la série TMDB <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={tmdbRef}>
                <Input
                  placeholder="Recherchez une série..."
                  value={tmdbQuery}
                  onChange={(e) => {
                    setTmdbQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setShowTmdbDropdown(true);
                    }
                  }}
                  onFocus={() => tmdbResults.length > 0 && setShowTmdbDropdown(true)}
                />
                {tmdbLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}

                {showTmdbDropdown && tmdbResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-50 w-full mt-2 bg-popover border rounded-lg shadow-xl max-h-[300px] overflow-y-auto"
                  >
                    {tmdbResults.filter(item => item.media_type === 'tv').map((item) => (
                      <div
                        key={`bulk-${item.media_type}-${item.id}`}
                        className="flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBulkTMDB(item);
                        }}
                      >
                        {item.poster_path ? (
                          <img
                            src={`${TMDB_IMG}/w92${item.poster_path}`}
                            alt=""
                            className="w-12 h-18 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-18 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                            <Tv className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.first_air_date || 'Date inconnue'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {tmdbResults.filter(item => item.media_type === 'tv').length === 0 && (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Aucune série trouvée. Recherchez un autre terme.
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {bulkImportTmdb && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                {bulkImportTmdb.poster_path ? (
                  <img
                    src={`${TMDB_IMG}/w92${bulkImportTmdb.poster_path}`}
                    alt=""
                    className="w-16 h-24 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-24 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                    <Tv className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <p className="font-semibold text-sm">Série sélectionnée</p>
                      </div>
                      <p className="font-medium">{bulkImportTmdb.name}</p>
                      <Badge variant="outline" className="text-xs font-mono mt-1">
                        ID: {bulkImportTmdb.id}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => {
                        setBulkImportTmdbId(null);
                        setBulkImportTmdb(null);
                        setBulkImportLabel('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bulkLabel">
                  Nom de la source <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bulkLabel"
                  placeholder="ex: Netflix HD"
                  value={bulkImportLabel}
                  onChange={(e) => setBulkImportLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkMediaType">Type de média</Label>
                <Select value={bulkImportMediaType} onValueChange={(v) => setBulkImportMediaType(v as 'tv' | 'anime')}>
                  <SelectTrigger id="bulkMediaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tv">Série TV</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkLanguage">Langue</Label>
                <Select value={bulkImportLanguage} onValueChange={setBulkImportLanguage}>
                  <SelectTrigger id="bulkLanguage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customLanguages.map((lang) => (
                      <SelectItem key={lang.id} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lang.color }} />
                          {lang.code}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulkSeason">Numéro de saison</Label>
              {tmdbSeasons.length > 0 ? (
                <Select value={bulkImportSeason} onValueChange={setBulkImportSeason}>
                  <SelectTrigger id="bulkSeason">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tmdbSeasons.map((s) => (
                      <SelectItem key={s.season_number} value={String(s.season_number)}>
                        {s.name || `Saison ${s.season_number}`}
                        {s.episode_count && ` (${s.episode_count} ép.)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="bulkSeason"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={bulkImportSeason}
                  onChange={(e) => setBulkImportSeason(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulkData" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                URLs des épisodes <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="bulkData"
                className="w-full min-h-[200px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder={`Collez ici vos URLs. Vous pouvez importer plusieurs lecteurs à la fois !

var eps2 = [
  'https://sibnet.ru/ep1',
  'https://sibnet.ru/ep2'
]

var eps3 = [
  'https://vidomly.com/ep1',
  'https://vidomly.com/ep2'
]

Le lecteur sera détecté automatiquement depuis l'URL (sibnet, vidomly, etc.)`}
                value={bulkImportData}
                onChange={(e) => {
                  const newData = e.target.value;
                  setBulkImportData(newData);

                  if (!bulkImportLabel.trim() && newData.trim()) {
                    const parsedArrays = parseAllArrays(newData);
                    if (parsedArrays.length > 0 && parsedArrays[0].urls.length > 0) {
                      const detectedName = extractReaderNameFromUrl(parsedArrays[0].urls[0]);
                      if (detectedName) {
                        const seriesName = bulkImportTmdb?.name || '';
                        const autoLabel = seriesName ? `${seriesName} - ${detectedName}` : detectedName;
                        setBulkImportLabel(autoLabel);
                      }
                    }
                  }
                }}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                L'ordre des URLs détermine le numéro d'épisode (1ère URL = Épisode 1, etc.)
              </p>
              {bulkImportData && (() => {
                const urlCount = parseEpisodeUrls(bulkImportData).length;
                const arrayInfo = detectMultipleArrays(bulkImportData);
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant={urlCount > 0 ? 'default' : 'destructive'}>
                        {urlCount} URLs détectées
                      </Badge>
                      {arrayInfo.count > 1 && (
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/50 text-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {arrayInfo.count} lecteurs détectés
                        </Badge>
                      )}
                    </div>
                    {arrayInfo.count > 0 && arrayInfo.arrays && (
                      <div className={`p-3 rounded-lg text-sm ${arrayInfo.count > 1 ? 'bg-green-500/10 border border-green-500/30' : 'bg-secondary/50'}`}>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${arrayInfo.count > 1 ? 'text-green-600' : 'text-primary'}`} />
                          <div className="flex-1">
                            <p className={`font-medium ${arrayInfo.count > 1 ? 'text-green-700' : ''}`}>
                              {arrayInfo.count > 1 ? 'Tous les lecteurs seront importés' : 'Lecteur détecté'}
                            </p>
                            <div className="mt-2 space-y-1">
                              {arrayInfo.arrays.map((arr, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <Badge variant="secondary" className="text-xs">
                                    {arr.readerName}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {arr.urls.length} épisode{arr.urls.length > 1 ? 's' : ''}
                                  </span>
                                  <code className="text-xs bg-secondary/50 px-1 rounded text-muted-foreground">
                                    {arr.arrayName}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {bulkImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Import en cours...</span>
                  <span>{bulkImportProgress.current}/{bulkImportProgress.total}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setBulkImportDialogOpen(false)}
              disabled={bulkImporting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={bulkImporting || !bulkImportTmdbId || !bulkImportLabel.trim() || !bulkImportData.trim()}
              className="gap-2"
            >
              {bulkImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importer les épisodes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dualLangDialogOpen} onOpenChange={setDualLangDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Import multi-langues (jusqu'à 3 langues)
            </DialogTitle>
            <DialogDescription>
              Importez simultanément jusqu'à 3 versions linguistiques d'une saison
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-full">
                  <Globe className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Import multi-langues</p>
                  <p className="text-xs text-muted-foreground">
                    Importez plusieurs langues en une seule opération - Lecteur recommandé: Sibnet
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDualLangInputs([...dualLangInputs, { langCode: customLanguages[0]?.code || 'VOSTFR', data: '' }])}
                className="gap-1 border-purple-500/50 hover:bg-purple-500/10"
              >
                <Plus className="w-4 h-4" />
                Ajouter une langue
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                Sélectionner la série TMDB <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="Recherchez une série..."
                  value={tmdbQuery}
                  onChange={(e) => {
                    setTmdbQuery(e.target.value);
                    if (e.target.value.trim()) {
                      setShowTmdbDropdown(true);
                    }
                  }}
                  onFocus={() => tmdbResults.length > 0 && setShowTmdbDropdown(true)}
                />
                {tmdbLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}

                {showTmdbDropdown && tmdbResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-50 w-full mt-2 bg-popover border rounded-lg shadow-xl max-h-[300px] overflow-y-auto"
                  >
                    {tmdbResults.filter(item => item.media_type === 'tv').map((item) => (
                      <div
                        key={`dual-${item.media_type}-${item.id}`}
                        className="flex items-start gap-3 p-3 hover:bg-accent cursor-pointer transition-colors border-b last:border-b-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDualLangTMDB(item);
                        }}
                      >
                        {item.poster_path ? (
                          <img
                            src={`${TMDB_IMG}/w92${item.poster_path}`}
                            alt=""
                            className="w-12 h-18 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-18 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                            <Tv className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.first_air_date || 'Date inconnue'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>

            {dualLangTmdb && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                {dualLangTmdb.poster_path ? (
                  <img
                    src={`${TMDB_IMG}/w92${dualLangTmdb.poster_path}`}
                    alt=""
                    className="w-16 h-24 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-24 bg-secondary rounded flex items-center justify-center flex-shrink-0">
                    <Tv className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <p className="font-semibold text-sm">Série sélectionnée</p>
                      </div>
                      <p className="font-medium">{dualLangTmdb.name}</p>
                      <Badge variant="outline" className="text-xs font-mono mt-1">
                        ID: {dualLangTmdb.id}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => {
                        setDualLangTmdbId(null);
                        setDualLangTmdb(null);
                        setDualLangLabel('');
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dualLabel">Nom de la source</Label>
                <Input
                  id="dualLabel"
                  placeholder="ex: Netflix HD"
                  value={dualLangLabel}
                  onChange={(e) => setDualLangLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dualMediaType">Type de média</Label>
                <Select value={dualLangMediaType} onValueChange={(v) => setDualLangMediaType(v as 'tv' | 'anime')}>
                  <SelectTrigger id="dualMediaType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tv">Série TV</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dualSeason">Numéro de saison</Label>
                {dualLangSeasons.length > 0 ? (
                  <Select value={dualLangSeason} onValueChange={setDualLangSeason}>
                    <SelectTrigger id="dualSeason">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dualLangSeasons.map((s) => (
                        <SelectItem key={s.season_number} value={String(s.season_number)}>
                          {s.name || `Saison ${s.season_number}`}
                          {s.episode_count && ` (${s.episode_count} ép.)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="dualSeason"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={dualLangSeason}
                    onChange={(e) => setDualLangSeason(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className={`grid gap-4 ${dualLangInputs.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {dualLangInputs.map((input, idx) => (
                <div key={idx} className="space-y-2 relative group">
                  <div className="flex items-center gap-2 mb-2">
                    <Select
                      value={input.langCode}
                      onValueChange={(v) => {
                        const next = [...dualLangInputs];
                        next[idx].langCode = v;
                        setDualLangInputs(next);
                      }}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue placeholder="Langue" />
                      </SelectTrigger>
                      <SelectContent>
                        {customLanguages.map(lang => (
                          <SelectItem key={lang.id} value={lang.code}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lang.color }} />
                              {lang.code}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">URLs des épisodes</span>
                    {dualLangInputs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setDualLangInputs(dualLangInputs.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <textarea
                    className="w-full min-h-[150px] p-3 rounded-md border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                    placeholder={`var eps = [\n  'https://sibnet.ru/video/ep1',\n  'https://sibnet.ru/video/ep2'\n]`}
                    value={input.data}
                    onChange={(e) => {
                      const next = [...dualLangInputs];
                      const newData = e.target.value;
                      next[idx].data = newData;
                      setDualLangInputs(next);

                      if (!dualLangLabel.trim() && newData.trim()) {
                        const parsedArrays = parseAllArrays(newData);
                        if (parsedArrays.length > 0 && parsedArrays[0].urls.length > 0) {
                          const detectedName = extractReaderNameFromUrl(parsedArrays[0].urls[0]);
                          if (detectedName) {
                            const seriesName = dualLangTmdb?.name || '';
                            const autoLabel = seriesName ? `${seriesName} - ${detectedName}` : detectedName;
                            setDualLangLabel(autoLabel);
                          }
                        }
                      }
                    }}
                  />
                  {input.data && (() => {
                    const urlCount = parseEpisodeUrls(input.data).length;
                    const firstUrl = parseEpisodeUrls(input.data)[0];
                    const detectedHost = firstUrl ? detectHost(firstUrl) : null;
                    const langInfo = customLanguages.find(l => l.code === input.langCode);
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={urlCount > 0 ? 'default' : 'destructive'} style={{ backgroundColor: langInfo?.color }}>
                          {urlCount} URLs {input.langCode}
                        </Badge>
                        {detectedHost && (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: detectedHost.color, color: detectedHost.color }}>
                            {detectedHost.displayName}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {(() => {
              const languagesWithData: Array<{
                code: string;
                label: string;
                color: string;
                urls: string[];
                hosts: Array<{ name: string; displayName: string; color: string }>;
              }> = [];

              dualLangInputs.forEach(input => {
                const urls = parseEpisodeUrls(input.data);
                if (urls.length > 0) {
                  const langInfo = customLanguages.find(l => l.code === input.langCode);
                  const hosts = new Map<string, { displayName: string; color: string }>();
                  urls.forEach(url => {
                    const host = detectHost(url);
                    if (host && !hosts.has(host.name)) {
                      hosts.set(host.name, { displayName: host.displayName, color: host.color });
                    }
                  });
                  languagesWithData.push({
                    code: input.langCode,
                    label: langInfo?.label || input.langCode,
                    color: langInfo?.color || '#3B82F6',
                    urls: urls,
                    hosts: Array.from(hosts.entries()).map(([name, info]) => ({ name, ...info })),
                  });
                }
              });

              if (languagesWithData.length === 0) return null;

              const totalEpisodes = languagesWithData.reduce((sum, lang) => sum + lang.urls.length, 0);

              return (
                <Card className="bg-secondary/20 border-dashed border-primary/30">
                  <CardHeader className="py-3 pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Aperçu de l'import
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {totalEpisodes} épisode{totalEpisodes > 1 ? 's' : ''} au total
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="space-y-3">
                      {languagesWithData.map((lang) => (
                        <div key={lang.code} className="p-3 rounded-lg bg-background/50 border border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: lang.color }}
                              />
                              <span className="font-medium text-sm">{lang.label}</span>
                              <Badge
                                variant="outline"
                                className="text-xs uppercase"
                                style={{ borderColor: lang.color, color: lang.color }}
                              >
                                {lang.code}
                              </Badge>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {lang.urls.length} épisode{lang.urls.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {lang.hosts.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground mr-1">
                                <Play className="w-3 h-3 inline mr-1" />
                                Lecteurs:
                              </span>
                              {lang.hosts.map((host) => (
                                <Badge
                                  key={host.name}
                                  variant="outline"
                                  className="text-xs py-0.5"
                                  style={{
                                    borderColor: host.color,
                                    color: host.color,
                                    backgroundColor: `${host.color}15`
                                  }}
                                >
                                  {host.displayName}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {dualLangImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Import en cours...</span>
                  <span>{dualLangProgress.current}/{dualLangProgress.total}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${(dualLangProgress.current / dualLangProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setDualLangDialogOpen(false)}
              disabled={dualLangImporting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleDualLanguageImport}
              disabled={dualLangImporting || !dualLangTmdbId || (!dualLangVostfrData.trim() && !dualLangVfData.trim())}
              className="gap-2 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
            >
              {dualLangImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Importer les langues ({dualLangInputs.filter(i => i.data.trim()).length})
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RoleManagementDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={selectedUserForRole ? { ...selectedUserForRole, role: selectedUserForRole.role || 'member' } : null}
        currentUserRole={(profile?.role as UserRole) || role || 'member'}
        onRoleUpdate={(userId, newRole) => {
          setUsers(prev => prev.map(u =>
            u.id === userId
              ? { ...u, role: newRole, is_admin: ['creator', 'super_admin', 'admin', 'reine', 'moderator'].includes(newRole) }
              : u
          ));
          toast.success(`Rôle mis à jour avec succès ! La page va se recharger.`);
          setTimeout(() => {
            window.location.reload();
          }, 2500);
        }}
      />

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMessage && getCategoryIcon(selectedMessage.category)}
              {selectedMessage?.subject || 'Message'}
            </DialogTitle>
            <DialogDescription>
              Message reçu le {selectedMessage ? formatDate(selectedMessage.created_at) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getCategoryLabel(selectedMessage.category)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{selectedMessage.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
              </div>

              <div className="p-4 bg-secondary/30 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Statut:</Label>
                  <Select
                    value={selectedMessage.status}
                    onValueChange={(v) => updateMessageStatus(selectedMessage.id, v as any)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="read">Lu</SelectItem>
                      <SelectItem value="replied">Répondu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`, '_blank')}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Répondre
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMessage(selectedMessage.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;