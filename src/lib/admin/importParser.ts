import * as XLSX from 'xlsx';
import type {
  ImportDuplicate,
  ImportParsedRow,
  ImportRawRow,
  ImportRowError,
  ImportValidationResult,
} from '@/types/import';
import { PAYMENT_METHOD_MAP, REQUIRED_COLUMNS } from '@/types/import';
import { parseSiteNumber } from '@/lib/validateReservation';

export function parseFileToRows(
  buffer: ArrayBuffer,
  fileName: string,
): { rows: Record<string, string>[]; error?: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { rows: [], error: 'シートが見つかりません' };

    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: '',
      raw: false,
    });

    return { rows: jsonRows };
  } catch {
    return {
      rows: [],
      error: `ファイルの読み込みに失敗しました: ${fileName}`,
    };
  }
}

export function checkRequiredColumns(headers: string[]): { ok: boolean; missing: string[] } {
  const trimmed = headers.map((header) => header.trim());
  const missing = REQUIRED_COLUMNS.filter((column) => !trimmed.includes(column));
  return { ok: missing.length === 0, missing };
}

const DATE_REGEX_YYYY_MM_DD = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (DATE_REGEX_YYYY_MM_DD.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return dateStr;
  }

  const num = Number(trimmed);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

const VALID_OCCUPATIONS = ['会社員', '学生', '自営業', '公務員', '主婦', '家族', 'その他'];
const VALID_SITE_NUMBERS = ['A-01', 'A-02', 'B-01', 'B-02', 'C-01', 'C-02'];
const SITE_CAPACITY: Record<string, number> = {
  'A-01': 4,
  'A-02': 5,
  'B-01': 5,
  'B-02': 6,
  'C-01': 5,
  'C-02': 6,
};

export function validateRow(
  raw: Record<string, string>,
  rowIndex: number,
  validSiteNumbers?: string[],
  siteCapacityMap?: Record<string, number>,
): { parsed?: ImportParsedRow; errors: string[] } {
  const errors: string[] = [];
  const sites = validSiteNumbers ?? VALID_SITE_NUMBERS;
  const capacities = siteCapacityMap ?? SITE_CAPACITY;

  const row: ImportRawRow = {
    予約者名: (raw['予約者名'] ?? '').trim(),
    性別: (raw['性別'] ?? '').trim(),
    電話番号: (raw['電話番号'] ?? '').trim(),
    職業: (raw['職業'] ?? '').trim(),
    メールアドレス: (raw['メールアドレス'] ?? '').trim(),
    郵便番号: (raw['郵便番号'] ?? '').trim(),
    都道府県: (raw['都道府県'] ?? '').trim(),
    市区町村: (raw['市区町村'] ?? '').trim(),
    番地: (raw['番地'] ?? '').trim(),
    建物名部屋番号: (raw['建物名部屋番号'] ?? '').trim(),
    LINEアカウント名: (raw['LINEアカウント名'] ?? '').trim(),
    LINEアカウントID: (raw['LINEアカウントID'] ?? '').trim(),
    知ったきっかけ: (raw['知ったきっかけ'] ?? '').trim(),
    チェックイン日: (raw['チェックイン日'] ?? '').trim(),
    チェックアウト日: (raw['チェックアウト日'] ?? '').trim(),
    人数: (raw['人数'] ?? '').trim(),
    サイト番号: (raw['サイト番号'] ?? '').trim(),
    支払い方法: (raw['支払い方法'] ?? '').trim(),
    備考: (raw['備考'] ?? '').trim(),
  };

  if (!row.予約者名) errors.push('予約者名が必須です');
  if (!row.チェックイン日) errors.push('チェックイン日が必須です');
  if (!row.チェックアウト日) errors.push('チェックアウト日が必須です');
  if (!row.人数) errors.push('人数が必須です');
  if (!row.支払い方法) errors.push('支払い方法が必須です');

  if (row.職業 && !VALID_OCCUPATIONS.includes(row.職業)) {
    errors.push(`職業が不正です: "${row.職業}"`);
  }

  const checkInDate = normalizeDate(row.チェックイン日);
  const checkOutDate = normalizeDate(row.チェックアウト日);
  if (row.チェックイン日 && !checkInDate) {
    errors.push(`チェックイン日の形式が不正です: "${row.チェックイン日}"`);
  }
  if (row.チェックアウト日 && !checkOutDate) {
    errors.push(`チェックアウト日の形式が不正です: "${row.チェックアウト日}"`);
  }
  if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
    errors.push('チェックアウト日はチェックイン日より後にしてください');
  }

  const guests = parseInt(row.人数, 10);
  if (row.人数 && (isNaN(guests) || guests < 1)) {
    errors.push(`人数が不正です: "${row.人数}"`);
  }

  const { siteNumber: normalizedSite } = parseSiteNumber(row.サイト番号 || '');
  if (row.サイト番号 && !sites.includes(normalizedSite)) {
    errors.push(`サイト番号が存在しません: "${row.サイト番号}"`);
  }

  if (row.サイト番号 && sites.includes(normalizedSite) && !isNaN(guests) && guests > capacities[normalizedSite]) {
    errors.push(`人数が定員超過です: ${normalizedSite} の定員は ${capacities[normalizedSite]} 名です`);
  }

  const paymentMethod = PAYMENT_METHOD_MAP[row.支払い方法];
  if (row.支払い方法 && !paymentMethod) {
    errors.push(`支払い方法が不正です: "${row.支払い方法}"`);
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    parsed: {
      rowIndex,
      userName: row.予約者名,
      gender: row.性別,
      occupation: row.職業,
      userPhone: row.電話番号,
      userEmail: row.メールアドレス,
      postalCode: row.郵便番号,
      prefecture: row.都道府県,
      city: row.市区町村,
      addressLine: row.番地,
      buildingName: row.建物名部屋番号,
      lineDisplayName: row.LINEアカウント名,
      lineId: row.LINEアカウントID,
      referralSource: row.知ったきっかけ,
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      guests,
      siteNumber: normalizedSite,
      paymentMethod: paymentMethod!,
      specialRequests: row.備考,
    },
    errors: [],
  };
}

