
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  MessageSquare,
  Send,
  User,
  Loader2,
  ThumbsUp,
  Bold,
  Italic,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Review {
  id: string;
  user_id: string;
  username: string;
  profile_url?: string | null;
  comment: string;
  rating: number;
  created_at: string;
  media_id: string;
  badge?: string | null;
}

interface ReviewsSectionProps {
  mediaType: "movie" | "tv";
  mediaId: string | number;
  className?: string;
}

const StarRating = ({
  rating,
  interactive = false,
  onChange,
  size = "md",
}: {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => interactive && onChange?.(star)}
          className={cn(
            "transition-all duration-300",
            interactive &&
            "focus:outline-none group cursor-pointer hover:scale-110",
          )}
          type="button"
          disabled={!interactive}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= rating
                ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                : interactive
                  ? "text-white/20 group-hover:text-yellow-400/50"
                  : "text-white/10",
            )}
          />
        </button>
      ))}
    </div>
  );
};

const ReviewStatsCard = ({ reviews }: { reviews: Review[] }) => {
  const averageRating = useMemo(
    () =>
      reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0,
    [reviews],
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
        <div className="text-2xl font-bold text-white mb-1">{reviews.length}</div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider">Avis total</div>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
        <div className="text-2xl font-bold text-yellow-400 mb-1">
          {averageRating}
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider">Note moyenne</div>
      </div>
    </div>
  );
};

