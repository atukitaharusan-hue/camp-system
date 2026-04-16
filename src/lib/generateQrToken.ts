/**
 * QRトークン生成
 * 将来的に署名付きトークンなどへ差し替え可能
 */
export function generateQrToken(): string {
  // crypto.randomUUID() はブラウザ・Node 共に利用可能
  return `rsv_${crypto.randomUUID()}`;
}
