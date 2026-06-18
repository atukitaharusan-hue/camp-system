'use client';

import { createContext, useContext, useMemo, useState } from 'react';

export type EasyModeFontSize = 'small' | 'medium' | 'large' | 'xlarge';

const STORAGE_KEY = 'easy-mode-font-size';

const FONT_SIZE_CONFIG: Record<EasyModeFontSize, { label: string; pixels: number }> = {
  small: { label: '小', pixels: 20 },
  medium: { label: '中', pixels: 24 },
  large: { label: '大', pixels: 30 },
  xlarge: { label: '特大', pixels: 38 },
};

type FontSizeContextValue = {
  fontSize: EasyModeFontSize;
  fontSizeLabel: string;
  fontSizePixels: number;
  setFontSize: (fontSize: EasyModeFontSize) => void;
  options: Array<{ value: EasyModeFontSize; label: string }>;
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<EasyModeFontSize>(() => {
    if (typeof window === 'undefined') return 'large';

    const savedFontSize = window.localStorage.getItem(STORAGE_KEY);
    if (savedFontSize && savedFontSize in FONT_SIZE_CONFIG) {
      return savedFontSize as EasyModeFontSize;
    }

    return 'large';
  });

  const setFontSize = (nextFontSize: EasyModeFontSize) => {
    setFontSizeState(nextFontSize);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextFontSize);
    }
  };

  const value = useMemo<FontSizeContextValue>(
    () => ({
      fontSize,
      fontSizeLabel: FONT_SIZE_CONFIG[fontSize].label,
      fontSizePixels: FONT_SIZE_CONFIG[fontSize].pixels,
      setFontSize,
      options: Object.entries(FONT_SIZE_CONFIG).map(([value, config]) => ({
        value: value as EasyModeFontSize,
        label: config.label,
      })),
    }),
    [fontSize],
  );

  return <FontSizeContext.Provider value={value}>{children}</FontSizeContext.Provider>;
}

export function useFontSizeContext() {
  const context = useContext(FontSizeContext);

  if (!context) {
    throw new Error('useFontSizeContext must be used within FontSizeProvider');
  }

  return context;
}
