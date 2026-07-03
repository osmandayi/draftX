/**
 * Hand-maintained types mirroring supabase/migrations/0001_init.sql.
 * Regenerate with `supabase gen types typescript` once the CLI is wired up.
 */

export type DraftStatus = "lobby" | "active" | "completed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      drafts: {
        Row: {
          id: string;
          name: string;
          creator_id: string;
          status: DraftStatus;
          invite_token: string;
          captain_a: string | null;
          captain_b: string | null;
          current_captain: string | null;
          turn_index: number;
          turn_seconds: number;
          turn_deadline: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          creator_id: string;
          captain_a: string;
          status?: DraftStatus;
          invite_token?: string;
        };
        Update: never;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          draft_id: string;
          name: string;
          drafted_by: string | null;
          pick_number: number | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          draft_id: string;
          name: string;
          created_by: string;
        };
        Update: never;
        Relationships: [];
      };
      picks: {
        Row: {
          id: string;
          draft_id: string;
          player_id: string;
          captain_id: string;
          pick_number: number;
          was_auto: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      add_player: {
        Args: { p_draft_id: string; p_name: string };
        Returns: Database["public"]["Tables"]["players"]["Row"];
      };
      remove_player: { Args: { p_player_id: string }; Returns: undefined };
      join_draft: { Args: { p_token: string }; Returns: string };
      start_draft: {
        Args: { p_draft_id: string; p_turn_seconds?: number };
        Returns: undefined;
      };
      make_pick: {
        Args: { p_draft_id: string; p_player_id: string };
        Returns: undefined;
      };
      resolve_timeout: { Args: { p_draft_id: string }; Returns: undefined };
      get_invite: {
        Args: { p_token: string };
        Returns: {
          id: string;
          name: string;
          status: DraftStatus;
          captain_name: string | null;
          has_second: boolean;
          player_count: number;
        }[];
      };
    };
    Enums: { draft_status: DraftStatus };
    CompositeTypes: Record<never, never>;
  };
}

export type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];
export type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
export type PickRow = Database["public"]["Tables"]["picks"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
