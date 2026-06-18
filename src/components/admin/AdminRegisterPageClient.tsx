'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchAccountingSubjects,
  fetchPlans,
  fetchSalesReportCategories,
} from '@/lib/admin/fetchData';
import { fetchReservations } from '@/lib/admin/fetchReservations';
import {
  buildReservationAccountingLogs,
  DEFAULT_CATEGORIES,
  DEFAULT_SUBJECTS,
  formatCurrency,
  resolveParentCategoryName,
  todayIso,
  type AccountingLogItem,
} from '@/lib/admin/accountingReportUtils';
import { loadPreviewRegisterSales, savePreviewRegisterSale } from '@/lib/registerSalesPreview';
import type {
  AccountingSubjectSetting,
  PreviewRegisterSale,
  PreviewRegisterSaleItem,
  RegisterSalePaymentMethod,
  SalesReportCategorySetting,
} from '@/types/admin';
import type { AdminPlan } from '@/types/admin';
import type { Database } from '@/types/database';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

type RegisterCartItem = PreviewRegisterSaleItem;

type Props = {
  initialReservationId: string | null;
};

function toCartItem(item: AccountingLogItem): RegisterCartItem {
  return {
    id: item.id,
    accountingSubjectId: item.accountingSubjectId,
    accountingSubjectName: item.accountingSubjectName,
    parentCategoryName: item.parentCategoryName,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    subtotal: item.subtotal,
  };
}

function buildReservationBaseItems(
  reservation: GuestReservationRow,
  subjects: AccountingSubjectSetting[],
  categories: SalesReportCategorySetting[],
) {
  return buildReservationAccountingLogs(
    [reservation],
    subjects,
    categories,
    reservation.check_in_date,
    reservation.check_in_date,
  )[0]?.items.map(toCartItem) ?? [];
}

function normalizePaymentMethod(value: string): RegisterSalePaymentMethod {
  if (value === 'card' || value === 'paid' || value === 'other') return value;
  return 'cash';
}

function getPaymentMethodLabel(value: RegisterSalePaymentMethod) {
  if (value === 'card') return 'カード';
  if (value === 'paid') return '決済済み';
  if (value === 'other') return 'その他';
  return '現金';
}

