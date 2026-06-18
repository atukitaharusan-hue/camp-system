export function buildReservationQrValue(reservationId: string, qrToken: string) {
  const path = `/checkin?id=${encodeURIComponent(reservationId)}&token=${encodeURIComponent(qrToken)}`;

  if (typeof window === 'undefined') {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export function buildCounterSessionQrValue(counterToken: string) {
  const path = `/admin/checkin-session?token=${encodeURIComponent(counterToken)}`;

  if (typeof window === 'undefined') {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export function extractReservationIdentityFromQr(rawValue: string) {
  const trimmed = rawValue.trim();

  try {
    const url = new URL(trimmed);
    const reservationId = url.searchParams.get('id');
    const qrToken = url.searchParams.get('token');

    return {
      reservationId: reservationId && reservationId.length > 0 ? reservationId : null,
      qrToken: qrToken && qrToken.length > 0 ? qrToken : null,
    };
  } catch {
    // Plain text QR values are supported below.
  }

  if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { reservationId: trimmed, qrToken: null };
  }

  if (trimmed.length > 0) {
    return { reservationId: null, qrToken: trimmed };
  }

  return { reservationId: null, qrToken: null };
}

export function extractCounterSessionTokenFromQr(rawValue: string) {
  const trimmed = rawValue.trim();

  try {
    const url = new URL(trimmed);
    const pathMatches = /\/admin\/checkin-session$/i.test(url.pathname);
    const token = url.searchParams.get('token');
    return {
      sessionToken: pathMatches && token && token.length > 0 ? token : null,
    };
  } catch {
    // Plain text fallback below.
  }

  if (/^chk_[a-z0-9_-]{16,}$/i.test(trimmed)) {
    return { sessionToken: trimmed };
  }

  return { sessionToken: null };
}
