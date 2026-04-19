import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateQrToken } from '@/lib/generateQrToken';
import { calculateNights, formatAdminErrors, validateReservation } from '@/lib/validateReservation';
import type {
  ImportDuplicate,
  ImportExecutionResult,
  ImportParsedRow,
  ImportRowError,
} from '@/types/import';
import type { Json } from '@/types/database';
import { logAdminAction } from '@/lib/admin/actionLog';

function buildSpecialRequests(row: ImportParsedRow) {
  const lines = [
    `PLAN_NAME: ${row.planName || '-'}`,
    `PLAN_ID: ${row.planId || '-'}`,
    `SITE_NAME: ${row.siteName || '-'}`,
    `GENDER: ${row.gender || '-'}`,
    `OCCUPATION: ${row.occupation || '-'}`,
    `POSTAL_CODE: ${row.postalCode || '-'}`,
    `PREFECTURE: ${row.prefecture || '-'}`,
    `CITY: ${row.city || '-'}`,
    `ADDRESS_LINE: ${row.addressLine || '-'}`,
    `BUILDING: ${row.buildingName || '-'}`,
    `LINE_NAME: ${row.lineDisplayName || '-'}`,
    `LINE_ID: ${row.lineId || '-'}`,
    `REFERRAL_SOURCE: ${row.referralSource || '-'}`,
  ];

  if (row.specialRequests) {
    lines.push(`NOTE: ${row.specialRequests}`);
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: ImportParsedRow[] = body.rows;
    const errorRows: ImportRowError[] = body.errorRows ?? [];
    const duplicateRows: ImportDuplicate[] = body.duplicateRows ?? [];
    const fileName: string = body.fileName ?? '';
    const executedBy: string = body.executedBy ?? '';

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '登録対象の行がありません' }, { status: 400 });
    }

    if (rows.length > 100) {
      return NextResponse.json({ error: '一度に登録できる件数は 100 件までです' }, { status: 400 });
    }

    const totalRows = rows.length + errorRows.length + duplicateRows.length;

    const { data: jobData, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        executed_by: executedBy,
        file_name: fileName,
        total_rows: totalRows,
        success_count: 0,
        error_count: errorRows.length + duplicateRows.length,
      })
      .select('id')
      .single();

    if (jobError || !jobData) {
      return NextResponse.json({ error: 'インポートジョブの作成に失敗しました' }, { status: 500 });
    }

    const jobId = jobData.id;
    const result: ImportExecutionResult = {
      jobId,
      insertedCount: 0,
      failedCount: 0,
      failures: [],
    };

    if (errorRows.length > 0) {
      await supabase.from('import_job_rows').insert(
        errorRows.map((row) => ({
          import_job_id: jobId,
          row_number: row.rowIndex,
          raw_data_json: row.raw as unknown as Json,
          status: 'error',
          error_message: row.errors.join(' / '),
        })),
      );
    }

    if (duplicateRows.length > 0) {
      await supabase.from('import_job_rows').insert(
        duplicateRows.map((dup) => ({
          import_job_id: jobId,
          row_number: dup.rowIndex,
          raw_data_json: dup.parsed as unknown as Json,
          status: 'error',
          error_message: `既存予約または貼り付けデータと重複しています: ${dup.existingCheckIn} - ${dup.existingCheckOut}`,
        })),
      );
    }

    for (const row of rows) {
      const validation = await validateReservation({
        siteNumber: row.siteNumber,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        guests: row.guests,
        source: 'import',
        planId: row.planId,
        requestedSiteCount: 1,
        selectedSiteNumbers: row.siteNumber ? [row.siteNumber] : [],
      });

      if (!validation.valid) {
        const errorMsg = formatAdminErrors(validation.errors);
        result.failedCount += 1;
        result.failures.push({ rowIndex: row.rowIndex, error: errorMsg });
        await supabase.from('import_job_rows').insert({
          import_job_id: jobId,
          row_number: row.rowIndex,
          raw_data_json: row as unknown as Json,
          status: 'error',
          error_message: errorMsg,
        });
        continue;
      }

      const nights = calculateNights(row.checkInDate, row.checkOutDate);

      const { data: insertData, error: insertError } = await supabase
        .from('guest_reservations')
        .insert({
          user_name: row.userName,
          user_phone: row.userPhone || null,
          user_email: row.userEmail || null,
          plan_id: row.planId,
          check_in_date: row.checkInDate,
          check_out_date: row.checkOutDate,
          nights,
          guests: row.guests,
          reserved_site_count: 1,
          selected_site_numbers: row.siteNumber ? [row.siteNumber] : [],
          site_number: row.siteNumber || null,
          site_name: row.siteName || null,
          total_amount: 0,
          status: 'confirmed' as const,
          payment_method: row.paymentMethod,
          payment_status: 'pending' as const,
          qr_token: generateQrToken(),
          options_json: [],
          agreed_cancellation: true,
          agreed_terms: true,
          agreed_sns: false,
          special_requests: buildSpecialRequests(row),
        })
        .select('id')
        .single();

      if (insertError) {
        result.failedCount += 1;
        result.failures.push({ rowIndex: row.rowIndex, error: insertError.message });
        await supabase.from('import_job_rows').insert({
          import_job_id: jobId,
          row_number: row.rowIndex,
          raw_data_json: row as unknown as Json,
          status: 'error',
          error_message: insertError.message,
        });
      } else {
        result.insertedCount += 1;
        await supabase.from('import_job_rows').insert({
          import_job_id: jobId,
          row_number: row.rowIndex,
          raw_data_json: row as unknown as Json,
          status: 'success',
          created_reservation_id: insertData?.id ?? null,
        });
      }
    }

    await supabase
      .from('import_jobs')
      .update({
        success_count: result.insertedCount,
        error_count: errorRows.length + duplicateRows.length + result.failedCount,
      })
      .eq('id', jobId);

    await logAdminAction({
      adminEmail: executedBy,
      actionType: 'import_execute',
      targetType: 'import_job',
      targetId: jobId,
      after: {
        file_name: fileName,
        total_rows: totalRows,
        success_count: result.insertedCount,
        error_count: errorRows.length + duplicateRows.length + result.failedCount,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[import-reservations] Error:', error);
    return NextResponse.json({ error: '登録処理中にエラーが発生しました' }, { status: 500 });
  }
}
