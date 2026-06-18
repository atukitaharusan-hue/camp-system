'use client';

export type EasyModeFooterAction = string;

export type EasyModeFooterNavItem = {
  id: EasyModeFooterAction;
  label: string;
  icon: string;
  isDanger?: boolean;
};

type FooterNavProps = {
  items: EasyModeFooterNavItem[];
  activeAction: EasyModeFooterAction;
  onSelect: (action: EasyModeFooterAction) => void;
};

export default function FooterNav({ items, activeAction, onSelect }: FooterNavProps) {
  const handleSelect = (action: EasyModeFooterAction, isDanger?: boolean) => {
    if (isDanger) {
      const confirmed = window.confirm('キャンセルの画面へ移ります。よろしいですか。');
      if (!confirmed) return;
    }

    onSelect(action);
  };

  return (
    <nav className="easy-mode-footer-nav" aria-label="かんたんモードの操作">
      {items.map((item) => {
        const isActive = item.id === activeAction;

        return (
          <button
            key={item.id}
            type="button"
            className={`easy-mode-footer-button ${isActive ? 'easy-mode-footer-button-active' : ''} ${
              item.isDanger ? 'easy-mode-footer-button-danger' : ''
            }`}
            onClick={() => handleSelect(item.id, item.isDanger)}
          >
            <span className="easy-mode-footer-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="easy-mode-footer-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
