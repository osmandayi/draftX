/** Lightweight captain display info passed from server to the draft room. */
export interface CaptainInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export type CaptainMap = Record<string, CaptainInfo>;
