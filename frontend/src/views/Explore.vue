<template>
  <div class="explore-container">
    <!-- 瀑布流容器 -->
    <div class="masonry-wrapper" ref="scrollContainer">
      <div class="waterfall-column" v-if="images.length > 0">
        <div 
          v-for="image in images" 
          :key="image.id" 
          class="pin-card" 
          @click="showDetail(image)"
        >
          <div class="pin-image-box">
            <img :src="image.url" :alt="image.prompt" loading="lazy" />
          </div>
          
          <!-- 悬浮磨砂层 -->
          <div class="glass-overlay">
            <div class="overlay-top">
              <span class="author-tag">@{{ image.author }}</span>
            </div>
            <div class="overlay-bottom">
              <div class="action-buttons">
                <button 
                  class="glass-btn like" 
                  :class="{ active: image.isLiked }" 
                  @click.stop="toggleLike(image)"
                >
                  <heart-filled v-if="image.isLiked" />
                  <heart-outlined v-else />
                </button>
                <button 
                  class="glass-btn fav" 
                  :class="{ active: image.isFavorited }" 
                  @click.stop="toggleFavorite(image)"
                >
                  <star-filled v-if="image.isFavorited" />
                  <star-outlined v-else />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <a-empty v-else description="暂无探索内容" class="empty-state" />
    </div>
    
    <!-- 加载状态 -->
    <div class="loading-trigger">
      <div v-if="loading" class="loading-pill"><a-spin size="small" /> 加载更多灵感...</div>
      <div v-else-if="!hasMore" class="end-pill">🎉 已经到底啦</div>
    </div>

    <!-- 沉浸式详情 Modal -->
    <a-modal 
      v-model:visible="detailVisible" 
      :footer="null" 
      width="90vw" 
      :closable="false"
      centered
      wrapClassName="immersive-modal-wrap"
      class="immersive-modal"
      @cancel="detailVisible = false"
    >
      <div v-if="selectedImage" class="modal-layout">
        <!-- 左侧：图片展示区 -->
        <div class="modal-preview-area" @click="detailVisible = false">
          <img :src="selectedImage.url" :alt="selectedImage.prompt" />
        </div>
        
        <!-- 右侧：信息交互区 -->
        <div class="modal-sidebar" @click.stop>
          <div class="sidebar-header">
            <div class="author-info">
              <a-avatar :size="48" class="author-avatar">
                {{ selectedImage.author[0].toUpperCase() }}
              </a-avatar>
              <div class="author-text">
                <span class="username">{{ selectedImage.author }}</span>
                <span class="user-role">创作者</span>
              </div>
            </div>
            <button class="close-btn" @click="detailVisible = false">✕</button>
          </div>
          
          <div class="sidebar-content">
            <div class="prompt-box">
              <label>提示词 Prompt</label>
              <p>{{ selectedImage.prompt }}</p>
            </div>
          </div>

          <div class="sidebar-footer">
            <button 
              class="action-block-btn like"
              :class="{ active: selectedImage.isLiked }"
              @click="toggleLike(selectedImage)"
            >
              <heart-filled v-if="selectedImage.isLiked" />
              <heart-outlined v-else />
              <span>{{ selectedImage.isLiked ? '已点赞' : '点赞' }}</span>
            </button>
            
            <button 
              class="action-block-btn fav"
              :class="{ active: selectedImage.isFavorited }"
              @click="toggleFavorite(selectedImage)"
            >
              <star-filled v-if="selectedImage.isFavorited" />
              <star-outlined v-else />
              <span>{{ selectedImage.isFavorited ? '已收藏' : '收藏' }}</span>
            </button>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { 
  HeartOutlined, HeartFilled, 
  StarOutlined, StarFilled 
} from '@ant-design/icons-vue'

const images = ref([])
const loading = ref(false)
const hasMore = ref(true)
const page = ref(1)
const detailVisible = ref(false)
const selectedImage = ref(null)

const fetchFeed = async () => {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const res = await axios.get(`/api/explore?page=${page.value}&limit=20`)
    if (res.data.feed.length === 0) {
      hasMore.value = false
    } else {
      images.value.push(...res.data.feed)
      page.value++
    }
  } catch (err) { console.log(err) } finally { loading.value = false }
}

const showDetail = (image) => {
  selectedImage.value = image
  detailVisible.value = true
}

const toggleLike = async (image) => {
  image.isLiked = !image.isLiked
  try { await axios.post(`/api/explore/images/${image.id}/like`) } 
  catch (err) { image.isLiked = !image.isLiked; message.error('操作失败') }
}

const toggleFavorite = async (image) => {
  image.isFavorited = !image.isFavorited
  try { await axios.post(`/api/explore/images/${image.id}/favorite`) } 
  catch (err) { image.isFavorited = !image.isFavorited; message.error('操作失败') }
}

const handleScroll = () => {
  const bottomOfWindow = document.documentElement.scrollTop + window.innerHeight >= document.documentElement.offsetHeight - 500
  if (bottomOfWindow) fetchFeed()
}

onMounted(() => {
  fetchFeed()
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.explore-container {
  max-width: 1800px;
  margin: 0 auto;
  padding: 0 16px;
}

/* ================= 瀑布流 (CSS Columns) ================= */
.waterfall-column { column-count: 5; column-gap: 24px; }

@media (max-width: 1600px) { .waterfall-column { column-count: 4; } }
@media (max-width: 1200px) { .waterfall-column { column-count: 3; } }
@media (max-width: 900px) { .waterfall-column { column-count: 2; column-gap: 16px; } }
@media (max-width: 600px) { .waterfall-column { column-count: 1; } }

.pin-card {
  break-inside: avoid;
  margin-bottom: 24px;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  cursor: zoom-in;
  /* 默认背景，防止加载闪烁 */
  background: #f0f0f0; 
  transform: translateZ(0);
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.pin-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(0,0,0,0.12);
  z-index: 2;
}

.pin-image-box {
  background: #e5e5e5;
  min-height: 150px;
}

.pin-image-box img { width: 100%; height: auto; display: block; }

/* ================= Glass Overlay ================= */
.glass-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.2);
  opacity: 0; transition: opacity 0.3s ease;
  display: flex; flex-direction: column; justify-content: space-between; padding: 16px;
}
.pin-card:hover .glass-overlay { opacity: 1; }

