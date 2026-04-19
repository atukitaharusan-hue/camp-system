import type {
  ImportColumnKey,
  ImportDuplicate,
  ImportParsedRow,
  ImportRawRow,
  ImportRowError,
  ImportValidationResult,
} from '@/types/import';
import { IMPORT_COLUMNS, IMPORT_COLUMN_KEYS, PAYMENT_METHOD_MAP } from '@/types/import';
import { parseSiteNumber } from '@/lib/validateReservation';
import type { AdminPlan, AdminSite } from '@/types/admin';

export interface ExistingReservation {
  site_number: string;
  check_in_date: string;
  check_out_date: string;
}

export interface ImportValidationContext {
  plans: AdminPlan[];
  sites: AdminSite[];
}

const DATE_REGEX_YYYY_MM_DD = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_REGEX = /^\d{3}-?\d{4}$/;
const VALID_OCCUPATIONS = ['会社員', '学生', '自営業', '公務員', '主婦', '無職', 'その他'];

function createEmptyRawRow(): ImportRawRow {
  return IMPORT_COLUMN_KEYS.reduce((acc, key) => {
    acc[key] = '';
    return acc;
  }, {} as ImportRawRow);
}

export function parseClipboardTable(text: string): ImportRawRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  return lines.map((line) => {
    const cells = line.split('\t');
    const row = createEmptyRawRow();
    IMPORT_COLUMN_KEYS.forEach((key, index) => {
      row[key] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

export function rowsToClipboardText(rows: ImportRawRow[]): string {
  return rows
    .map((row) => IMPORT_COLUMN_KEYS.map((key) => row[key] ?? '').join('\t'))
    .join('\n');
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (DATE_REGEX_YYYY_MM_DD.test(trimmed)) {
    const parts = trimmed.split(/[-/]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const date = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : dateStr;
  }

  const num = Number(trimmed);
  if (!Number.isNaN(num) && num > 30000 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

function addFieldError(
  fieldErrors: Partial<Record<ImportColumnKey, string>>,
  errors: string[],
  field: ImportColumnKey,
  message: string,
) {
  fieldErrors[field] = message;
  errors.push(message);
}

export function validateRow(
  raw: ImportRawRow,
  rowIndex: number,
  context?: ImportValidationContext,
): { parsed?: ImportParsedRow; errors: string[]; fieldErrors: Partial<Record<ImportColumnKey, string>> } {
  const errors: string[] = [];
  const fieldErrors: Partial<Record<ImportColumnKey, string>> = {};
  const validSites = context?.sites ?? [];
  const siteByNumber = new Map(validSites.map((site) => [site.siteNumber, site]));
  const siteByName = new Map(validSites.map((site) => [site.siteName, site]));
  const planByName = new Map((context?.plans ?? []).map((plan) => [plan.name, plan]));

  if (!raw.userName.trim()) addFieldError(fieldErrors, errors, 'userName', '予約者名は必須です');
  if (!raw.planName.trim()) addFieldError(fieldErrors, errors, 'planName', 'プラン名は必須です');
  if (!raw.siteNumber.trim()) addFieldError(fieldErrors, errors, 'siteNumber', 'サイト番号は必須です');
  if (!raw.siteName.trim()) addFieldError(fieldErrors, errors, 'siteName', 'サイト名は必須です');
  if (!raw.checkInDate.trim()) addFieldError(fieldErrors, errors, 'checkInDate', 'チェックイン日は必須です');
  if (!raw.checkOutDate.trim()) addFieldError(fieldErrors, errors, 'checkOutDate', 'チェックアウト日は必須です');
  if (!raw.guests.trim()) addFieldError(fieldErrors, errors, 'guests', '人数は必須です');
  if (!raw.paymentMethod.trim()) addFieldError(fieldErrors, errors, 'paymentMethod', '支払い方法は必須です');

  if (raw.userEmail.trim() && !EMAIL_REGEX.test(raw.userEmail.trim())) {
    addFieldError(fieldErrors, errors, 'userEmail', 'メールアドレス形式が不正です');
  }

  if (raw.postalCode.trim() && !POSTAL_CODE_REGEX.test(raw.postalCode.trim())) {
    addFieldError(fieldErrors, errors, 'postalCode', '郵便番号形式が不正です');
  }

  if (raw.occupation.trim() && !VALID_OCCUPATIONS.includes(raw.occupation.trim())) {
    addFieldError(fieldErrors, errors, 'occupation', `職業が不正です: ${raw.occupation}`);
  }

  const checkInDate = normalizeDate(raw.checkInDate);
  const checkOutDate = normalizeDate(raw.checkOutDate);

  if (raw.checkInDate.trim() && !checkInDate) {
    addFieldError(fieldErrors, errors, 'checkInDate', `チェックイン日形式が不正です: ${raw.checkInDate}`);
  }
  if (raw.checkOutDate.trim() && !checkOutDate) {
    addFieldError(fieldErrors, errors, 'checkOutDate', `チェックアウト日形式が不正です: ${raw.checkOutDate}`);
  }
  if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
    addFieldError(fieldErrors, errors, 'checkOutDate', 'チェックアウト日はチェックイン日より後にしてください');
  }

  const guests = parseInt(raw.guests, 10);
  if (raw.guests.trim() && (Number.isNaN(guests) || guests < 1)) {
    addFieldError(fieldErrors, errors, 'guests', `人数が不正です: ${raw.guests}`);
  }

  const plan = raw.planName.trim() ? planByName.get(raw.planName.trim()) : null;
  if (raw.planName.trim() && !plan) {
    addFieldError(fieldErrors, errors, 'planName', `指定されたプラン名が存在しません: ${raw.planName}`);
  }

  const { siteNumber: normalizedSite } = parseSiteNumber(raw.siteNumber || '');
  const siteByNumberMatch = raw.siteNumber.trim() ? siteByNumber.get(normalizedSite) : null;
  const siteByNameMatch = raw.siteName.trim() ? siteByName.get(raw.siteName.trim()) : null;

  if (raw.siteNumber.trim() && !siteByNumberMatch) {
    addFieldError(fieldErrors, errors, 'siteNumber', `サイト番号が存在しません: ${raw.siteNumber}`);
  }
  if (raw.siteName.trim() && !siteByNameMatch) {
    addFieldError(fieldErrors, errors, 'siteName', `指定されたサイト名が存在しません: ${raw.siteName}`);
  }

  if (siteByNumberMatch && raw.siteName.trim() && siteByNumberMatch.siteName !== raw.siteName.trim()) {
    addFieldError(fieldErrors, errors, 'siteName', 'サイト番号とサイト名が一致しません');
  }

  if (
    raw.siteNumber.trim() &&
    siteByNumberMatch &&
    !Number.isNaN(guests) &&
    guests > siteByNumberMatch.capacity
  ) {
    addFieldError(
      fieldErrors,
      errors,
      'guests',
      `人数が定員超過です。${normalizedSite} の上限は ${siteByNumberMatch.capacity} 名です`,
    );
  }

  if (plan && siteByNumberMatch && !plan.targetSiteIds.includes(siteByNumberMatch.id)) {
    addFieldError(fieldErrors, errors, 'siteNumber', '指定されたサイトは対象プランに紐付いていません');
  }

  const paymentMethod = PAYMENT_METHOD_MAP[raw.paymentMethod];
  if (raw.paymentMethod.trim() && !paymentMethod) {
    addFieldError(fieldErrors, errors, 'paymentMethod', `支払い方法が不正です: ${raw.paymentMethod}`);
  }

  if (errors.length > 0) {
    return { errors, fieldErrors };
  }

  return {
    parsed: {
      rowIndex,
      userName: raw.userName.trim(),
      planName: raw.planName.trim(),
      planId: plan!.id,
      gender: raw.gender.trim(),
      occupation: raw.occupation.trim(),
      userPhone: raw.userPhone.trim(),
      userEmail: raw.userEmail.trim(),
      postalCode: raw.postalCode.trim(),
      prefecture: raw.prefecture.trim(),
      city: raw.city.trim(),
      addressLine: raw.addressLine.trim(),
      buildingName: raw.buildingName.trim(),
      lineDisplayName: raw.lineDisplayName.trim(),
      lineId: raw.lineId.trim(),
      referralSource: raw.referralSource.trim(),
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      guests,
      siteNumber: normalizedSite,
      siteName: siteByNumberMatch?.siteName ?? raw.siteName.trim(),
      siteId: siteByNumberMatch!.id,
      paymentMethod: paymentMethod!,
      specialRequests: raw.specialRequests.trim(),
    },
    errors: [],
    fieldErrors: {},
  };
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
        fieldErrors: {
          siteNumber: `既存予約と重複しています: ${overlap.check_in_date} - ${overlap.check_out_date}`,
        },
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
        fieldErrors: {
          siteNumber: `貼り付けデータ内で重複しています: ${overlapWith.checkInDate} - ${overlapWith.checkOutDate}`,
        },
      });
    } else {
      clean.push(row);
    }
  }

  return { clean, duplicates };
}

export function validateAllRows(
  rawRows: ImportRawRow[],
  existingReservations: ExistingReservation[],
  context?: ImportValidationContext,
): ImportValidationResult {
  const validRows: ImportParsedRow[] = [];
  const errorRows: ImportRowError[] = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    const raw = rawRows[index];
    const { parsed, errors, fieldErrors } = validateRow(raw, index + 1, context);

    if (errors.length > 0) {
      errorRows.push({
        rowIndex: index + 1,
        raw,
        errors,
        fieldErrors,
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

export function getFieldErrorMap(
  errorRows: ImportRowError[],
  duplicateRows: ImportDuplicate[],
): Record<number, Partial<Record<ImportColumnKey, string>>> {
  const result: Record<number, Partial<Record<ImportColumnKey, string>>> = {};

  errorRows.forEach((row) => {
    result[row.rowIndex] = { ...(result[row.rowIndex] ?? {}), ...row.fieldErrors };
  });

  duplicateRows.forEach((row) => {
    result[row.rowIndex] = { ...(result[row.rowIndex] ?? {}), ...(row.fieldErrors ?? {}) };
  });

  return result;
}

export function getRowErrorMessages(
  errorRows: ImportRowError[],
  duplicateRows: ImportDuplicate[],
): Record<number, string[]> {
  const result: Record<number, string[]> = {};

  errorRows.forEach((row) => {
    result[row.rowIndex] = row.errors;
  });

  duplicateRows.forEach((row) => {
    result[row.rowIndex] = [
      ...(result[row.rowIndex] ?? []),
      `既存予約または貼り付けデータと重複しています: ${row.existingCheckIn} - ${row.existingCheckOut}`,
    ];
  });

  return result;
}

export function createTemplateClipboardText() {
  const headerRow = IMPORT_COLUMNS.map((column) => column.label).join('\t');
  const sampleRow = IMPORT_COLUMN_KEYS.map((key) => createEmptySampleRow()[key]).join('\t');
  return `${headerRow}\n${sampleRow}`;
}

function createEmptySampleRow(): ImportRawRow {
  return {
    userName: '山田 太郎',
    planName: '電源付きキャンピングカーサイト',
    siteNumber: 'A-01',
    siteName: 'Aエリア 1番サイト',
    gender: '男性',
    userPhone: '090-1234-5678',
    occupation: '会社員',
    userEmail: 'sample@example.com',
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
}
