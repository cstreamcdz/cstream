export interface Theme {
  id: string;
  name: string;
  label: string;
  isDark: boolean;
  description: string;
  colors: {
    primary: string;
    background: string;
    text?: string;
    cardBg?: string;
    borderColor?: string;
    bgGradient?: string;
    accent?: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'premium-violet',
    name: 'Violet Luxe',
    label: 'Améthyste',
    isDark: true,
    description: 'Violet profond satiné',
    colors: {
      primary: '#C084FC',
      background: '#020004',
      text: '#FAF5FF',
      cardBg: 'rgba(192, 132, 252, 0.02)',
      borderColor: 'rgba(192, 132, 252, 0.12)',
      bgGradient: 'radial-gradient(circle at 50% -20%, #1E0033 0%, #020004 100%)',
      accent: '#E879F9',
    },
  },
  {
    id: 'premium-gold',
    name: 'Elite Gold',
    label: 'Elite Or',
    isDark: true,
    description: 'Luxe ultime et finitions dorées',
    colors: {
      primary: '#FFD700',
      background: '#050401',
      text: '#FFFBE6',
      cardBg: 'rgba(255, 215, 0, 0.04)',
      borderColor: 'rgba(255, 215, 0, 0.25)',
      bgGradient: 'radial-gradient(circle at top, #1A1500 0%, #050401 100%)',
      accent: '#FDB931',
    },
  },
  {
    id: 'gray',
    name: 'Gray',
    label: 'Gris',
    isDark: true,
    description: 'Gris ardoise sophistiqué',
    colors: {
      primary: '#94A3B8',
      background: '#0F172A',
      text: '#F1F5F9',
      cardBg: 'rgba(148, 163, 184, 0.08)',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      bgGradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      accent: '#64748B',
    },
  },
  {
    id: 'blue',
    name: 'Blue',
    label: 'Bleu',
    isDark: true,
    description: 'Bleu océanique profond',
    colors: {
      primary: '#3B82F6',
      background: '#020617',
      text: '#EFF6FF',
      cardBg: 'rgba(59, 130, 246, 0.05)',
      borderColor: 'rgba(59, 130, 246, 0.2)',
      bgGradient: 'linear-gradient(135deg, #020617 0%, #1E3A8A 100%)',
      accent: '#60A5FA',
    },
  },
  {
    id: 'red',
    name: 'Red',
    label: 'Rouge',
    isDark: true,
    description: 'Rouge intense et énergique',
    colors: {
      primary: '#EF4444',
      background: '#050000',
      text: '#FEF2F2',
      cardBg: 'rgba(239, 68, 68, 0.05)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
      bgGradient: 'linear-gradient(135deg, #050000 0%, #7F1D1D 100%)',
      accent: '#F87171',
    },
  },
  {
    id: 'premium-verified',
    name: 'Verified Elite',
    label: 'Vérifié',
    isDark: true,
    description: 'Design exclusif holographique',
    colors: {
      primary: '#00F2FF',
      background: '#010409',
      text: '#F0F6FC',
      cardBg: 'rgba(0, 242, 255, 0.05)',
      borderColor: 'rgba(0, 242, 255, 0.3)',
      bgGradient: 'radial-gradient(circle at 80% 20%, #001524 0%, #010409 100%)',
      accent: '#7C3AED',
    },
  },
  {
    id: 'light-violet',
    name: 'Violet Clair',
    label: 'Lumière',
    isDark: false,
    description: 'Clarté violette élégante',
    colors: {
      primary: '#7C3AED',
      background: '#F8F7FF',
      text: '#1E1B4B',
      cardBg: 'rgba(124, 58, 237, 0.04)',
      borderColor: 'rgba(124, 58, 237, 0.1)',
      bgGradient: 'linear-gradient(135deg, #F8F7FF 0%, #F1F0FB 100%)',
      accent: '#C084FC',
    },
  }
];

export const DEFAULT_THEME = 'premium-violet';

