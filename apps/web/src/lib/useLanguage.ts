'use client';

import { useEffect, useState } from 'react';
import type { Language } from './i18n';

const STORAGE_KEY = 'qr_lang';

export function useLanguage(): { lang: Language; setLang: (lang: Language) => void } {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as Language | null)) || null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return { lang, setLang };
}
