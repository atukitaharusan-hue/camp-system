/**
 * 本番前テスト用ヘルパー
 *
 * 各予約経路が共通バリデーションを正しく通すことを確認するための
 * テストデータとユーティリティ。
 *
 * 使い方:
 *   import { testFixtures, runValidationSuite } from '@/lib/testValidation';
 *   const results = await runValidationSuite();
 *   console.table(results);
 */

import {
  validateReservation,
  type ReservationValidationInput,
  type ReservationSource,
} from '@/lib/validateReservation';

// ─── テスト用フィクスチャ ───

interface TestCase {
  /** テストケース名 */
  name: string;
  /** 入力データ */
  input: ReservationValidationInput;
  /** 期待するバリデーション結果 (true=通る, false=エラー) */
  expectValid: boolean;
  /** エラーの場合、期待するエラーコード（部分一致） */
  expectCode?: string;
}

const tomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const dayAfterTomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
})();

const threeDaysLater = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
})();

/**
 * テストフィクスチャ一覧
 *
 * 正常系・異常系をカバーする最小限のテストデータ。
 */
export const testFixtures: TestCase[] = [
  // --- 正常系 ---
  {
    name: '正常: Web予約 A-01 1泊',
    input: {
      siteNumber: 'A-01',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 2,
      source: 'web',
    },
    expectValid: true,
  },
  {
    name: '正常: 管理手動 A-02 2泊',
    input: {
      siteNumber: 'A-02',
      checkInDate: tomorrow,
      checkOutDate: threeDaysLater,
      guests: 4,
      source: 'admin',
    },
    expectValid: true,
  },
  {
    name: '正常: インポート B-02 1泊',
    input: {
      siteNumber: 'B-02',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 6,
      source: 'import',
    },
    expectValid: true,
  },

  // --- 異常系 ---
  {
    name: '異常: 日付逆転',
    input: {
      siteNumber: 'A-01',
      checkInDate: dayAfterTomorrow,
      checkOutDate: tomorrow,
      guests: 2,
      source: 'web',
    },
    expectValid: false,
    expectCode: 'INVALID_DATE_ORDER',
  },
  {
    name: '異常: 人数0',
    input: {
      siteNumber: 'A-01',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 0,
      source: 'admin',
    },
    expectValid: false,
    expectCode: 'INVALID_GUESTS',
  },
  {
    name: '異常: 定員超過 A-01(定員4)',
    input: {
      siteNumber: 'A-01',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 10,
      source: 'web',
    },
    expectValid: false,
    expectCode: 'CAPACITY_EXCEEDED',
  },
  {
    name: '異常: 存在しないサイト',
    input: {
      siteNumber: 'Z-99',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 2,
      source: 'admin',
    },
    expectValid: false,
    expectCode: 'SITE_NOT_FOUND',
  },
  {
    name: '異常: メンテナンス中サイト B-01',
    input: {
      siteNumber: 'B-01',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 2,
      source: 'admin',
    },
    expectValid: false,
    expectCode: 'SITE_UNAVAILABLE',
  },
  {
    name: '異常: 非公開サイト B-01 (Web)',
    input: {
      siteNumber: 'B-01',
      checkInDate: tomorrow,
      checkOutDate: dayAfterTomorrow,
      guests: 2,
      source: 'web',
    },
    expectValid: false,
    expectCode: 'SITE_NOT_PUBLISHED',
  },
  {
    name: '異常: 受付停止日 (2026-08-13)',
    input: {
      siteNumber: 'A-01',
      checkInDate: '2026-08-13',
      checkOutDate: '2026-08-14',
      guests: 2,
      source: 'admin',
    },
    expectValid: false,
    expectCode: 'CLOSED_DATE',
  },
];

// ─── テスト実行 ───

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  errors: string[];
}

/**
 * 全テストケースを実行してレポートを返す。
 *
 * ブラウザコンソールや管理画面のデバッグ用。
 * 本番デプロイ前に `runValidationSuite()` を実行して全パスすることを確認する。
 */
export async function runValidationSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const tc of testFixtures) {
    const validation = await validateReservation(tc.input);
    const passed =
      validation.valid === tc.expectValid &&
      (!tc.expectCode || validation.errors.some((e) => e.code === tc.expectCode));

    results.push({
      name: tc.name,
      passed,
      expected: tc.expectValid ? 'valid' : `error(${tc.expectCode ?? 'any'})`,
      actual: validation.valid
        ? 'valid'
        : `error(${validation.errors.map((e) => e.code).join(',')})`,
      errors: validation.errors.map((e) => e.message),
    });
  }

  return results;
}

/**
 * テスト結果のサマリーを文字列で返す
 */
export function formatTestReport(results: TestResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const lines = [
    `バリデーションテスト: ${passed}/${results.length} 通過 (失敗: ${failed})`,
    '',
  ];

  for (const r of results) {
    const mark = r.passed ? 'OK' : 'NG';
    lines.push(`[${mark}] ${r.name}`);
    if (!r.passed) {
      lines.push(`  期待: ${r.expected}`);
      lines.push(`  実際: ${r.actual}`);
    }
  }

  return lines.join('\n');
}
