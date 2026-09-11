// ─── Roulette Types ───────────────────────────────────────────────────────────

export interface RaffleEvent {
  id: number;
  title: string;
  description?: string;
  prize: string;
  is_active: boolean;
  winner_id?: number;
  winner_name?: string;
  winner_phone?: string;
  drawn_at?: string;
  created_at: string;
  participant_count: number;
}

export interface Participant {
  id: number;
  event_id: number;
  user_id?: number;
  name: string;
  phone?: string;
  registered_at: string;
}

export interface DrawResult {
  winner: { id: number; name: string; phone: string };
  index: number;
  total: number;
}

export interface Segment extends Participant {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  color: string;
}

export type AdminTab = "evento" | "participantes";
