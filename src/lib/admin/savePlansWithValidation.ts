import { AdminSaveError } from '@/lib/admin/fetchData';
import { persistPlans } from '@/lib/admin/persistPlans';
import { normalizeGuestBandRules } from '@/lib/pricing';
import type { AdminPlan } from '@/types/admin';

function buildPlanValidationErrors(plans: AdminPlan[]) {
  const errors: string[] = [];

  plans.forEach((plan, index) => {
    const label = plan.name.trim() || `プラン${index + 1}`;

    if (!plan.name.trim()) errors.push(`${label}: プラン名を入力してください。`);
    if (!plan.description.trim()) errors.push(`${label}: 説明を入力してください。`);
    if (!Number.isFinite(plan.basePrice) || plan.basePrice < 0) {
      errors.push(`${label}: 基本料金は0円以上で入力してください。`);
    }

    if (plan.pricingMode !== 'per_group' && plan.pricingMode !== 'per_person' && plan.pricingMode !== 'guest_band') {
      errors.push(`${label}: 料金計算パターンを選択してください。`);
    }

    if (plan.pricingMode === 'per_person') {
      if (!Number.isFinite(plan.adultPrice) || plan.adultPrice < 0) {
        errors.push(`${label}: 大人単価は0円以上で入力してください。`);
      }
      if (!Number.isFinite(plan.childPrice) || plan.childPrice < 0) {
        errors.push(`${label}: 子ども単価は0円以上で入力してください。`);
      }
      if (!Number.isFinite(plan.infantPrice) || plan.infantPrice < 0) {
        errors.push(`${label}: 幼児単価は0円以上で入力してください。`);
      }
    }

    if (plan.pricingMode === 'guest_band') {
      const guestBandRules = normalizeGuestBandRules(plan.guestBandRules);
      if (guestBandRules.length === 0) {
        errors.push(`${label}: 人数帯別固定料金のルールを1件以上設定してください。`);
      }

      guestBandRules.forEach((rule) => {
        if (rule.periodMode === 'months' && rule.months.length === 0) {
          errors.push(`${label}: ${rule.label} の適用月を1つ以上選択してください。`);
        }

        if (rule.periodMode === 'date_range') {
          if (!rule.startDate || !rule.endDate) {
            errors.push(`${label}: ${rule.label} の適用期間を入力してください。`);
          } else if (new Date(rule.startDate).getTime() > new Date(rule.endDate).getTime()) {
            errors.push(`${label}: ${rule.label} の終了日は開始日以降にしてください。`);
          }
        }

        if (rule.bands.length === 0) {
          errors.push(`${label}: ${rule.label} の人数帯を1件以上設定してください。`);
        }

        rule.bands.forEach((band) => {
          if (!Number.isInteger(band.maxGuests) || band.maxGuests < 1) {
            errors.push(`${label}: ${rule.label} の最大人数は1以上の整数で入力してください。`);
          }
          if (!Number.isFinite(band.price) || band.price < 0) {
            errors.push(`${label}: ${rule.label} の金額は0円以上で入力してください。`);
          }
        });
      });
    }

    if (!Number.isInteger(plan.maxSiteCount) || plan.maxSiteCount < 1) {
      errors.push(`${label}: 上限サイト数は1以上の整数で入力してください。`);
    }
    if (!Number.isInteger(plan.maxConcurrentReservations) || plan.maxConcurrentReservations < 1) {
      errors.push(`${label}: 同時予約上限数は1以上の整数で入力してください。`);
    }
    if (!Number.isInteger(plan.maxGuestsPerReservation) || plan.maxGuestsPerReservation < 1) {
      errors.push(`${label}: 1予約の上限定員数は1以上の整数で入力してください。`);
    }
    if (
      plan.salesStartDate &&
      plan.salesEndDate &&
      new Date(plan.salesStartDate).getTime() > new Date(plan.salesEndDate).getTime()
    ) {
      errors.push(`${label}: 予約可能期間の終了日は開始日以降にしてください。`);
    }
  });

  return errors;
}