export const ReviewsSection = ({
  mediaType,
  mediaId,
  className = "",
}: ReviewsSectionProps) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const mediaIdStr = `${mediaType}_${mediaId}`;

  useEffect(() => {
    const fetchReviews = async () => {
      if (!mediaId) return;
      setReviewsLoading(true);
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("id, user_id, username, profile_url, comment, rating, created_at, media_id, badge")
          .eq("media_id", mediaIdStr)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReviews(data ? (data as unknown as Review[]) : []);
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [mediaId, mediaType, mediaIdStr]);

  const addReview = useCallback(async () => {
    if (!user) {
      toast.error("Veuillez vous connecter pour laisser un avis");
      return;
    }

    if (!newComment.trim()) {
      toast.error("Veuillez écrire un commentaire");
      return;
    }

    if (newComment.trim().length < 10) {
      toast.error("Votre commentaire doit contenir au moins 10 caractères");
      return;
    }

    setSubmittingReview(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("reviews")
        .insert({
          user_id: user.id,
          username: profile?.username || user.email?.split("@")[0] || "Utilisateur",
          profile_url: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
          comment: newComment.trim(),
          rating: newRating,
          media_id: mediaIdStr,
          badge: null,
        })
        .select("*")
        .single();

      if (error) throw error;

      const newReview: Review = {
        id: (data as any).id,
        user_id: user.id,
        username: (data as any).username,
        profile_url: (data as any).profile_url,
        comment: (data as any).comment,
        rating: (data as any).rating,
        created_at: (data as any).created_at,
        media_id: (data as any).media_id,
        badge: (data as any).badge,
      };

      setReviews((prev) => [newReview, ...prev]);
      setNewComment("");
      setNewRating(5);
      setShowCommentForm(false);
      toast.success("Avis publié avec succès !", {
        icon: "✨",
        description: "Merci pour votre contribution !",
      });
    } catch (error) {
      console.error("Error adding review:", error);
      toast.error("Erreur lors de la publication de votre avis");
    } finally {
      setSubmittingReview(false);
    }
  }, [user, newComment, newRating, mediaIdStr]);

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-8", className)}>

      {/* Input Box */}
      <div className="bg-white/5 border border-white/10 rounded-[27px] overflow-hidden backdrop-blur-sm shadow-xl p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <MessageSquare className="w-5 h-5 text-primary" />
          Laisser un commentaire
        </h3>

        {user ? (
          <div className="space-y-4">
            {/* Rating Select */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-400">Votre note :</span>
              <div className="flex items-center bg-zinc-900/50 rounded-full px-3 py-1 border border-white/5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewRating(star)}
                    className="p-1 hover:scale-110 transition-transform focus:outline-none"
                    type="button"
                  >
                    <Star
                      className={cn(
                        "w-5 h-5 transition-colors",
                        star <= newRating
                          ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
                          : "text-zinc-600 hover:text-yellow-400/50"
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm font-bold text-yellow-400">{newRating}/5</span>
              </div>
            </div>

            <div className="bg-background rounded-[21px] p-2 border border-white/5 focus-within:border-primary/50 transition-colors">
              <Textarea
                placeholder="Partagez votre avis sur ce film..."
                className="min-h-[80px] border-0 bg-transparent resize-none focus-visible:ring-0 px-3 py-2 text-[14px] text-zinc-200 placeholder:text-zinc-600"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />

              <div className="flex items-center justify-between mt-2 pl-2 pr-1 pb-1">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="w-[30px] h-[30px] rounded-full hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-[30px] h-[30px] rounded-full hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-[30px] h-[30px] rounded-full hover:bg-white/5 text-zinc-500 hover:text-zinc-300">
                    <Smile className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 px-4"
                  disabled={!newComment.trim() || submittingReview}
                  onClick={addReview}
                >
                  {submittingReview ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Publier
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-700">
            <p className="text-zinc-400 mb-3">Connectez-vous pour partager votre avis avec la communauté CStream.</p>
            <Button variant="outline" className="rounded-full border-primary text-primary hover:bg-primary/10">
              Se connecter
            </Button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {reviews.length > 0 && <ReviewStatsCard reviews={reviews} />}

      {/* Reviews List */}
      <div className="bg-white/5 border border-white/10 rounded-[27px] overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="h-[50px] flex items-center px-5 border-b border-white/5 relative bg-black/20">
          <span className="font-bold text-[13px] text-zinc-300 uppercase tracking-wider relative">
            Commentaires récents
            <span className="absolute -bottom-[17px] left-0 w-full h-[1px] bg-primary/50" />
          </span>
        </div>

        <div className="p-5 space-y-6 max-h-[800px] overflow-y-auto custom-scrollbar">
          {reviewsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center text-zinc-500 py-12 flex flex-col items-center">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
              <p>Aucun commentaire pour le moment.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="grid grid-cols-[35px_1fr] gap-5 group">
                {/* Like / React Column */}
                <div className="flex flex-col gap-2">
                  <div className="w-[35px] bg-white/5 rounded-md overflow-hidden flex flex-col items-center py-1 border border-white/5 group-hover:border-white/10 transition-colors">
                    <button className="w-[35px] h-[35px] flex items-center justify-center text-zinc-400 hover:text-pink-500 transition-colors relative group/like">
                      <div className="absolute inset-0 bg-pink-500/20 scale-0 rounded-full group-hover/like:scale-100 transition-transform duration-300" />
                      <ThumbsUp className="w-4 h-4 relative z-10" />
                    </button>
                    <div className="w-[80%] h-[1px] bg-white/10 my-1" />
                    <span className="text-[11px] font-bold text-zinc-500 h-[20px] flex items-center">
                      0
                    </span>
                  </div>
                </div>

                {/* Comment Content */}
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <Avatar className="w-10 h-10 border-2 border-white/10 shadow-lg">
                        <AvatarImage src={review.profile_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                          {review.username ? review.username.charAt(0).toUpperCase() : '?'}
                        </AvatarFallback>
                      </Avatar>
                      {review.badge && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center">
                          <span className="sr-only">{review.badge}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[14px] text-zinc-200 group-hover:text-primary transition-colors cursor-pointer">
                          {review.username}
                        </span>

                        <div className="flex items-center gap-0.5 ml-2 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-[10px] font-bold text-yellow-400">{review.rating}</span>
                        </div>
                      </div>
                      <p className="font-medium text-[11px] text-zinc-500 flex items-center gap-1.5">
                        {review.created_at ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: fr }) : ''}
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-900/30 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                    <p className="text-[14px] leading-relaxed font-medium text-zinc-300 whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
