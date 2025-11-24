<template>
  <div class="login-page">
    <div class="theme-toggle" @click="toggleTheme" title="切换主题">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
      </svg>
    </div>

    <div class="login-container">
      <div class="login-card">
        <div class="logo-area">
          <h1>AI Vision Studio</h1>
          <p class="subtitle">{{ isLogin ? '登录以继续您的创作之旅' : '创建新账号以开始使用' }}</p>
        </div>

        <div v-if="errorMsg" class="error-message">{{ errorMsg }}</div>

        <!-- Login Form -->
        <form v-if="isLogin" @submit.prevent="handleLogin" class="form-container">
          <div class="form-group">
            <input type="text" v-model="loginForm.username" class="form-control" placeholder=" " required autocomplete="username">
            <label class="form-label">用户名</label>
          </div>
          <div class="form-group">
            <input type="password" v-model="loginForm.password" class="form-control" placeholder=" " required autocomplete="current-password">
            <label class="form-label">密码</label>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '处理中...' : '登 录' }}
          </button>
          
          <div class="switch-mode">
            还没有账号？ <a @click="toggleForm">立即注册</a>
          </div>
        </form>

        <!-- Register Form -->
        <form v-else @submit.prevent="handleRegister" class="form-container">
          <div class="form-group">
            <input type="text" v-model="registerForm.username" class="form-control" placeholder=" " required autocomplete="username">
            <label class="form-label">用户名</label>
          </div>
          <div class="form-group">
            <input type="password" v-model="registerForm.password" class="form-control" placeholder=" " required autocomplete="new-password">
            <label class="form-label">密码 (至少6位)</label>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '处理中...' : '创建账号' }}
          </button>
          
          <div class="switch-mode">
            已有账号？ <a @click="toggleForm">返回登录</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const isLogin = ref(true)
const loading = ref(false)
const errorMsg = ref('')
const isDark = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const registerForm = reactive({
  username: '',
  password: ''
})

const toggleForm = () => {
  isLogin.value = !isLogin.value
  errorMsg.value = ''
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const showError = (msg) => {
  errorMsg.value = msg
  // Trigger shake animation logic if needed, but simple display is fine for now
}

const handleLogin = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    await userStore.login(loginForm.username, loginForm.password)
    router.push('/')
  } catch (err) {
    showError(err.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (registerForm.password.length < 6) {
    showError('密码长度至少为6位')
    return
  }
  
  loading.value = true
  errorMsg.value = ''
  try {
    await axios.post('/api/auth/register', registerForm)
    // Auto login
    await userStore.login(registerForm.username, registerForm.password)
    router.push('/')
  } catch (err) {
    showError(err.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})
</script>

<style scoped>
/* =================================================================
   1. 核心修复：将 CSS 变量定义提升到全局根作用域
   注意：千万不要在 .login-page {} 里面再次定义这些变量，否则会覆盖暗黑模式
   ================================================================= */
:global(:root) {
  /* --- 亮色模式 (Light Mode) --- */
  --bg-color: #fbfbfd;
  --card-bg: rgba(255, 255, 255, 0.8);
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --accent-color: #0066cc;
  --accent-hover: #0077ed;
  --border-color: rgba(0, 0, 0, 0.1);
  --input-bg: rgba(0, 0, 0, 0.03);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.08);
  --error-color: #ff3b30;
  
  /* 背景光球颜色 */
  --blob-color-1: var(--accent-color);
  --blob-color-2: #bf5af2;
  --blob-opacity: 0.15; /* 亮色模式光球浓度 */

  /* 通用设置 */
  --font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --radius-large: 24px;
  --radius-medium: 14px;
  --radius-small: 8px;
  --transition-spring: 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  --transition-smooth: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* --- 暗黑模式 (Dark Mode) --- */
:global(html.dark) {
  --bg-color: #000000;
  --card-bg: rgba(28, 28, 30, 0.7); /* 稍微增加透明度 */
  --text-primary: #f5f5f7;
  --text-secondary: #a1a1a6;
  --accent-color: #2997ff;
  --accent-hover: #47aaff;
  --border-color: rgba(255, 255, 255, 0.15);
  --input-bg: rgba(255, 255, 255, 0.1);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.6);

  /* 2. 视觉优化：暗黑模式下，光球如果太亮会像雾霾，这里调低不透明度并加深颜色 */
  --blob-color-1: #0a84ff; 
  --blob-color-2: #5e5ce6;
  --blob-opacity: 0.25; /* 暗色模式稍微亮一点点因为背景黑 */
}

/* =================================================================
   3. 全局 Body 重置 (防止白边)
   ================================================================= */
:global(body) {
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  transition: background-color 0.3s ease;
}

/* =================================================================
   4. 组件样式 (只使用变量，不定义变量)
   ================================================================= */
.login-page {
  width: 100vw;
  min-height: 100vh;
  
  background-color: var(--bg-color);
  color: var(--text-primary);
  font-family: var(--font-family);
  
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-smooth), color var(--transition-smooth);
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

/* 背景光球动画 */
.login-page::before, .login-page::after {
  content: '';
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: var(--blob-opacity); /* 使用变量控制浓度 */
  z-index: 0;
  animation: float 10s ease-in-out infinite alternate;
  pointer-events: none;
}

.login-page::before {
  background: var(--blob-color-1);
  top: -100px;
  left: -100px;
}

.login-page::after {
  background: var(--blob-color-2);
  bottom: -100px;
  right: -100px;
  animation-delay: -5s;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(30px, 50px) scale(1.1); }
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 2rem;
  perspective: 1000px;
  z-index: 1;
}

.login-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-large);
  padding: 3rem 2.5rem;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  transform-style: preserve-3d;
  animation: cardEntrance 0.8s var(--transition-spring) forwards;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

@keyframes cardEntrance {
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.logo-area {
  text-align: center;
  margin-bottom: 2.5rem;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  /* 确保文字渐变使用了当前模式的文字颜色 */
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 400;
}

.form-group {
  margin-bottom: 1.25rem;
  position: relative;
}

.form-control {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-medium);
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.2s ease;
  font-family: inherit;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  background: var(--bg-color); /* 聚焦时使用当前背景色 */
  border-color: var(--accent-color);
  box-shadow: 0 0 0 4px rgba(0, 102, 204, 0.15); /* 这里的阴影颜色也可以考虑用变量，目前暂保留 */
  transform: scale(1.01);
}

.form-control::placeholder {
  color: transparent;
}

/* Floating Label */
.form-label {
  position: absolute;
  left: 16px;
  top: 16px;
  color: var(--text-secondary);
  font-size: 16px;
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left top;
}

.form-control:focus + .form-label,
.form-control:not(:placeholder-shown) + .form-label {
  transform: translateY(-10px) scale(0.75);
  color: var(--accent-color);
  font-weight: 600;
}

.btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 1rem;
  position: relative;
  overflow: hidden;
}

.btn-primary {
  background: var(--accent-color);
  color: white; /* 按钮文字保持白色 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* 稍微通用一点的阴影 */
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.btn-primary:active {
  transform: translateY(1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.switch-mode {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 14px;
  color: var(--text-secondary);
}

.switch-mode a {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.switch-mode a:hover {
  opacity: 0.8;
}

.error-message {
  background: rgba(255, 59, 48, 0.1);
  color: var(--error-color);
  padding: 12px;
  border-radius: var(--radius-small);
  font-size: 13px;
  margin-bottom: 1rem;
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.theme-toggle {
  position: absolute;
  top: 24px;
  right: 24px;
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.theme-toggle:hover {
  transform: scale(1.1);
}

.form-container {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
</style>