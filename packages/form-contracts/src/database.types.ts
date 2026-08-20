export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      forms: {
        Row: { id: number; public_id: string; name: string; draft_definition: Json; published_version_id: number | null; created_at: string; updated_at: string };
        Insert: { id?: never; public_id?: string; name: string; draft_definition?: Json; published_version_id?: number | null; created_at?: string; updated_at?: string };
        Update: { id?: never; public_id?: string; name?: string; draft_definition?: Json; published_version_id?: number | null; updated_at?: string };
        Relationships: [];
      };
      form_versions: {
        Row: { id: number; form_id: number; version_number: number; definition: Json; created_at: string };
        Insert: { id?: never; form_id: number; version_number: number; definition: Json; created_at?: string };
        Update: { id?: never; form_id?: number; version_number?: number; definition?: Json };
        Relationships: [];
      };
      submissions: {
        Row: { id: number; public_id: string; form_id: number; form_version_id: number | null; idempotency_key: string; payload: Json; delivery_status: 'pending' | 'delivered' | 'failed'; delivery_attempts: number; last_delivery_error: string | null; external_response: Json | null; submitted_at: string; created_at: string; updated_at: string };
        Insert: { id?: never; public_id?: string; form_id: number; form_version_id?: number | null; idempotency_key: string; payload: Json; delivery_status?: 'pending' | 'delivered' | 'failed'; delivery_attempts?: number; last_delivery_error?: string | null; external_response?: Json | null; submitted_at?: string; created_at?: string; updated_at?: string };
        Update: { id?: never; form_version_id?: number | null; payload?: Json; delivery_status?: 'pending' | 'delivered' | 'failed'; delivery_attempts?: number; last_delivery_error?: string | null; external_response?: Json | null; updated_at?: string };
        Relationships: [];
      };
      uploads: {
        Row: { id: string; form_id: number; form_version_id: number | null; field_name: string; object_path: string; original_name: string; content_type: 'application/pdf' | 'image/jpeg' | 'image/png'; size_bytes: number; owner_key_hash: string; status: 'pending' | 'ready' | 'attached' | 'expired' | 'rejected'; expires_at: string; completed_at: string | null; attached_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; form_id: number; form_version_id?: number | null; field_name: string; object_path: string; original_name: string; content_type: 'application/pdf' | 'image/jpeg' | 'image/png'; size_bytes: number; owner_key_hash: string; status?: 'pending' | 'ready' | 'attached' | 'expired' | 'rejected'; expires_at?: string; completed_at?: string | null; attached_at?: string | null; created_at?: string; updated_at?: string };
        Update: { status?: 'pending' | 'ready' | 'attached' | 'expired' | 'rejected'; completed_at?: string | null; attached_at?: string | null; updated_at?: string };
        Relationships: [];
      };
      submission_uploads: {
        Row: { submission_id: number; upload_id: string; created_at: string };
        Insert: { submission_id: number; upload_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
