<template>
  <a-layout class="main-layout-wrapper">
    <!-- Sider -->
    <a-layout-sider 
      v-model:collapsed="collapsed" 
      collapsible 
      breakpoint="lg" 
      collapsed-width="0" 
      width="260"
      :trigger="null"
      class="glass-sider"
    >
      <div class="logo-container">
        <div class="logo-box">
          <div class="logo-icon">AV</div>
          <span v-if="!collapsed" class="logo-text">AI Vision</span>
        </div>
      </div>
      
      <a-menu v-model:selectedKeys="selectedKeys" mode="inline" class="glass-menu">
        <a-menu-item key="/"><router-link to="/"><home-outlined /><span>首页</span></router-link></a-menu-item>
        <a-menu-item key="/explore"><router-link to="/explore"><compass-outlined /><span>发现</span></router-link></a-menu-item>
        <a-menu-item key="/profile"><router-link to="/profile"><user-outlined /><span>我的</span></router-link></a-menu-item>
        <a-menu-item key="/admin" v-if="userStore.isAdmin"><router-link to="/admin"><dashboard-outlined /><span>后台</span></router-link></a-menu-item>
      </a-menu>

      <div class="sider-footer" @click="collapsed = !collapsed">
         <component :is="collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
      </div>
    </a-layout-sider>

    <a-layout style="background: transparent;"> 
      <!-- Header -->
      <a-layout-header class="glass-header">
        <div class="header-left"></div>
        <div class="header-right">
          <div class="user-stats-pill" v-if="userStore.isLoggedIn">
            <div class="stat-group"><span class="stat-icon">💎</span><span class="stat-val">{{ userStore.credits }}</span></div>
            <div class="divider"></div>
            <div class="stat-group"><span class="stat-label">Free</span><span class="stat-val">{{ userStore.freeCount }}/5</span></div>
          </div>

          <button class="icon-btn theme-btn" @click="toggleTheme">
            <svg v-if="!isDark" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707M12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            <svg v-else width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>
          </button>

          <a-dropdown placement="bottomRight" :trigger="['click']">
            <div class="user-trigger">
              <a-avatar :size="36" class="custom-avatar">{{ userStore.user.username?.[0]?.toUpperCase() }}</a-avatar>
              <span class="username">{{ userStore.user.username }}</span>
              <down-outlined class="arrow" />
            </div>
            <template #overlay>
              <a-menu class="glass-dropdown-menu">
                <a-menu-item key="profile"><router-link to="/profile">个人中心</router-link></a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout"><a @click="handleLogout" style="color: #ff4d4f;">退出登录</a></a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content style="margin: 0; padding: 24px; min-height: 280px; position: relative;">
        <router-view></router-view>
      </a-layout-content>
      
      <a-layout-footer class="glass-footer">Image AI Processor ©2025 Created by Antigravity</a-layout-footer>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { HomeOutlined, CompassOutlined, UserOutlined, DashboardOutlined, DownOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons-vue'

const collapsed = ref(false)
const selectedKeys = ref(['/'])
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isDark = ref(false)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onBeforeMount(() => {
  const savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  } else {
    isDark.value = false
    document.documentElement.classList.remove('dark')
  }
})

watch(() => route.path, (newPath) => { selectedKeys.value = [newPath] }, { immediate: true })

const handleLogout = () => { userStore.logout(); router.push('/login') }
onMounted(() => { if (userStore.isLoggedIn) userStore.fetchUserInfo() })
</script>

