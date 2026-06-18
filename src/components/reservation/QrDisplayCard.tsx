'use client';

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildReservationQrValue } from '@/lib/reservationQr';
import { generateReceptionCode } from '@/types/reservation';

interface QrDisplayCardProps {
  qrToken?: string;
  reservationId?: string;
  rawValue?: string;
  codeLabel?: string;
  title?: string;
}

export default function QrDisplayCard({
  qrToken,
  reservationId,
  rawValue,
  codeLabel,
  title,
}: QrDisplayCardProps) {
  const receptionCode = codeLabel ?? (reservationId ? generateReceptionCode(reservationId) : 'QR');
  const qrValue = useMemo(
    () => rawValue ?? (reservationId && qrToken ? buildReservationQrValue(reservationId, qrToken) : ''),
    [rawValue, reservationId, qrToken],
  );

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <QRCodeSVG value={qrValue} size={220} level="M" includeMargin={false} />
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">{title ?? '受付コード'}</p>
        <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-gray-800">
          {receptionCode}
        </p>
      </div>

      <div className="mt-4 space-y-1 text-center">
        <p className="text-xs leading-relaxed text-gray-400">
          スクリーンショットでもご利用いただけます。
        </p>
        <p className="text-xs leading-relaxed text-gray-400">
          受付時にスタッフへ画面をご提示ください。
        </p>
        <p className="break-all text-[10px] leading-relaxed text-gray-300">
          {qrValue}
        </p>
      </div>
    </div>
  );
}
