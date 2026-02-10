import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Film, Tv, Star, TrendingUp, Activity, Eye, Clock,
  BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Loader2,
  Calendar, Globe, Heart, Bookmark, MessageCircle, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  totalMedia: number;
  movieSources: number;
  tvSources: number;
  animeSources: number;
  totalFavorites: number;
  totalWatchlist: number;
  totalHistory: number;
  totalMessages: number;
  pendingMessages: number;
  onlineUsers: number;
}

interface UserActivity {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  last_seen: string;
  created_at: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = 'primary'
}: {
  title: string;
  value: number | string;
  icon: any;
  description?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
}) => {
  const colorClasses: Record<string, string> = {
    primary: 'from-primary/20 to-accent/20 border-primary/20 text-primary',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/20 text-green-500',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20 text-blue-500',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/20 text-purple-500',
    orange: 'from-orange-500/20 to-amber-500/20 border-orange-500/20 text-orange-500',
    red: 'from-red-500/20 to-rose-500/20 border-red-500/20 text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`bg-gradient-to-br ${colorClasses[color]} border overflow-hidden relative`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="pt-6 relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{value}</p>
                {trend && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-green-500' : 'text-red-500'}`}>
                    {trend.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend.value}%
                  </div>
                )}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <div className={`p-3 rounded-xl bg-background/50 backdrop-blur-sm ${colorClasses[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ActivityItem = ({ user }: { user: UserActivity }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'dnd': return 'bg-orange-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <div className="relative">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
            {user.username?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${getStatusColor(user.status)}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.username}</p>
        <p className="text-xs text-muted-foreground">{formatTime(user.last_seen || user.created_at)}</p>
      </div>
      <Badge variant="outline" className="text-xs">
        {user.status === 'online' ? 'En ligne' : user.status === 'dnd' ? 'Occupé' : 'Hors ligne'}
      </Badge>
    </div>
  );
};

export const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    newUsersWeek: 0,
    totalMedia: 0,
    movieSources: 0,
    tvSources: 0,
    animeSources: 0,
    totalFavorites: 0,
    totalWatchlist: 0,
    totalHistory: 0,
    totalMessages: 0,
    pendingMessages: 0,
    onlineUsers: 0,
  });
  const [recentUsers, setRecentUsers] = useState<UserActivity[]>([]);

  const fetchAnalytics = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const safeQuery = async (queryPromise: PromiseLike<any>, fallback: any = { data: [], count: 0 }) => {
        try {
          const result = await queryPromise;
          if (result.error) return fallback;
          return result;
        } catch {
          return fallback;
        }
      };

      const [
        profilesResult,
        readersResult,
        favoritesResult,
        watchlistResult,
        historyResult,
        messagesResult,
      ] = await Promise.all([
        safeQuery(supabase.from('profiles').select('id, username, avatar_url, status, created_at', { count: 'exact' })),
        safeQuery(supabase.from('readers').select('id, media_type', { count: 'exact' })),
        safeQuery(supabase.from('favorites').select('id', { count: 'exact' })),
        safeQuery(supabase.from('watchlist').select('id', { count: 'exact' })),
        safeQuery(supabase.from('history').select('id', { count: 'exact' })),
        safeQuery(supabase.from('contact_messages').select('id, status', { count: 'exact' })),
      ]);

      const profiles = profilesResult.data || [];
      const readers = readersResult.data || [];
      const messages = messagesResult.data || [];

      const newUsersToday = profiles.filter((p: any) => new Date(p.created_at) >= today).length;
      const newUsersWeek = profiles.filter((p: any) => new Date(p.created_at) >= weekAgo).length;
      const activeUsers = profiles.filter((p: any) => p.status === 'online').length;

      const movieSources = readers.filter((r: any) => r.media_type === 'movie').length;
      const tvSources = readers.filter((r: any) => r.media_type === 'tv' || r.media_type === 'series').length;
      const animeSources = readers.filter((r: any) => r.media_type === 'anime').length;

      setAnalytics({
        totalUsers: profilesResult.count || profiles.length,
        activeUsers,
        newUsersToday,
        newUsersWeek,
        totalMedia: readersResult.count || readers.length,
        movieSources,
        tvSources,
        animeSources,
        totalFavorites: favoritesResult.count || 0,
        totalWatchlist: watchlistResult.count || 0,
        totalHistory: historyResult.count || 0,
        totalMessages: messagesResult.count || messages.length,
        pendingMessages: messages.filter((m: any) => m.status === 'pending').length,
        onlineUsers: activeUsers,
      });

      const recentProfiles = profiles
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          username: p.username || 'Utilisateur',
          avatar_url: p.avatar_url,
          status: p.status || 'offline',
          last_seen: p.created_at,
          created_at: p.created_at,
        }));

      setRecentUsers(recentProfiles);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Analytics en temps réel
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Suivez les performances de votre plateforme
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Utilisateurs totaux"
          value={analytics.totalUsers}
          icon={Users}
          description={`+${analytics.newUsersWeek} cette semaine`}
          trend={{ value: Math.round((analytics.newUsersWeek / Math.max(analytics.totalUsers, 1)) * 100), positive: true }}
          color="primary"
        />
        <StatCard
          title="Utilisateurs en ligne"
          value={analytics.onlineUsers}
          icon={Activity}
          description="Actifs maintenant"
          color="green"
        />
        <StatCard
          title="Nouveaux aujourd'hui"
          value={analytics.newUsersToday}
          icon={TrendingUp}
          description="Inscriptions du jour"
          color="blue"
        />
        <StatCard
          title="Messages en attente"
          value={analytics.pendingMessages}
          icon={MessageCircle}
          description={`${analytics.totalMessages} total`}
          color={analytics.pendingMessages > 0 ? 'orange' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" />
              Répartition des médias
            </CardTitle>
            <CardDescription>Sources par type de contenu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Films', value: analytics.movieSources, color: '#3b82f6' },
                        { name: 'Séries', value: analytics.tvSources, color: '#a855f7' },
                        { name: 'Anime', value: analytics.animeSources, color: '#ec4899' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Films', value: analytics.movieSources, color: '#3b82f6' },
                        { name: 'Séries', value: analytics.tvSources, color: '#a855f7' },
                        { name: 'Anime', value: analytics.animeSources, color: '#ec4899' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      formatter={(value) => <span className="text-sm font-medium">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
                >
                  <Film className="w-8 h-8 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Films</p>
                    <p className="text-xl font-bold text-blue-500">{analytics.movieSources}</p>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-500 border-0">
                    {Math.round((analytics.movieSources / Math.max(analytics.totalMedia, 1)) * 100)}%
                  </Badge>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                >
                  <Tv className="w-8 h-8 text-purple-500" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Séries</p>
                    <p className="text-xl font-bold text-purple-500">{analytics.tvSources}</p>
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-500 border-0">
                    {Math.round((analytics.tvSources / Math.max(analytics.totalMedia, 1)) * 100)}%
                  </Badge>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20"
                >
                  <Star className="w-8 h-8 text-pink-500" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Anime</p>
                    <p className="text-xl font-bold text-pink-500">{analytics.animeSources}</p>
                  </div>
                  <Badge className="bg-pink-500/20 text-pink-500 border-0">
                    {Math.round((analytics.animeSources / Math.max(analytics.totalMedia, 1)) * 100)}%
                  </Badge>
                </motion.div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50">
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Engagement utilisateurs
              </h4>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Favoris', value: analytics.totalFavorites, fill: '#ef4444' },
                      { name: 'Watchlist', value: analytics.totalWatchlist, fill: '#8b5cf6' },
                      { name: 'Historique', value: analytics.totalHistory, fill: '#22c55e' },
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {[
                        { name: 'Favoris', value: analytics.totalFavorites, fill: '#ef4444' },
                        { name: 'Watchlist', value: analytics.totalWatchlist, fill: '#8b5cf6' },
                        { name: 'Historique', value: analytics.totalHistory, fill: '#22c55e' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Activité récente
            </CardTitle>
            <CardDescription>Derniers utilisateurs inscrits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {recentUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              recentUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ActivityItem user={user} />
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Résumé global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <p className="text-2xl font-bold">{analytics.totalMedia}</p>
              <p className="text-xs text-muted-foreground mt-1">Sources totales</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <p className="text-2xl font-bold">{analytics.totalUsers}</p>
              <p className="text-xs text-muted-foreground mt-1">Utilisateurs</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <p className="text-2xl font-bold">{analytics.onlineUsers}</p>
              <p className="text-xs text-muted-foreground mt-1">En ligne</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20">
              <p className="text-2xl font-bold">{analytics.totalFavorites}</p>
              <p className="text-xs text-muted-foreground mt-1">Favoris</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <p className="text-2xl font-bold">{analytics.totalHistory}</p>
              <p className="text-xs text-muted-foreground mt-1">Vues</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
              <p className="text-2xl font-bold">{analytics.totalMessages}</p>
              <p className="text-xs text-muted-foreground mt-1">Messages</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsTab;
