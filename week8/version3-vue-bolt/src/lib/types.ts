export type Plan = { id: string; name: string; price_cents: number; character_limit: number; sort_order: number }
export type Profile = { id: string; email: string; display_name: string }
export type Character = { id: string; user_id: string; name: string; species: string | null; role: string | null; level: number | null; health: number | null; max_health: number | null; experience: number | null; abilities: string | null; biography: string | null; created_at: string; updated_at: string }
export type Attribute = { id?: string; character_id?: string; name: string; value: string; position: number }
export type Equipment = { id: string; character_id: string; item_name: string; item_type: string | null; quantity: number; description: string | null }
export type JournalEntry = { id: string; character_id: string; session_date: string; title: string; campaign_name: string | null; attendees: string | null; events: string | null; rewards: string | null; notes: string | null; created_at: string; updated_at: string }
