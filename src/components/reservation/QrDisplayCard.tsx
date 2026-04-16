'use client';

import { QRCodeSVG } from 'qrcode.react';
import {
  generateReceptionCode,
} from '@/types/reservation';

interface QrDisplayCardProps {
  /** QRコードに埋め込む値（reservation_id または署名付きトークン） */
  qrToken: string;
  /** 予約ID（受付コード生成用） */
  reservationId: string;
}

export default function QrDisplayCard({
  qrToken,
  reservationId,
}: QrDisplayCardProps) {
  const receptionCode = generateReceptionCode(reservationId);

  return (
    <div className="flex flex-col items-center">
      {/* QRコード */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <QRCodeSVG
          value={qrToken}
          size={220}
          level="M"
          includeMargin={false}
        />
      </div>

      {/* 受付コード */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">受付コード</p>
        <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-gray-800">
          {receptionCode}
        </p>
      </div>

      {/* 補助説明文 */}
      <div className="mt-4 space-y-1 text-center">
        <p className="text-xs leading-relaxed text-gray-400">
          スクリーンショットでもご利用いただけます
        </p>
        <p className="text-xs leading-relaxed text-gray-400">
          通信環境が悪い場合に備えて事前保存をおすすめします
        </p>
      </div>
    </div>
  );
}
