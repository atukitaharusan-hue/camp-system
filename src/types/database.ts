export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_action_logs: {
        Row: {
          action_type: string
          admin_email: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action_type: string
          admin_email?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action_type?: string
          admin_email?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          status: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          status?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          status?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      admin_members: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          role: string
          user_name: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          role?: string
          user_name: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          role?: string
          user_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      campgrounds: {
        Row: {
          address: string | null
          amenities: Json | null
          capacity: number
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          operating_hours: Json | null
          phone: string | null
          rules: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          capacity?: number
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          operating_hours?: Json | null
          phone?: string | null
          rules?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          capacity?: number
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          rules?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          check_in_time: string
          checked_in_by: string | null
          created_at: string
          id: string
          notes: string | null
          qr_code: string | null
          reservation_id: string
        }
        Insert: {
          check_in_time?: string
          checked_in_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          qr_code?: string | null
          reservation_id: string
        }
        Update: {
          check_in_time?: string
          checked_in_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          qr_code?: string | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_date_ranges: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: []
      }
      closed_dates: {
        Row: {
          closed_date: string
          created_at: string
          id: string
        }
        Insert: {
          closed_date: string
          created_at?: string
          id?: string
        }
        Update: {
          closed_date?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string
          id: string
          image_url: string | null
          is_published: boolean | null
          location: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          location?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_reservations: {
        Row: {
          adults: number
          agreed_cancellation: boolean | null
          agreed_sns: boolean | null
          agreed_terms: boolean | null
          campground_name: string | null
          cars: number
          check_in_date: string
          check_out_date: string
          checked_in_at: string | null
          children: number
          created_at: string
          guests: number
          id: string
          infants: number
          nights: number
          options_json: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pets: number
          qr_token: string
          site_name: string | null
          site_number: string | null
          site_type: Database["public"]["Enums"]["site_type"] | null
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          total_amount: number
          updated_at: string
          user_email: string | null
          user_identifier: string | null
          user_name: string
          user_phone: string | null
        }
        Insert: {
          adults?: number
          agreed_cancellation?: boolean | null
          agreed_sns?: boolean | null
          agreed_terms?: boolean | null
          campground_name?: string | null
          cars?: number
          check_in_date: string
          check_out_date: string
          checked_in_at?: string | null
          children?: number
          created_at?: string
          guests?: number
          id?: string
          infants?: number
          nights?: number
          options_json?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pets?: number
          qr_token: string
          site_name?: string | null
          site_number?: string | null
          site_type?: Database["public"]["Enums"]["site_type"] | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount?: number
          updated_at?: string
          user_email?: string | null
          user_identifier?: string | null
          user_name?: string
          user_phone?: string | null
        }
        Update: {
          adults?: number
          agreed_cancellation?: boolean | null
          agreed_sns?: boolean | null
          agreed_terms?: boolean | null
          campground_name?: string | null
          cars?: number
          check_in_date?: string
          check_out_date?: string
          checked_in_at?: string | null
          children?: number
          created_at?: string
          guests?: number
          id?: string
          infants?: number
          nights?: number
          options_json?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          pets?: number
          qr_token?: string
          site_name?: string | null
          site_number?: string | null
          site_type?: Database["public"]["Enums"]["site_type"] | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount?: number
          updated_at?: string
          user_email?: string | null
          user_identifier?: string | null
          user_name?: string
          user_phone?: string | null
        }
        Relationships: []
      }
      import_job_rows: {
        Row: {
          created_at: string
          created_reservation_id: string | null
          error_message: string | null
          id: string
          import_job_id: string
          raw_data_json: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          created_reservation_id?: string | null
          error_message?: string | null
          id?: string
          import_job_id: string
          raw_data_json?: Json
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          created_reservation_id?: string | null
          error_message?: string | null
          id?: string
          import_job_id?: string
          raw_data_json?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          error_count: number
          executed_by: string
          file_name: string
          id: string
          success_count: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          error_count?: number
          executed_by?: string
          file_name?: string
          id?: string
          success_count?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          error_count?: number
          executed_by?: string
          file_name?: string
          id?: string
          success_count?: number
          total_rows?: number
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_type: string
          payload_json: Json | null
          recipient: string | null
          reservation_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type: string
          payload_json?: Json | null
          recipient?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type?: string
          payload_json?: Json | null
          recipient?: string | null
          reservation_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          reservation_id: string | null
          sent_at: string | null
          sent_via: Json | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reservation_id?: string | null
          sent_at?: string | null
          sent_via?: Json | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reservation_id?: string | null
          sent_at?: string | null
          sent_via?: Json | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          capacity: number | null
          category: string | null
          created_at: string
          current_participants: number | null
          description: string | null
          duration: string | null
          event_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          location: string | null
          max_quantity: number | null
          name: string
          price: number
          price_type: string | null
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          duration?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string | null
          max_quantity?: number | null
          name: string
          price?: number
          price_type?: string | null
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          category?: string | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          duration?: string | null
          event_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          location?: string | null
          max_quantity?: number | null
          name?: string
          price?: number
          price_type?: string | null
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          paid_at: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          paid_at?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sites: {
        Row: {
          plan_id: string
          site_id: string
        }
        Insert: {
          plan_id: string
          site_id: string
        }
        Update: {
          plan_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sites_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          base_price: number
          capacity: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          name: string
          sales_end_date: string | null
          sales_start_date: string | null
          updated_at: string
        }
        Insert: {
          base_price: number
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          name: string
          sales_end_date?: string | null
          sales_start_date?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          name?: string
          sales_end_date?: string | null
          sales_start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      reservation_options: {
        Row: {
          created_at: string
          id: string
          option_id: string
          quantity: number
          reservation_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          quantity?: number
          reservation_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          quantity?: number
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          check_in_date: string
          check_out_date: string
          created_at: string
          guests: number
          id: string
          site_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_date: string
          check_out_date: string
          created_at?: string
          guests?: number
          id?: string
          site_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          guests?: number
          id?: string
          site_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_closures: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          site_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          site_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          site_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_closures_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          area: string | null
          campground_id: string | null
          capacity: number
          created_at: string
          description: string | null
          designation_fee: number | null
          distance_to_facilities: number | null
          drainage_rating: number | null
          feature_note: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          location_data: Json | null
          price_per_night: number
          site_name: string | null
          site_number: string
          site_status: string | null
          slope_rating: number | null
          sub_area: string | null
          type: Database["public"]["Enums"]["site_type"] | null
          updated_at: string
          view_rating: number | null
        }
        Insert: {
          area?: string | null
          campground_id?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          designation_fee?: number | null
          distance_to_facilities?: number | null
          drainage_rating?: number | null
          feature_note?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          location_data?: Json | null
          price_per_night: number
          site_name?: string | null
          site_number: string
          site_status?: string | null
          slope_rating?: number | null
          sub_area?: string | null
          type?: Database["public"]["Enums"]["site_type"] | null
          updated_at?: string
          view_rating?: number | null
        }
        Update: {
          area?: string | null
          campground_id?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          designation_fee?: number | null
          distance_to_facilities?: number | null
          drainage_rating?: number | null
          feature_note?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          location_data?: Json | null
          price_per_night?: number
          site_name?: string | null
          site_number?: string
          site_status?: string | null
          slope_rating?: number | null
          sub_area?: string | null
          type?: Database["public"]["Enums"]["site_type"] | null
          updated_at?: string
          view_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_campground_id_fkey"
            columns: ["campground_id"]
            isOneToOne: false
            referencedRelation: "campgrounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_reservation_total: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_option_ids?: string[]
          p_site_id: string
        }
        Returns: number
      }
      check_site_availability: {
        Args: { p_check_in: string; p_check_out: string; p_site_id: string }
        Returns: boolean
      }
    }
    Enums: {
      payment_method: "credit_card" | "cash" | "bank_transfer"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
      site_type: "standard" | "premium" | "deluxe" | "tent_only" | "rv_only"
      user_role: "user" | "admin" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      payment_method: ["credit_card", "cash", "bank_transfer"],
      payment_status: ["pending", "paid", "refunded", "failed"],
      reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
      ],
      site_type: ["standard", "premium", "deluxe", "tent_only", "rv_only"],
      user_role: ["user", "admin", "manager"],
    },
  },
} as const

