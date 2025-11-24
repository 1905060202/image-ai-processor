<template>
  <div class="home-container">
    <div class="control-panel">
      <div class="card">
        <h2>创作中心</h2>
        
        <!-- Mode Selector -->
        <div class="mode-selector">
          <label :class="{ active: mode === 'text-to-image' }">
            <input type="radio" v-model="mode" value="text-to-image"> 文生图
          </label>
          <label :class="{ active: mode === 'image-to-image' }">
            <input type="radio" v-model="mode" value="image-to-image"> 图生图
          </label>
        </div>

        <!-- Image Upload (for Image-to-Image) -->
        <div v-if="mode === 'image-to-image'" class="form-group">
          <div 
            class="file-upload-wrapper" 
            :class="{ dragover: isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input type="file" ref="fileInput" @change="handleFileChange" accept="image/*" style="display: none">
            <div v-if="!uploadedImage" class="upload-placeholder">
              <cloud-upload-outlined style="font-size: 32px; color: #86868b;" />
              <span>点击或拖拽上传参考图</span>
            </div>
            <div v-else class="uploaded-preview">
              <img :src="uploadedImagePreview" alt="Reference">
              <div class="remove-btn" @click.stop="removeUploadedImage">
                <delete-outlined />
              </div>
            </div>
          </div>
        </div>

        <!-- Prompt Input -->
        <div class="form-group">
          <label>提示词</label>
          <a-textarea 
            v-model:value="prompt" 
            placeholder="描述你想生成的画面... (例如: 一只可爱的猫咪在太空中)" 
            :rows="4" 
            :auto-size="{ minRows: 4, maxRows: 6 }"
          />
        </div>

        <!-- Settings -->
        <div class="settings-row">
          <div class="form-group">
            <label>模型提供方</label>
            <a-select v-model:value="provider" style="width: 100%">
              <a-select-option value="doubao">豆包 (推荐)</a-select-option>
              <a-select-option value="nano">Nano</a-select-option>
            </a-select>
          </div>
          <div class="form-group">
            <label>输出尺寸</label>
            <a-select v-model:value="size" style="width: 100%">
              <a-select-opt-group label="1:1">
                <a-select-option value="1024x1024">1024x1024</a-select-option>
                <a-select-option value="2048x2048">2048x2048</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="4:3">
                <a-select-option value="2304x1728">2304x1728</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="3:4">
                <a-select-option value="1728x2304">1728x2304</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="16:9">
                <a-select-option value="2560x1440">2560x1440</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="9:16">
                <a-select-option value="1440x2560">1440x2560</a-select-option>
              </a-select-opt-group>
            </a-select>
          </div>
        </div>

        <a-button type="primary" size="large" block :loading="generating" @click="handleGenerate">
          {{ generating ? '生成中...' : '开始生成' }}
        </a-button>
      </div>
    </div>

    <div class="preview-panel">
      <div class="card preview-card">
        <h3>生成结果</h3>
        <div class="preview-box" :class="{ 'has-image': generatedImage }">
          <div v-if="!generatedImage && !generating" class="placeholder">
            <picture-outlined style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;" />
            <p>生成的图片将显示在这里</p>
          </div>
          <div v-if="generating" class="loading-overlay">
            <a-spin size="large" tip="AI 正在绘图..." />
          </div>
          <img v-if="generatedImage" :src="generatedImage" alt="Generated" class="result-image">
        </div>
      </div>

      <div class="history-section">
        <div class="history-header">
          <h3>历史记录</h3>
          <div class="history-search">
            <a-input-search
              v-model:value="historySearch"
              placeholder="搜索历史记录..."
              style="width: 200px"
              @search="fetchHistory"
            />
          </div>
        </div>
        
        <div class="history-grid" v-if="historyImages.length > 0">
          <div v-for="img in historyImages" :key="img.id" class="history-item" @click="selectHistory(img)">
            <img :src="img.url" :alt="img.prompt" loading="lazy">
          </div>
        </div>
        <div v-else class="no-history">
          <a-empty description="暂无历史记录" />
        </div>

        <div class="pagination-controls" v-if="historyTotalPages > 1">
          <a-button 
            type="text" 
            :disabled="historyPage === 1" 
            @click="changeHistoryPage(-1)"
          >
            <left-outlined />
          </a-button>
          <span class="page-info">{{ historyPage }} / {{ historyTotalPages }}</span>
          <a-button 
            type="text" 
            :disabled="historyPage === historyTotalPages" 
            @click="changeHistoryPage(1)"
          >
            <right-outlined />
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined, DeleteOutlined, PictureOutlined, SearchOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons-vue'
import axios from 'axios'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// State
const mode = ref('text-to-image')
const prompt = ref('')
const provider = ref('doubao')
const size = ref('1024x1024')
const generating = ref(false)
const generatedImage = ref(null)

// History State
const historyImages = ref([])
const historyPage = ref(1)
const historyTotalPages = ref(1)
const historySearch = ref('')
const historyLoading = ref(false)

// File Upload State
const fileInput = ref(null)
const uploadedImage = ref(null)
const uploadedImagePreview = ref('')
const isDragOver = ref(false)

// Methods
const triggerFileInput = () => fileInput.value.click()

const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (file) processFile(file)
}

const handleDrop = (e) => {
  isDragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

const processFile = (file) => {
  if (!file.type.startsWith('image/')) {
    message.error('请上传图片文件')
    return
  }
  uploadedImage.value = file
  uploadedImagePreview.value = URL.createObjectURL(file)
}

const removeUploadedImage = () => {
  uploadedImage.value = null
  uploadedImagePreview.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

const handleGenerate = async () => {
  if (!prompt.value.trim()) {
    message.warning('请输入提示词')
    return
  }
  
  if (mode.value === 'image-to-image' && !uploadedImage.value) {
    message.warning('请上传参考图')
    return
  }

  generating.value = true
  generatedImage.value = null
  
  try {
    let res;
    
    if (mode.value === 'text-to-image') {
      // Text to Image API
      res = await axios.post('/api/v1/generate-text', {
        prompt: prompt.value,
        provider: provider.value,
        size: size.value
      })
    } else {
      // Image to Image API
      const formData = new FormData()
      formData.append('prompt', prompt.value)
      formData.append('provider', provider.value)
      formData.append('size', size.value)
      formData.append('images', uploadedImage.value) // Note: Backend expects 'images'
      formData.append('keepOriginal', 'false') // Default to false for now

      res = await axios.post('/api/v1/upload', formData)
    }

    if (res.data.generatedUrl) {
      generatedImage.value = res.data.generatedUrl
      message.success('生成成功')
      fetchHistory() // Refresh history
      userStore.fetchUserInfo() // Refresh credits
    }
  } catch (err) {
    console.error(err)
    message.error(err.response?.data?.error || err.response?.data?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

// History Methods
const fetchHistory = async () => {
  historyLoading.value = true
  try {
    const res = await axios.get('/api/v1/images', {
      params: {
        page: historyPage.value,
        limit: 12,
        q: historySearch.value
      }
    })
    
    historyImages.value = res.data.images.map(img => ({
      ...img,
      url: `/generated/${img.filename}`
    }))
    historyTotalPages.value = res.data.totalPages || 1
  } catch (err) {
    console.error('Failed to fetch history', err)
    message.error('获取历史记录失败')
  } finally {
    historyLoading.value = false
  }
}

const selectHistory = (img) => {
  generatedImage.value = img.url
  prompt.value = img.prompt
}

const changeHistoryPage = (delta) => {
  const newPage = historyPage.value + delta
  if (newPage >= 1 && newPage <= historyTotalPages.value) {
    historyPage.value = newPage
    fetchHistory()
  }
}

// Watchers
watch(historySearch, () => {
  historyPage.value = 1
  fetchHistory()
})

onMounted(() => {
  fetchHistory()
})
</script>

<style scoped>
.home-container {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  max-width: 1600px;
  margin: 0 auto;
  height: calc(100vh - 112px); /* Adjust based on layout header/footer */
  padding-bottom: 24px;
}

