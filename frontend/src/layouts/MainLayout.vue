<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible breakpoint="lg" collapsed-width="0" width="256">
      <div class="logo">
        <span>AI Vision</span>
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
        <a-menu-item key="/">
          <router-link to="/">
            <home-outlined />
            <span>首页</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="/explore">
          <router-link to="/explore">
            <compass-outlined />
            <span>发现</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="/profile">
          <router-link to="/profile">
            <user-outlined />
            <span>我的</span>
          </router-link>
        </a-menu-item>
        <a-menu-item key="/admin" v-if="userStore.isAdmin">
          <router-link to="/admin">
            <dashboard-outlined />
            <span>后台管理</span>
          </router-link>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 24px; display: flex; justify-content: flex-end; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.05); z-index: 1;">
        
        <!-- User Stats -->
        <div class="user-stats" v-if="userStore.isLoggedIn">
          <div class="stat-item">
            <span class="icon">💎</span>
            <span class="value">{{ userStore.credits }}</span>
          </div>
          <div class="stat-item">
            <span class="label">免费:</span>
            <span class="value">{{ userStore.freeCount }}/5</span>
          </div>
        </div>

        <!-- Theme Toggle -->
        <div class="theme-toggle" @click="toggleTheme" title="切换主题">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
          </svg>
        </div>

        <a-dropdown>
          <a class="ant-dropdown-link" @click.prevent>
            <a-avatar style="background-color: #1890ff; margin-right: 8px;">
              {{ userStore.user.username?.[0]?.toUpperCase() }}
            </a-avatar>
            {{ userStore.user.username }}
            <down-outlined />
          </a>
          <template #overlay>
            <a-menu>
              <a-menu-item>
                <router-link to="/profile">个人中心</router-link>
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item>
                <a @click="handleLogout">退出登录</a>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-layout-header>
      <a-layout-content style="margin: 24px">
        <router-view></router-view>
      </a-layout-content>
      <a-layout-footer style="text-align: center; color: #999;">
        Image AI Processor ©2025 Created by Antigravity
      </a-layout-footer>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeMount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  HomeOutlined,
  CompassOutlined,
  UserOutlined,
  DashboardOutlined,
  DownOutlined
} from '@ant-design/icons-vue'

const collapsed = ref(false)
const selectedKeys = ref(['/'])
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isDark = ref(false)

// Theme toggle function
const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// Initialize theme based on saved preference or system preference
onBeforeMount(() => {
  const savedTheme = localStorage.getItem('theme') || 'system'
  if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
})

watch(
  () => route.path,
  (newPath) => {
    selectedKeys.value = [newPath]
  },
  { immediate: true }
)

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  if (userStore.isLoggedIn) {
    userStore.fetchUserInfo()
  }
})
</script>

<style scoped>
.logo {
  height: 32px;
  margin: 16px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 16px;
  border-radius: 6px;
}

.user-stats {
  display: flex;
  gap: 16px;
  margin-right: 24px;
  padding-right: 24px;
  border-right: 1px solid #f0f0f0;
}

@media (max-width: 768px) {
  .user-stats {
    gap: 8px;
    margin-right: 12px;
    padding-right: 12px;
  }
  
  .stat-item {
    padding: 2px 8px !important;
    font-size: 12px !important;
  }
  
  .stat-item .icon {
    font-size: 14px !important;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f5f5f7;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.stat-item .icon {
  font-size: 16px;
}

.stat-item .label {
  color: #666;
}

.stat-item .value {
  font-weight: 600;
  color: #1d1d1f;
}

/* Theme Toggle Styles */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  margin-right: 16px;
  transition: all 0.3s ease;
  background: var(--theme-toggle-bg, #f5f5f7);
  color: var(--theme-toggle-color, #1d1d1f);
  border: 1px solid var(--theme-toggle-border, #e0e0e0);
}

.theme-toggle:hover {
  background: var(--theme-toggle-hover-bg, #e0e0e0);
  transform: scale(1.1);
}

/* Dark mode specific styles */
:global(.dark) .theme-toggle {
  --theme-toggle-bg: #2c2c2e;
  --theme-toggle-color: #f5f5f7;
  --theme-toggle-border: #444;
  --theme-toggle-hover-bg: #3a3a3c;
}

:global(.dark) .user-stats {
  border-right: 1px solid #444;
}

:global(.dark) .stat-item {
  background: #2c2c2e;
}

:global(.dark) .stat-item .label {
  color: #aaa;
}

:global(.dark) .stat-item .value {
  color: #f5f5f7;
}
</style>
