'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchOptions, fetchPlans } from '@/lib/admin/fetchData';
import { extractReservationIdentityFromQr } from '@/lib/reservationQr';
import { getSiteSelectionLabel } from '@/lib/siteSelectionLabel';
import { generateReceptionCode, getPaymentMethodLabel } from '@/types/reservation';
import type { Database, Json } from '@/types/database';
import type { AdminPlan } from '@/types/admin';
import type { OptionItem } from '@/types/options';

type GuestReservationRow = Database['public']['Tables']['guest_reservations']['Row'];

interface DetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

interface ReservationOptionEntry {
  type?: string;
  optionId?: string;
  name?: string;
  quantity?: number;
  days?: number;
  people?: number;
  subtotal?: number;
}

type ScanState =
  | { type: 'idle'; message?: string }
  | { type: 'loading'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const STATUS_LABELS: Record<string, string> = {
  pending: '仮予約',
  confirmed: '予約確定',
  checked_in: 'チェックイン済み',
  completed: '利用完了',
  cancelled: 'キャンセル',
  waitlisted: 'キャンセル待ち',
};

function parseReservationOptions(value: Json | null): ReservationOptionEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, Json> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => ({
      type: typeof item.type === 'string' ? item.type : undefined,
      optionId: typeof item.optionId === 'string' ? item.optionId : undefined,
      name: typeof item.name === 'string' ? item.name : undefined,
      quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
      days: typeof item.days === 'number' ? item.days : undefined,
      people: typeof item.people === 'number' ? item.people : undefined,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal : undefined,
    }));
}

function getSelectedSiteNumbers(value: GuestReservationRow['selected_site_numbers']) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function getOptionQuantityLabel(option: ReservationOptionEntry) {
  const quantity = option.type === 'event' ? option.people ?? option.quantity ?? 1 : option.quantity ?? 1;
  const daysLabel = option.days && option.days > 1 ? ` / ${option.days}日` : '';
  return `${quantity}${option.type === 'event' ? '名' : '個'}${daysLabel}`;
}

function getOptionTotal(options: ReservationOptionEntry[]) {
  return options.reduce((sum, option) => sum + (option.subtotal ?? 0), 0);
}

function sameCustomer(target: GuestReservationRow, candidate: GuestReservationRow) {
  if (target.user_identifier && candidate.user_identifier === target.user_identifier) return true;
  if (target.user_email && candidate.user_email === target.user_email) return true;
  if (target.user_phone && candidate.user_phone === target.user_phone) return true;
  return candidate.user_name === target.user_name;
}

