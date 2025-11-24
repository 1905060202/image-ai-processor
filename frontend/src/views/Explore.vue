<template>
  <div class="explore-container">
    <div class="masonry" ref="scrollContainer">
      <div v-for="image in images" :key="image.id" class="pin" @click="showDetail(image)">
        <img :src="image.url" :alt="image.prompt" loading="lazy" />
        <div class="pin-overlay">
          <div class="pin-info">
            <span class="author">@{{ image.author }}</span>
            <div class="actions">
              <button 
                class="action-btn like" 
                :class="{ active: image.isLiked }" 
                @click.stop="toggleLike(image)"
              >
                <heart-filled v-if="image.isLiked" />
                <heart-outlined v-else />
              </button>
              <button 
                class="action-btn fav" 
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
    
    <div class="loading-trigger">
      <a-spin v-if="loading" />
      <span v-else-if="!hasMore">没有更多内容了</span>
      <span v-else>加载更多...</span>
    </div>

    <!-- Detail Modal -->
    <a-modal 
      v-model:visible="detailVisible" 
      :footer="null" 
      width="90vw" 
      :bodyStyle="{ padding: 0, height: '90vh', overflow: 'hidden' }"
      centered
      wrapClassName="full-screen-modal"
    >
      <div v-if="selectedImage" class="modal-content-wrapper">
        <div class="modal-image-area">
          <img :src="selectedImage.url" :alt="selectedImage.prompt" />
        </div>
        <div class="modal-sidebar">
          <div class="modal-author">
            <a-avatar :size="40" :style="{ backgroundColor: '#7265e6' }">
              {{ selectedImage.author[0].toUpperCase() }}
            </a-avatar>
            <span class="username">{{ selectedImage.author }}</span>
          </div>
          
          <div class="modal-prompt">
            {{ selectedImage.prompt }}
          </div>

          <div class="modal-actions">
            <a-button 
              size="large" 
              block 
              :type="selectedImage.isLiked ? 'primary' : 'default'"
              :danger="selectedImage.isLiked"
              @click="toggleLike(selectedImage)"
            >
              <template #icon>
                <heart-filled v-if="selectedImage.isLiked" />
                <heart-outlined v-else />
              </template>
              {{ selectedImage.isLiked ? '已点赞' : '点赞' }}
            </a-button>
            
            <a-button 
              size="large" 
              block 
              :type="selectedImage.isFavorited ? 'primary' : 'default'"
              class="fav-btn"
              :class="{ active: selectedImage.isFavorited }"
              @click="toggleFavorite(selectedImage)"
            >
              <template #icon>
                <star-filled v-if="selectedImage.isFavorited" />
                <star-outlined v-else />
              </template>
              {{ selectedImage.isFavorited ? '已收藏' : '收藏' }}
            </a-button>
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
    // Use the correct API endpoint from original code
    const res = await axios.get(`/api/explore?page=${page.value}&limit=20`)
    
    if (res.data.feed.length === 0) {
      hasMore.value = false
    } else {
      images.value.push(...res.data.feed)
      page.value++
    }
  } catch (err) {
    console.error(err)
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

const showDetail = (image) => {
  selectedImage.value = image
  detailVisible.value = true
}

const toggleLike = async (image) => {
  try {
    const res = await axios.post(`/api/explore/images/${image.id}/like`)
    image.isLiked = res.data.liked
    // Update likes count if needed
  } catch (err) {
    message.error('操作失败')
  }
}

const toggleFavorite = async (image) => {
  try {
    const res = await axios.post(`/api/explore/images/${image.id}/favorite`)
    image.isFavorited = res.data.favorited
  } catch (err) {
    message.error('操作失败')
  }
}

const handleScroll = () => {
  const bottomOfWindow = document.documentElement.scrollTop + window.innerHeight >= document.documentElement.offsetHeight - 500
  if (bottomOfWindow) {
    fetchFeed()
  }
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
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 16px;
}

.masonry {
  column-count: 5;
  column-gap: 24px;
}

@media (max-width: 1400px) { .masonry { column-count: 4; } }
@media (max-width: 1100px) { .masonry { column-count: 3; } }
@media (max-width: 800px) { .masonry { column-count: 2; column-gap: 16px; } }
@media (max-width: 500px) { .masonry { column-count: 1; column-gap: 12px; } }

@media (max-width: 768px) {
  .explore-container {
    padding: 0 12px;
  }
  
  .pin {
    margin-bottom: 16px;
  }
}

.pin {
  break-inside: avoid;
  margin-bottom: 24px;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  cursor: zoom-in;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.pin:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.12);
}

.pin img {
  width: 100%;
  display: block;
}

.pin-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent 40%);
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
}

.pin:hover .pin-overlay {
  opacity: 1;
}

.pin-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  color: white;
}

.author {
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255,255,255,0.3);
  transform: scale(1.1);
}

.action-btn.like.active {
  background: #ff3b30;
  color: white;
}

.action-btn.fav.active {
  background: #ffcc00;
  color: white;
}

.loading-trigger {
  text-align: center;
  padding: 40px;
  color: #999;
}

/* Modal Styles */
.modal-content-wrapper {
  display: flex;
  height: 100%;
}

.modal-image-area {
  flex: 2;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image-area img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.modal-sidebar {
  flex: 1;
  max-width: 400px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.modal-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.username {
  font-size: 16px;
  font-weight: 600;
}

.modal-prompt {
  background: #f5f5f7;
  padding: 16px;
  border-radius: 12px;
  color: #666;
  line-height: 1.6;
  flex: 1;
  overflow-y: auto;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  gap: 16px;
}

.fav-btn.active {
  background: #ffcc00;
  border-color: #ffcc00;
  color: white;
}

@media (max-width: 900px) {
  .modal-content-wrapper {
    flex-direction: column;
    overflow-y: auto;
  }
  
  .modal-image-area {
    min-height: 300px;
    flex: none;
  }

  .modal-sidebar {
    max-width: none;
    height: auto;
    flex: none;
  }
  
  .modal-actions {
    flex-direction: column;
  }
}
</style>