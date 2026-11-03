<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

type Props = { mode: 'login' | 'register' }
const props = defineProps<Props>(); const router = useRouter(); const busy = ref(false); const error = ref('')
const form = reactive({ email: '', password: '', confirm: '', displayName: '' })
const title = computed(() => props.mode === 'login' ? 'Welcome back' : 'Create your account')
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }
async function submit() {
  error.value = ''
  if (!validEmail(form.email)) { error.value = 'Enter a valid email address.'; return }
  if (props.mode === 'register' && form.displayName.length > 50) { error.value = 'Display name must be 50 characters or fewer.'; return }
  if (props.mode === 'register' && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password)) { error.value = 'Password must be at least 8 characters with a letter and a number.'; return }
  if (props.mode === 'register' && form.password !== form.confirm) { error.value = 'Passwords do not match.'; return }
  busy.value = true
  const result = props.mode === 'login' ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password }) : await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { display_name: form.displayName } } })
  busy.value = false
  if (result.error) { error.value = props.mode === 'login' ? 'Email or password is incorrect.' : result.error.message.toLowerCase().includes('already') ? 'An account with this email already exists.' : 'We could not create your account. Please try again.'; return }
  await router.push(props.mode === 'register' ? '/plans?welcome=1' : '/characters')
}
</script>

<template>
  <section class="auth-layout"><div class="auth-art"><div class="sigil">✦</div><p class="eyebrow">A living archive for your next adventure</p><h2>Every hero<br><em>has a story.</em></h2><p>Keep your party, your gear, and every hard-won session close at hand.</p><div class="constellation">✧ · ˚ · ✦ · ˚ · ✧</div></div><form class="auth-card" @submit.prevent="submit"><div class="eyebrow">{{ props.mode === 'login' ? 'Return to the archive' : 'Begin your legend' }}</div><h2>{{ title }}</h2><p class="muted">{{ props.mode === 'login' ? 'Your next chapter awaits.' : 'No payment required. Start your chronicle free.' }}</p><label v-if="props.mode === 'register'">Display name<input v-model="form.displayName" placeholder="What shall we call you?" /></label><label>Email<input v-model="form.email" type="email" placeholder="you@realm.com" required /></label><label>Password<input v-model="form.password" type="password" placeholder="8+ characters, letter and number" required /></label><label v-if="props.mode === 'register'">Confirm password<input v-model="form.confirm" type="password" required /></label><p v-if="error" class="form-error">{{ error }}</p><button class="primary full" :disabled="busy">{{ busy ? 'Opening the archive…' : props.mode === 'login' ? 'Enter the chronicles' : 'Create my account' }}</button><p class="switch">{{ props.mode === 'login' ? 'New to the guild?' : 'Already have an account?' }} <RouterLink :to="props.mode === 'login' ? '/register' : '/login'">{{ props.mode === 'login' ? 'Create an account' : 'Sign in' }}</RouterLink></p></form></section>
</template>
