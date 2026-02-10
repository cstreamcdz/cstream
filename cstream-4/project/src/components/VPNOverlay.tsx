import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ExternalLink, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export const VPNOverlay = () => {
    const { language } = useI18n();
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Check if user is in France using timezone
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const isFrance = timezone === 'Europe/Paris';
        const isFrench = language === 'fr';

        if (isFrance && isFrench) {
            const dismissed = localStorage.getItem('vpn-warning-dismissed');
            if (!dismissed) {
                setShow(true);
            }
        }
    }, [language]);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('vpn-warning-dismissed', 'true');
    };

    const vpnName = "NordVPN";
    const vpnLink = "https://nordvpn.com/fr/risk-free-vpn/";
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(vpnLink).hostname}&sz=32`;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100]"
                >
                    <div className="bg-[#1a1b26]/95 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />

                        <button
                            onClick={handleDismiss}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-red-500/10 text-red-500 shrink-0 animate-pulse">
                                <ShieldAlert className="w-6 h-6" />
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-bold text-white text-base mb-1">Protection Recommandée</h3>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Le streaming peut être surveillé en France. Utilisez un VPN pour masquer votre activité.
                                    </p>
                                </div>

                                <a
                                    href={vpnLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white p-1 pr-4 rounded-xl transition-all group shadow-lg shadow-blue-900/20 border border-blue-400/20"
                                >
                                    <div className="bg-white p-1.5 rounded-lg shrink-0">
                                        <img src={faviconUrl} alt={vpnName} className="w-5 h-5 object-contain" />
                                    </div>
                                    <span className="text-sm font-bold flex-1 text-center">Utiliser {vpnName}</span>
                                    <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </a>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