export default function AdminQrScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const scannedValueRef = useRef<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ type: 'idle' });
  const [manualValue, setManualValue] = useState('');
  const [memberReservation, setMemberReservation] = useState<GuestReservationRow | null>(null);
  const [relatedReservations, setRelatedReservations] = useState<GuestReservationRow[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);

  const supportsBarcodeDetector = useMemo(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window,
    [],
  );

  const planNameMap = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan.name])),
    [plans],
  );

  const optionNameMap = useMemo(
    () => new Map(options.map((option) => [option.id, option.name])),
    [options],
  );

  const stopScanner = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    fetchPlans().then(setPlans);
    fetchOptions().then(setOptions);
    return () => stopScanner();
  }, [stopScanner]);

  const loadMemberByQrValue = useCallback(async (rawValue: string) => {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      setScanState({ type: 'error', message: 'QRコードの内容が空です。もう一度読み取ってください。' });
      return;
    }

    const { reservationId, qrToken } = extractReservationIdentityFromQr(trimmedValue);
    if (!reservationId && !qrToken) {
      setScanState({ type: 'error', message: 'QRコードの形式を認識できませんでした。予約QRか確認してください。' });
      return;
    }

    setScanState({ type: 'loading', message: 'QRコードから予約情報を確認しています...' });
    setMemberReservation(null);
    setRelatedReservations([]);

    let targetQuery = supabase.from('guest_reservations').select('*');
    if (reservationId) {
      targetQuery = targetQuery.eq('id', reservationId);
    } else if (qrToken) {
      targetQuery = targetQuery.eq('qr_token', qrToken);
    }

    const { data: target, error: targetError } = await targetQuery.single();
    if (targetError || !target) {
      setScanState({ type: 'error', message: '該当する会員・予約情報が見つかりませんでした。QRコードを確認してください。' });
      return;
    }

    const { data: reservations, error: reservationsError } = await supabase
      .from('guest_reservations')
      .select('*')
      .order('check_in_date', { ascending: false });

    if (reservationsError) {
      setScanState({ type: 'error', message: `予約情報の取得に失敗しました: ${reservationsError.message}` });
      return;
    }

    const related = (reservations ?? []).filter((reservation) => sameCustomer(target, reservation));
    setMemberReservation(target);
    setRelatedReservations(related);
    setScanState({
      type: 'success',
      message: related.length > 0 ? `${target.user_name} さんの予約情報を表示しました。` : '会員情報は見つかりましたが、紐づく予約がありません。',
    });
    stopScanner();
  }, [stopScanner]);

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current) return;

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      const value = barcodes[0]?.rawValue;
      if (value && value !== scannedValueRef.current) {
        scannedValueRef.current = value;
        await loadMemberByQrValue(value);
        return;
      }
    } catch {
      // Keep scanning on individual frame errors.
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  }, [loadMemberByQrValue]);

  const startScanner = async () => {
    if (!supportsBarcodeDetector) {
      setScanState({
        type: 'error',
        message: 'この端末ではカメラQR読み取りに対応していません。下の手入力欄にQR内容、予約ID、またはQRトークンを入力してください。',
      });
      return;
    }

    setIsStarting(true);
    setScanState({ type: 'idle' });
    scannedValueRef.current = null;
    setMemberReservation(null);
    setRelatedReservations([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      stopScanner();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new (window as typeof window & {
        BarcodeDetector: new (config: { formats: string[] }) => DetectorLike;
      }).BarcodeDetector({ formats: ['qr_code'] });

      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setScanState({ type: 'error', message: 'カメラを起動できませんでした。ブラウザのカメラ権限を確認してください。' });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCheckIn = async (reservation: GuestReservationRow) => {
    if (reservation.status === 'checked_in') {
      setScanState({ type: 'success', message: 'この予約はすでにチェックイン済みです。' });
      return;
    }

    if (!window.confirm(`${generateReceptionCode(reservation.id)} をチェックイン済みに更新しますか？`)) return;

    setUpdatingReservationId(reservation.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const response = await fetch('/api/admin/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkIn', id: reservation.id }),
    });
    const result = await response.json().catch(() => ({}));

    setUpdatingReservationId(null);

    if (!response.ok || !result.success) {
      const message = typeof result.error === 'string' ? result.error : 'チェックイン更新に失敗しました。';
      setScanState({ type: 'error', message: `チェックイン更新に失敗しました: ${message}` });
      return;
    }

    setRelatedReservations((current) =>
      current.map((item) =>
        item.id === reservation.id
          ? { ...item, status: 'checked_in', checked_in_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : item,
      ),
    );
    setScanState({ type: 'success', message: `${reservation.user_name} さんの予約をチェックイン済みに更新しました。${user?.email ? `（操作: ${user.email}）` : ''}` });
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">QRコード読み取り</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理画面内でカメラを起動し、ユーザーのQRコードから会員情報と予約一覧を表示します。対象予約だけをチェックイン済みに更新できます。
        </p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ユーザーQRをスマホで直接開いた場合は、管理人専用パスワードの入力後に情報を表示します。
          <Link href="/admin/qr-screen" className="ml-2 font-semibold text-amber-900 underline">
            パスワードを設定する
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startScanner}
            disabled={isStarting}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isStarting ? 'カメラ起動中...' : 'カメラを起動'}
          </button>
          <button
            type="button"
            onClick={stopScanner}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            カメラを停止
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
          <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <label className="mb-2 block text-sm font-semibold text-gray-800">QR内容を手入力</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="reservation id / qr token / url"
          />
          <button
            type="button"
            onClick={() => loadMemberByQrValue(manualValue)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            確認
          </button>
        </div>
      </section>

      {scanState.type !== 'idle' && (
        <div
          className={`rounded border p-4 text-sm ${
            scanState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : scanState.type === 'loading'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {scanState.message}
        </div>
      )}

      {memberReservation && (
        <MemberInfoCard reservation={memberReservation} reservationCount={relatedReservations.length} />
      )}

      {memberReservation && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">予約情報一覧</h2>
              <p className="mt-1 text-sm text-gray-500">会員情報に紐づく予約を表示しています。</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {relatedReservations.length}件
            </span>
          </div>

          {relatedReservations.length === 0 ? (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              この会員に紐づく予約は見つかりませんでした。
            </div>
          ) : (
            <div className="space-y-4">
              {relatedReservations.map((reservation) => (
                <ReservationCheckInCard
                  key={reservation.id}
                  reservation={reservation}
                  planName={reservation.plan_id ? planNameMap.get(reservation.plan_id) ?? 'プラン未設定' : 'プラン未設定'}
                  optionNameMap={optionNameMap}
                  updating={updatingReservationId === reservation.id}
                  onCheckIn={() => handleCheckIn(reservation)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MemberInfoCard({
  reservation,
  reservationCount,
}: {
  reservation: GuestReservationRow;
  reservationCount: number;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-emerald-950">会員情報</h2>
          <p className="mt-1 text-sm text-emerald-700">読み取り後、まず本人確認用の情報を表示しています。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
          関連予約 {reservationCount}件
        </span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="氏名" value={reservation.user_name} />
        <InfoItem label="電話番号" value={reservation.user_phone ?? '-'} />
        <InfoItem label="メールアドレス" value={reservation.user_email ?? '-'} />
        <InfoItem label="会員番号 / 顧客識別" value={reservation.user_identifier ?? reservation.user_email ?? reservation.user_phone ?? reservation.id} />
        <InfoItem label="LINE表示名" value={reservation.user_identifier ? reservation.user_name : '-'} />
        <InfoItem label="性別" value={reservation.user_gender ?? '-'} />
        <InfoItem label="職業" value={reservation.user_occupation ?? '-'} />
        <InfoItem label="住所" value={reservation.user_address ?? '-'} />
        <InfoItem label="きっかけ" value={reservation.user_referral_source ?? '-'} />
      </div>
    </section>
  );
}

function ReservationCheckInCard({
  reservation,
  planName,
  optionNameMap,
  updating,
  onCheckIn,
}: {
  reservation: GuestReservationRow;
  planName: string;
  optionNameMap: Map<string, string>;
  updating: boolean;
  onCheckIn: () => void;
}) {
  const selectedSiteNumbers = getSelectedSiteNumbers(reservation.selected_site_numbers);
  const siteLabel = getSiteSelectionLabel({
    siteNumber: reservation.site_number,
    siteName: reservation.site_name,
    selectedSiteNumbers,
  });
  const optionEntries = parseReservationOptions(reservation.options_json);
  const optionTotal = getOptionTotal(optionEntries);
  const isCheckedIn = reservation.status === 'checked_in';

  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/admin/reservations/${reservation.id}`} className="font-mono text-sm font-semibold text-blue-700 underline">
            {generateReceptionCode(reservation.id)}
          </Link>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isCheckedIn ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {STATUS_LABELS[reservation.status ?? 'pending'] ?? reservation.status ?? '未設定'}
            </span>
            {reservation.checked_in_at && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
                {new Date(reservation.checked_in_at).toLocaleString('ja-JP')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckIn}
          disabled={isCheckedIn || updating || reservation.status === 'cancelled' || reservation.status === 'waitlisted'}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCheckedIn ? 'チェックイン済み' : updating ? '更新中...' : 'チェックイン済みにする'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="プラン名" value={planName} />
        <InfoItem label="サイト番号 / サイト名" value={siteLabel} />
        <InfoItem label="宿泊日" value={`${reservation.check_in_date} - ${reservation.check_out_date}`} />
        <InfoItem label="チェックイン時間" value="管理画面で未設定" />
        <InfoItem label="チェックアウト時間" value="管理画面で未設定" />
        <InfoItem label="泊数" value={`${reservation.nights ?? 0}泊`} />
        <InfoItem label="人数" value={`大人 ${reservation.adults ?? 0} / 子供 ${reservation.children ?? 0} / 幼児 ${reservation.infants ?? 0} / 合計 ${reservation.guests ?? 0}`} />
        <InfoItem label="支払い方法" value={getPaymentMethodLabel(reservation.payment_method)} />
        <InfoItem label="合計金額" value={`¥${Number(reservation.total_amount ?? 0).toLocaleString()}`} />
      </div>

      <div className="mt-4 rounded-xl bg-white p-3 text-sm">
        <div className="mb-2 font-semibold text-gray-800">オプション内容</div>
        {optionEntries.length === 0 ? (
          <p className="text-gray-500">オプションなし</p>
        ) : (
          <div className="space-y-2">
            {optionEntries.map((option, index) => {
              const optionName = option.name ?? (option.optionId ? optionNameMap.get(option.optionId) : undefined) ?? 'オプション';
              return (
                <div key={`${option.optionId ?? 'option'}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                  <span>{optionName} × {getOptionQuantityLabel(option)}</span>
                  <span>¥{Number(option.subtotal ?? 0).toLocaleString()}</span>
                </div>
              );
            })}
            <div className="border-t border-gray-100 pt-2 text-right font-semibold text-gray-900">
              オプション合計 ¥{optionTotal.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-gray-900">{value || '-'}</div>
    </div>
  );
}
