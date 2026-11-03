import { createRouter, createWebHistory } from 'vue-router'
import { auth, loadAuth } from './stores/auth'
import { isSupabaseConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage.vue'
import PlansPage from './pages/PlansPage.vue'
import CharactersPage from './pages/CharactersPage.vue'
import CharacterEditPage from './pages/CharacterEditPage.vue'
import CharacterDetailPage from './pages/CharacterDetailPage.vue'
import AccountPage from './pages/AccountPage.vue'

const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', redirect: '/characters' },
  { path: '/login', component: AuthPage, props: { mode: 'login' } },
  { path: '/register', component: AuthPage, props: { mode: 'register' } },
  { path: '/plans', component: PlansPage },
  { path: '/characters', component: CharactersPage },
  { path: '/characters/new', component: CharacterEditPage },
  { path: '/characters/:id', component: CharacterDetailPage },
  { path: '/characters/:id/edit', component: CharacterEditPage },
  { path: '/account', component: AccountPage },
] })

router.beforeEach(async (to) => {
  if (!isSupabaseConfigured) return true
  await loadAuth()
  if (auth.loading) return true
  const isAuthRoute = to.path === '/login' || to.path === '/register'
  if (!auth.session && !isAuthRoute) return '/login'
  if (auth.session && isAuthRoute) return '/characters'
  return true
})
export default router
