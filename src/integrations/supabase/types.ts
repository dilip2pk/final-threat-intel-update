export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_prompt_versions: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          prompt_id: string
          system_prompt: string
          user_prompt_template: string
          version: number
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          prompt_id: string
          system_prompt?: string
          user_prompt_template?: string
          version: number
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          prompt_id?: string
          system_prompt?: string
          user_prompt_template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          prompt_key: string
          provider: string
          system_prompt: string
          updated_at: string
          user_prompt_template: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          prompt_key: string
          provider?: string
          system_prompt?: string
          updated_at?: string
          user_prompt_template?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          prompt_key?: string
          provider?: string
          system_prompt?: string
          updated_at?: string
          user_prompt_template?: string
          version?: number
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          keywords: string[]
          name: string
          severity_threshold: string
          updated_at: string
          url_pattern: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
          severity_threshold?: string
          updated_at?: string
          url_pattern?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
          severity_threshold?: string
          updated_at?: string
          url_pattern?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          body: string | null
          created_at: string
          error_message: string | null
          id: string
          recipients: string[]
          related_feed_id: string | null
          related_feed_title: string | null
          status: string
          subject: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipients: string[]
          related_feed_id?: string | null
          related_feed_title?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          recipients?: string[]
          related_feed_id?: string | null
          related_feed_title?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      feed_sources: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          last_fetched: string | null
          name: string
          tags: string[]
          total_items: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          last_fetched?: string | null
          name: string
          tags?: string[]
          total_items?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          last_fetched?: string | null
          name?: string
          tags?: string[]
          total_items?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          created_at: string
          format: string
          id: string
          name: string
          report_html: string | null
          report_url: string | null
          scan_id: string | null
          scan_target: string | null
          scan_type: string | null
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          name: string
          report_html?: string | null
          report_url?: string | null
          scan_id?: string | null
          scan_target?: string | null
          scan_type?: string | null
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          name?: string
          report_html?: string | null
          report_url?: string | null
          scan_id?: string | null
          scan_target?: string | null
          scan_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scan_results: {
        Row: {
          created_at: string
          host: string
          host_status: string | null
          id: string
          os_detection: string | null
          ports: Json | null
          raw_output: string | null
          scan_id: string
          vulnerabilities: Json | null
        }
        Insert: {
          created_at?: string
          host: string
          host_status?: string | null
          id?: string
          os_detection?: string | null
          ports?: Json | null
          raw_output?: string | null
          scan_id: string
          vulnerabilities?: Json | null
        }
        Update: {
          created_at?: string
          host?: string
          host_status?: string | null
          id?: string
          os_detection?: string | null
          ports?: Json | null
          raw_output?: string | null
          scan_id?: string
          vulnerabilities?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_results_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_schedules: {
        Row: {
          active: boolean | null
          auto_ai_analysis: boolean | null
          auto_ticket: boolean | null
          created_at: string
          cron_expression: string | null
          custom_options: string | null
          enable_scripts: boolean | null
          frequency: string
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          notify_email: boolean | null
          ports: string | null
          scan_type: string
          target: string
          target_type: string
          timing_template: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          auto_ai_analysis?: boolean | null
          auto_ticket?: boolean | null
          created_at?: string
          cron_expression?: string | null
          custom_options?: string | null
          enable_scripts?: boolean | null
          frequency?: string
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          notify_email?: boolean | null
          ports?: string | null
          scan_type?: string
          target: string
          target_type?: string
          timing_template?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          auto_ai_analysis?: boolean | null
          auto_ticket?: boolean | null
          created_at?: string
          cron_expression?: string | null
          custom_options?: string | null
          enable_scripts?: boolean | null
          frequency?: string
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          notify_email?: boolean | null
          ports?: string | null
          scan_type?: string
          target?: string
          target_type?: string
          timing_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          ai_analysis: Json | null
          completed_at: string | null
          created_at: string
          custom_options: string | null
          enable_scripts: boolean | null
          error_message: string | null
          id: string
          initiated_by: string | null
          ports: string | null
          result_summary: Json | null
          scan_type: string
          started_at: string | null
          status: string
          target: string
          target_type: string
          timing_template: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          custom_options?: string | null
          enable_scripts?: boolean | null
          error_message?: string | null
          id?: string
          initiated_by?: string | null
          ports?: string | null
          result_summary?: Json | null
          scan_type?: string
          started_at?: string | null
          status?: string
          target: string
          target_type?: string
          timing_template?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          custom_options?: string | null
          enable_scripts?: boolean | null
          error_message?: string | null
          id?: string
          initiated_by?: string | null
          ports?: string | null
          result_summary?: Json | null
          scan_type?: string
          started_at?: string | null
          status?: string
          target?: string
          target_type?: string
          timing_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          active: boolean | null
          configuration: Json
          created_at: string
          cron_expression: string | null
          frequency: string
          id: string
          job_type: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          name: string
          next_run_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          configuration?: Json
          created_at?: string
          cron_expression?: string | null
          frequency?: string
          id?: string
          job_type?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          next_run_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          configuration?: Json
          created_at?: string
          cron_expression?: string | null
          frequency?: string
          id?: string
          job_type?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          next_run_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shodan_queries: {
        Row: {
          created_at: string
          id: string
          is_dork: boolean
          last_run_at: string | null
          name: string
          query: string
          query_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dork?: boolean
          last_run_at?: string | null
          name: string
          query: string
          query_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dork?: boolean
          last_run_at?: string | null
          name?: string
          query?: string
          query_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      shodan_results: {
        Row: {
          created_at: string
          id: string
          query_id: string
          result_data: Json
        }
        Insert: {
          created_at?: string
          id?: string
          query_id: string
          result_data?: Json
        }
        Update: {
          created_at?: string
          id?: string
          query_id?: string
          result_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shodan_results_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "shodan_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_hunt_playbooks: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_builtin: boolean
          name: string
          severity: string
          steps: Json
          tags: string[]
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          severity?: string
          steps?: Json
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          severity?: string
          steps?: Json
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      threat_hunt_results: {
        Row: {
          created_at: string
          description: string | null
          hunt_id: string
          id: string
          is_false_positive: boolean
          match_data: Json
          severity: string
          source_id: string | null
          source_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hunt_id: string
          id?: string
          is_false_positive?: boolean
          match_data?: Json
          severity?: string
          source_id?: string | null
          source_type?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hunt_id?: string
          id?: string
          is_false_positive?: boolean
          match_data?: Json
          severity?: string
          source_id?: string | null
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "threat_hunt_results_hunt_id_fkey"
            columns: ["hunt_id"]
            isOneToOne: false
            referencedRelation: "threat_hunts"
            referencedColumns: ["id"]
          },
        ]
      }
      threat_hunts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          findings_count: number
          hunt_type: string
          id: string
          name: string
          query: Json
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          findings_count?: number
          hunt_type?: string
          id?: string
          name: string
          query?: Json
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          findings_count?: number
          hunt_type?: string
          id?: string
          name?: string
          query?: Json
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_history: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_log"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_log: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          related_feed_id: string | null
          related_feed_title: string | null
          resolution_notes: string | null
          status: string
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          related_feed_id?: string | null
          related_feed_title?: string | null
          resolution_notes?: string | null
          status?: string
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          related_feed_id?: string | null
          related_feed_title?: string | null
          resolution_notes?: string | null
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      top_cves: {
        Row: {
          created_at: string
          created_by: string | null
          cve_id: string
          description: string | null
          id: string
          published_date: string | null
          severity: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cve_id: string
          description?: string | null
          id?: string
          published_date?: string | null
          severity?: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cve_id?: string
          description?: string | null
          id?: string
          published_date?: string | null
          severity?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracker_entries: {
        Row: {
          comments: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          cve_id: string | null
          deployment_type: string | null
          eta_upgrade: string | null
          feed_link: string | null
          feed_source: string | null
          feed_title: string
          id: string
          mitigated: string | null
          operating_system: string | null
          package_installed: string | null
          product_architect: string | null
          product_name: string
          rnd_lead: string | null
          service_enabled: string | null
          severity: string | null
          support_owner: string | null
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          cve_id?: string | null
          deployment_type?: string | null
          eta_upgrade?: string | null
          feed_link?: string | null
          feed_source?: string | null
          feed_title: string
          id?: string
          mitigated?: string | null
          operating_system?: string | null
          package_installed?: string | null
          product_architect?: string | null
          product_name: string
          rnd_lead?: string | null
          service_enabled?: string | null
          severity?: string | null
          support_owner?: string | null
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          cve_id?: string | null
          deployment_type?: string | null
          eta_upgrade?: string | null
          feed_link?: string | null
          feed_source?: string | null
          feed_title?: string
          id?: string
          mitigated?: string | null
          operating_system?: string | null
          package_installed?: string | null
          product_architect?: string | null
          product_name?: string
          rnd_lead?: string | null
          service_enabled?: string | null
          severity?: string | null
          support_owner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          active: boolean
          created_at: string
          id: string
          notify_frequency: string
          notify_method: string
          organization: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          notify_frequency?: string
          notify_method?: string
          organization: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          notify_frequency?: string
          notify_method?: string
          organization?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
