'use client';

import type { TouchEvent } from 'react';

export type EasyModeCategory = {
  id: string;
  name: string;
  icon: string;
};

type CategoryTabsProps = {
  categories: EasyModeCategory[];
  activeCategoryId: string;
  onSelect: (categoryId: string) => void;
  onTouchStart?: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (event: TouchEvent<HTMLDivElement>) => void;
};

export default function CategoryTabs({
  categories,
  activeCategoryId,
  onSelect,
  onTouchStart,
  onTouchEnd,
}: CategoryTabsProps) {
  return (
    <div
      className="easy-mode-tabs-scroll"
      role="tablist"
      aria-label="かんたんモードのカテゴリ"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {categories.map((category) => {
        const isActive = category.id === activeCategoryId;

        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`easy-mode-category-panel-${category.id}`}
            className={`easy-mode-tab ${isActive ? 'easy-mode-tab-active' : ''}`}
            onClick={() => onSelect(category.id)}
          >
            <span className="easy-mode-tab-icon" aria-hidden="true">
              {category.icon}
            </span>
            <span className="easy-mode-tab-text">{category.name}</span>
          </button>
        );
      })}
    </div>
  );
}