export const getThemeById = (id: string): Theme | undefined => {
  return THEMES.find((t) => t.id === id);
};

export const applyTheme = (themeId: string) => {
  const theme = getThemeById(themeId) || getThemeById(DEFAULT_THEME);
  if (!theme) return;

  const root = document.documentElement;

  // Set core theme variables
  root.style.setProperty('--primary-hex', theme.colors.primary);
  root.style.setProperty('--background-hex', theme.colors.background);
  root.style.setProperty('--text-color', theme.colors.text || (theme.isDark ? '#f5f5f5' : '#1a1a1a'));
  root.style.setProperty('--card-bg', theme.colors.cardBg || (theme.isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'));
  root.style.setProperty('--border-color', theme.colors.borderColor || (theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'));
  root.style.setProperty('--bg-gradient', theme.colors.bgGradient || `linear-gradient(135deg, ${theme.colors.background}, ${theme.isDark ? '#1a1a2e' : '#ffffff'})`);
  root.style.setProperty('--accent-color', theme.colors.accent || theme.colors.primary);
  root.style.setProperty('--theme-text', theme.colors.text || (theme.isDark ? '#f5f5f5' : '#1a1a1a'));
  root.style.setProperty('--theme-border', theme.colors.borderColor || (theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'));

  // Sync Shadcn HSL variables
  const primaryRgb = hexToRgb(theme.colors.primary);
  if (primaryRgb) {
    const h = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    root.style.setProperty('--primary', `${h.h} ${h.s}% ${h.l}%`);
    root.style.setProperty('--ring', `${h.h} ${h.s}% ${h.l}%`);
    root.style.setProperty('--theme-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
  }

  const bgRgb = hexToRgb(theme.colors.background);
  if (bgRgb) {
    const h = rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b);
    root.style.setProperty('--background', `${h.h} ${h.s}% ${h.l}%`);

    if (theme.isDark) {
      const cardL = Math.max(h.l + 3, 7);
      root.style.setProperty('--card', `${h.h} ${h.s}% ${cardL}%`);
      root.style.setProperty('--popover', `${h.h} ${h.s}% ${cardL}%`);
      root.style.setProperty('--muted', `${h.h} ${h.s}% ${Math.max(h.l + 5, 12)}%`);
      root.style.setProperty('--secondary', `${h.h} ${h.s}% ${Math.max(h.l + 4, 10)}%`);
      root.style.setProperty('--border', `${h.h} ${h.s}% ${Math.max(h.l + 6, 15)}%`);
      root.style.setProperty('--foreground', '0 0% 98%');
      root.style.setProperty('--card-foreground', '0 0% 98%');
      root.style.setProperty('--popover-foreground', '0 0% 98%');
      root.style.setProperty('--muted-foreground', '240 5% 70%');
    } else {
      const cardL = Math.max(h.l - 5, 95);
      root.style.setProperty('--card', `${h.h} ${h.s}% ${cardL}%`);
      root.style.setProperty('--popover', `${h.h} ${h.s}% ${cardL}%`);
      root.style.setProperty('--muted', `${h.h} ${h.s}% ${Math.max(h.l - 8, 90)}%`);
      root.style.setProperty('--secondary', `${h.h} ${h.s}% ${Math.max(h.l - 6, 92)}%`);
      root.style.setProperty('--border', `${h.h} ${h.s}% ${Math.max(h.l - 10, 85)}%`);
      root.style.setProperty('--foreground', '240 10% 4%');
      root.style.setProperty('--card-foreground', '240 10% 4%');
      root.style.setProperty('--popover-foreground', '240 10% 4%');
      root.style.setProperty('--muted-foreground', '240 3.8% 46.1%');
    }
  }

  localStorage.setItem('cstream_active_theme', theme.id);
  console.log('[ThemeEngine] Applied:', theme.id);
};

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export const initializeTheme = () => {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem('cstream_active_theme') || DEFAULT_THEME;
  applyTheme(saved);
};