@media (max-width: 992px) {
  .home-container {
    grid-template-columns: 1fr;
    height: auto;
    display: flex;
    flex-direction: column;
  }
  
  .preview-panel {
    height: auto !important;
  }
  
  .preview-card {
    min-height: 400px;
  }
  
  .history-section {
    height: auto;
    max-height: 600px;
  }
}

@media (max-width: 768px) {
  .home-container {
    padding: 12px;
    gap: 16px;
  }
  
  .card {
    padding: 16px;
  }
  
  .settings-row {
    flex-direction: column;
    gap: 16px;
  }
  
  .history-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .history-search {
    width: 100%;
  }
  
  .history-search :deep(.ant-input-search) {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .history-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .mode-selector label {
    padding: 8px 4px;
    font-size: 14px;
  }
}

.card {
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.04);
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0,0,0,0.02);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  box-shadow: 0 15px 35px rgba(0,0,0,0.06);
}

h2, h3 {
  margin-bottom: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

/* Mode Selector */
.mode-selector {
  display: flex;
  background: #f5f5f7;
  padding: 4px;
  border-radius: 14px;
  margin-bottom: 24px;
}

.mode-selector label {
  flex: 1;
  text-align: center;
  padding: 10px;
  cursor: pointer;
  border-radius: 10px;
  font-weight: 500;
  color: #86868b;
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.mode-selector label.active {
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-weight: 600;
}

.mode-selector input {
  display: none;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #1d1d1f;
  font-size: 14px;
}

.settings-row {
  display: flex;
  gap: 16px;
}

.settings-row .form-group {
  flex: 1;
}

/* File Upload */
.file-upload-wrapper {
  border: 2px dashed #d2d2d7;
  border-radius: 16px;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: #fafafa;
  overflow: hidden;
  position: relative;
}

.file-upload-wrapper:hover, .file-upload-wrapper.dragover {
  border-color: #007aff;
  background: #f0f8ff;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #86868b;
}

.uploaded-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.uploaded-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0,0,0,0.6);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: transform 0.2s;
}

.remove-btn:hover {
  transform: scale(1.1);
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  overflow: hidden; /* Fix for flex child overflow */
}

.preview-card {
  flex: 2;
  min-height: 400px;
  overflow: hidden;
}

.preview-box {
  flex: 1;
  background: #f5f5f7;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  height: 100%;
}

.preview-box.has-image {
  background: #000;
}

.placeholder {
  text-align: center;
  color: #86868b;
}

.result-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* History */
.history-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.02);
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding: 4px; /* Prevent shadow cut-off */
  flex: 1; /* Ensure it takes available space */
}

.history-item {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  position: relative;
  min-height: 100px;
}

.history-item:hover {
  border-color: #007aff;
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.12);
}

.history-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.history-item:hover img {
  transform: scale(1.1);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.history-header h3 {
  margin-bottom: 0;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f5f5f7;
}

.page-info {
  color: #86868b;
  font-size: 14px;
  font-weight: 500;
}

.no-history {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #86868b;
  flex: 1;
}
</style>