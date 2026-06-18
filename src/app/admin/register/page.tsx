import AdminRegisterPageClient from '@/components/admin/AdminRegisterPageClient';

export default async function AdminRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ reservationId?: string }>;
}) {
  const params = await searchParams;
  return <AdminRegisterPageClient initialReservationId={params.reservationId ?? null} />;
}
