import type { Database } from './database';

type PaymentMethod = Database['public']['Enums']['payment_method'];

export const IMPORT_COLUMN_KEYS = [
  'userName',
  'planName',
  'siteNumber',
  'siteName',
  'gender',
  'userPhone',
  'occupation',
  'userEmail',
  'postalCode',
  'prefecture',
  'city',
  'addressLine',
  'buildingName',
  'lineDisplayName',
  'lineId',
  'referralSource',
  'checkInDate',
  'checkOutDate',
  'guests',
  'paymentMethod',
  'specialRequests',
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMN_KEYS)[number];

export interface ImportColumnDefinition {
  key: ImportColumnKey;
  label: string;
  required?: boolean;
  placeholder?: string;
}

export const IMPORT_COLUMNS: ImportColumnDefinition[] = [
  { key: 'userName', label: '予約者名', required: true, placeholder: '山田 太郎' },
  { key: 'planName', label: 'プラン名', required: true, placeholder: '電源付きキャンピングカーサイト' },
  { key: 'siteNumber', label: 'サイト番号', required: true, placeholder: 'A-01' },
  { key: 'siteName', label: 'サイト名', required: true, placeholder: 'Aエリア 1番サイト' },
  { key: 'gender', label: '性別', placeholder: '男性' },
  { key: 'userPhone', label: '電話番号', placeholder: '090-1234-5678' },
  { key: 'occupation', label: '職業', placeholder: '会社員' },
  { key: 'userEmail', label: 'メールアドレス', placeholder: 'sample@example.com' },
  { key: 'postalCode', label: '郵便番号', placeholder: '123-4567' },
  { key: 'prefecture', label: '都道府県', placeholder: '東京都' },
  { key: 'city', label: '市区町村', placeholder: '渋谷区' },
  { key: 'addressLine', label: '番地', placeholder: '神南1-2-3' },
  { key: 'buildingName', label: '建物名・部屋番号', placeholder: 'サンプルマンション101' },
  { key: 'lineDisplayName', label: 'LINE表示名', placeholder: 'taro_camp' },
  { key: 'lineId', label: 'LINE ID', placeholder: '@taro' },
  { key: 'referralSource', label: 'きっかけ', placeholder: 'Instagram' },
  { key: 'checkInDate', label: 'チェックイン日', required: true, placeholder: '2026-07-20' },
  { key: 'checkOutDate', label: 'チェックアウト日', required: true, placeholder: '2026-07-21' },
  { key: 'guests', label: '人数', required: true, placeholder: '2' },
  { key: 'paymentMethod', label: '支払い方法', required: true, placeholder: '現地払い(現金のみ)' },
  { key: 'specialRequests', label: '備考', placeholder: '到着は18時予定' },
];

export type ImportRawRow = Record<ImportColumnKey, string>;

export interface ImportParsedRow {
  rowIndex: number;
  userName: string;
  planName: string;
  planId: string;
  gender: string;
  occupation: string;
  userPhone: string;
  userEmail: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine: string;
  buildingName: string;
  lineDisplayName: string;
  lineId: string;
  referralSource: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  siteNumber: string;
  siteName: string;
  siteId: string;
  paymentMethod: PaymentMethod;
  specialRequests: string;
}

export interface ImportRowError {
  rowIndex: number;
  raw: ImportRawRow;
  errors: string[];
  fieldErrors: Partial<Record<ImportColumnKey, string>>;
}

export interface ImportDuplicate {
  rowIndex: number;
  parsed: ImportParsedRow;
  existingCheckIn: string;
  existingCheckOut: string;
  fieldErrors?: Partial<Record<ImportColumnKey, string>>;
}

export interface ImportValidationResult {
  validRows: ImportParsedRow[];
  errorRows: ImportRowError[];
  duplicateRows: ImportDuplicate[];
}

export interface ImportExecutionResult {
  jobId?: string;
  insertedCount: number;
  failedCount: number;
  failures: { rowIndex: number; error: string }[];
}

export const REQUIRED_COLUMNS = IMPORT_COLUMNS.filter((column) => column.required).map((column) => column.label);

export const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  'クレジットカード': 'credit_card',
  credit_card: 'credit_card',
  '現地払い': 'cash',
  '現地払い(現金のみ)': 'cash',
  '現地支払い': 'cash',
  cash: 'cash',
  '銀行振込': 'bank_transfer',
  bank_transfer: 'bank_transfer',
};

export const IMPORT_SAMPLE_ROW: ImportRawRow = {
  userName: '山田 太郎',
  planName: '電源付きキャンピングカーサイト',
  siteNumber: 'A-01',
  siteName: 'Aエリア 1番サイト',
  gender: '男性',
  userPhone: '090-1234-5678',
  occupation: '会社員',
  userEmail: 'taro@example.com',
  postalCode: '123-4567',
  prefecture: '東京都',
  city: '渋谷区',
  addressLine: '神南1-2-3',
  buildingName: 'サンプルマンション101',
  lineDisplayName: 'taro_camp',
  lineId: '@taro',
  referralSource: 'Instagram',
  checkInDate: '2026-07-20',
  checkOutDate: '2026-07-21',
  guests: '2',
  paymentMethod: '現地払い(現金のみ)',
  specialRequests: '到着は18時予定',
};