export default function AdminRegisterPageClient({ initialReservationId }: Props) {
  const [subjects, setSubjects] = useState<AccountingSubjectSetting[]>([]);
  const [categories, setCategories] = useState<SalesReportCategorySetting[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [reservations, setReservations] = useState<GuestReservationRow[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(initialReservationId);
  const [cartItems, setCartItems] = useState<RegisterCartItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedParentCategories, setSelectedParentCategories] = useState<string[]>(['all']);
  const [paymentMethod, setPaymentMethod] = useState<RegisterSalePaymentMethod>('cash');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [previewSalesCount, setPreviewSalesCount] = useState(0);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [siteNumberInput, setSiteNumberInput] = useState('');
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  useEffect(() => {
    void (async () => {
      const [fetchedSubjects, fetchedCategories, fetchedPlans, fetchedReservations] = await Promise.all([
        fetchAccountingSubjects(),
        fetchSalesReportCategories(),
        fetchPlans(),
        fetchReservations(),
      ]);

      setSubjects(fetchedSubjects.length > 0 ? fetchedSubjects : DEFAULT_SUBJECTS);
      setCategories(fetchedCategories.length > 0 ? fetchedCategories : DEFAULT_CATEGORIES);
      setPlans(fetchedPlans);
      setReservations(fetchedReservations.data);
      setPreviewSalesCount(loadPreviewRegisterSales().length);
    })();
  }, []);

  useEffect(() => {
    const handleUpdate = () => setPreviewSalesCount(loadPreviewRegisterSales().length);
    window.addEventListener('preview-register-sales-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('preview-register-sales-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => subject.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [subjects],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId) ?? null,
    [reservations, selectedReservationId],
  );

  const planNameMap = useMemo(() => new Map(plans.map((plan) => [plan.id, plan.name])), [plans]);

  useEffect(() => {
    if (selectedReservation) {
      setCustomerNameInput(selectedReservation.user_name ?? '');
      setSiteNumberInput(selectedReservation.site_number ?? '指定なし');
      const nextAdults =
        selectedReservation.adults ??
        Math.max(
          (selectedReservation.guests ?? 1) -
            (selectedReservation.children ?? 0) -
            (selectedReservation.infants ?? 0),
          1,
        );
      setAdults(nextAdults);
      setChildren(selectedReservation.children ?? 0);
      setInfants(selectedReservation.infants ?? 0);
      setPaymentMethod(
        selectedReservation.payment_method === 'credit_card'
          ? 'card'
          : selectedReservation.payment_method === 'bank_transfer'
            ? 'other'
            : 'cash',
      );
      setCartItems(buildReservationBaseItems(selectedReservation, activeSubjects, activeCategories));
      setReceivedAmount(0);
      return;
    }

    setCustomerNameInput('');
    setSiteNumberInput('予約なし');
    setAdults(0);
    setChildren(0);
    setInfants(0);
    setCartItems([]);
    setPaymentMethod('cash');
    setReceivedAmount(0);
  }, [selectedReservation, activeSubjects, activeCategories]);

  const filteredReservations = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return reservations;

    return reservations.filter((reservation) => {
      const planName = reservation.plan_id ? planNameMap.get(reservation.plan_id) ?? '' : '';
      return [
        reservation.user_name ?? '',
        reservation.user_phone ?? '',
        reservation.id ?? '',
        reservation.site_number ?? '',
        planName,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [planNameMap, reservations, searchKeyword]);

  const visibleSubjects = useMemo(() => {
    if (selectedParentCategories.includes('all')) return activeSubjects;

    const allowedSubjectIds = new Set(
      activeCategories
        .filter((category) => selectedParentCategories.includes(category.parentCategoryName))
        .flatMap((category) => category.subjectIds),
    );

    return activeSubjects.filter((subject) => allowedSubjectIds.has(subject.id));
  }, [activeCategories, activeSubjects, selectedParentCategories]);

  const categorySubtotals = useMemo(() => {
    return activeCategories.map((category) => ({
      name: category.parentCategoryName,
      subtotal: cartItems
        .filter((item) => item.parentCategoryName === category.parentCategoryName)
        .reduce((sum, item) => sum + item.subtotal, 0),
    }));
  }, [activeCategories, cartItems]);

  const totalGuests = useMemo(() => Math.max(1, adults + children + infants), [adults, children, infants]);

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.subtotal, 0),
    [cartItems],
  );

  const changeAmount = useMemo(() => Math.max(0, receivedAmount - totalAmount), [receivedAmount, totalAmount]);

  const addSubjectToCart = (subject: AccountingSubjectSetting) => {
    const item: RegisterCartItem = {
      id: `${subject.id}-${Date.now()}`,
      accountingSubjectId: subject.id,
      accountingSubjectName: subject.name,
      parentCategoryName: resolveParentCategoryName(subject.id, activeCategories),
      unitPrice: Math.max(0, subject.defaultUnitPrice ?? 0),
      quantity: 1,
      subtotal: Math.max(0, subject.defaultUnitPrice ?? 0),
    };

    setCartItems((current) => [...current, item]);
    setMessage(null);
  };

  const updateCartItem = (itemId: string, patch: Partial<RegisterCartItem>) => {
    setCartItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;

        const nextUnitPrice = Math.max(0, patch.unitPrice ?? item.unitPrice);
        const nextQuantity = Math.max(1, patch.quantity ?? item.quantity);

        return {
          ...item,
          ...patch,
          unitPrice: nextUnitPrice,
          quantity: nextQuantity,
          subtotal: nextUnitPrice * nextQuantity,
        };
      }),
    );
  };

  const removeCartItem = (itemId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  };

  const toggleParentCategory = (categoryName: string) => {
    setSelectedParentCategories((current) => {
      if (categoryName === 'all') return ['all'];

      const base = current.includes('all') ? [] : current;
      if (base.includes(categoryName)) {
        const next = base.filter((name) => name !== categoryName);
        return next.length > 0 ? next : ['all'];
      }

      return [...base, categoryName];
    });
  };

  const handleSave = () => {
    if (cartItems.length === 0) {
      setMessage('会計科目を追加してください。');
      return;
    }

    const sale: PreviewRegisterSale = {
      id: `preview-sale-${Date.now()}`,
      reservationId: selectedReservation?.id ?? null,
      reservationCode: selectedReservation ? selectedReservation.id.replace(/-/g, '').slice(0, 8).toUpperCase() : null,
      customerName: customerNameInput.trim() || (selectedReservation?.user_name ?? '予約なし会計'),
      siteNumber: selectedReservation?.site_number ?? (siteNumberInput.trim() || '予約なし'),
      checkInDate: selectedReservation?.check_in_date ?? todayIso(),
      planName: selectedReservation?.plan_id ? planNameMap.get(selectedReservation.plan_id) ?? '' : '',
      guests: totalGuests,
      adults,
      children,
      infants,
      saleType: selectedReservation ? 'additional' : 'register',
      paymentMethod,
      totalAmount,
      receivedAmount: paymentMethod === 'cash' ? receivedAmount : null,
      changeAmount: paymentMethod === 'cash' ? changeAmount : null,
      createdAt: new Date().toISOString(),
      items: cartItems,
    };

    savePreviewRegisterSale(sale);
    setPreviewSalesCount(loadPreviewRegisterSales().length);
    setMessage('会計ログを保存しました。');
    setReceivedAmount(0);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">管理棟レジ</h1>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            保存済みプレビュー会計 {previewSalesCount}件
          </div>
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">入口</h2>
          <div className="space-y-3">
            <Link
              href="/admin/qr-scan"
              className="block rounded-2xl border border-slate-200 px-4 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              QRを読み取る
            </Link>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">予約者を検索する</p>
              <input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="名前 / 電話番号 / 予約ID / サイト番号"
                className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedReservationId(null)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                    selectedReservationId === null
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  予約なし会計
                </button>
                {filteredReservations.map((reservation) => {
                  const planName = reservation.plan_id ? planNameMap.get(reservation.plan_id) ?? '' : '';
                  const selected = reservation.id === selectedReservationId;
                  return (
                    <button
                      key={reservation.id}
                      type="button"
                      onClick={() => setSelectedReservationId(reservation.id)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
                        selected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">{reservation.user_name}</div>
                      <div className={`mt-1 text-xs ${selected ? 'text-slate-200' : 'text-slate-500'}`}>
                        {reservation.site_number ?? '指定なし'} / {reservation.check_in_date} / {planName || 'プラン未設定'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">予約者名</div>
                <input
                  value={customerNameInput}
                  onChange={(event) => setCustomerNameInput(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">サイト番号</div>
                <input
                  value={siteNumberInput}
                  onChange={(event) => setSiteNumberInput(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">宿泊日</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {selectedReservation?.check_in_date ?? '当日会計'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">プラン</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {selectedReservation?.plan_id ? planNameMap.get(selectedReservation.plan_id) ?? '未設定' : '予約なし'}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                大人
                <input
                  type="number"
                  min={0}
                  value={adults}
                  onChange={(event) => setAdults(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                子ども
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(event) => setChildren(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                幼児
                <input
                  type="number"
                  min={0}
                  value={infants}
                  onChange={(event) => setInfants(Math.max(0, Number(event.target.value) || 0))}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs text-emerald-700">合計人数</div>
                <div className="mt-2 text-lg font-semibold text-emerald-900">{totalGuests}名</div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">親カテゴリボタン</h2>
                <p className="mt-1 text-sm text-slate-500">複数選択できます。選んだ親カテゴリに属する会計科目だけを表示します。</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleParentCategory('all')}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedParentCategories.includes('all')
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                すべて選択
              </button>
              {activeCategories.map((category) => {
                const selected = selectedParentCategories.includes(category.parentCategoryName);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleParentCategory(category.parentCategoryName)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {category.parentCategoryName}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">会計科目ボタン</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleSubjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => addSubjectToCart(subject)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100"
                  >
                    <div className="font-semibold text-slate-900">{subject.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {resolveParentCategoryName(subject.id, activeCategories)}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{formatCurrency(subject.defaultUnitPrice ?? 0)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">カート</h2>
              <div className="mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400">
                    会計科目を押すとここに追加されます。
                  </div>
                ) : null}

                {cartItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{item.accountingSubjectName}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.parentCategoryName}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                      >
                        削除
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <label className="text-sm text-slate-700">
                        単価
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(event) => updateCartItem(item.id, { unitPrice: Number(event.target.value) || 0 })}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-sm text-slate-700">
                        数量
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => updateCartItem(item.id, { quantity: Number(event.target.value) || 1 })}
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                        <div className="text-xs text-slate-500">小計</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatCurrency(item.subtotal)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">親カテゴリ別小計</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {categorySubtotals
                    .filter((row) => row.subtotal > 0)
                    .map((row) => (
                      <div key={row.name} className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">{row.name}</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(row.subtotal)}</span>
                      </div>
                    ))}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <span className="font-semibold text-slate-900">合計</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">支払い方法</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(normalizePaymentMethod(event.target.value))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="cash">現金</option>
                    <option value="card">カード</option>
                    <option value="paid">決済済み</option>
                    <option value="other">その他</option>
                  </select>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {getPaymentMethodLabel(paymentMethod)}
                  </div>
                </div>

                {paymentMethod === 'cash' ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-slate-700">
                      預かり金
                      <input
                        type="number"
                        min={0}
                        value={receivedAmount}
                        onChange={(event) => setReceivedAmount(Number(event.target.value) || 0)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="text-xs text-slate-500">合計金額</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatCurrency(totalAmount)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="text-xs text-slate-500">お釣り</div>
                      <div className="mt-1 font-semibold text-slate-900">{formatCurrency(changeAmount)}</div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSave}
                  className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  会計を保存する
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