<style scoped>
/* 
   核心修复：将变量定义提升到 :global(:root) 
   这样整个 HTML 文档（包括 AntD 的弹出层）都能读取到这些颜色
*/
:global(:root) {
  /* --- Light Mode --- */
  --glass-bg: rgba(255, 255, 255, 0.75);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  --sider-bg: rgba(255, 255, 255, 0.7);
  --text-primary: #1d1d1f;
  --text-secondary: #86868b;
  --text-tertiary: #999;
  --accent: #007aff;
  --accent-light: rgba(0, 122, 255, 0.1);
  --menu-hover: rgba(0, 0, 0, 0.04);
  --menu-active: #fff;
  --pill-bg: rgba(255, 255, 255, 0.5);
  --logo-color: #1d1d1f;
  --layout-bg: radial-gradient(circle at top left, #ebf4ff 0%, #f5f7fa 100%);
}

/* --- Dark Mode Override --- */
:global(html.dark:root) {
  --glass-bg: rgba(30, 30, 32, 0.75);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  --sider-bg: rgba(30, 30, 32, 0.7);
  --text-primary: #f5f5f7;
  --text-secondary: #a1a1a6;
  --text-tertiary: #666;
  --accent: #0a84ff;
  --accent-light: rgba(10, 132, 255, 0.2);
  --menu-hover: rgba(255, 255, 255, 0.1);
  --menu-active: rgba(255, 255, 255, 0.15);
  --pill-bg: rgba(60, 60, 60, 0.4);
  --logo-color: #f5f5f7;
  --layout-bg: radial-gradient(circle at top left, #1a1a1a 0%, #000000 100%);
}

/* 强制 body 背景 */
:global(body) { margin: 0; background: var(--layout-bg); transition: background 0.3s ease; }
:global(html.dark body) { background-color: #000000 !important; }

.main-layout-wrapper {
  background: var(--layout-bg);
  min-height: 100vh;
}

/* ================= Glass Styles ================= */
.glass-sider {
  background: var(--sider-bg) !important;
  backdrop-filter: blur(20px) saturate(180%);
  border-right: 1px solid var(--glass-border);
  z-index: 100;
}

.glass-header {
  position: sticky; top: 0; z-index: 99; width: 100%; padding: 0 32px; height: 64px;
  display: flex; justify-content: space-between; align-items: center;
  background: var(--glass-bg) !important;
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--glass-border);
}

.user-stats-pill {
  display: flex; align-items: center; background: var(--pill-bg); border: 1px solid var(--glass-border);
  border-radius: 20px; padding: 6px 16px; height: 38px; gap: 12px;
  box-shadow: var(--glass-shadow); backdrop-filter: blur(10px);
}

/* Menu Customization */
.glass-menu { background: transparent !important; border-right: none !important; padding: 0 12px; }
:deep(.ant-menu-item) { border-radius: 12px; margin-bottom: 4px; color: var(--text-secondary); height: 44px; line-height: 44px; background: transparent !important; }
:deep(.ant-menu-item:hover) { background-color: var(--menu-hover) !important; color: var(--text-primary) !important; }
:deep(.ant-menu-item-selected) { background-color: var(--accent-light) !important; color: var(--accent) !important; font-weight: 600; }

/* Misc */
.logo-container { height: 64px; display: flex; align-items: center; padding-left: 24px; }
.logo-box { display: flex; align-items: center; gap: 12px; }
.logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, var(--accent) 0%, #bf5af2 100%); border-radius: 8px; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; }
.logo-text { font-size: 18px; font-weight: 700; color: var(--logo-color); }
.header-right { display: flex; align-items: center; gap: 16px; }
.stat-group { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.stat-val { color: var(--text-primary); font-weight: 600; }
.icon-btn { background: transparent; border: none; width: 36px; height: 36px; border-radius: 50%; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.icon-btn:hover { background: var(--menu-hover); color: var(--text-primary); }
.user-trigger { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px 4px 4px; border-radius: 20px; }
.user-trigger:hover { background: var(--menu-hover); }
.username { font-weight: 500; color: var(--text-primary); }
.sider-footer { position: absolute; bottom: 20px; left: 0; width: 100%; display: flex; justify-content: center; color: var(--text-secondary); cursor: pointer; padding: 10px; font-size: 18px; }
.glass-footer { text-align: center; background: transparent; color: var(--text-tertiary); font-size: 12px; }
</style>