'use client';

import { useFontSizeContext, type EasyModeFontSize } from '@/contexts/FontSizeContext';

export default function FontSizeControl() {
  const { fontSize, fontSizeLabel, options, setFontSize } = useFontSizeContext();

  return (
    <label className="easy-mode-header-button easy-mode-select-wrapper">
      <span className="easy-mode-select-label">文字サイズ: {fontSizeLabel}</span>
      <select
        aria-label="文字サイズ"
        className="easy-mode-select"
        value={fontSize}
        onChange={(event) => setFontSize(event.target.value as EasyModeFontSize)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="easy-mode-select-arrow" aria-hidden="true">
        ▼
      </span>
    </label>
  );
}
