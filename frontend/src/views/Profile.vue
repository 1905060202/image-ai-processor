<template>
  <div>
    <div class="profile-header">
      <a-avatar :size="100" style="background-color: #1890ff; font-size: 40px;">
        {{ userStore.user.username[0]?.toUpperCase() }}
      </a-avatar>
      <div class="profile-info">
        <h2>{{ userStore.user.username }}</h2>
        <div class="stats">
          <a-statistic title="积分" :value="credits" style="margin-right: 32px" />
          <a-statistic title="点赞" :value="likesCount" style="margin-right: 32px" />
          <a-statistic title="收藏" :value="favoritesCount" />
        </div>
      </div>
    </div>

    <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
      <a-tab-pane key="likes" tab="我点赞的">
        <div class="masonry-grid">
          <div v-for="image in likeImages" :key="image.id" class="masonry-item" @click="showDetail(image)">
            <img :src="image.url" :alt="image.prompt" :style="{ height: image.height + 'px' }" />
            <div class="overlay">
              <div class="prompt">{{ image.prompt }}</div>
            </div>
          </div>
        </div>
      </a-tab-pane>
      <a-tab-pane key="favorites" tab="我收藏的">
        <div class="masonry-grid">
          <div v-for="image in favoriteImages" :key="image.id" class="masonry-item" @click="showDetail(image)">
            <img :src="image.url" :alt="image.prompt" :style="{ height: image.height + 'px' }" />
            <div class="overlay">
              <div class="prompt">{{ image.prompt }}</div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>

    <div v-if="loading" style="text-align: center; padding: 20px;">
      <a-spin />
    </div>

    <a-modal v-model:visible="detailVisible" :footer="null" width="800px" centered>
      <div v-if="selectedImage" class="detail-content">
        <img :src="selectedImage.url" style="width: 100%; border-radius: 8px;" />
        <div style="margin-top: 16px;">
          <h3>{{ selectedImage.prompt }}</h3>
          <p>作者: {{ selectedImage.author }}</p>
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
  } catch (err) {
    console.error(err)
  }
}

const fetchLikes = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/profile/likes?limit=50')
    likeImages.value = res.data.images
    likesCount.value = res.data.total
  } catch (err) {
    message.error('获取点赞列表失败')
  } finally {
    loading.value = false
  }
}

const fetchFavorites = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/profile/favorites?limit=50')
    favoriteImages.value = res.data.images
    favoritesCount.value = res.data.total
  } catch (err) {
    message.error('获取收藏列表失败')
  } finally {
    loading.value = false
  }
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
.profile-header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 32px;
  background: white;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
    gap: 16px;
    padding: 24px 16px;
  }
  
  .stats {
    justify-content: center;
  }
  
  .profile-info h2 {
    margin: 0 0 8px 0;
  }
}

.profile-info h2 {
  margin: 0 0 16px 0;
}

.stats {
  display: flex;
}

.masonry-grid {
  column-count: 4;
  column-gap: 1rem;
}

@media (max-width: 1200px) { .masonry-grid { column-count: 3; } }
@media (max-width: 768px) { .masonry-grid { column-count: 2; } }
@media (max-width: 480px) { .masonry-grid { column-count: 1; } }

.masonry-item {
  break-inside: avoid;
  margin-bottom: 1rem;
  cursor: pointer;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s;
}

.masonry-item:hover {
  transform: translateY(-4px);
}

.masonry-item img {
  width: 100%;
  display: block;
  border-radius: 12px;
}

.overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 1rem;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
}

.masonry-item:hover .overlay {
  opacity: 1;
}
</style>