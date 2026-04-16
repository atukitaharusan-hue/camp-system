export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      campgrounds: {
        Row: {
          id: string
          name: string
          description: string | null
          address: string | null
          phone: string | null
          email: string | null
          capacity: number
          operating_hours: Json | null
          amenities: Json | null
          rules: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          capacity?: number
          operating_hours?: Json | null
          amenities?: Json | null
          rules?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          capacity?: number
          operating_hours?: Json | null
          amenities?: Json | null
          rules?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_reservations: {
        Row: {
          id: string
          user_identifier: string | null
          user_name: string
          user_email: string | null
          user_phone: string | null
          check_in_date: string
          check_out_date: string
          nights: number
          guests: number
          adults: number
          children: number
          infants: number
          pets: number
          cars: number
          site_number: string | null
          site_name: string | null
          site_type: Database["public"]["Enums"]["site_type"]
          campground_name: string | null
          total_amount: number
          status: Database["public"]["Enums"]["reservation_status"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          qr_token: string
          options_json: Json
          agreed_cancellation: boolean
          agreed_terms: boolean
          agreed_sns: boolean
          special_requests: string | null
          checked_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_identifier?: string | null
          user_name?: string
          user_email?: string | null
          user_phone?: string | null
          check_in_date: string
          check_out_date: string
          nights?: number
          guests?: number
          adults?: number
          children?: number
          infants?: number
          pets?: number
          cars?: number
          site_number?: string | null
          site_name?: string | null
          site_type?: Database["public"]["Enums"]["site_type"]
          campground_name?: string | null
          total_amount: number
          status?: Database["public"]["Enums"]["reservation_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          qr_token: string
          options_json?: Json
          agreed_cancellation?: boolean
          agreed_terms?: boolean
          agreed_sns?: boolean
          special_requests?: string | null
          checked_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_identifier?: string | null
          user_name?: string
          user_email?: string | null
          user_phone?: string | null
          check_in_date?: string
          check_out_date?: string
          nights?: number
          guests?: number
          adults?: number
          children?: number
          infants?: number
          pets?: number
          cars?: number
          site_number?: string | null
          site_name?: string | null
          site_type?: Database["public"]["Enums"]["site_type"]
          campground_name?: string | null
          total_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          qr_token?: string
          options_json?: Json
          agreed_cancellation?: boolean
          agreed_terms?: boolean
          agreed_sns?: boolean
          special_requests?: string | null
          checked_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          id: string
          executed_by: string
          file_name: string
          total_rows: number
          success_count: number
          error_count: number
          created_at: string
        }
        Insert: {
          id?: string
          executed_by: string
          file_name: string
          total_rows?: number
          success_count?: number
          error_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          executed_by?: string
          file_name?: string
          total_rows?: number
          success_count?: number
          error_count?: number
          created_at?: string
        }
        Relationships: []
      }
      import_job_rows: {
        Row: {
          id: string
          import_job_id: string
          row_number: number
          raw_data_json: Json
          status: string
          error_message: string | null
          created_reservation_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          import_job_id: string
          row_number: number
          raw_data_json?: Json
          status: string
          error_message?: string | null
          created_reservation_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          import_job_id?: string
          row_number?: number
          raw_data_json?: Json
          status?: string
          error_message?: string | null
          created_reservation_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_logs: {
        Row: {
          id: string
          reservation_id: string | null
          notification_type: string
          channel: string
          recipient: string | null
          payload_json: Json
          status: string
          error_message: string | null
          created_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          reservation_id?: string | null
          notification_type: string
          channel?: string
          recipient?: string | null
          payload_json?: Json
          status?: string
          error_message?: string | null
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          id?: string
          reservation_id?: string | null
          notification_type?: string
          channel?: string
          recipient?: string | null
          payload_json?: Json
          status?: string
          error_message?: string | null
          created_at?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      admin_action_logs: {
        Row: {
          id: string
          admin_email: string
          action_type: string
          target_type: string
          target_id: string | null
          before_json: Json | null
          after_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_email: string
          action_type: string
          target_type: string
          target_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_email?: string
          action_type?: string
          target_type?: string
          target_id?: string | null
          before_json?: Json | null
          after_json?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          id: string
          reservation_id: string
          checked_in_by: string | null
          check_in_time: string
          qr_code: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          checked_in_by?: string | null
          check_in_time?: string
          qr_code?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          checked_in_by?: string | null
          check_in_time?: string
          qr_code?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          reservation_id: string | null
          type: string
          title: string
          message: string
          sent_via: Json | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          reservation_id?: string | null
          type: string
          title: string
          message: string
          sent_via?: Json | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          reservation_id?: string | null
          type?: string
          title?: string
          message?: string
          sent_via?: Json | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          }
        ]
      }
      options: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          reservation_id: string
          amount: number
          currency: string
          method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          amount: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          amount?: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          phone: string | null
          full_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          phone?: string | null
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          full_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      reservation_options: {
        Row: {
          id: string
          reservation_id: string
          option_id: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          reservation_id: string
          option_id: string
          quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          reservation_id?: string
          option_id?: string
          quantity?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          }
        ]
      }
      reservations: {
        Row: {
          id: string
          user_id: string
          site_id: string
          check_in_date: string
          check_out_date: string
          guests: number
          total_amount: number
          status: Database["public"]["Enums"]["reservation_status"]
          special_requests: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          site_id: string
          check_in_date: string
          check_out_date: string
          guests?: number
          total_amount: number
          status?: Database["public"]["Enums"]["reservation_status"]
          special_requests?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          site_id?: string
          check_in_date?: string
          check_out_date?: string
          guests?: number
          total_amount?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          special_requests?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          }
        ]
      }
      sites: {
        Row: {
          id: string
          campground_id: string
          site_number: string
          type: Database["public"]["Enums"]["site_type"]
          capacity: number
          price_per_night: number
          description: string | null
          features: Json | null
          location_data: Json | null
          drainage_rating: number | null
          slope_rating: number | null
          view_rating: number | null
          distance_to_facilities: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campground_id: string
          site_number: string
          type?: Database["public"]["Enums"]["site_type"]
          capacity?: number
          price_per_night: number
          description?: string | null
          features?: Json | null
          location_data?: Json | null
          drainage_rating?: number | null
          slope_rating?: number | null
          view_rating?: number | null
          distance_to_facilities?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campground_id?: string
          site_number?: string
          type?: Database["public"]["Enums"]["site_type"]
          capacity?: number
          price_per_night?: number
          description?: string | null
          features?: Json | null
          location_data?: Json | null
          drainage_rating?: number | null
          slope_rating?: number | null
          view_rating?: number | null
          distance_to_facilities?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_campground_id_fkey"
            columns: ["campground_id"]
            isOneToOne: false
            referencedRelation: "campgrounds"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_reservation_total: {
        Args: {
          p_site_id: string
          p_check_in: string
          p_check_out: string
          p_option_ids?: string[]
        }
        Returns: number
      }
      check_site_availability: {
        Args: {
          p_site_id: string
          p_check_in: string
          p_check_out: string
        }
        Returns: boolean
      }
    }
    Enums: {
      payment_method: "credit_card" | "cash" | "bank_transfer"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      reservation_status: "pending" | "confirmed" | "checked_in" | "completed" | "cancelled"
      site_type: "standard" | "premium" | "deluxe" | "tent_only" | "rv_only"
      user_role: "user" | "admin" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}