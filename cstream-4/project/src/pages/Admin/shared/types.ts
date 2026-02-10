export type MediaType = 'movie' | 'tv' | 'anime';

export interface Reader {
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

export type UserStatus = 'online' | 'offline' | 'dnd' | 'away';

export interface UserData {
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
}

export interface TMDBResult {
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

export interface TMDBSeason {
  season_number: number;
  name?: string;
  episode_count?: number;
}

export interface ContactMessage {
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

export interface ParsedArray {
  arrayName: string;
  readerName: string;
  urls: string[];
}

export interface AdminStats {
  totalReaders: number;
  readersEnabled: number;
  readersDisabled: number;
  readersWithTmdb: number;
  readersWithoutTmdb: number;
  totalUsers: number;
  adminUsers: number;
  onlineUsers: number;
  movieReaders: number;
  seriesReaders: number;
  animeReaders: number;
  frenchReaders: number;
  englishReaders: number;
  totalMessages: number;
  pendingMessages: number;
  readMessages: number;
}

export interface GroupedReader {
  tmdb_id: number;
  media_type: string;
  language: string;
  baseName: string;
  readers: Reader[];
  tmdbInfo?: TMDBResult | null;
}
