import { reactive } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Plan, Profile } from '../lib/types'

export const auth = reactive({ loading: true, session: null as Session | null, user: null as User | null, profile: null as Profile | null, plan: null as Plan | null })
let started = false

export async function loadAuth() {
  if (started || !isSupabaseConfigured) { auth.loading = false; return }
  started = true
  const { data } = await supabase.auth.getSession()
  await syncSession(data.session)
  supabase.auth.onAuthStateChange((_event, session) => { void syncSession(session) })
}

async function syncSession(session: Session | null) {
  auth.session = session; auth.user = session?.user ?? null; auth.profile = null; auth.plan = null
  if (session?.user) {
    const [{ data: profile }, { data: subscription }] = await Promise.all([
      supabase.from('profiles').select('id,email,display_name').eq('id', session.user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan_id, plans(*)').eq('user_id', session.user.id).eq('status', 'active').maybeSingle(),
    ])
    auth.profile = profile
    const planValue = subscription?.plans
    auth.plan = Array.isArray(planValue) ? planValue[0] ?? null : planValue
  }
  auth.loading = false
}

export async function signOut() { await supabase.auth.signOut() }
