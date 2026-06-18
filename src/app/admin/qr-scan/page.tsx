'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchOptions, fetchPlans } from '@/lib/admin/fetchData';
import { extractCounterSessionTokenFromQr, extractReservationIdentityFromQr } from '@/lib/reservationQr';
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
  completed: '完了',
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
  const router = useRouter();
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
  const [openingReservationId, setOpeningReservationId] = useState<string | null>(null);

  const supportsBarcodeDetector = useMemo(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window,
    [],
  );

  const planNameMap = useMemo(() => new Map(plans.map((plan) => [plan.id, plan.name])), [plans]);
  const optionNameMap = useMemo(() => new Map(options.map((option) => [option.id, option.name])), [options]);

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

    const counterSessionToken = extractCounterSessionTokenFromQr(trimmedValue).sessionToken;
    if (counterSessionToken) {
      stopScanner();
      router.push(`/admin/checkin-session?token=${encodeURIComponent(counterSessionToken)}`);
      return;
    }

    const { reservationId, qrToken } = extractReservationIdentityFromQr(trimmedValue);
    if (!reservationId && !qrToken) {
      setScanState({ type: 'error', message: 'QRコードから予約情報を読み取れませんでした。' });
      return;
    }

    setScanState({ type: 'loading', message: '予約情報を読み込んでいます...' });
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
      setScanState({ type: 'error', message: '対象の予約が見つかりませんでした。' });
      return;
    }

    const { data: reservations, error: reservationsError } = await supabase
      .from('guest_reservations')
      .select('*')
      .order('check_in_date', { ascending: false });

    if (reservationsError) {
      setScanState({ type: 'error', message: `予約一覧の取得に失敗しました: ${reservationsError.message}` });
      return;
    }

    const related = (reservations ?? []).filter((reservation) => sameCustomer(target, reservation));
    setMemberReservation(target);
    setRelatedReservations(related);
    setScanState({
      type: 'success',
      message: related.length > 0 ? `${target.user_name} さんの予約を表示しました。` : '会員情報は見つかりましたが、紐づく予約がありません。',
    });
    stopScanner();
  }, [router, stopScanner]);

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
      // keep scanning
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  }, [loadMemberByQrValue]);

  const startScanner = async () => {
    if (!supportsBarcodeDetector) {
      setScanState({
        type: 'error',
        message: 'この端末ではカメラQR読取に対応していません。下の入力欄に予約ID・QR・URLを貼り付けてください。',
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

  const openProcessing = async (reservation: GuestReservationRow) => {
    if (reservation.status === 'checked_in') {
      setScanState({ type: 'success', message: 'この予約はすでにチェックイン済みです。' });
      return;
    }
    setOpeningReservationId(reservation.id);
    router.push(`/admin/checkin-session?reservationId=${encodeURIComponent(reservation.id)}`);
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">QR読取</h1>
        <p className="mt-1 text-sm text-gray-500">
          会計用QRを読むと、そのまま管理人のチェックイン最終確定画面へ進みます。お客様側の予約QRを読んだ場合は、関連予約を一覧表示して対応を選べます。
        </p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          お客様用QRをスマホで運用したい場合は、QR表示用パスワードを設定してください。
          <Link href="/admin/qr-screen" className="ml-2 font-semibold text-amber-900 underline">
            QR画面を設定する
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
        <label className="mb-2 block text-sm font-semibold text-gray-800">QR内容を手入力する</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="reservation id / qr token / url / 会計用トークン"
          />
          <button
            type="button"
            onClick={() => loadMemberByQrValue(manualValue)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            読み込む
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

      {memberReservation ? <MemberInfoCard reservation={memberReservation} reservationCount={relatedReservations.length} /> : null}

      {memberReservation && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">関連予約一覧</h2>
              <p className="mt-1 text-sm text-gray-500">会計・チェックイン対応を行う予約を選んでください。</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {relatedReservations.length}件
            </span>
          </div>

          {relatedReservations.length === 0 ? (
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              この会員に紐づく予約がありません。
            </div>
          ) : (
            <div className="space-y-4">
              {relatedReservations.map((reservation) => (
                <ReservationCheckInCard
                  key={reservation.id}
                  reservation={reservation}
                  planName={reservation.plan_id ? planNameMap.get(reservation.plan_id) ?? 'プラン未設定' : 'プラン未設定'}
                  optionNameMap={optionNameMap}
                  updating={openingReservationId === reservation.id}
                  onCheckIn={() => openProcessing(reservation)}
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
          <p className="mt-1 text-sm text-emerald-700">読み取ったQRから紐づく会員情報を表示しています。</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
          関連予約 {reservationCount}件
        </span>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="氏名" value={reservation.user_name} />
        <InfoItem label="電話番号" value={reservation.user_phone ?? '-'} />
        <InfoItem label="メールアドレス" value={reservation.user_email ?? '-'} />
        <InfoItem label="会員識別子" value={reservation.user_identifier ?? reservation.user_email ?? reservation.user_phone ?? reservation.id} />
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
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500">
              {reservation.checkin_flow_status ?? '進行前'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckIn}
          disabled={isCheckedIn || updating || reservation.status === 'cancelled' || reservation.status === 'waitlisted'}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCheckedIn ? 'チェックイン済み' : updating ? '画面を開いています...' : '対応を開く'}
        </button>
        <Link
          href={`/admin/register?reservationId=${encodeURIComponent(reservation.id)}`}
          className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          レジ会計をする
        </Link>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="プラン" value={planName} />
        <InfoItem label="サイト番号 / サイト名" value={siteLabel} />
        <InfoItem label="宿泊日" value={`${reservation.check_in_date} - ${reservation.check_out_date}`} />
        <InfoItem label="人数" value={`大人 ${reservation.adults ?? 0} / 子ども ${reservation.children ?? 0} / 幼児 ${reservation.infants ?? 0} / 合計 ${reservation.guests ?? 0}`} />
        <InfoItem label="支払い方法" value={getPaymentMethodLabel(reservation.payment_method)} />
        <InfoItem label="予約金額" value={`¥${Number(reservation.total_amount ?? 0).toLocaleString()}`} />
      </div>

      <div className="mt-4 rounded-xl bg-white p-3 text-sm">
        <div className="mb-2 font-semibold text-gray-800">追加項目</div>
        {optionEntries.length === 0 ? (
          <p className="text-gray-500">追加項目はありません。</p>
        ) : (
          <div className="space-y-2">
            {optionEntries.map((option, index) => {
              const optionName = option.name ?? (option.optionId ? optionNameMap.get(option.optionId) : undefined) ?? '追加項目';
              return (
                <div key={`${option.optionId ?? 'option'}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                  <span>{optionName} / {getOptionQuantityLabel(option)}</span>
                  <span>¥{Number(option.subtotal ?? 0).toLocaleString()}</span>
                </div>
              );
            })}
            <div className="border-t border-gray-100 pt-2 text-right font-semibold text-gray-900">
              追加項目合計: ¥{optionTotal.toLocaleString()}
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
