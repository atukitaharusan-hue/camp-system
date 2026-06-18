'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CategoryTabs, { type EasyModeCategory } from '@/components/easy-mode/CategoryTabs';
import FooterNav, { type EasyModeFooterAction, type EasyModeFooterNavItem } from '@/components/easy-mode/FooterNav';
import FontSizeControl from '@/components/easy-mode/FontSizeControl';
import { useFontSizeContext } from '@/contexts/FontSizeContext';
import TodayGuests from '@/components/easy-mode/categories/TodayGuests';
import AvailabilityCategory from '@/components/easy-mode/categories/Availability';
import CheckoutCategory from '@/components/easy-mode/categories/Checkout';
import InventoryCategory from '@/components/easy-mode/categories/Inventory';
import StaffMemosCategory from '@/components/easy-mode/categories/StaffMemos';
import ReservationList from '@/components/easy-mode/categories/ReservationList';
import CustomMemoCategory from '@/components/easy-mode/categories/CustomMemo';
import CustomLinksCategory from '@/components/easy-mode/categories/CustomLinks';
import CustomChecklist from '@/components/easy-mode/categories/CustomChecklist';
import CustomProducts from '@/components/easy-mode/categories/CustomProducts';
import CustomEventsCategory from '@/components/easy-mode/categories/CustomEvents';
import CustomReservationsCategory from '@/components/easy-mode/categories/CustomReservations';
import {
  defaultEasyModeCategories,
  defaultEasyModeFooterItems,
  fetchEasyModeCategories,
  fetchEasyModeFooterItems,
  fetchEasyModeInventoryOverrides,
  fetchEvents,
  fetchOptions,
  saveEasyModeCategories,
} from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import { todayIsoJst } from '@/lib/easyMode';
import type {
  EasyModeCategorySetting,
  EasyModeFooterItemSetting,
} from '@/types/admin';

function getDeviceTarget(width: number): 'mobile' | 'tablet' | 'pc' {
  if (width < 600) return 'mobile';
  if (width < 900) return 'tablet';
  return 'pc';
}

function getHelperTextForType(type: EasyModeCategorySetting['type']) {
  switch (type) {
    case 'today_guests':
      return '今日の来場予定を大きなカードで確認できます。';
    case 'availability':
      return '空き状況を見ながら、そのまま新規予約へ進めます。';
    case 'checkout':
      return '会計やレジ操作の入口です。';
    case 'inventory':
      return '売切、在庫あり、販売停止を簡単に切り替えられます。';
    case 'staff_memos':
      return 'スタッフどうしのお願いや共有事項を付箋のように見られます。';
    case 'reservations':
      return '今日・明日・名前・電話番号で予約を探せます。';
    case 'sales_report':
      return '売上日報は次のカテゴリで扱えるように拡張できます。';
    case 'events':
      return 'イベント情報を見やすく表示します。';
    case 'custom_memo':
      return '管理者が登録した注意事項や連絡事項を大きく表示します。';
    case 'custom_link':
      return '必要なリンク先を大きなボタンで開けます。';
    case 'custom_checklist':
      return '朝の準備や閉店作業などをチェック形式で確認できます。';
    case 'custom_products':
      return '特定の商品だけをまとめて確認し、会計導線へつなげられます。';
    case 'custom_events':
      return '条件に合うイベントだけを並べて見られます。';
    case 'custom_reservations':
      return '条件に合う予約だけを絞り込んで表示できます。';
    default:
      return 'このカテゴリの内容を確認できます。';
  }
}

function createFooterItems(items: EasyModeFooterItemSetting[]): EasyModeFooterNavItem[] {
  return items
    .filter((item) => item.isVisible || item.isRequired)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      isDanger: item.actionType === 'cancel',
    }));
}

function renderPlaceholder(title: string, description: string) {
  return (
    <section className="easy-mode-panel-card">
      <div className="space-y-3">
        <p className="text-[1.05em] font-extrabold text-slate-900">{title}</p>
        <div className="rounded-3xl bg-slate-50 px-5 py-8 text-[0.9em] leading-relaxed text-slate-600">
          {description}
        </div>
      </div>
    </section>
  );
}

