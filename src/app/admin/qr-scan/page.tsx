'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ScanResultState =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

interface DetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
}

function extractReservationToken(value: string) {
  try {
    const url = new URL(value);
    const idFromQuery = url.searchParams.get('id');
    if (idFromQuery) return { reservationId: idFromQuery, qrToken: null };
  } catch {
    // Ignore plain text values.
  }

  if (/^[0-9a-f-]{36}$/i.test(value)) {
    return { reservationId: value, qrToken: null };
  }

  return { reservationId: null, qrToken: value };
}

export default function AdminQrScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [scanState, setScanState] = useState<ScanResultState>({ type: 'idle' });
  const [manualValue, setManualValue] = useState('');

  const supportsBarcodeDetector = useMemo(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window,
    [],
  );

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const updateReservationByValue = async (rawValue: string) => {
    const { reservationId, qrToken } = extractReservationToken(rawValue.trim());

    let query = supabase.from('guest_reservations').select('id, status, user_name');
    if (reservationId) {
      query = query.eq('id', reservationId);
    } else if (qrToken) {
      query = query.eq('qr_token', qrToken);
    } else {
      setScanState({ type: 'error', message: 'QRコードの内容を解釈できませんでした。' });
      return;
    }

    const { data, error } = await query.single();

    if (error || !data) {
      setScanState({ type: 'error', message: '該当する予約が見つかりませんでした。' });
      return;
    }

    if (data.status === 'checked_in') {
      setScanState({ type: 'success', message: `${data.user_name} さんはすでにチェックイン済みです。` });
      return;
    }

    const { error: updateError } = await supabase
      .from('guest_reservations')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
      .eq('id', data.id);

    if (updateError) {
      setScanState({ type: 'error', message: 'チェックイン更新に失敗しました。' });
      return;
    }

    setScanState({ type: 'success', message: `${data.user_name} さんをチェックイン済みに更新しました。` });
  };

  const scanFrame = async () => {
    if (!videoRef.current || !detectorRef.current) return;

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      const value = barcodes[0]?.rawValue;
      if (value) {
        await updateReservationByValue(value);
        return;
      }
    } catch {
      // Ignore single-frame scanner errors and keep looping.
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanner = async () => {
    if (!supportsBarcodeDetector) {
      setScanState({ type: 'error', message: 'この端末ではカメラ読み取りに対応していません。手入力を利用してください。' });
      return;
    }

    setIsStarting(true);
    setScanState({ type: 'idle' });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new (window as typeof window & { BarcodeDetector: new (config: { formats: string[] }) => DetectorLike }).BarcodeDetector({ formats: ['qr_code'] });
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setScanState({ type: 'error', message: 'カメラを起動できませんでした。権限を確認してください。' });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">QRチェックイン</h1>
        <p className="mt-1 text-sm text-gray-500">管理画面内でカメラを起動し、QRを読み取って予約ステータスを更新します。</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={startScanner} disabled={isStarting} className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {isStarting ? 'カメラ起動中...' : 'カメラを起動'}
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
          <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <label className="mb-2 block text-sm font-semibold text-gray-800">QR文字列を手入力</label>
        <div className="flex gap-3">
          <input value={manualValue} onChange={(event) => setManualValue(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="reservation id / qr token / url" />
          <button type="button" onClick={() => updateReservationByValue(manualValue)} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            照合
          </button>
        </div>
      </section>

      {scanState.type !== 'idle' && (
        <div className={`rounded border p-4 text-sm ${scanState.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {scanState.message}
        </div>
      )}
    </div>
  );
}
