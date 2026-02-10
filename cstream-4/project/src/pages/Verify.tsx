import { toast } from "sonner";
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Zap, Shield, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Vérification en cours...');
  const [discordData, setDiscordData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAuthSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch profile to check if already verified
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if ((profile as any)?.verified || (profile as any)?.is_verified || session.user.app_metadata?.provider === 'discord') {
            setStatus('success');
            return;
          }

          const userData = {
            discordUsername: session.user.user_metadata?.name || session.user.email || 'User',
            email: session.user.email,
            discordId: session.user.id,
            avatar: session.user.user_metadata?.avatar_url,
          };

          setDiscordData(userData);
          setStatus('ready');
        } else {
          setStatus('ready');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setStatus('ready');
      }
    };

    checkAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Automatically verify on sign in/up
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            verified: true,
            is_verified: true, // Supporting both legacy and new column
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', session.user.id);

        if (updateError) {
          console.error('Error updating verification status:', updateError);
          // Try upsert if update fails
          await supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              verified: true,
              is_verified: true,
              updated_at: new Date().toISOString()
            } as any);
        }

        setStatus('success');
        const timer = setTimeout(() => navigate('/profile'), 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription?.unsubscribe();
  }, [navigate, location]);

  const handleManualVerify = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate('/auth');
        return;
      }

      const CREATOR_EMAILS = ['chemsdine.kachid@gmail.com', 'laylamayacoub@gmail.com'];
      const isCreator = session.user.email && CREATOR_EMAILS.includes(session.user.email);

      const { error } = await supabase
        .from('profiles')
        .update({
          verified: true,
          is_verified: true,
          updated_at: new Date().toISOString(),
          ...(isCreator ? {
            role: 'creator',
            level: 'Creator',
            premium: true,
            all_badges: true
          } : {})
        } as any)
        .eq('id', session.user.id);

      if (error) throw error;

      setStatus('success');
      setTimeout(() => navigate('/profile'), 2000);
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error("Erreur lors de la vérification");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginWithDiscord = async () => {
    try {
      setIsLoading(true);
      setStatus('verifying');
      setMessage('Redirection vers Discord...');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/verify`,
          scopes: 'identify email',
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('Discord login error:', error);
      setStatus('error');
      setMessage(error.message || 'Erreur lors de la connexion Discord');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10 flex flex-col">
      <nav className="p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold tracking-tighter text-sm uppercase">CSTREAM</span>
          </div>
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest"
          >
            Retour
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-[#0A0A0A] border border-white/[0.03] rounded-[2rem] p-8 md:p-10 shadow-2xl">
            <div className="text-center mb-10">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-6">
                <Shield className="w-5 h-5 text-zinc-500" strokeWidth={1.5} />
              </div>
              <h1 className="text-lg font-bold mb-1">Certification</h1>
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-medium">Identity Verification</p>
            </div>

            <AnimatePresence mode="wait">
              {status === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center py-4"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                </motion.div>
              )}

              {status === 'ready' && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <Button
                    onClick={handleManualVerify}
                    disabled={isLoading}
                    className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl shadow-white/5"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier mon compte"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <div className="relative flex justify-center text-[8px] uppercase tracking-widest text-zinc-700 font-bold bg-[#0A0A0A] px-2">ou</div>
                  </div>

                  <Button
                    onClick={handleLoginWithDiscord}
                    variant="outline"
                    className="w-full h-12 bg-white/5 border-white/10 text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-white/10"
                  >
                    Vérifier avec Discord
                  </Button>

                  <p className="text-[9px] text-zinc-700 text-center uppercase tracking-widest leading-relaxed font-medium">
                    Obtenez le badge de certification officiel <br /> pour votre profil CStream.
                  </p>
                </motion.div>
              )}

              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/5 border border-blue-500/10 flex items-center justify-center mb-6">
                      <Check className="w-6 h-6 text-blue-500" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-sm font-bold mb-2">Compte Certifié</h2>
                    <p className="text-zinc-600 text-[10px] uppercase tracking-wider font-medium max-w-[200px] mx-auto leading-relaxed">
                      Badge actif sur votre profil
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate('/profile')}
                    className="w-full h-12 bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] text-white font-bold text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all"
                  >
                    Voir mon Profil
                  </Button>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 text-center"
                >
                  <AlertCircle className="w-10 h-10 text-red-900 mx-auto opacity-50" />
                  <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold">{message}</p>
                  <Button
                    onClick={() => setStatus('ready')}
                    className="w-full h-12 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest"
                  >
                    Réessayer
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}