export interface ExistingReservation {
  site_number: string;
  check_in_date: string;
  check_out_date: string;
}

export function detectDuplicates(
  validRows: ImportParsedRow[],
  existingReservations: ExistingReservation[],
): { clean: ImportParsedRow[]; duplicates: ImportDuplicate[] } {
  const clean: ImportParsedRow[] = [];
  const duplicates: ImportDuplicate[] = [];

  for (const row of validRows) {
    if (!row.siteNumber) {
      clean.push(row);
      continue;
    }

    const overlap = existingReservations.find(
      (existing) =>
        existing.site_number === row.siteNumber &&
        existing.check_in_date < row.checkOutDate &&
        existing.check_out_date > row.checkInDate,
    );

    if (overlap) {
      duplicates.push({
        rowIndex: row.rowIndex,
        parsed: row,
        existingCheckIn: overlap.check_in_date,
        existingCheckOut: overlap.check_out_date,
      });
    } else {
      clean.push(row);
    }
  }

  return { clean, duplicates };
}

export function detectInternalDuplicates(
  rows: ImportParsedRow[],
): { clean: ImportParsedRow[]; duplicates: ImportDuplicate[] } {
  const clean: ImportParsedRow[] = [];
  const duplicates: ImportDuplicate[] = [];

  for (const row of rows) {
    if (!row.siteNumber) {
      clean.push(row);
      continue;
    }

    const overlapWith = clean.find(
      (cleanRow) =>
        cleanRow.siteNumber === row.siteNumber &&
        cleanRow.checkInDate < row.checkOutDate &&
        cleanRow.checkOutDate > row.checkInDate,
    );

    if (overlapWith) {
      duplicates.push({
        rowIndex: row.rowIndex,
        parsed: row,
        existingCheckIn: overlapWith.checkInDate,
        existingCheckOut: overlapWith.checkOutDate,
      });
    } else {
      clean.push(row);
    }
  }

  return { clean, duplicates };
}

export function validateAllRows(
  rawRows: Record<string, string>[],
  existingReservations: ExistingReservation[],
  validSiteNumbers?: string[],
  siteCapacityMap?: Record<string, number>,
): ImportValidationResult {
  const validRows: ImportParsedRow[] = [];
  const errorRows: ImportRowError[] = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    const raw = rawRows[index];
    const { parsed, errors } = validateRow(raw, index + 1, validSiteNumbers, siteCapacityMap);

    if (errors.length > 0) {
      errorRows.push({
        rowIndex: index + 1,
        raw: {
          予約者名: (raw['予約者名'] ?? '').trim(),
          性別: (raw['性別'] ?? '').trim(),
          電話番号: (raw['電話番号'] ?? '').trim(),
          職業: (raw['職業'] ?? '').trim(),
          メールアドレス: (raw['メールアドレス'] ?? '').trim(),
          郵便番号: (raw['郵便番号'] ?? '').trim(),
          都道府県: (raw['都道府県'] ?? '').trim(),
          市区町村: (raw['市区町村'] ?? '').trim(),
          番地: (raw['番地'] ?? '').trim(),
          建物名部屋番号: (raw['建物名部屋番号'] ?? '').trim(),
          LINEアカウント名: (raw['LINEアカウント名'] ?? '').trim(),
          LINEアカウントID: (raw['LINEアカウントID'] ?? '').trim(),
          知ったきっかけ: (raw['知ったきっかけ'] ?? '').trim(),
          チェックイン日: (raw['チェックイン日'] ?? '').trim(),
          チェックアウト日: (raw['チェックアウト日'] ?? '').trim(),
          人数: (raw['人数'] ?? '').trim(),
          サイト番号: (raw['サイト番号'] ?? '').trim(),
          支払い方法: (raw['支払い方法'] ?? '').trim(),
          備考: (raw['備考'] ?? '').trim(),
        },
        errors,
      });
    } else if (parsed) {
      validRows.push(parsed);
    }
  }

  const internal = detectInternalDuplicates(validRows);
  const external = detectDuplicates(internal.clean, existingReservations);

  return {
    validRows: external.clean,
    errorRows,
    duplicateRows: [...internal.duplicates, ...external.duplicates],
  };
}
