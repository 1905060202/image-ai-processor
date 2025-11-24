<template>
  <div class="profile-container">
    <!-- 个人信息卡片 -->
    <div class="profile-card">
      <div class="profile-left">
        <a-avatar :size="100" class="profile-avatar">
          {{ userStore.user.username?.[0]?.toUpperCase() }}
        </a-avatar>
      </div>
      <div class="profile-right">
        <h2 class="username">{{ userStore.user.username }}</h2>
        <div class="stats-row">
          <div class="stat-box">
            <span class="val">{{ credits }}</span>
            <span class="lbl">积分余额</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-box">
            <span class="val">{{ likesCount }}</span>
            <span class="lbl">获赞总数</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-box">
            <span class="val">{{ favoritesCount }}</span>
            <span class="lbl">收藏作品</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容 Tabs -->
    <div class="content-panel">
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange" class="profile-tabs">
        <a-tab-pane key="likes" tab="❤️ 我点赞的">
          <div class="waterfall-wrapper">
            <div v-if="likeImages.length > 0" class="waterfall-container">
              <div v-for="image in likeImages" :key="image.id" class="waterfall-item" @click="showDetail(image)">
                <img :src="image.url" :alt="image.prompt" loading="lazy" />
                <div class="item-overlay">
                  <p class="prompt-text">{{ image.prompt }}</p>
                </div>
              </div>
            </div>
            <a-empty v-else description="暂无点赞" class="empty-state" />
          </div>
        </a-tab-pane>
        
        <a-tab-pane key="favorites" tab="⭐ 我收藏的">
          <div class="waterfall-wrapper">
            <div v-if="favoriteImages.length > 0" class="waterfall-container">
              <div v-for="image in favoriteImages" :key="image.id" class="waterfall-item" @click="showDetail(image)">
                <img :src="image.url" :alt="image.prompt" loading="lazy" />
                <div class="item-overlay">
                  <p class="prompt-text">{{ image.prompt }}</p>
                </div>
              </div>
            </div>
            <a-empty v-else description="暂无收藏" class="empty-state" />
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 图片详情 Modal -->
    <a-modal 
      v-model:visible="detailVisible" 
      :footer="null" 
      width="auto" 
      centered 
      class="image-detail-modal"
      :closable="false"
      @cancel="detailVisible = false"
    >
      <div v-if="selectedImage" class="detail-layout">
        <div class="detail-image-box">
          <img :src="selectedImage.url" class="full-img" />
        </div>
        <div class="detail-info-box">
          <h3>作品详情</h3>
          <div class="info-item">
            <span class="label">提示词</span>
            <p class="value prompt-val">{{ selectedImage.prompt }}</p>
          </div>
          <div class="info-item">
            <span class="label">作者</span>
            <p class="value">{{ selectedImage.author || '未知用户' }}</p>
          </div>
          <button class="close-btn" @click="detailVisible = false">关闭</button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useUserStore } from '@/stores/user'
import { message } from 'ant-design-vue'

const userStore = useUserStore()
const activeTab = ref('likes')
const credits = ref(0)
const likesCount = ref(0)
const favoritesCount = ref(0)
const likeImages = ref([])
const favoriteImages = ref([])
const loading = ref(false)
const detailVisible = ref(false)
const selectedImage = ref(null)

const fetchUserInfo = async () => {
  try {
    const res = await axios.get('/api/credits/info')
    credits.value = res.data.credits
  } catch (err) { console.error(err) }
}

const fetchLikes = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/profile/likes?limit=50')
    likeImages.value = res.data.images
    likesCount.value = res.data.total
  } catch (err) { message.error('获取失败') } finally { loading.value = false }
}

const fetchFavorites = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/profile/favorites?limit=50')
    favoriteImages.value = res.data.images
    favoritesCount.value = res.data.total
  } catch (err) { message.error('获取失败') } finally { loading.value = false }
}

const handleTabChange = (key) => {
  if (key === 'likes' && likeImages.value.length === 0) fetchLikes()
  if (key === 'favorites' && favoriteImages.value.length === 0) fetchFavorites()
}

const showDetail = (image) => {
  selectedImage.value = image
  detailVisible.value = true
}

onMounted(() => {
  fetchUserInfo()
  fetchLikes()
})
</script>

<style scoped>
.profile-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* 个人信息卡片 */
.profile-card {
  background: var(--card-bg, #fff);
  border-radius: 24px;
  padding: 40px;
  display: flex;
  align-items: center;
  gap: 40px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.04);
  margin-bottom: 32px;
  border: 1px solid rgba(0,0,0,0.04);
}

.profile-avatar {
  background: linear-gradient(135deg, #007aff 0%, #00c6ff 100%);
  font-size: 40px;
  box-shadow: 0 8px 20px rgba(0, 122, 255, 0.3);
}

.username {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 24px;
}

.stat-box {
  display: flex;
  flex-direction: column;
}

.stat-box .val { font-size: 20px; font-weight: 700; color: var(--text-primary); }
.stat-box .lbl { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.stat-divider { width: 1px; height: 32px; background: rgba(0,0,0,0.1); }

/* 内容区域 */
.content-panel {
  background: transparent;
}

.waterfall-container {
  column-count: auto;
  column-width: 200px;
  column-gap: 20px;
}

.waterfall-item {
  break-inside: avoid;
  margin-bottom: 20px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  cursor: zoom-in;
  background: var(--bg-secondary, #f0f0f0);
  transform: translateZ(0);
}

.waterfall-item img {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.5s ease;
}

.waterfall-item:hover img { transform: scale(1.05); }

.item-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 20px 16px 16px;
  opacity: 0; transition: opacity 0.3s;
}
.waterfall-item:hover .item-overlay { opacity: 1; }

.prompt-text {
  color: white; font-size: 12px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin: 0; line-height: 1.4;
}

/* Modal Styles */
.detail-layout {
  display: flex;
  background: var(--card-bg, #fff);
  border-radius: 20px;
  overflow: hidden;
  max-width: 900px;
  max-height: 80vh;
}

.detail-image-box {
  flex: 3;
  background: #000;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}

.full-img { max-width: 100%; max-height: 80vh; object-fit: contain; }

.detail-info-box {
  flex: 2;
  padding: 32px;
  width: 300px;
  display: flex; flex-direction: column;
}

.detail-info-box h3 { margin-top: 0; margin-bottom: 24px; color: var(--text-primary); }

.info-item { margin-bottom: 20px; }
.info-item .label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; }
.info-item .value { color: var(--text-primary); font-size: 15px; }
.prompt-val { line-height: 1.6; max-height: 200px; overflow-y: auto; white-space: pre-wrap; }

.close-btn {
  margin-top: auto;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color, #eee);
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
  font-weight: 600;
  transition: all 0.2s;
}
.close-btn:hover { background: var(--bg-secondary, #f5f5f7); }

/* Dark Mode */
:global(html.dark) .profile-card { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
:global(html.dark) .stat-divider { background: rgba(255,255,255,0.1); }
:global(html.dark) .waterfall-item { background: #2c2c2e; }
:global(html.dark) .detail-layout { background: #1c1c1e; }
:global(html.dark) .close-btn { border-color: #444; color: #fff; }
:global(html.dark) .close-btn:hover { background: #333; }

/* Responsive */
@media (max-width: 768px) {
  .profile-card { flex-direction: column; text-align: center; padding: 24px; }
  .stats-row { justify-content: center; }
  .detail-layout { flex-direction: column; }
  .detail-image-box { max-height: 40vh; }
  .detail-info-box { width: 100%; }
}
</style>