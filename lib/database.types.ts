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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      article_images: {
        Row: {
          alt_text: string
          created_at: string
          height: number
          id: number
          mime_type: string
          original_name: string
          public_url: string
          size_bytes: number
          storage_path: string
          width: number
        }
        Insert: {
          alt_text: string
          created_at?: string
          height: number
          id?: never
          mime_type?: string
          original_name: string
          public_url: string
          size_bytes: number
          storage_path: string
          width: number
        }
        Update: {
          alt_text?: string
          created_at?: string
          height?: number
          id?: never
          mime_type?: string
          original_name?: string
          public_url?: string
          size_bytes?: number
          storage_path?: string
          width?: number
        }
        Relationships: []
      }
      article_videos: {
        Row: {
          created_at: string
          description: string | null
          id: number
          thumbnail_url: string | null
          title: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          thumbnail_url?: string | null
          title: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          thumbnail_url?: string | null
          title?: string
          video_url?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author: string
          category: string
          content: string
          cover_image_alt: string | null
          cover_image_path: string | null
          cover_image_url: string | null
          created_at: string
          editor: string
          excerpt: string
          geo_summary: string | null
          id: number
          image_style: string
          is_headline: boolean
          published_at: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author: string
          category: string
          content: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          cover_image_url?: string | null
          created_at?: string
          editor?: string
          excerpt: string
          geo_summary?: string | null
          id?: never
          image_style?: string
          is_headline?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author?: string
          category?: string
          content?: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          cover_image_url?: string | null
          created_at?: string
          editor?: string
          excerpt?: string
          geo_summary?: string | null
          id?: never
          image_style?: string
          is_headline?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      roles: {
        Row: {
          can_create_roles: string[] | null
          can_delete_roles: string[] | null
          can_edit_roles: string[] | null
          can_see_pages: string[] | null
          created_at: string
          id: string
          job_tasks: string[] | null
          name: string
        }
        Insert: {
          can_create_roles?: string[] | null
          can_delete_roles?: string[] | null
          can_edit_roles?: string[] | null
          can_see_pages?: string[] | null
          created_at?: string
          id?: string
          job_tasks?: string[] | null
          name: string
        }
        Update: {
          can_create_roles?: string[] | null
          can_delete_roles?: string[] | null
          can_edit_roles?: string[] | null
          can_see_pages?: string[] | null
          created_at?: string
          id?: string
          job_tasks?: string[] | null
          name?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: number
          time_format: string
          timezone: string
        }
        Insert: {
          id?: number
          time_format?: string
          timezone?: string
        }
        Update: {
          id?: number
          time_format?: string
          timezone?: string
        }
        Relationships: []
      }
      traffic_daily: {
        Row: {
          created_at: string
          day: string
          page_views: number
        }
        Insert: {
          created_at?: string
          day: string
          page_views: number
        }
        Update: {
          created_at?: string
          day?: string
          page_views?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          password_hash: string
          profile_photo_url: string | null
          role_id: string | null
          time_format: string
          timezone: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          password_hash: string
          profile_photo_url?: string | null
          role_id?: string | null
          time_format?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          password_hash?: string
          profile_photo_url?: string | null
          role_id?: string | null
          time_format?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
