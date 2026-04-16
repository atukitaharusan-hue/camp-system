/** 取込履歴の1件分 */
export interface ImportHistoryEntry {
  id: string;
  /** 取込実行日時 (ISO 8601) */
  executedAt: string;
  /** 実行者メールアドレス */
  executedBy: string;
  /** 元ファイル名 */
  fileName: string;
  /** ファイル内の総行数 (ヘッダー除く) */
  totalRows: number;
  /** 取込成功件数 */
  insertedCount: number;
  /** 取込失敗件数 */
  failedCount: number;
  /** バリデーション段階でエラーになった行数 */
  validationErrorCount: number;
  /** 重複として除外された行数 */
  duplicateCount: number;
  /** エラー詳細 */
  errors: ImportHistoryError[];
}

/** エラー行の詳細 */
export interface ImportHistoryError {
  /** エラーが発生したフェーズ */
  phase: 'validation' | 'duplicate' | 'insert';
  /** 元ファイル上の行番号 */
  rowIndex: number;
  /** 予約者名 (表示用) */
  userName: string;
  /** サイト番号 (表示用) */
  siteNumber: string;
  /** エラー理由 */
  reasons: string[];
}
