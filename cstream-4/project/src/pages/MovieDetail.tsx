// src/pages/MovieDetail.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { tmdbApi } from '@/lib/tmdb';
import { useI18n } from '@/lib/i18n';
import { Navbar } from '@/components/Navbar';
import { MediaGrid } from '@/components/MediaGrid';
import { TrailerModal } from '@/components/TrailerModal';
import { UniversalPlayer, SOURCES } from "@/components/UniversalPlayer";
import { cn } from '@/lib/utils';
import { CinemaosPlayer } from '@/components/CinemaosPlayer';
import { CSPlayer } from '@/components/CSPlayer';
import { DualVotingSystem } from '@/components/DualVotingSystem';
import { SEO } from '@/components/SEO';
import { PosterOverlay } from '@/components/PosterOverlay';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ImportedSourceSelector } from '@/components/ImportedSourceSelector';
import { AvailableOn } from '@/components/AvailableOn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play, Star, Clock, Calendar, Heart, Bookmark, Share2,
  ChevronLeft, X, Loader2, ThumbsUp, Eye, MessageSquare,
  Send, Globe, User, ChevronDown, ExternalLink, AlertTriangle, RefreshCw, RotateCcw,
  Film, Image as ImageIcon, Layers, Download, Zap
} from 'lucide-react';
import { ScoreCircle } from '@/components/ScoreCircle';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Comments } from '@/components/Comments';
import { useWatchHistory } from '@/hooks/useWatchHistory';
import { useAuth } from '@/hooks/useAuth';
import { useLocalAndSyncSources } from '@/hooks/useLocalAndSyncSources';
import { parseHTML } from '@/lib/utils';

/* ============================ Types ============================ */
interface Reader {
  id: string;
  label: string;
  url: string;
  media_type: string;
  language: string;
  tmdb_id?: number | null;
  season_number?: number | null;
  episode_number?: number | null;
  enabled?: boolean | null;
  order_index?: number | null;
}
interface Review {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  comment: string;
  rating: number;
  created_at: string;
  page_url: string;
  is_admin?: boolean;
}
interface TMDBMovie {
  id: number;
  title: string;
  tagline?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  credits?: {
    crew?: Array<{ job: string; name: string; id: number }>;
    cast?: Array<{
      id: number;
      name: string;
      character: string;
      profile_path?: string
    }>;
  };
  videos?: {
    results?: Array<{
      key: string;
      type: string;
      site: string
    }>;
  };
  recommendations?: {
    results?: any[];
  };
  images?: {
    backdrops?: Array<{ file_path: string; width: number; height: number }>;
    posters?: Array<{ file_path: string; width: number; height: number }>;
  };
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path?: string;
    backdrop_path?: string;
  };
  production_companies?: Array<{
    id: number;
    name: string;
    logo_path?: string;
    origin_country?: string;
  }>;
  budget?: number;
  revenue?: number;
  status?: string;
  original_language?: string;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  season_number?: number | null;
  episode_number?: number | null;
}
interface TMDBCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  parts?: Array<{
    id: number;
    title: string;
    poster_path?: string;
    release_date?: string;
    vote_average?: number;
  }>;
}
/* ============================ Utilitaires ============================ */
const PROXY_BASE = typeof import.meta.env?.VITE_PROXY_BASE === 'string'
  ? import.meta.env.VITE_PROXY_BASE
  : '';
