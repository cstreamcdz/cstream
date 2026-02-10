
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Résultat : ${outcome}`);
            setDeferredPrompt(null);
            setShowInstallBtn(false);
        }
    };

    if (!showInstallBtn) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
            >
                <Button
                    onClick={handleInstallClick}
                    className="h-12 px-8 rounded-full shadow-2xl bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-all duration-300 font-bold text-base gap-3 ring-2 ring-white/20"
                >
                    <Download className="w-5 h-5 animate-bounce" />
                    Installer l'Application
                </Button>
            </motion.div>
        </AnimatePresence>
    );
}
