import type { Database } from './database';

type PaymentMethod = Database['public']['Enums']['payment_method'];

export interface ImportRawRow {
  予約者名: string;
  性別: string;
  電話番号: string;
  職業: string;
  メールアドレス: string;
  郵便番号: string;
  都道府県: string;
  市区町村: string;
  番地: string;
  建物名部屋番号: string;
  LINEアカウント名: string;
  LINEアカウントID: string;
  知ったきっかけ: string;
  チェックイン日: string;
  チェックアウト日: string;
  人数: string;
  サイト番号: string;
  支払い方法: string;
  備考: string;
}

export interface ImportParsedRow {
  rowIndex: number;
  userName: string;
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
  paymentMethod: PaymentMethod;
  specialRequests: string;
}

export interface ImportRowError {
  rowIndex: number;
  raw: ImportRawRow;
  errors: string[];
}

export interface ImportDuplicate {
  rowIndex: number;
  parsed: ImportParsedRow;
  existingCheckIn: string;
  existingCheckOut: string;
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

export const REQUIRED_COLUMNS = [
  '予約者名',
  '性別',
  '電話番号',
  '職業',
  'メールアドレス',
  '郵便番号',
  '都道府県',
  '市区町村',
  '番地',
  '建物名部屋番号',
  'LINEアカウント名',
  'LINEアカウントID',
  '知ったきっかけ',
  'チェックイン日',
  'チェックアウト日',
  '人数',
  'サイト番号',
  '支払い方法',
  '備考',
] as const;

export const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  クレジットカード: 'credit_card',
  credit_card: 'credit_card',
  現地払い: 'cash',
  現金: 'cash',
  cash: 'cash',
  銀行振込: 'bank_transfer',
  振込: 'bank_transfer',
  bank_transfer: 'bank_transfer',
};