.overlay-top { display: flex; justify-content: flex-end; }
.author-tag {
  background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(8px);
  padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #1d1d1f;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.overlay-bottom { display: flex; justify-content: flex-end; }
.action-buttons { display: flex; gap: 8px; }

.glass-btn {
  background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px); width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: white;
  transition: all 0.2s; font-size: 16px;
}
.glass-btn:hover { background: rgba(255,255,255,0.9); color: #000; transform: scale(1.1); }
.glass-btn.like.active { background: #ff3b30; border-color: #ff3b30; color: white; }
.glass-btn.fav.active { background: #ffcc00; border-color: #ffcc00; color: white; }

/* Loading State */
.loading-trigger { display: flex; justify-content: center; padding: 40px; }
.loading-pill, .end-pill {
  background: #fff; padding: 8px 20px; border-radius: 20px;
  color: #86868b; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex; align-items: center; gap: 8px;
}

/* ================= Immersive Modal ================= */
:global(.immersive-modal .ant-modal-content) {
  padding: 0; border-radius: 24px; overflow: hidden; background: transparent;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-layout { display: flex; height: 85vh; background: #fff; }

.modal-preview-area {
  flex: 1; background: #000;
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out; position: relative; overflow: hidden;
}
.modal-preview-area img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 0 50px rgba(0,0,0,0.5); }

.modal-sidebar {
  width: 400px; background: #fff;
  display: flex; flex-direction: column;
  border-left: 1px solid rgba(0,0,0,0.05); flex-shrink: 0;
}

.sidebar-header {
  padding: 24px; display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.author-info { display: flex; align-items: center; gap: 14px; }
.author-avatar { background: linear-gradient(135deg, #7265e6 0%, #1890ff 100%); font-size: 18px; font-weight: 700; }
.author-text { display: flex; flex-direction: column; }
.username { font-size: 16px; font-weight: 700; color: #1d1d1f; }
.user-role { font-size: 12px; color: #86868b; }

.close-btn {
  background: transparent; border: none; font-size: 20px; color: #86868b; cursor: pointer;
  padding: 4px; border-radius: 8px; transition: background 0.2s;
}
.close-btn:hover { background: #f5f5f7; color: #1d1d1f; }

.sidebar-content { flex: 1; padding: 24px; overflow-y: auto; }

.prompt-box {
  background: #f9f9f9; /* 浅色模式默认 */
  padding: 16px; border-radius: 16px;
}
.prompt-box label { display: block; font-size: 12px; font-weight: 600; color: #999; margin-bottom: 8px; text-transform: uppercase; }
.prompt-box p { margin: 0; line-height: 1.6; color: #1d1d1f; font-size: 14px; }

.sidebar-footer {
  padding: 24px; border-top: 1px solid rgba(0,0,0,0.05);
  display: flex; gap: 12px;
}

.action-block-btn {
  flex: 1; height: 44px; border: 1px solid #e5e5ea; border-radius: 12px;
  background: transparent; color: #1d1d1f; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;
}
.action-block-btn:hover { background: #f5f5f7; }
.action-block-btn.like.active { background: #ff3b30; border-color: #ff3b30; color: white; }
.action-block-btn.fav.active { background: #ffcc00; border-color: #ffcc00; color: white; }

/* ================= Dark Mode Fix (关键修复) ================= */
:global(html.dark) .pin-card { background: #2c2c2e; }
:global(html.dark) .pin-image-box { background: #2c2c2e; }
:global(html.dark) .loading-pill { background: #2c2c2e; border: 1px solid #3a3a3c; color: #a1a1a6; }

/* 模态框暗黑适配 */
:global(html.dark) .modal-layout { background: #1c1c1e; }
:global(html.dark) .modal-sidebar { 
  background: #1c1c1e; /* 确保侧边栏背景是深色 */
  border-color: rgba(255,255,255,0.1); 
}
:global(html.dark) .sidebar-header, 
:global(html.dark) .sidebar-footer { 
  border-color: rgba(255,255,255,0.1); 
}

/* 核心修复：提示词框暗黑适配 */
:global(html.dark) .prompt-box { 
  background: #000000 !important; /* 强制纯黑底色，区别于 sidebar */
  border: 1px solid rgba(255,255,255,0.1);
}
:global(html.dark) .prompt-box p { 
  color: #f5f5f7 !important; /* 强制白字 */
}
:global(html.dark) .prompt-box label {
  color: #86868b !important;
}

:global(html.dark) .username { color: #f5f5f7; }
:global(html.dark) .user-role { color: #86868b; }
:global(html.dark) .action-block-btn { border-color: #444; color: #fff; }
:global(html.dark) .action-block-btn:hover { background: rgba(255,255,255,0.1); }
:global(html.dark) .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

/* 响应式适配 */
@media (max-width: 900px) {
  .modal-layout { flex-direction: column; height: auto; max-height: 90vh; overflow-y: auto; }
  .modal-preview-area { min-height: 400px; flex: none; }
  .modal-sidebar { width: 100%; flex: none; }
}
</style>