const normalizeBaseUrl = (url: string): string => {
  if (!url) return url;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
const buildFinalUrl = (baseUrl: string, reader: Reader, movie: TMDBMovie): string => {
  const base = normalizeBaseUrl(baseUrl);
  const season = reader?.season_number ?? movie?.season_number ?? null;
  const episode = reader?.episode_number ?? movie?.episode_number ?? null;
  if (!season && !episode) return base;
  const parts: string[] = [base];
  if (season) parts.push(`season/${season}`);
  if (episode) parts.push(`episode/${episode}`);
  return parts.join('/');
};
const formatDuration = (minutes?: number | null): string => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString('fr-FR');
};
/* ============================ CollectionDisplay Component ============================ */
const CollectionDisplay = ({ collectionId, currentMovieId }: { collectionId: number; currentMovieId: number }) => {
  const [collection, setCollection] = useState<TMDBCollection | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const data = await tmdbApi.getCollection(collectionId);
        setCollection(data as TMDBCollection);
      } catch (err) {
        console.error('Failed to fetch collection:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCollection();
  }, [collectionId]);
  if (loading) {
    return null;
  }
  if (!collection?.parts) return null;
  const sortedParts = [...collection.parts].sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
    return dateA - dateB;
  });
  return (
    <div className="space-y-4">
      {sortedParts.map((part, index) => (
        <Link
          key={part.id}
          to={`/movie/${part.id}`}
          className={`flex gap-4 p-4 rounded-xl transition-all hover:bg-white/5 ${part.id === currentMovieId ? 'bg-primary/10 ring-1 ring-primary/30' : ''
            }`}
        >
          {/* Number */}
          <div className="flex-shrink-0 w-8 text-2xl font-bold text-muted-foreground">
            {index + 1}
          </div>

          {/* Poster */}
          <div className="flex-shrink-0 w-16">
            {part.poster_path ? (
              <img
                src={tmdbApi.getImageUrl(part.poster_path, 'w200')}
                alt={part.title}
                className="w-full rounded-lg"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-secondary/50 rounded-lg flex items-center justify-center">
                <Film className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white group-hover:text-primary transition-colors">
              {part.title}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {part.vote_average && part.vote_average > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  {part.vote_average.toFixed(1)}
                </span>
              )}
              {part.release_date && (
                <span>{new Date(part.release_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
/* ============================ Composant principal ============================ */
const MovieDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useI18n();
  const { history, saveProgress } = useWatchHistory();
  const lastProgressSaveRef = useRef<number>(0);
  const playbackStartTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // États principaux
  const [movie, setMovie] = useState<TMDBMovie | null>(null);
  const [movieLogos, setMovieLogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [findingSource, setFindingSource] = useState(false);
  // Mode lecture
  const [isWatching, setIsWatching] = useState(false);
  const [playerType, setPlayerType] = useState<'universal' | 'bludclart'>('universal');
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [currentSource, setCurrentSource] = useState<Reader | null>(null);
  // Modal sources
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [candidates, setCandidates] = useState<Reader[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [currentImportedSource, setCurrentImportedSource] = useState<any>(null);
  const [sourceLoadError, setSourceLoadError] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number>(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [userLiked, setUserLiked] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [likes, setLikes] = useState(0);
  const [views, setViews] = useState(0);
  const [zoomedPoster, setZoomedPoster] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [seasonData, setSeasonData] = useState<any>(null);

  // Synchronisation des états pour les séries
  useEffect(() => {
    const seasons = (movie as any)?.seasons;
    if (seasons && seasons.length > 0) {
      const firstSeason = seasons.find((s: any) => s.season_number > 0) || seasons[0];
      setSelectedSeason(firstSeason.season_number);
    }
  }, [movie]);

  useEffect(() => {
    const fetchSeasonDetails = async () => {
      if (!movie?.id || !selectedSeason) return;
      setEpisodesLoading(true);
      try {
        const data = await tmdbApi.getTVSeasonDetails(movie.id, selectedSeason) as any;
        setSeasonData(data);
        setEpisodes(data?.episodes || []);
      } catch (err) {
        console.error('Error fetching season details:', err);
      } finally {
        setEpisodesLoading(false);
      }
    };
    if (movie?.id) fetchSeasonDetails();
  }, [movie?.id, selectedSeason]);

  const handleEpisodeClick = (season: number, ep: number) => {
    setSelectedEpisode(ep);
    setIframeKey(prev => prev + 1);
    toast.success(`Épisode ${ep} sélectionné`);
  };

  const handleNextEpisode = () => {
    const currentIdx = episodes.findIndex((e: any) => e.episode_number === selectedEpisode);
    if (currentIdx < episodes.length - 1) {
      const nextEp = episodes[currentIdx + 1].episode_number;
      setSelectedEpisode(Number(nextEp));
      setIframeKey(prev => prev + 1);
    }
  };

  const handlePreviousEpisode = () => {
    const currentIdx = episodes.findIndex((e: any) => e.episode_number === selectedEpisode);
    if (currentIdx > 0) {
      const prevEp = episodes[currentIdx - 1].episode_number;
      setSelectedEpisode(Number(prevEp));
      setIframeKey(prev => prev + 1);
    }
  };

  // Load saved rating on mount
  useEffect(() => {
    if (id) {
      const key = `cstream_rating_${id}`;
      const saved = localStorage.getItem(key);
      if (saved) setNewRating(parseInt(saved));
    }
  }, [id]);

  // Charger les détails du film
  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const tmdbLang = language === 'fr' ? 'fr-FR' : 'en-US';
        const data = await tmdbApi.getMovieDetails(parseInt(id), tmdbLang) as TMDBMovie;
        setMovie(data);

        // Fetch logos separately to handle language-specific logos
        const imageData = await tmdbApi.getMediaImages(parseInt(id), 'movie', tmdbLang);
        if (imageData?.logos) {
          setMovieLogos(imageData.logos);
        }

        setLikes(data.vote_count ? data.vote_count * 10 : 156);
        setViews(data.vote_count ? data.vote_count * 100 : 2847);
      } catch (err) {
        console.error('Failed to fetch movie:', err);
        toast.error('Impossible de charger les détails du film.');
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id, language]);
  // Fetch reviews from database
  useEffect(() => {
    const fetchReviews = async () => {
      if (!id) return;
      setReviewsLoading(true);
      try {
        const pageUrl = `/movie/${id}`;
        const { data, error } = await supabase
          .from('reviews')
          .select(`
            id,
            user_id,
            comment,
            rating,
            created_at,
            page_url
          `)
          .eq('page_url', pageUrl)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const reviewsWithUsernames: Review[] = await Promise.all(
          (data || []).map(async (review) => {
            let username = 'Utilisateur';
            let avatarUrl = null;
            let isAdmin = false;
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', review.user_id)
                .maybeSingle();
              if (profile) {
                username = profile.username || 'Utilisateur';
                avatarUrl = profile.avatar_url;
              }
              const { data: adminCheck } = await supabase
                .from('admin')
                .select('id')
                .eq('id', parseInt(review.user_id) || 0)
                .maybeSingle();

              isAdmin = !!adminCheck;
            } catch (e) {
              console.error('Error fetching profile:', e);
            }
            return {
              id: review.id,
              user_id: review.user_id,
              username,
              avatar_url: avatarUrl,
              comment: review.comment,
              rating: review.rating,
              created_at: review.created_at || new Date().toISOString(),
              page_url: review.page_url || pageUrl,
              is_admin: isAdmin
            };
          })
        );
        setReviews(reviewsWithUsernames);
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [id]);
  // Charger le progrès sauvegardé pour ce film
  useEffect(() => {
    if (!id || !history.length) return;
    const tmdbId = parseInt(id);
    const existingProgress = history.find(
      h => h.tmdb_id === tmdbId && h.media_type === 'movie'
    );
    if (existingProgress?.progress && existingProgress.progress > 5 && existingProgress.progress < 95) {
      setSavedProgress(existingProgress.progress);
      setShowResumePrompt(true);
    }
  }, [id, history]);
  // Auto-load sources for selector
  useEffect(() => {
    if (!movie?.id) return;
    fetchCandidates(movie);
  }, [movie?.id]);
  // Auto-save progress while watching
  useEffect(() => {
    if (!isWatching || !movie) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      playbackStartTimeRef.current = null;
      return;
    }
    playbackStartTimeRef.current = Date.now();

    // Save initial progress (0%) when starting
    saveProgress(parseInt(id!), 'movie', null, null, 0).catch(err => console.error('Save start:', err));
    // Save progress every 5 seconds
    const runtimeMs = (movie.runtime || 120) * 60 * 1000;

    progressIntervalRef.current = setInterval(() => {
      if (!playbackStartTimeRef.current) return;

      const elapsed = Date.now() - playbackStartTimeRef.current;
      const progressPercent = Math.min((elapsed / runtimeMs) * 100, 99);

      saveProgress(parseInt(id!), 'movie', null, null, Math.round(progressPercent))
        .catch(err => console.error('Save interval:', err));
    }, 5000);
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (playbackStartTimeRef.current && movie) {
        const elapsed = Date.now() - playbackStartTimeRef.current;
        const progressPercent = Math.min((elapsed / runtimeMs) * 100, 100);
        saveProgress(parseInt(id!), 'movie', null, null, Math.round(progressPercent))
          .catch(err => console.error('Save final:', err));
      }
    };
  }, [isWatching, movie, saveProgress, id]);
  // Callback pour sauvegarder le progrès (fallback)
  const handleProgressUpdate = useCallback((progress: number, currentTime: number, duration: number) => {
    if (!id) return;
    const now = Date.now();
    if (now - lastProgressSaveRef.current < 5000) return;
    if (progress >= 0) {
      lastProgressSaveRef.current = now;
      saveProgress(parseInt(id), 'movie', null, null, Math.round(progress));
    }
  }, [id, saveProgress]);
  // Callback quand la vidéo se termine
  const handleVideoEnd = useCallback(() => {
    if (!id) return;
    saveProgress(parseInt(id), 'movie', null, null, 100);
    toast.success('Film terminé !');
  }, [id, saveProgress]);
  // Charger favoris et likes
  useEffect(() => {
    if (!id) return;

    const loadFavoriteAndLikeStatus = async () => {
      try {
        if (user) {
          const [favResult, likeResult] = await Promise.all([
            supabase
              .from('favorites')
              .select('id')
              .eq('user_id', user.id)
              .eq('media_id', id)
              .eq('media_type', 'movie')
              .maybeSingle(),
            supabase
              .from('user_likes')
              .select('id')
              .eq('user_id', user.id)
              .eq('media_id', id)
              .eq('media_type', 'movie')
              .maybeSingle()
          ]);

          if (!favResult.error) {
            setIsFavorite(!!favResult.data);
          }
          if (!likeResult.error) {
            setUserLiked(!!likeResult.data);
          }
        } else {
          const localFavs = JSON.parse(localStorage.getItem('cstream_favorites_v1') || '[]') as Array<{ id: number; mediaType: string }>;
          setIsFavorite(localFavs.some(fav => fav.id === parseInt(id) && fav.mediaType === 'movie'));
          const liked = localStorage.getItem(`liked_${id}`) === 'true';
          setUserLiked(liked);
        }
      } catch {
        setIsFavorite(false);
        setUserLiked(false);
      }
    };

    loadFavoriteAndLikeStatus();
  }, [id, user]);
  // Toggle favori - fonctionne pour invités aussi
  const toggleFavorite = useCallback(async () => {
    if (!id) return;

    if (user) {
      try {
        if (isFavorite) {
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('media_id', id)
            .eq('media_type', 'movie');

          if (error) throw error;
          setIsFavorite(false);
          toast.success('Retiré des favoris');
        } else {
          const { error } = await supabase
            .from('favorites')
            .insert({
              user_id: user.id,
              media_id: id,
              media_type: 'movie',
            });

          if (error) throw error;
          setIsFavorite(true);
          toast.success('Ajouté aux favoris');
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);
        toast.error('Impossible de mettre à jour les favoris');
      }
    } else {
      try {
        const localFavs = JSON.parse(localStorage.getItem('cstream_favorites_v1') || '[]') as Array<{ id: number; mediaType: string; title: string; posterPath: string | null; addedAt: string }>;
        if (isFavorite) {
          const filtered = localFavs.filter(fav => !(fav.id === parseInt(id) && fav.mediaType === 'movie'));
          localStorage.setItem('cstream_favorites_v1', JSON.stringify(filtered));
          setIsFavorite(false);
          toast.success('Retiré des favoris');
        } else {
          localFavs.unshift({
            id: parseInt(id),
            mediaType: 'movie',
            title: movie?.title || '',
            posterPath: movie?.poster_path || null,
            addedAt: new Date().toISOString()
          });
          localStorage.setItem('cstream_favorites_v1', JSON.stringify(localFavs.slice(0, 100)));
          setIsFavorite(true);
          toast.success('Ajouté aux favoris');
        }
      } catch {
        toast.error('Impossible de mettre à jour les favoris');
      }
    }
  }, [id, user, isFavorite, movie]);
  // Toggle like - fonctionne pour invités aussi
  const toggleLike = useCallback(async () => {
    if (!id) return;

    if (user) {
      try {
        if (userLiked) {
          const { error } = await supabase
            .from('user_likes')
            .delete()
            .eq('user_id', user.id)
            .eq('media_id', id)
            .eq('media_type', 'movie');

          if (error) throw error;
          setUserLiked(false);
          setLikes(prev => prev - 1);
          toast.success('Like retiré');
        } else {
          const { error } = await supabase
            .from('user_likes')
            .upsert({
              user_id: user.id,
              media_id: id,
              media_type: 'movie'
            }, {
              onConflict: 'user_id,media_id,media_type',
              ignoreDuplicates: true
            });

          if (error) throw error;
          setUserLiked(true);
          setLikes(prev => prev + 1);
          toast.success('Liked !');
        }
      } catch (error) {
        console.error('Error toggling like:', error);
        toast.error('Erreur lors de la mise à jour du like');
      }
    } else {
      if (userLiked) {
        localStorage.removeItem(`liked_${id}`);
        setUserLiked(false);
        setLikes(prev => prev - 1);
        toast.success('Like retiré');
      } else {
        localStorage.setItem(`liked_${id}`, 'true');
        setUserLiked(true);
        setLikes(prev => prev + 1);
        toast.success('Liked !');
      }
    }
  }, [id, user, userLiked]);
  // Hook pour sources locales + synchronisées
  const { fetchAllSources } = useLocalAndSyncSources();
  // Rechercher sources (local + synchronized)
  const fetchCandidates = useCallback(
    async (movieObj: TMDBMovie): Promise<Reader[]> => {
      setSourcesLoading(true);
      try {
        const tmdbId = movieObj?.id;
        const allSources = await fetchAllSources('movie', Number(tmdbId));

        let list: Reader[] = allSources as any;
        if (!list.length) {
          const fallbackSources = await fetchAllSources('movie');
          list = fallbackSources as any;
        }
        setCandidates(list);
        return list;
      } catch (err) {
        console.error('fetchCandidates error', err);
        toast.error('Erreur lors de la recherche de sources.');
        return [];
      } finally {
        setSourcesLoading(false);
      }
    },
    [fetchAllSources]
  );
  // Ouvrir modal sources
  const openSourcesModal = useCallback(async () => {
    if (!movie) return;
    setSourcesOpen(true);
    await fetchCandidates(movie);
  }, [movie, fetchCandidates]);
  // Lancer la lecture
  const handleChooseAndWatch = useCallback(
    (reader: Reader) => {
      if (!movie) return;
      const finalUrl = buildFinalUrl(reader.url, reader, movie);
      if (!finalUrl) {
        toast.error('URL invalide pour cette source.');
        return;
      }
      const proxyUrl = PROXY_BASE
        ? `${PROXY_BASE}${encodeURIComponent(finalUrl)}`
        : finalUrl;
      setCurrentVideoUrl(proxyUrl);
      setCurrentSource(reader);
      setIsWatching(true);
      setVideoLoading(true);
      setSourcesOpen(false);
      setIframeError(false);
      setIframeKey(prev => prev + 1);
      toast.success(`Lecture via ${reader.label}`);

      setTimeout(() => setVideoLoading(false), 1500);
    },
    [movie]
  );
  // Handle imported source selection - load directly
  const handleImportedSourceSelect = useCallback(
    (source: any) => {
      console.log('[MovieDetail] Selected imported source:', source);
      console.log('[MovieDetail] Setting video URL to:', source.url);
      setCurrentImportedSource(source);
      setCurrentVideoUrl(source.url);
      setSourceLoadError(false);
      setIsWatching(true);
      setVideoLoading(false);
      setIframeError(false);
      setIframeKey(prev => prev + 1);
      setSourcesOpen(false);
      toast.success(`Lecture via ${source.label}`);

      // Timeout de 5s - si l'iframe ne charge pas, erreur
      setTimeout(() => {
        setSourceLoadError(true);
        console.log('[MovieDetail] Iframe timeout - source unavailable');
      }, 5000);
    },
    []
  );
  // Bouton "Regarder" rapide - lance le lecteur universel
  const handleWatchQuick = useCallback(async () => {
    if (!movie) return;
    setIsWatching(true);
    setPlayerLoading(true);
    toast.success('Lecture en cours...');
    setTimeout(() => setPlayerLoading(false), 500);
  }, [movie]);
  // Recommander
  const handleRecommend = useCallback(async () => {
    if (!movie || !user) {
      toast.error('Veuillez vous connecter pour recommander');
      return;
    }
    try {
      toast.success('Film recommandé à vos amis !');
    } catch (err) {
      toast.error('Erreur lors de la recommandation');
    }
  }, [movie, user]);
  // Partager
  const handleShare = useCallback(async () => {
    if (!movie) return;
    const shareData = {
      title: movie.title,
      text: `Regarde ${movie.title} - ${movie.tagline || 'Un film incroyable !'}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Partagé avec succès !');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Lien copié dans le presse-papiers');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  }, [movie]);
  // Add review to database
  const addReview = useCallback(async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour laisser un avis');
      return;
    }
    if (!newComment.trim()) {
      toast.error('Veuillez écrire un commentaire');
      return;
    }
    if (newComment.trim().length < 10) {
      toast.error('Votre commentaire doit contenir au moins 10 caractères');
      return;
    }
    setSubmittingReview(true);
    try {
      const mediaId = `movie_${id}`;
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          username: profile?.username || user.email?.split('@')[0] || 'Utilisateur',
          profile_url: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          comment: newComment.trim(),
          rating: newRating,
          media_id: mediaId,
          badge: null,
        })
        .select('*')
        .single();
      if (error) throw error;
      const newReview: Review = {
        id: (data as any).id,
        user_id: user.id,
        username: (data as any).username || profile?.username || 'Utilisateur',
        avatar_url: (data as any).profile_url || profile?.avatar_url,
        comment: newComment.trim(),
        rating: newRating,
        created_at: (data as any).created_at || new Date().toISOString(),
        page_url: mediaId,
        is_admin: false
      };
      setReviews(prev => [newReview, ...prev]);
      setNewComment('');
      setNewRating(5);
      setShowCommentForm(false);
      toast.success('Avis publié avec succès !');
    } catch (error) {
      console.error('Error adding review:', error);
      toast.error('Erreur lors de la publication de votre avis');
    } finally {
      setSubmittingReview(false);
    }
  }, [id, user, newComment, newRating]);
  /* ============================ Render ============================ */
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
      </div>
    );
  }
  if (!movie) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground mb-4">Ce film n'a pas été trouvé.</p>
          <Button onClick={() => navigate('/movies')}>
            Retour aux films
          </Button>
        </div>
      </div>
    );
  }
  const directors = movie.credits?.crew?.filter((c) => c.job === 'Director') || [];
  const castList = movie.credits?.cast?.slice(0, 12) || [];
  const trailer = movie.videos?.results?.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  );
  const seoDescription = movie.overview
    ? movie.overview.substring(0, 160) + '...'
    : `Regarder ${movie.title} en streaming gratuit sur CStream`;
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={movie.title}
        description={seoDescription}
        image={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined}
        url={`/movie/${id}`}
        type="video.movie"
        movieData={{
          name: movie.title,
          description: movie.overview,
          image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
          datePublished: movie.release_date,
          duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
          genre: movie.genres?.map(g => g.name),
          director: directors[0]?.name,
          actor: castList.slice(0, 5).map(c => c.name),
          aggregateRating: movie.vote_average && movie.vote_count ? {
            ratingValue: movie.vote_average,
            ratingCount: movie.vote_count,
          } : undefined,
        }}
      />
      <Navbar />

      <AnimatePresence>
        {zoomedPoster && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-8 cursor-zoom-out"
            onClick={() => setZoomedPoster(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={tmdbApi.getImageUrl(zoomedPoster, 'original')}
                alt="Poster zoomé"
                className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white z-[110]"
                onClick={() => setZoomedPoster(null)}
              >
                <X className="w-6 h-6" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isWatching ? (
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsWatching(false);
                setCurrentImportedSource(null);
                setCurrentVideoUrl('');
              }}
              className="flex-shrink-0 min-h-[44px] min-w-[44px]"
              aria-label="Retour aux détails du film"
            >
              <ChevronLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Retour</span>
            </Button>
            {/* Logo du film */}
            <div className="mb-6 h-32 md:h-48 flex items-center justify-center md:justify-start">
              {movieLogos && movieLogos.length > 0 ? (
                (() => {
                  const langCode = language.split('-')[0];
                  // Prioritize current language logo, otherwise fallback to English or the first one
                  const logo = movieLogos.find(l => l.iso_639_1 === langCode) ||
                    movieLogos.find(l => l.iso_639_1 === 'en') ||
                    movieLogos[0];

                  return logo ? (
                    <motion.img
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      src={tmdbApi.getLogoUrl(logo.file_path, 'w500')!}
                      alt={movie.title}
                      className="max-w-[80%] max-h-full object-contain filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
                    />
                  ) : (
                    <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white">
                      {movie.title}
                    </h1>
                  );
                })()
              ) : (
                <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-white">
                  {movie.title}
                </h1>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Lecteur - Affiche source importée ou lecteurs publics */}
            <div className="lg:col-span-3 space-y-5 sm:space-y-7">
              {/* Header de sélection de sources (Nouveau) */}
              <div className="mb-6 p-3 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="w-full md:w-auto">
                    <div className="flex items-center gap-2 mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                      Lecteurs Premium
                    </div>
                    <ImportedSourceSelector
                      tmdbId={movie.id}
                      onSelect={(s) => {
                        handleImportedSourceSelect(s);
                      }}
                      currentSource={currentImportedSource}
                    />
                  </div>
                </div>
              </div>

              <Card className="overflow-hidden">
                {currentImportedSource ? (
                  // Lecteur direct pour source importée
                  <div className="w-full bg-black aspect-video flex items-center justify-center">
                    {sourceLoadError ? (
                      <div className="text-center text-red-400 p-6">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-70" />
                        <p className="font-semibold mb-2">Source indisponible</p>
                        <p className="text-sm text-gray-400 mb-4">
                          Cette source ne peut pas être intégrée (erreur {currentImportedSource?.provider || 'lecteur'}).
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsWatching(false);
                            setCurrentImportedSource(null);
                            setSourceLoadError(false);
                          }}
                          className="gap-2"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Retour
                        </Button>
                      </div>
                    ) : currentVideoUrl ? (
                      <iframe
                        key={iframeKey}
                        src={currentVideoUrl}
                        width="100%"
                        height="100%"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; payment"
                        frameBorder="0"
                        scrolling="no"
                        onLoad={() => {
                          console.log('[MovieDetail] Iframe loaded successfully');
                          setSourceLoadError(false);
                        }}
                        style={{
                          border: 'none',
                          width: '100%',
                          height: '100%',
                          display: 'block'
                        }}
                      />
                    ) : (
                      <div className="text-gray-400 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Chargement du lecteur...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  // Affiche les vrais streamings ou les lecteurs génériques
                  <>
                    {/* Lecteurs génériques comme fallback */}
                    <Tabs defaultValue="universal" className="w-full mt-4">
                      <TabsList className="w-full grid w-full grid-cols-4 rounded-none">
                        <TabsTrigger value="bludclart" className="flex items-center gap-1">
                          Bludclart <Badge className="bg-blue-500/30 text-blue-300 border-blue-500/50 text-[10px]">Opti</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="universal">Lecteur Principal</TabsTrigger>
                        <TabsTrigger value="cinemaos">Cinemaos</TabsTrigger>
                        <TabsTrigger value="csplayer">CSPlayer</TabsTrigger>
                      </TabsList>
                      <TabsContent value="bludclart" className="mt-0">
                        <div className="w-full bg-black aspect-video">
                          <iframe
                            src={`https://bludclart.com/movie/${id}/watch`}
                            width="100%"
                            height="100%"
                            allow="autoplay; fullscreen"
                            frameBorder="0"
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="universal" className="mt-0">
                        <UniversalPlayer
                          tmdbId={parseInt(id!)}
                          mediaType="movie"
                          title={movie.title}
                          posterPath={movie.poster_path}
                          autoPlay={true}
                          onProgressUpdate={handleProgressUpdate}
                          onVideoEnd={handleVideoEnd}
                          className="rounded-none"
                        />
                      </TabsContent>
                      <TabsContent value="cinemaos" className="mt-0 p-4">
                        <CinemaosPlayer
                          tmdbId={parseInt(id!)}
                          mediaType="movie"
                          title={movie.title}
                        />
                      </TabsContent>
                      <TabsContent value="csplayer" className="mt-0 p-4">
                        <CSPlayer
                          tmdbId={parseInt(id!)}
                          mediaType="movie"
                          title={movie.title}
                        />
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </Card>
              {/* Interactions */}
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                      <Button
                        variant={userLiked ? "default" : "outline"}
                        size="sm"
                        onClick={toggleLike}
                        className="gap-1.5 sm:gap-2 h-10 sm:h-11 min-h-[44px] px-3"
                        aria-label={userLiked ? "Retirer le like" : "Ajouter un like"}
                        aria-pressed={userLiked}
                      >
                        <ThumbsUp className={`w-4 h-4 sm:w-5 sm:h-5 ${userLiked ? 'fill-current' : ''}`} />
                        <span className="text-xs sm:text-sm">{likes}</span>
                      </Button>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden xs:inline">{views} vues</span>
                        <span className="xs:hidden">{views}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden xs:inline">{reviews.length} avis</span>
                        <span className="xs:hidden">{reviews.length}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleFavorite}
                        className="h-10 sm:h-11 w-10 sm:w-11 p-0 min-h-[44px] min-w-[44px]"
                        aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                        aria-pressed={isFavorite}
                      >
                        <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                        className="h-10 sm:h-11 w-10 sm:w-11 p-0 min-h-[44px] min-w-[44px]"
                        aria-label="Partager le film"
                      >
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Synopsis */}
              {movie.overview && (
                <Card>
                  <CardHeader>
                    <CardTitle>Synopsis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{parseHTML(movie.overview)}</p>
                  </CardContent>
                </Card>
              )}
              {/* Distribution */}
              {castList.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {castList.slice(0, 8).map((actor) => (
                        <div key={actor.id} className="text-center">
                          {actor.profile_path ? (
                            <img
                              src={tmdbApi.getImageUrl(actor.profile_path, 'w200')}
                              alt={actor.name}
                              className="w-full aspect-[2/3] rounded-md mb-2 object-cover"
                            />
                          ) : (
                            <div className="w-full aspect-[2/3] bg-secondary/20 rounded-md mb-2 flex items-center justify-center">
                              <User className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <p className="text-sm font-medium">{actor.name}</p>
                          <p className="text-xs text-muted-foreground">{actor.character}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Recommandations */}
              {movie.recommendations?.results && movie.recommendations.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vous pourriez aussi aimer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {movie.recommendations.results.slice(0, 6).map((rec: any) => (
                        <Link
                          key={rec.id}
                          to={`/movie/${rec.id}`}
                          className="group"
                        >
                          {rec.poster_path ? (
                            <img
                              src={tmdbApi.getImageUrl(rec.poster_path, 'w200')}
                              alt={rec.title}
                              className="w-full aspect-[2/3] rounded-md mb-2 object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full aspect-[2/3] bg-secondary/20 rounded-md mb-2" />
                          )}
                          <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                            {rec.title}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Reviews */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      <CardTitle>Avis des utilisateurs ({reviews.length})</CardTitle>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowCommentForm(!showCommentForm)}
                      disabled={!user}
                    >
                      {showCommentForm ? 'Annuler' : user ? 'Ajouter un avis' : 'Connectez-vous'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <AnimatePresence>
                    {showCommentForm && user && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 mb-6 p-4 border rounded-lg bg-secondary/20"
                      >
                        <h3 className="font-semibold flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Nouvel avis
                        </h3>
                        <textarea
                          placeholder="Votre commentaire (minimum 10 caractères)"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="w-full p-3 border rounded-md bg-background focus:ring-2 focus:ring-primary"
                          rows={4}
                        />
                        <div>
                          <label className="block mb-2 text-sm font-medium">
                            Note: {newRating}/5
                          </label>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setNewRating(star)}
                                className="focus:outline-none"
                                type="button"
                              >
                                <Star
                                  className={`w-8 h-8 cursor-pointer transition-colors ${star <= newRating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground hover:text-yellow-400'
                                    }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button
                          onClick={addReview}
                          className="w-full"
                          disabled={submittingReview}
                        >
                          {submittingReview ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Publier mon avis
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {reviewsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : reviews.length > 0 ? (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <motion.div
                          key={review.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border-b pb-4 last:border-0"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {review.avatar_url ? (
                                <img
                                  src={review.avatar_url}
                                  alt={review.username}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{review.username}</p>
                                  {review.is_admin && (
                                    <Badge variant="default" className="text-xs">Admin</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(review.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-sm mb-3 leading-relaxed">{review.comment}</p>

                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground'
                                  }`}
                              />
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Aucun avis disponible. {user ? 'Soyez le premier à donner votre avis !' : 'Connectez-vous pour laisser le premier avis !'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {/* Sidebar Info */}
            <aside className="lg:col-span-1 space-y-5 sm:space-y-7">
              {/* Système de Vote Double */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Votes</CardTitle>
                </CardHeader>
                <CardContent>
                  <DualVotingSystem
                    tmdbVote={movie.vote_average || 0}
                    tmdbVoteCount={movie.vote_count || 0}
                    cstreamVote={7.5}
                    mediaId={id!}
                    mediaType="movie"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Informations</CardTitle>
                </CardHeader>
                <CardContent>
                  {movie.poster_path ? (
                    <img
                      src={tmdbApi.getImageUrl(movie.poster_path, 'w342')}
                      alt={movie.title}
                      className="w-full max-w-[160px] mx-auto rounded-md mb-3 object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-full max-w-[160px] mx-auto aspect-[2/3] bg-secondary/20 rounded-md mb-3" />
                  )}
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Titre</p>
                      <p className="font-semibold">{movie.title}</p>
                    </div>
                    {movie.tagline && (
                      <p className="text-xs italic text-muted-foreground border-l-2 border-primary pl-2">
                        "{movie.tagline}"
                      </p>
                    )}
                    {directors.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Réalisateur</p>
                        <p className="font-medium">{directors.map((d) => d.name).join(', ')}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Durée</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-medium">{formatDuration(movie.runtime)}</span>
                      </div>
                    </div>
                    {movie.release_date && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Date de sortie</p>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-medium">
                            {new Date(movie.release_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Note TMDB</p>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="font-bold">
                          {movie.vote_average ? movie.vote_average.toFixed(1) : '—'}
                        </span>
                        <span className="text-muted-foreground">/ 10</span>
                      </div>
                      {movie.vote_count && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ({movie.vote_count.toLocaleString()} votes)
                        </p>
                      )}
                    </div>
                    {movie.genres && movie.genres.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Genres</p>
                        <div className="flex flex-wrap gap-1">
                          {movie.genres.map((genre) => (
                            <Badge key={genre.id} variant="secondary" className="text-xs">
                              {genre.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {trailer && (
                    <Button
                      asChild
                      className="w-full mt-4"
                      variant="outline"
                    >
                      <a
                        href={`https://www.youtube.com/watch?v=${trailer.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Bande-annonce
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
              {/* Statistiques */}
              <Card>
                <CardHeader>
                  <CardTitle>Statistiques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <ThumbsUp className="w-5 h-5 text-red-500" />
                      <span>Likes</span>
                    </div>
                    <span className="font-bold">{likes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Eye className="w-5 h-5 text-blue-500" />
                      <span>Vues</span>
                    </div>
                    <span className="font-bold">{views.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="w-5 h-5 text-green-500" />
                      <span>Commentaires</span>
                    </div>
                    <span className="font-bold">{reviews.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="w-5 h-5 text-pink-500" />
                      <span>Favoris</span>
                    </div>
                    <span className="font-bold">{isFavorite ? 'Oui' : 'Non'}</span>
                  </div>
                </CardContent>
              </Card>
              {/* Conseils */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Conseils</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Utilisez le bouton "Retour" pour revenir aux détails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Changez de source si le lecteur ne fonctionne pas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Partagez le film avec vos amis via le bouton de partage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Laissez un avis pour aider les autres utilisateurs</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
      ) : (
        /* Mode Détails */
        <>
          {/* Hero Section - Nouveau design 3 colonnes */}
          <section className="relative min-h-[70vh] overflow-hidden">
            <div className="absolute inset-0 bg-[#050508]" />
            {movie.backdrop_path && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${tmdbApi.getImageUrl(movie.backdrop_path, 'original')})`,
                  filter: 'blur(25px) brightness(0.4)',
                  transform: 'scale(1.2)',
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/40 via-transparent to-transparent" />
            <div className="relative container mx-auto px-4 py-8">
              <Link
                to="/movies"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Retour aux films
              </Link>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Colonne gauche - Poster avec badge score */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="lg:col-span-2 flex justify-center lg:justify-start"
                >
                  <div className="relative group max-w-[200px] lg:max-w-[180px]">
                    {/* Score Badge */}
                    {movie.vote_average && movie.vote_average > 0 && (
                      <div className="absolute -top-2 -left-2 z-10 scale-90">
                        <ScoreCircle score={movie.vote_average} size="sm" />
                      </div>
                    )}

                    {/* Poster cliquable - Taille réduite */}
                    <div className="w-full aspect-[2/3] overflow-hidden rounded-xl shadow-2xl cursor-zoom-in transition-transform duration-300 hover:scale-105 bg-black" onClick={() => setZoomedPoster(movie.poster_path || null)}>
                      <img
                        src={movie.poster_path?.startsWith('http') ? movie.poster_path : tmdbApi.getImageUrl(movie.poster_path || '', 'w500')}
                        className="w-full h-full object-cover opacity-100"
                        alt={movie.title}
                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/500x750?text=No+Poster')}
                      />
                    </div>

                    {/* Titre stylisé sous le poster */}
                    <div className="mt-3 text-center">
                      <h2 className="text-sm font-semibold text-white tracking-wide leading-tight line-clamp-2">
                        {movie.title}
                      </h2>
                    </div>
                  </div>
                </motion.div>
                {/* Colonne centrale - Informations principales */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="lg:col-span-7 space-y-4"
                >
                  {/* Titre principal avec style backdrop ou Logo TMDB */}
                  <div className="relative mb-6">
                    {(movie.images as any)?.logos && (movie.images as any).logos.length > 0 ? (
                      <div className="max-w-[400px] mb-4">
                        <img
                          src={tmdbApi.getImageUrl((movie.images as any).logos[0].file_path, 'original')}
                          alt={movie.title}
                          className="w-full h-auto drop-shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
                          loading="eager"
                        />
                      </div>
                    ) : (
                      <h1
                        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
                        style={{
                          textShadow: '2px 2px 24px rgba(0,0,0,0.8)'
                        }}
                      >
                        {movie.title}
                      </h1>
                    )}
                  </div>
                  {/* Production company logo */}
                  {movie.production_companies && movie.production_companies.length > 0 && (
                    <div className="flex items-center gap-3">
                      {movie.production_companies[0].logo_path ? (
                        <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2">
                          <img
                            src={tmdbApi.getImageUrl(movie.production_companies[0].logo_path, 'w200')}
                            alt={movie.production_companies[0].name}
                            className="h-6 w-auto object-contain invert opacity-80"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-white/70">{movie.production_companies[0].name}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Date et durée */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {movie.release_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(movie.release_date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                    {movie.runtime && movie.runtime > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{movie.runtime} minutes ({formatDuration(movie.runtime)})</span>
                      </div>
                    )}
                  </div>
                  {/* Genres */}
                  <div className="flex flex-wrap gap-2">
                    {movie.genres?.map((genre) => (
                      <Link key={genre.id} to={`/movies?genre=${genre.id}`}>
                        <Badge
                          variant="outline"
                          className="border-white/30 hover:bg-white/10 hover:border-white/50 transition-all cursor-pointer px-4 py-1"
                        >
                          {genre.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  {/* Réalisateur avec photo */}
                  {directors.length > 0 && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center overflow-hidden ring-2 ring-primary/30">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{directors.map((d) => d.name).join(', ')}</p>
                        <p className="text-xs text-muted-foreground">Réalisateur</p>
                      </div>
                    </div>
                  )}
                  {/* Boutons Watch / Download / Trailer */}
                  <div className="flex flex-wrap gap-3 pt-2 items-center">
                    <Button
                      size="lg"
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 min-h-[48px] px-8 rounded-full"
                      onClick={handleWatchQuick}
                      disabled={findingSource}
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {findingSource ? 'Recherche...' : 'Watch'}
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setTrailerOpen(true)}
                      className="gap-2 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary min-h-[48px] px-8 rounded-full"
                    >
                      <Film className="w-5 h-5" />
                      Trailer
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={openSourcesModal}
                      className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 min-h-[48px] px-8 rounded-full"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Download
                    </Button>
                    {movie && (
                      <ImportedSourceSelector
                        tmdbId={movie.id}
                        onSelect={handleImportedSourceSelect}
                        currentSource={currentImportedSource}
                        loading={sourcesLoading}
                      />
                    )}
                  </div>
                  {/* Available on - Plateformes */}
                  {movie && (
                    <div className="space-y-4">
                      <AvailableOn movie={movie} tv={undefined} />

                      {/* Additional Media Info */}
                      {(movie.budget || movie.revenue || movie.runtime) && (
                        <Card className="bg-gradient-to-br from-slate-900 to-slate-950">
                          <CardContent className="p-4 space-y-3">
                            {movie.budget > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Budget</span>
                                <span className="font-semibold">${(movie.budget / 1000000).toFixed(1)}M</span>
                              </div>
                            )}
                            {movie.revenue > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Revenue</span>
                                <span className="font-semibold text-green-400">${(movie.revenue / 1000000).toFixed(1)}M</span>
                              </div>
                            )}
                            {movie.runtime && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Duration</span>
                                <span className="font-semibold">{movie.runtime} min</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                  {/* User Rating - avec persistance */}
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-2">Votre note CStream pour {movie?.title}?</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className="p-1 hover:scale-110 transition-transform"
                          onClick={() => {
                            setNewRating(star);
                            const key = `cstream_rating_${id}`;
                            localStorage.setItem(key, star.toString());
                            toast.success(`Vous avez noté ${star}/5 étoiles - Sauvegardé`);
                          }}
                        >
                          <Star className={`w-6 h-6 transition-colors ${newRating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleFavorite}
                      className={`gap-2 rounded-full border-white/20 hover:border-white/40 ${isFavorite ? 'bg-red-500/20 border-red-500/50' : ''}`}
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      Favorite
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleFavorite}
                      className={`gap-2 rounded-full border-white/20 hover:border-white/40 ${isFavorite ? 'bg-primary/20 border-primary/50' : ''}`}
                    >
                      <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                      Watchlist
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className="gap-2 rounded-full border-white/20 hover:border-white/40"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                  {/* Overview */}
                  <div className="pt-3">
                    <h3 className="text-base font-semibold mb-2 text-white/90">Synopsis</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm line-clamp-6">
                      {parseHTML(movie.overview)}
                    </p>
                  </div>
                </motion.div>
                {/* Colonne droite - Cast & Credits sidebar */}
                <motion.aside
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-3 hidden lg:block"
                >
                  <div className="sticky top-24 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Casts & Credits</h3>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                      {castList.slice(0, 6).map((actor) => (
                        <Link
                          key={actor.id}
                          to={`/person/${actor.id}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                          {/* Photo circulaire */}
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary/50 flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                            {actor.profile_path ? (
                              <img
                                src={tmdbApi.getImageUrl(actor.profile_path, 'w200')}
                                alt={actor.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-white group-hover:text-primary transition-colors truncate">
                              {actor.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {actor.character}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>

                    {castList.length > 6 && (
                      <button
                        onClick={() => {
                          const castSection = document.getElementById('cast-section');
                          castSection?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        Show All
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                    {/* Stats rapides */}
                    <div className="pt-4 border-t border-white/10 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <ThumbsUp className="w-4 h-4" /> Likes
                        </span>
                        <span className="font-medium">{likes.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Eye className="w-4 h-4" /> Views
                        </span>
                        <span className="font-medium">{views.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> Reviews
                        </span>
                        <span className="font-medium">{reviews.length}</span>
                      </div>
                    </div>
                  </div>
                </motion.aside>
              </div>
            </div>
          </section>
          {/* Distribution */}
          {castList.length > 0 && (
            <section id="cast-section" className="py-12">
              <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold mb-6">Distribution</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {castList.map((person) => (
                    <Link key={person.id} to={`/person/${person.id}`} className="group">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-2">
                        {person.profile_path ? (
                          <img
                            src={tmdbApi.getImageUrl(person.profile_path, 'w300')}
                            alt={person.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <User className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">
                        {person.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{person.character}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
          {/* Production Companies */}
          {movie.production_companies && movie.production_companies.length > 0 && (
            <section className="py-12 bg-secondary/20">
              <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Layers className="w-6 h-6" />
                  Production
                </h2>
                <div className="flex flex-wrap gap-6">
                  {movie.production_companies.map((company) => (
                    <div key={company.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-4">
                      {company.logo_path ? (
                        <img
                          src={tmdbApi.getImageUrl(company.logo_path, 'w200')}
                          alt={company.name}
                          className="h-8 w-auto object-contain bg-white rounded p-1"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Film className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="text-sm font-medium">{company.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {/* Image Gallery */}
          {movie.images && ((movie.images.backdrops && movie.images.backdrops.length > 0) || (movie.images.posters && movie.images.posters.length > 0)) && (
            <section className="py-12">
              <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6" />
                  Galerie
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {movie.images.backdrops?.slice(0, 4).map((img, index) => (
                    <div key={`backdrop-${index}`} className="aspect-video rounded-xl overflow-hidden border border-white/10 shadow-lg bg-secondary/30">
                      <PosterOverlay
                        posterPath={img.file_path}
                        title={`Backdrop ${index + 1}`}
                        mediaType="movie"
                      />
                    </div>
                  ))}
                  {movie.images.posters?.slice(0, 4).map((img, index) => (
                    <div key={`poster-${index}`} className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-lg max-w-[200px] mx-auto bg-secondary/30">
                      <PosterOverlay
                        posterPath={img.file_path}
                        title={`Poster ${index + 1}`}
                        mediaType="movie"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {/* Collection - Design amélioré avec liste numérotée */}
          {movie.belongs_to_collection && (
            <section className="py-12">
              <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold mb-6">{movie.belongs_to_collection.name}</h2>
                <CollectionDisplay collectionId={movie.belongs_to_collection.id} currentMovieId={movie.id} />
              </div>
            </section>
          )}
          {/* Recommandations */}
          {movie.recommendations?.results && movie.recommendations.results.length > 0 && (
            <section className="py-12 bg-secondary/30">
              <div className="container mx-auto px-4">
                <h2 className="text-2xl font-bold mb-6">Recommandations</h2>
                <MediaGrid
                  items={movie.recommendations.results.slice(0, 12)}
                  mediaType="movie"
                />
              </div>
            </section>
          )}
          {/* Section Reviews */}
          <section id="reviews" className="py-12 relative z-10">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-primary" />
                Avis Utilisateurs
              </h2>
              <ReviewsSection mediaType="movie" mediaId={id!} />
            </div>
          </section>
          {/* Modal Sources - AMÉLIORÉ avec filtrage strict par tmdb_id */}
          <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b border-border/50 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="truncate">Sources disponibles</span>
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-4">
                {sourcesLoading ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-muted-foreground">Recherche des sources...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vérification des lecteurs compatibles avec ce film
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 pb-3 border-b border-border/50">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lecteurs universels</p>
                      <button
                        onClick={() => {
                          setSourcesOpen(false);
                          setIsWatching(true);
                          setVideoLoading(true);
                          toast.success('Lecture lancée - Lecteur universel (11 sources)');
                          setTimeout(() => setVideoLoading(false), 1000);
                        }}
                        className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-green-500/10 hover:from-purple-500/20 hover:to-green-500/20 border border-purple-500/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-green-500 flex items-center justify-center flex-shrink-0">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white">Lecteur Universel</p>
                            <p className="text-xs text-muted-foreground">11 sources - VidFast, VidKing, SuperEmbed...</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-primary/50 text-primary flex-shrink-0">Recommandé</Badge>
                      </button>
                    </div>
                    {candidates.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Autres sources ({candidates.length})</p>
                        <div className="grid gap-3">
                          {candidates.map((r, index) => (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg p-3 sm:p-4 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm sm:text-base">{r.label}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {r.language}
                                  </Badge>
                                  {(r as any).source_type === 'local' ? (
                                    <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border border-yellow-500/30">
                                      <Zap className="w-3 h-3 mr-1" /> LOCAL
                                    </Badge>
                                  ) : (
                                    <Badge className="text-xs bg-blue-500/20 text-blue-600 border border-blue-500/30">
                                      Synchronisée
                                    </Badge>
                                  )}
                                  {r.tmdb_id === movie.id && (
                                    <Badge variant="default" className="text-xs">
                                      Spécifique
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {r.url}
                                </div>
                              </div>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleChooseAndWatch(r)}
                                className="gap-2 w-full sm:w-auto min-h-[44px]"
                              >
                                <Play className="w-4 h-4" />
                                Regarder
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 p-4 sm:p-6 pt-3 border-t border-border/50 bg-background flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setSourcesOpen(false)}
                  className="w-full min-h-[44px]"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Share Widget - Christmas */}
          {/* Trailer Modal */}
          <TrailerModal
            open={trailerOpen}
            onOpenChange={setTrailerOpen}
            trailerKey={trailer?.key || null}
            title={`${movie.title} - Bande-annonce`}
          />
        </>
      )}
    </div>
  );
};
export default MovieDetail;