import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, Trophy, Clock, Globe, Volume2, Zap, Search, X, Star, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { StreamedAPI } from '@/lib/streamed';

const API_BASE = '/api/sports';
const imageCache = new Map<string, string>();

interface Sport {
  id: string;
  name: string;
}

interface Match {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string | null;
  teams?: {
    home?: { name: string; badge: string | null };
    away?: { name: string; badge: string | null };
  };
  sources: Array<{ source: string; id: string }>;
  popular: boolean;
}

interface Stream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

const Sports = () => {
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState('live');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamModal, setStreamModal] = useState<{ show: boolean; match?: Match; streams?: Stream[] }>({ show: false });
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [vpnMode, setVpnMode] = useState(false);
  const [apiType, setApiType] = useState<'streamed' | 'footy'>('streamed');
  const [activeApi, setActiveApi] = useState("base");

  const getImageUrl = (originalUrl: string | null, type: 'badge' | 'poster' = 'badge') => {
    if (!originalUrl) return '';

    // If using Footy API, handle their images
    if (apiType === 'footy') {
      if (originalUrl.startsWith('/api/v1/')) {
        return `https://api.watchfooty.st${originalUrl}`;
      }
      return originalUrl;
    }

    const cacheKey = originalUrl + vpnMode + type;
    if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;

    let finalUrl = originalUrl;
    if (!vpnMode) {
      if (originalUrl.includes('streamed.pk/api/images/badge/')) {
        finalUrl = originalUrl.replace('/api/images/badge/', '/api/images/proxy/');
      } else if (originalUrl.startsWith('/api/images/badge/')) {
        finalUrl = `https://streamed.pk${originalUrl.replace('/api/images/badge/', '/api/images/proxy/')}`;
      } else if (originalUrl.includes('streamed.pk')) {
        finalUrl = originalUrl.replace('/api/images/badge/', '/api/images/proxy/');
      } else if (originalUrl.startsWith('/api/images/')) {
        finalUrl = `https://streamed.pk${originalUrl.replace('/api/images/', '/api/images/proxy/')}`;
      }
    }

    if (type === 'badge') {
      finalUrl += finalUrl.includes('?') ? '&w=64' : '?w=64';
    } else {
      finalUrl += finalUrl.includes('?') ? '&w=320' : '?w=320';
    }

    imageCache.set(cacheKey, finalUrl);
    return finalUrl;
  };

  const languageLabels: Record<string, string> = {
    'French': '🇫🇷 Français', 'English': '🇬🇧 English', 'Spanish': '🇪🇸 Español',
    'Arabic': '🇸🇦 Arabe', 'Korean': '🇰🇷 Coréen', 'Italian': '🇮🇹 Italien',
    'German': '🇩🇪 Allemand', 'fr': '🇫🇷 Français', 'en': '🇬🇧 English',
    'es': '🇪🇸 Español', 'ar': '🇸🇦 Arabe', 'ko': '🇰🇷 Coréen',
    'it': '🇮🇹 Italien', 'de': '🇩🇪 Allemand', 'Multi': '🌐 Multi',
    'fra': '🇫🇷 Français', 'fre': '🇫🇷 Français'
  };

  const supportedLanguages = [
    "French", "English", "Spanish", "Arabic", "Korean", "Italian", "German", "Multi"
  ];

  const sportEmojis: Record<string, string> = {
    'football': '⚽', 'basketball': '🏀', 'tennis': '🎾', 'mma': '🥊',
    'hockey': '🏒', 'baseball': '⚾', 'rugby': '🏉', 'boxing': '🥊',
    'cricket': '🏏', 'darts': '🎯', 'billiards': '🎱', 'golf': '⛳',
    'american football': '🏈', 'motor sports': '🏎️', 'fight sports': '🥊'
  };

  const fetchSports = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}`);
      const data = await response.json();

      const sportsArray = Array.isArray(data) ? data : (data?.sports || data || []);

      const defaultSports = [
        { id: 'live', name: '🔴 LIVE' },
        { id: 'schedule', name: '📅 Calendrier' },
        { id: 'all', name: '🌍 Tous les Sports' },
      ];

      const apiSports = sportsArray.slice(0, 15).map((s: any) => {
        const id = s.id || s.name?.toLowerCase();
        const emoji = sportEmojis[id] || '🏆';
        return {
          id,
          name: `${emoji} ${s.name || s.id}`
        };
      });

      setAllSports([...defaultSports, ...apiSports]);
    } catch (error) {
      console.error('Error fetching sports:', error);
      setAllSports([
        { id: 'live', name: '🔴 LIVE' },
        { id: 'all', name: '🌍 Tous' },
        { id: 'football', name: '⚽ Football' },
        { id: 'basketball', name: '🏀 Basketball' },
        { id: 'american football', name: '🏈 American Football' },
        { id: 'hockey', name: '🏒 Hockey' },
        { id: 'baseball', name: '⚾ Baseball' },
        { id: 'motor sports', name: '🏎️ Motor Sports' },
        { id: 'fight sports', name: '🥊 Fight Sports' },
        { id: 'tennis', name: '🎾 Tennis' },
        { id: 'rugby', name: '🏉 Rugby' },
        { id: 'golf', name: '⛳ Golf' },
        { id: 'billiards', name: '🎱 Billiards' },
        { id: 'cricket', name: '🏏 Cricket' },
        { id: 'darts', name: '🎯 Darts' },
      ]);
    }
  }, []);

  const fetchMatches = useCallback(async (sportId: string) => {
    try {
      setLoading(true);

      if (apiType === 'footy') {
        let endpoint = 'all';
        if (sportId === 'live') endpoint = 'live';
        else if (sportId === 'football') endpoint = 'football';
        else if (sportId === 'basketball') endpoint = 'basketball';

        // Handle categories and live filtering according to provided docs
        const url = sportId === 'live'
          ? `https://api.watchfooty.st/api/v1/matches/live`
          : `https://api.watchfooty.st/api/v1/matches/${sportId === 'all' || sportId === 'schedule' ? 'all' : sportId}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        const matchesArray = Array.isArray(data) ? data : [];
        const mappedMatches = matchesArray.map((m: any) => {
          // Map streams correctly based on Footy API response format
          const sources = (m.streams || []).map((s: any) => ({
            source: 'footy',
            id: s.id || Math.random().toString(36).substring(2, 11),
            url: s.url,
            language: s.language || 'Multi',
            quality: s.quality || 'HD'
          }));

          return {
            id: m.matchId || Math.random().toString(36).substring(2, 11),
            title: m.title || `${m.teams?.home?.name || 'Home'} vs ${m.teams?.away?.name || 'Away'}`,
            category: m.sport || 'Sport',
            date: m.timestamp ? m.timestamp * 1000 : Date.now(),
            teams: {
              home: {
                name: m.teams?.home?.name || 'Home',
                badge: m.teams?.home?.logoUrl || m.teams?.home?.logo || null
              },
              away: {
                name: m.teams?.away?.name || 'Away',
                badge: m.teams?.away?.logoUrl || m.teams?.away?.logo || null
              }
            },
            poster: m.poster || null,
            popular: m.isEvent || false,
            sources: sources,
          };
        });
        setMatches(mappedMatches);
        return;
      }


      if (apiType === 'streamed') {
        let data;
        if (sportId === 'live') {
          data = await StreamedAPI.getLiveMatches();
        } else if (sportId === 'all') {
          data = await StreamedAPI.getAllMatches();
        } else if (sportId === 'schedule') {
          // Schedule isn't directly supported by 'getAllMatches' nicely filtered, 
          // but 'getAllMatches' returns everything.
          // StreamedAPI.getAllMatches() returns Match[]
          data = await StreamedAPI.getLiveMatches(); // fallback or actual schedule?
          // API docs say: /matches/all, /matches/live, /matches/sport/:sport
          // 'schedule' in this app seems to mean 'today' or 'all'.
          const all = await StreamedAPI.getAllMatches();
          data = all;
        } else {
          data = await StreamedAPI.getSportMatches(sportId);
        }

        if (data && data.length > 0) {
          const mappedMatches = data.map((m: any) => ({
            id: m.slug || Math.random().toString(36).substr(2, 9), // StreamedAPI uses slug
            title: m.title,
            category: m.sport || 'Sport',
            date: m.date ? new Date(m.date).getTime() : Date.now(),
            teams: {
              home: { name: 'Home', badge: null }, // StreamedAPI might not return teams separated
              away: { name: 'Away', badge: null }
            },
            // StreamedAPI returns 'poster'
            poster: m.poster,
            popular: false,
            sources: m.sources || []
          }));
          setMatches(mappedMatches);
        } else {
          setMatches([]);
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
      setMatches([]);
      toast.error('Erreur: impossible de charger les matches.');
    } finally {
      setLoading(false);
    }
  }, [apiType]);

  useEffect(() => {
    fetchMatches(selectedSport);
  }, [selectedSport, apiType, fetchMatches]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
  }, [matches, searchQuery]);

  const groupedMatches = useMemo(() => {
    if (selectedSport !== 'schedule') return null;
    const groups: Record<string, Match[]> = {};
    filteredMatches.forEach(m => {
      const date = new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(m);
    });
    return groups;
  }, [filteredMatches, selectedSport]);

  const liveMatches = matches.filter(m => m.date < Date.now() && (m.date + 7200000) > Date.now());

  const handleWatchClick = async (match: Match, e: React.MouseEvent) => {
    e.stopPropagation();
    setVpnMode(false);

    if (!match.sources || match.sources.length === 0) {
      toast.error('❌ Aucun serveur disponible pour ce match');
      return;
    }

    try {
      if (apiType === 'footy') {
        const streams: Stream[] = match.sources.map((s: any) => ({
          id: s.id || Math.random().toString(36).substring(2, 11),
          streamNo: 1,
          language: s.language || 'Multi',
          hd: s.quality?.toLowerCase().includes('hd') || true,
          embedUrl: s.url,
          source: 'footy'
        }));
        setStreamModal({ show: true, match, streams });
        setSelectedStream(streams[0]);
        return;
      }

      const source = match.sources[0];
      const res = await fetch(`${API_BASE}/stream/${source.source}/${source.id}`, {
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        // Retry with backup API directly
        const backupRes = await fetch(`https://streamed.pk/api/sports/stream/${source.source}/${source.id}`);
        if (!backupRes.ok) {
          const proxyRes = await fetch(`/api/proxy?url=${encodeURIComponent(`https://streamed.pk/api/sports/stream/${source.source}/${source.id}`)}`);
          if (!proxyRes.ok) throw new Error(`Serveur indisponible`);
          const data = await proxyRes.json();
          const streams: Stream[] = Array.isArray(data) ? data : (data?.streams || []);
          if (streams.length === 0) throw new Error('Aucun flux');
          setStreamModal({ show: true, match, streams });
          setSelectedStream(streams[0]);
          return;
        }
        const data = await backupRes.json();
        const streams: Stream[] = Array.isArray(data) ? data : (data?.streams || []);
        if (streams.length === 0) throw new Error('Aucun flux');
        setStreamModal({ show: true, match, streams });
        setSelectedStream(streams[0]);
        return;
      }

      const data = await res.json();
      const streams: Stream[] = Array.isArray(data) ? data : (data?.streams || []);

      if (streams.length === 0) {
        toast.error('⚠️ Aucun flux trouvé');
        return;
      }

      // Prioritize French streams
      const sortedStreams = [...streams].sort((a, b) => {
        const aIsFr = a.language.toLowerCase().includes('fre') || a.language.toLowerCase().includes('fr');
        const bIsFr = b.language.toLowerCase().includes('fre') || b.language.toLowerCase().includes('fr');
        if (aIsFr && !bIsFr) return -1;
        if (!aIsFr && bIsFr) return 1;
        return 0;
      });

      setStreamModal({ show: true, match, streams: sortedStreams });
      setSelectedStream(sortedStreams[0]);
      toast.success(`✅ ${streams.length} flux disponible(s)`);
    } catch (error) {
      toast.error('❌ Impossible de charger les flux');
    }
  };

  const playStream = (stream: Stream) => {
    setSelectedStream(stream);
    toast.success('✅ Lecture du flux...');
  };

  const MatchCard = ({ match }: { match: Match }) => {
    const isLive = match.date < Date.now() && (match.date + 7200000) > Date.now();

    return (
      <div
        className="group relative bg-[#0d0d0f] rounded-xl overflow-hidden border border-white/5 hover:border-primary/40 transition-all duration-300 cursor-pointer h-full flex flex-col shadow-lg shadow-black/20"
        onClick={(e) => handleWatchClick(match, e)}
      >
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
          <div className="px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/5 text-[9px] font-black text-white/90">
            {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {isLive && (
            <div className="px-1.5 py-0.5 rounded-md bg-red-600 text-[9px] font-black text-white animate-pulse flex items-center gap-1 shadow-[0_0_10px_rgba(220,38,38,0.4)]">
              LIVE
            </div>
          )}
        </div>

        <div className="aspect-[16/9] relative overflow-hidden bg-[#151517]">
          <div className="absolute inset-0">
            <img
              src={getImageUrl(match.poster, 'poster')}
              alt=""
              className="w-full h-full object-cover opacity-50 blur-[4px] scale-110 group-hover:opacity-70 group-hover:blur-[2px] transition-all duration-700"
              loading="lazy"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-transparent to-transparent opacity-80" />

          <div className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none">
            <div className="flex items-center gap-6 scale-90 group-hover:scale-100 transition-all duration-500">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-primary/50 transition-colors duration-500">
                  <img
                    src={getImageUrl(match.teams?.home?.badge, 'badge')}
                    alt=""
                    className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                    loading="lazy"
                  />
                </div>
                <span className="text-[9px] text-white font-black uppercase tracking-tighter max-w-[55px] truncate text-center drop-shadow-md">{match.teams?.home?.name}</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-primary font-black text-2xl italic tracking-tighter drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]">VS</span>
                <div className="w-8 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-primary/50 transition-colors duration-500">
                  <img
                    src={getImageUrl(match.teams?.away?.badge, 'badge')}
                    alt=""
                    className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                    loading="lazy"
                  />
                </div>
                <span className="text-[9px] text-white font-black uppercase tracking-tighter max-w-[55px] truncate text-center drop-shadow-md">{match.teams?.away?.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-2.5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-0.5 h-2 bg-primary rounded-full" />
              <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest truncate">
                {match.category}
              </span>
            </div>

            <h3 className="text-[10px] font-bold text-white/90 line-clamp-1 leading-none mb-2 uppercase tracking-tight">
              {match.title}
            </h3>
          </div>

          <button
            className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-primary text-[8px] font-black text-white transition-all duration-300 flex items-center justify-center gap-1.5 border border-white/5 hover:border-transparent group/btn uppercase tracking-widest overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
            <Play className="w-2.5 h-2.5 fill-current" />
            LIVE
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-black">
      <SEO title="Sports - CStream" description="Streaming sportif en direct avec multi-langues et HD" />
      <Navbar />

      <main className="container mx-auto px-4 pt-28 pb-12">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tighter bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">🏆 SPORTS LIVE</h1>
            <p className="text-white/40 text-sm font-medium">L'expérience ultime du streaming sportif</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setApiType('streamed')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${apiType === 'streamed' ? 'bg-primary text-white' : 'text-white/40 hover:text-white'
                  }`}
              >
                STREAMED API
              </button>
              <button
                onClick={() => setApiType('footy')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${apiType === 'footy' ? 'bg-primary text-white' : 'text-white/40 hover:text-white'
                  }`}
              >
                FOOTY API
              </button>
            </div>

            <button
              onClick={() => setVpnMode(!vpnMode)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all duration-300 border flex items-center gap-2 ${vpnMode
                ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10'
                : 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                }`}
            >
              <div className={`w-2 h-2 rounded-full ${vpnMode ? 'bg-primary animate-pulse' : 'bg-green-500 animate-pulse'}`} />
              VPN MODE: {vpnMode ? 'OUI (VPN REQUIS)' : 'NON (PROXY ACTIF)'}
            </button>

            <Button
              onClick={() => fetchMatches(selectedSport)}
              variant="outline"
              className="rounded-xl gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              ACTUALISER
            </Button>
          </div>
        </div>

        <div className="mb-8 relative">
          <Search className="absolute left-4 top-3 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un match..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary/50 focus:outline-none transition-all"
          />
        </div>

        {selectedSport === 'live' && liveMatches.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black mb-6 flex items-center gap-3 tracking-tight">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
              EN DIRECT
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {liveMatches.slice(0, 10).map((match, idx) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <MatchCard match={match} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-12">
          <h3 className="text-lg font-bold mb-4">Catégories</h3>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-4">
            {allSports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${selectedSport === sport.id
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-white/5 text-foreground hover:bg-white/10 border border-white/10'
                  }`}
              >
                {sport.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">
            {selectedSport === 'all' ? 'Tous les matches' :
              selectedSport === 'live' ? 'En direct maintenant' :
                selectedSport === 'schedule' ? 'Programme du jour' : 'Matches'}
          </h2>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold mb-2">Aucun match trouvé</h3>
              <p className="text-muted-foreground">Essayez une autre catégorie ou recherche</p>
            </div>
          ) : selectedSport === 'schedule' && groupedMatches ? (
            <div className="space-y-12">
              {Object.entries(groupedMatches).map(([date, dateMatches]) => (
                <div key={date}>
                  <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-primary uppercase tracking-widest">
                    <Calendar className="w-5 h-5" />
                    {date}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {dateMatches.map((match, idx) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        <MatchCard match={match} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredMatches.map((match, idx) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <MatchCard match={match} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedStream && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <h2 className="text-white text-lg font-bold hidden md:block truncate max-w-[300px]">
                    {streamModal.match?.title}
                  </h2>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[50vw]">
                    {streamModal.streams?.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStream(s)}
                        className={`flex flex-col items-center px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border ${selectedStream.id === s.id
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                          }`}
                      >
                        <span className="uppercase">{s.source} #{s.streamNo}</span>
                        <span className="text-[8px] opacity-70">{languageLabels[s.language] || s.language}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedStream(null);
                      setStreamModal({ show: false });
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white/70 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-black">
                {selectedStream && (
                  <iframe
                    key={selectedStream.id}
                    src={selectedStream.embedUrl}
                    title="Stream Player"
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
};

export default Sports;