function toPlanSaveError(error: unknown) {
  if (error instanceof AdminSaveError) return error;

  const message =
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'プランの保存に失敗しました。';
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'UNKNOWN';

  if (message.toLowerCase().includes('canceling statement due to statement timeout')) {
    return new AdminSaveError(
      '保存処理が時間切れになりました。変更内容を少し分けて保存するか、少し待ってから再度お試しください。',
      'STATEMENT_TIMEOUT',
      ['関連サイトや適用オプションが多い場合に時間がかかることがあります。'],
    );
  }

  if (message.toLowerCase().includes('failed to fetch')) {
    return new AdminSaveError(
      '保存中に通信が切れました。ネットワーク接続を確認して、もう一度保存してください。',
      'NETWORK_FETCH_FAILED',
      ['画面の内容は残っているので、確認後に再度保存できます。'],
    );
  }

  if (
    code === '23514' &&
    (message.includes('plans_pricing_mode_check') || message.includes('pricing_mode'))
  ) {
    return new AdminSaveError(
      '料金計算パターンの保存条件がDB側で古いままです。guest_band を許可する migration を適用してください。',
      'PRICING_MODE_CONSTRAINT_OUTDATED',
      ['pricing_mode の制約に guest_band が含まれていない可能性があります。'],
    );
  }

  if (
    code === '42703' ||
    message.includes('max_site_count') ||
    message.includes('max_concurrent_reservations') ||
    message.includes('max_guests_per_booking') ||
    message.includes('adult_price') ||
    message.includes('child_price') ||
    message.includes('infant_price') ||
    message.includes('guest_band_rules')
  ) {
    return new AdminSaveError(
      'プラン保存に必要なDB列が不足しています。Supabase の migration を適用してください。',
      'MIGRATION_REQUIRED',
      [
        '不足している可能性がある列: max_site_count / max_concurrent_reservations / max_guests_per_booking / adult_price / child_price / infant_price / guest_band_rules',
      ],
    );
  }

  if (code === '23502') {
    return new AdminSaveError('必須項目が不足しているため保存できません。入力内容を確認してください。', code);
  }

  if (code === '23503') {
    return new AdminSaveError(
      '関連するサイトまたは適用オプションとの紐付けに失敗しました。対象データが存在するか確認してください。',
      code,
    );
  }

  if (code === '42501' || message.toLowerCase().includes('row-level security policy')) {
    return new AdminSaveError(
      '適用オプションの保存権限が不足しているため保存できません。DB の RLS 設定を確認してください。',
      'RLS_POLICY_BLOCKED',
      ['plan_options テーブルの INSERT / DELETE ポリシーが不足している可能性があります。'],
    );
  }

  return new AdminSaveError(message, code);
}

export async function savePlansWithValidation(plans: AdminPlan[]) {
  const validationErrors = buildPlanValidationErrors(plans);
  if (validationErrors.length > 0) {
    throw new AdminSaveError('入力内容に不足があります。', 'VALIDATION_ERROR', validationErrors);
  }

  try {
    await persistPlans(
      plans.map((plan) => ({
        ...plan,
        name: plan.name.trim(),
        description: plan.description.trim(),
        category: plan.category.trim(),
        features: plan.features.trim(),
        pricingMode: plan.pricingMode,
        basePrice: Number(plan.basePrice || 0),
        adultPrice: Number(plan.adultPrice || 0),
        childPrice: Number(plan.childPrice || 0),
        infantPrice: Number(plan.infantPrice || 0),
        guestBandRules: normalizeGuestBandRules(plan.guestBandRules),
        capacity: plan.maxSiteCount,
        salesStartDate: plan.salesStartDate || null,
        salesEndDate: plan.salesEndDate || null,
        imageUrl: plan.imageUrl || '',
        applicableOptionIds: Array.from(new Set(plan.applicableOptionIds.filter(Boolean))),
      })),
    );
  } catch (error) {
    throw toPlanSaveError(error);
  }
}
