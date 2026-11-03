<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { auth, loadAuth, signOut } from './stores/auth'
import { isSupabaseConfigured } from './lib/supabase'

const route = useRoute(); const router = useRouter()
onMounted(() => { void loadAuth() })
async function logout() { await signOut(); await router.push('/login') }
</script>

<template>
  <div class="app-shell">
    <span class="corner-mark corner-top">🌿</span><span class="corner-mark corner-bottom">🔥</span>
    <main class="frame">
      <div v-if="!isSupabaseConfigured" class="config-screen"><div class="sigil">✦</div><div class="eyebrow">The chronicle keeper</div><h1>Supabase is not configured</h1><p>Copy <strong>.env.example</strong> to <strong>.env</strong>, then add your Supabase URL and anon key to connect your chronicles.</p></div>
      <template v-else>
        <header v-if="route.path !== '/login' && route.path !== '/register'" class="site-header">
          <div><div class="eyebrow">The chronicle keeper</div><h1>RPG Campaign Chronicles</h1><p class="welcome">Welcome, {{ auth.profile?.display_name || auth.user?.email }} <span v-if="auth.plan">· Tier: {{ auth.plan.name }}</span></p></div>
          <nav><RouterLink to="/characters" :class="{ active: route.path === '/characters' }">Characters</RouterLink><RouterLink to="/plans" :class="{ active: route.path === '/plans' }">Plans</RouterLink><RouterLink to="/account" :class="{ active: route.path === '/account' }">Account</RouterLink><button class="logout" @click="logout">Logout</button></nav>
        </header>
        <RouterView />
        <footer v-if="route.path !== '/login' && route.path !== '/register'"><span>RPG Campaign Chronicles</span><div><a href="#">Twitter 🐦</a><a href="#">Discord 🎮</a><a href="#">Patreon 🛡️</a></div></footer>
      </template>
    </main>
  </div>
</template>
