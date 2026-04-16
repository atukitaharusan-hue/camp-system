import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type GuestReservationRow = Database["public"]["Tables"]["guest_reservations"]["Row"];
type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export interface ReservationListFilter {
  status?: ReservationStatus | "all";
}

export interface FetchReservationsResult {
  data: GuestReservationRow[];
  error: string | null;
}

export async function fetchReservations(
  filter?: ReservationListFilter,
): Promise<FetchReservationsResult> {
  let query = supabase
    .from("guest_reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function fetchReservationByIdAdmin(
  id: string,
): Promise<{ data: GuestReservationRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("guest_reservations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