export default function EasyModeShell() {
  const router = useRouter();
  const { fontSizePixels } = useFontSizeContext();
  const [allCategories, setAllCategories] = useState<EasyModeCategorySetting[]>(defaultEasyModeCategories);
  const [footerSettings, setFooterSettings] = useState<EasyModeFooterItemSetting[]>(defaultEasyModeFooterItems);
  const [activeCategoryId, setActiveCategoryId] = useState(defaultEasyModeCategories[0]?.id ?? '');
  const [activeAction, setActiveAction] = useState<EasyModeFooterAction>('home');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedAccountingReservationId, setSelectedAccountingReservationId] = useState<string | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<'mobile' | 'tablet' | 'pc'>('mobile');
  const [todayReservationCount, setTodayReservationCount] = useState(0);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [hasPendingMemos, setHasPendingMemos] = useState(false);
  const [hasLowStock, setHasLowStock] = useState(false);

  useEffect(() => {
    const syncDeviceTarget = () => setDeviceTarget(getDeviceTarget(window.innerWidth));
    syncDeviceTarget();
    window.addEventListener('resize', syncDeviceTarget);
    return () => window.removeEventListener('resize', syncDeviceTarget);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      const [categories, footerItems] = await Promise.all([
        fetchEasyModeCategories(),
        fetchEasyModeFooterItems(),
      ]);

      if (!mounted) return;
      setAllCategories(categories);
      setFooterSettings(footerItems);
    }
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadConditions() {
      const today = todayIsoJst();
      const [{ data: reservations }, events, memoResponse, options, inventoryOverrides] = await Promise.all([
        fetchReservations(),
        fetchEvents(),
        fetch('/api/admin/easy-mode-memos', { cache: 'no-store' })
          .then((response) => (response.ok ? response.json() : { memos: [] }))
          .catch(() => ({ memos: [] })),
        fetchOptions(),
        fetchEasyModeInventoryOverrides(),
      ]);

      if (!mounted) return;

      const reservationCount = reservations.filter(
        (reservation) => reservation.check_in_date === today && reservation.status !== 'cancelled',
      ).length;
      const eventCount = events.filter(
        (event) => event.startAt.slice(0, 10) <= today && event.endAt.slice(0, 10) >= today,
      ).length;
      const memos = Array.isArray(memoResponse.memos) ? memoResponse.memos : [];
      const lowStock = options.some((option) => {
        const override = inventoryOverrides[option.id];
        const remaining = override?.remaining ?? option.maxQuantity ?? null;
        const status = override?.status ?? (option.isActive ? 'available' : 'inactive');
        return status !== 'inactive' && (status === 'sold_out' || (typeof remaining === 'number' && remaining <= 3));
      });

      setTodayReservationCount(reservationCount);
      setTodayEventCount(eventCount);
      setHasPendingMemos(memos.some((memo: { status?: string }) => memo.status !== 'completed'));
      setHasLowStock(lowStock);
    }

    void loadConditions();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleCategories = useMemo(() => {
    return allCategories
      .filter((category) => category.isVisible)
      .filter((category) => category.targetDevice === 'all' || category.targetDevice === deviceTarget)
      .filter((category) => category.targetRole !== 'specific' || category.targetStaffIds.length === 0)
      .filter((category) => {
        switch (category.displayCondition) {
          case 'today_only':
            return true;
          case 'has_reservations':
            return todayReservationCount > 0;
          case 'has_events':
            return todayEventCount > 0;
          case 'low_stock':
            return hasLowStock;
          case 'has_pending_memos':
            return hasPendingMemos;
          default:
            return true;
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allCategories, deviceTarget, hasLowStock, hasPendingMemos, todayEventCount, todayReservationCount]);

  const currentActiveCategoryId = useMemo(() => {
    if (!visibleCategories.length) return '';
    return visibleCategories.some((category) => category.id === activeCategoryId)
      ? activeCategoryId
      : visibleCategories[0].id;
  }, [visibleCategories, activeCategoryId]);

  const activeCategory = useMemo(
    () =>
      visibleCategories.find((category) => category.id === currentActiveCategoryId) ??
      visibleCategories[0] ??
      null,
    [visibleCategories, currentActiveCategoryId],
  );

  const tabCategories: EasyModeCategory[] = useMemo(
    () =>
      visibleCategories.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
      })),
    [visibleCategories],
  );

  const footerItems = useMemo(() => createFooterItems(footerSettings), [footerSettings]);

  const activeActionLabel =
    footerItems.find((item) => item.id === activeAction)?.label ?? activeCategory?.name ?? 'かんたんモード';

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveAction('home');
  };

  const handleFooterSelect = (action: EasyModeFooterAction) => {
    const matchedFooter = footerSettings.find((item) => item.id === action);

    if (matchedFooter?.actionType === 'custom_link' && matchedFooter.customUrl) {
      window.location.href = matchedFooter.customUrl;
      return;
    }

    switch (matchedFooter?.actionType) {
      case 'home':
        setActiveAction('home');
        if (visibleCategories[0]) setActiveCategoryId(visibleCategories[0].id);
        return;
      case 'new_reservation':
        router.push('/admin/reservations/new');
        return;
      case 'cancel':
        router.push('/admin/reservations');
        return;
      case 'site_assignment':
        router.push('/admin/reservations/site-assignments');
        return;
      case 'checkin':
        router.push('/admin/qr-scan');
        return;
      case 'checkout': {
        const checkoutCategory = visibleCategories.find((category) => category.type === 'checkout');
        if (checkoutCategory) {
          setActiveCategoryId(checkoutCategory.id);
        }
        setActiveAction(action);
        return;
      }
      default:
        setActiveAction(action);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStart || tabCategories.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) {
      setTouchStart(null);
      return;
    }

    const currentIndex = tabCategories.findIndex((category) => category.id === currentActiveCategoryId);
    if (currentIndex < 0) {
      setTouchStart(null);
      return;
    }

    if (deltaX < 0 && currentIndex < tabCategories.length - 1) {
      handleCategoryChange(tabCategories[currentIndex + 1].id);
    }

    if (deltaX > 0 && currentIndex > 0) {
      handleCategoryChange(tabCategories[currentIndex - 1].id);
    }

    setTouchStart(null);
  };

  const handleCategoryConfigUpdate = async (categoryId: string, config: Record<string, unknown>) => {
    const nextCategories = allCategories.map((category) =>
      category.id === categoryId ? { ...category, config } : category,
    );
    setAllCategories(nextCategories);
    await saveEasyModeCategories(nextCategories);
  };

  const helperText =
    activeAction === 'home'
      ? getHelperTextForType(activeCategory?.type ?? 'today_guests')
      : `${activeActionLabel}の内容を確認できます。`;

  const helperIcon =
    activeAction === 'home'
      ? activeCategory?.icon ?? '🧭'
      : footerItems.find((item) => item.id === activeAction)?.icon ?? activeCategory?.icon ?? '🧭';

  const moveToCheckout = (reservationId?: string | null) => {
    if (reservationId) {
      setSelectedAccountingReservationId(reservationId);
    }
    const checkoutCategory = visibleCategories.find((category) => category.type === 'checkout');
    if (checkoutCategory) {
      setActiveCategoryId(checkoutCategory.id);
    }
    setActiveAction('checkout');
  };

  const renderCategory = () => {
    if (!activeCategory) {
      return renderPlaceholder('カテゴリがありません', '表示対象のカテゴリがまだ設定されていません。');
    }

    switch (activeCategory.type) {
      case 'today_guests':
        return <TodayGuests onGoToAccounting={(reservationId) => moveToCheckout(reservationId)} />;
      case 'availability':
        return <AvailabilityCategory />;
      case 'checkout':
        return <CheckoutCategory selectedReservationId={selectedAccountingReservationId} />;
      case 'inventory':
        return <InventoryCategory />;
      case 'staff_memos':
        return <StaffMemosCategory />;
      case 'reservations':
        return <ReservationList onGoToAccounting={(reservationId) => moveToCheckout(reservationId)} />;
      case 'custom_memo':
        return <CustomMemoCategory category={activeCategory} />;
      case 'custom_link':
        return <CustomLinksCategory category={activeCategory} />;
      case 'custom_checklist':
        return <CustomChecklist category={activeCategory} onUpdateConfig={handleCategoryConfigUpdate} />;
      case 'custom_products':
        return <CustomProducts category={activeCategory} onGoToCheckout={() => moveToCheckout(null)} />;
      case 'custom_events':
        return <CustomEventsCategory category={activeCategory} />;
      case 'custom_reservations':
        return (
          <CustomReservationsCategory
            category={activeCategory}
            onOpenReservation={(reservationId) => router.push(`/admin/reservations/${reservationId}/edit`)}
          />
        );
      case 'sales_report':
        return renderPlaceholder('売上日報', '売上日報の内容は次の実装でつなぎ込みます。');
      case 'events':
        return renderPlaceholder('イベント', 'イベントの一覧は今後の接続で使えるように準備しています。');
      default:
        return renderPlaceholder(activeCategory.name, 'このカテゴリの内容はまだ準備中です。');
    }
  };

  return (
    <div className="easy-mode-shell" style={{ ['--easy-font-size' as string]: `${fontSizePixels}px` }}>
      <div className="easy-mode-header">
        <div className="easy-mode-header-title-group">
          <p className="easy-mode-header-title">かんたんモード</p>
          <p className="easy-mode-header-subtitle">大きな文字と大きなボタンで、迷わず操作できます。</p>
        </div>
        <div className="easy-mode-header-actions">
          <Link href="/admin" className="easy-mode-header-button easy-mode-close-link">
            閉じる
          </Link>
          <FontSizeControl />
        </div>
      </div>

      <div className="easy-mode-tabs-sticky">
        <CategoryTabs
          categories={tabCategories}
          activeCategoryId={activeCategory?.id ?? ''}
          onSelect={handleCategoryChange}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      <main className="easy-mode-main-content">
        <section className="easy-mode-helper-card">
          <div className="easy-mode-helper-heading">
            <span className="easy-mode-helper-icon" aria-hidden="true">
              {helperIcon}
            </span>
            <div>
              <p className="easy-mode-helper-title">{activeAction === 'home' ? activeCategory?.name ?? 'かんたんモード' : activeActionLabel}</p>
              <p className="easy-mode-helper-description">{helperText}</p>
            </div>
          </div>
        </section>

        <div
          id={`easy-mode-category-panel-${activeCategory?.id ?? 'empty'}`}
          className="easy-mode-category-content"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {renderCategory()}
        </div>
      </main>

      <div className="easy-mode-back-link-row">
        <Link href="/admin" className="easy-mode-back-link">
          通常画面へ戻る
        </Link>
      </div>

      <FooterNav items={footerItems} activeAction={activeAction} onSelect={handleFooterSelect} />
    </div>
  );
}
