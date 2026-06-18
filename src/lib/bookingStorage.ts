import type { OptionsPayload } from '@/types/options';
import type { BookingDraft } from '@/stores/bookingDraftStore';

export const BOOKING_DRAFT_STORAGE_KEY = 'booking-draft';
export const BOOKING_OPTIONS_STORAGE_KEY = 'booking_options_payload';
export const BOOKING_CONFIRMATION_SNAPSHOT_KEY = 'booking_confirmation_snapshot';
export const LAST_RESERVATION_ID_STORAGE_KEY = 'lastReservationId';
export const MY_PAGE_LINKED_RESERVATION_IDS_STORAGE_KEY = 'mypageLinkedReservationIds';

function getStorage(kind: 'local' | 'session') {
  if (typeof window === 'undefined') return null;
  return kind === 'local' ? window.localStorage : window.sessionStorage;
}

export function readOptionsPayload() {
  const local = getStorage('local');
  const session = getStorage('session');
  const raw = local?.getItem(BOOKING_OPTIONS_STORAGE_KEY) ?? session?.getItem(BOOKING_OPTIONS_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OptionsPayload;
  } catch {
    return null;
  }
}

export function writeOptionsPayload(payload: OptionsPayload) {
  const serialized = JSON.stringify(payload);
  getStorage('local')?.setItem(BOOKING_OPTIONS_STORAGE_KEY, serialized);
  getStorage('session')?.setItem(BOOKING_OPTIONS_STORAGE_KEY, serialized);
}

export function readConfirmationSnapshot() {
  const local = getStorage('local');
  const session = getStorage('session');
  const raw =
    local?.getItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY) ??
    session?.getItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function readPersistedBookingDraft() {
  const local = getStorage('local');
  const session = getStorage('session');
  const raw = local?.getItem(BOOKING_DRAFT_STORAGE_KEY) ?? session?.getItem(BOOKING_DRAFT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as
      | BookingDraft
      | {
          state?: BookingDraft;
        };

    if (parsed && typeof parsed === 'object' && 'state' in parsed && parsed.state) {
      return parsed.state;
    }

    return parsed as BookingDraft;
  } catch {
    return null;
  }
}

export function writeConfirmationSnapshot(snapshot: BookingDraft) {
  const serialized = JSON.stringify(snapshot);
  getStorage('local')?.setItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY, serialized);
  getStorage('session')?.setItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY, serialized);
}

export function setLastReservationId(reservationId: string) {
  getStorage('local')?.setItem(LAST_RESERVATION_ID_STORAGE_KEY, reservationId);
  getStorage('session')?.setItem(LAST_RESERVATION_ID_STORAGE_KEY, reservationId);
}

export function readLastReservationId() {
  const local = getStorage('local');
  const session = getStorage('session');
  return local?.getItem(LAST_RESERVATION_ID_STORAGE_KEY) ?? session?.getItem(LAST_RESERVATION_ID_STORAGE_KEY) ?? null;
}

export function readMyPageLinkedReservationIds() {
  const local = getStorage('local');
  const session = getStorage('session');
  const raw =
    local?.getItem(MY_PAGE_LINKED_RESERVATION_IDS_STORAGE_KEY) ??
    session?.getItem(MY_PAGE_LINKED_RESERVATION_IDS_STORAGE_KEY);
  if (!raw) return [] as string[];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [] as string[];
  }
}

export function addMyPageLinkedReservationId(reservationId: string) {
  const next = Array.from(new Set([...readMyPageLinkedReservationIds(), reservationId]));
  const serialized = JSON.stringify(next);
  getStorage('local')?.setItem(MY_PAGE_LINKED_RESERVATION_IDS_STORAGE_KEY, serialized);
  getStorage('session')?.setItem(MY_PAGE_LINKED_RESERVATION_IDS_STORAGE_KEY, serialized);
}

export function clearBookingFlowStorage() {
  getStorage('local')?.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  getStorage('session')?.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  getStorage('local')?.removeItem(BOOKING_OPTIONS_STORAGE_KEY);
  getStorage('session')?.removeItem(BOOKING_OPTIONS_STORAGE_KEY);
  getStorage('local')?.removeItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY);
  getStorage('session')?.removeItem(BOOKING_CONFIRMATION_SNAPSHOT_KEY);
}
