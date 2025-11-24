<template>
  <div class="home-container">
    <!-- 左侧控制面板 -->
    <div class="control-panel">
      <div class="card control-card">
        <div class="card-header">
           <h2>创作中心</h2>
        </div>
        
        <!-- Mode Selector -->
        <div class="ios-segmented-control">
          <div class="segment-bg"></div>
          <label class="segment-item" :class="{ active: mode === 'text-to-image' }">
            <input type="radio" v-model="mode" value="text-to-image">
            <span>文生图</span>
          </label>
          <label class="segment-item" :class="{ active: mode === 'image-to-image' }">
            <input type="radio" v-model="mode" value="image-to-image">
            <span>图生图</span>
          </label>
          <div class="segment-glider" :class="{ right: mode === 'image-to-image' }"></div>
        </div>

        <!-- Image Upload -->
        <transition name="fade-slide">
          <div v-if="mode === 'image-to-image'" class="form-group">
            <div 
              class="premium-upload-box" 
              :class="{ 'has-file': uploadedImage, 'is-dragover': isDragOver }"
              @dragover.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input type="file" ref="fileInput" @change="handleFileChange" accept="image/*" style="display: none">
              
              <div v-if="!uploadedImage" class="upload-content">
                <div class="icon-circle"><cloud-upload-outlined /></div>
                <p class="upload-title">上传参考图</p>
                <p class="upload-hint">支持 JPG, PNG</p>
              </div>

              <div v-else class="uploaded-perfect-fit">
                <img :src="uploadedImagePreview" alt="Reference">
                <div class="glass-overlay">
                  <span class="file-name">{{ uploadedImage.name }}</span>
                  <button class="remove-btn-glass" @click.stop="removeUploadedImage"><delete-outlined /></button>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Prompt Input -->
        <div class="form-group">
          <label class="section-label">提示词</label>
          <a-textarea 
            v-model:value="prompt" 
            placeholder="描述画面细节..." 
            class="ios-textarea"
            :auto-size="{ minRows: 4, maxRows: 8 }"
          />
        </div>

        <!-- Settings: 修复下拉框看不见的问题 -->
        <div class="settings-grid">
          <div class="form-group">
            <label class="section-label">模型</label>
            <!-- 移除额外的 div wrapper，直接放 a-select 并给宽度 -->
            <a-select v-model:value="provider" class="ios-select" :bordered="false" dropdownClassName="ios-dropdown">
              <a-select-option value="doubao">豆包 (Pro)</a-select-option>
              <a-select-option value="nano">Nano (Fast)</a-select-option>
            </a-select>
          </div>
          <div class="form-group">
            <label class="section-label">尺寸</label>
            <a-select v-model:value="size" class="ios-select" :bordered="false" dropdownClassName="ios-dropdown">
              <a-select-opt-group label="正方形">
                <a-select-option value="1024x1024">1:1</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="横屏">
                <a-select-option value="2560x1440">16:9</a-select-option>
                <a-select-option value="2304x1728">4:3</a-select-option>
              </a-select-opt-group>
              <a-select-opt-group label="竖屏">
                <a-select-option value="1440x2560">9:16</a-select-option>
                <a-select-option value="1728x2304">3:4</a-select-option>
              </a-select-opt-group>
            </a-select>
          </div>
        </div>

        <div class="action-footer">
           <button class="ios-primary-btn" :disabled="generating" @click="handleGenerate">
            <span v-if="!generating">立即生成 ✨</span>
            <span v-else><a-spin size="small" style="margin-right: 8px"/> 绘制中...</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧预览与历史 (保持之前修复的完美版) -->
    <div class="preview-panel">
      <div class="card preview-card" :class="{ 'auto-height': generatedImage }">
        <div class="preview-header"><h3>当前作品</h3></div>
        <div class="preview-viewport" :class="{ 'fit-content': generatedImage }">
          <div v-if="!generatedImage && !generating" class="placeholder-state">
            <div class="placeholder-icon-bg"><picture-outlined /></div>
            <p>AI 创意画布</p>
          </div>
          <div v-if="generating" class="loading-state"><a-spin size="large" /><p>正在绘制...</p></div>
          <div v-if="generatedImage" class="image-perfect-wrapper">
             <img :src="generatedImage" alt="Generated" class="result-image">
             <div class="glass-action-bar">
                <button @click="previewImage({url: generatedImage})"><eye-outlined /></button>
                <div class="divider"></div>
                <button @click="downloadImage({url: generatedImage, filename: `generated-${Date.now()}.png`})"><download-outlined /></button>
             </div>
          </div>
        </div>
      </div>

      <div class="history-section">
        <div class="history-header">
          <h3>历史画廊 <span class="count-badge" v-if="historyImages.length">{{ historyImages.length }}</span></h3>
          <div class="history-tools">
            <a-input-search v-model:value="historySearch" placeholder="搜索..." class="transparent-search" @search="fetchHistory"/>
          </div>
        </div>
        <div class="history-scroll-container">
          <div class="waterfall-container" v-if="historyImages.length > 0">
            <div v-for="img in historyImages" :key="img.id" class="waterfall-item" @click="selectHistory(img)">
              <div class="waterfall-img-box"><img :src="img.url" :alt="img.prompt" loading="lazy"></div>
              <div class="hover-glass-overlay">
                <div class="action-row-glass">
                  <button @click.stop="previewImage(img)"><eye-outlined /></button>
                  <button @click.stop="downloadImage(img)"><download-outlined /></button>
                  <button @click.stop="renameImage(img)"><edit-outlined /></button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-history"><a-empty description="暂无历史创作" /></div>
          <div class="pagination-controls" v-if="historyTotalPages > 1">
              <a-button type="text" :disabled="historyPage === 1" @click="changeHistoryPage(-1)"><left-outlined /></a-button>
              <span class="page-info">{{ historyPage }} / {{ historyTotalPages }}</span>
              <a-button type="text" :disabled="historyPage === historyTotalPages" @click="changeHistoryPage(1)"><right-outlined /></a-button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <a-modal v-model:open="previewVisible" :footer="null" width="auto" centered :closable="false" class="clean-modal" @cancel="previewVisible = false">
    <div class="full-image-container" @click="previewVisible = false"><img :src="previewImageUrl" alt="Preview" /></div>
  </a-modal>
  <a-modal v-model:open="renameVisible" title="重命名" @ok="handleRenameOk" @cancel="renameVisible = false">
    <a-input v-model:value="renameText" placeholder="输入新的文件名" />
  </a-modal>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { 
  CloudUploadOutlined, 
  DeleteOutlined, 
  PictureOutlined, 
  SearchOutlined, 
  LeftOutlined, 
  RightOutlined,
  EyeOutlined,
  DownloadOutlined,
  EditOutlined
} from '@ant-design/icons-vue'
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

// Preview Modal State
const previewVisible = ref(false)
const previewImageUrl = ref('')
const previewImageObject = ref(null)

// Rename Modal State
const renameVisible = ref(false)
const renameText = ref('')
const renameImageObject = ref(null)

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

// New functions for image actions
const previewImage = (img) => {
  previewImageUrl.value = img.url
  previewImageObject.value = img
  previewVisible.value = true
}

const downloadImage = (img) => {
  const link = document.createElement('a')
  link.href = img.url
  link.download = img.filename
  link.click()
  message.success('图片下载已开始')
}

const renameImage = (img) => {
  renameImageObject.value = img
  // Remove extension for cleaner display
  const lastDotIndex = img.filename.lastIndexOf('.')
  renameText.value = lastDotIndex !== -1 ? img.filename.substring(0, lastDotIndex) : img.filename
  renameVisible.value = true
}

const handleRenameOk = async () => {
  if (!renameText.value.trim()) {
    message.warning('请输入文件名')
    return;
  }

  try {
    // Get extension from original filename
    const lastDotIndex = renameImageObject.value.filename.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? renameImageObject.value.filename.substring(lastDotIndex) : '';
    const newFilename = renameText.value + extension;
    
    // Check if new filename is the same as the old one
    if (renameImageObject.value.filename === newFilename) {
      message.info('文件名未改变');
      renameVisible.value = false;
      return;
    }
    
    // Use PATCH method with filename as parameter, not ID
    const response = await axios.patch(`/api/v1/images/${renameImageObject.value.filename}`, {
      newFilename: newFilename
    });
    
    message.success('重命名成功');
    renameVisible.value = false;
    fetchHistory(); // Refresh history
    
    // Update the renamed image in the history list without reloading
    const imageIndex = historyImages.value.findIndex(img => img.filename === renameImageObject.value.filename);
    if (imageIndex !== -1) {
      historyImages.value[imageIndex].filename = response.data.newFilename;
      historyImages.value[imageIndex].url = `/generated/${response.data.newFilename}`;
    }
  } catch (err) {
    console.error('Failed to rename image', err);
    // Handle specific error codes
    if (err.response?.status === 409) {
      message.error('文件名已存在，请换一个');
    } else if (err.response?.status === 404) {
      message.error('原始记录未找到或无权操作');
    } else {
      message.error(err.response?.data?.error || '重命名失败');
    }
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
/* ================= 全局布局 ================= */
.home-container {
  height: calc(100vh - 64px);
  display: flex;
  gap: 24px;
  padding: 24px;
  max-width: 1800px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
  color: var(--text-primary);
}

.control-panel { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; }
.control-card { height: 100%; overflow-y: auto; padding-right: 4px; }
.preview-panel { flex: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0; height: 100%; overflow: hidden; }

.card {
  background: var(--card-bg, #ffffff);
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
}

h2 { font-size: 22px; font-weight: 700; margin: 0 0 20px 0; letter-spacing: -0.5px; }
h3 { font-size: 17px; font-weight: 600; margin: 0; }
.section-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary, #86868b); margin-bottom: 8px; text-transform: uppercase; }

/* ================= iOS Control ================= */
.ios-segmented-control {
  background: var(--bg-secondary, #eff1f2);
  padding: 4px; border-radius: 12px; display: flex; position: relative; margin-bottom: 24px; height: 44px; flex-shrink: 0;
}
.segment-item { flex: 1; text-align: center; z-index: 2; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: var(--text-secondary, #666); transition: color 0.3s ease; }
.segment-item.active { color: var(--text-primary, #000); font-weight: 600; }
.segment-item input { display: none; }
.segment-glider { position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px); background: var(--card-bg, #fff); border-radius: 9px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 0.3s; z-index: 1; }
.segment-glider.right { transform: translateX(100%); margin-left: 4px; }

/* ================= Premium Upload Box (修复版) ================= */
.premium-upload-box {
  border: 1px dashed #d1d1d6;
  border-radius: 16px;
  /* 默认高度，没图时显示 */
  min-height: 140px; 
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-secondary, #fafafa);
  transition: all 0.3s ease;
  display: flex; align-items: center; justify-content: center;
}
.premium-upload-box:hover { border-color: var(--primary-color, #007aff); background: rgba(0, 122, 255, 0.03); }

/* 有图时的状态：去除边框，去除Padding，高度自动 */
.premium-upload-box.has-file {
  border: none;
  background: transparent;
  display: block; /* 取消 flex 居中，让 img 撑开 */
  height: auto;
}

.upload-content { text-align: center; width: 100%; }
.icon-circle { width: 40px; height: 40px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); font-size: 20px; color: var(--primary-color, #007aff); }
.upload-title { font-weight: 600; font-size: 14px; margin: 0 0 4px 0; }
.upload-hint { font-size: 12px; margin: 0; opacity: 0.7; }

/* 完美契合的上传预览 */
.uploaded-perfect-fit {
  width: 100%;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  font-size: 0; /* 消除img底下的空隙 */
}
.uploaded-perfect-fit img {
  width: 100%;
  height: auto;
  display: block;
}

.glass-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(255,255,255,0.75);
  backdrop-filter: blur(12px);
  padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid rgba(255,255,255,0.5);
}
.file-name { font-size: 12px; font-weight: 500; color: #333; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove-btn-glass { background: none; border: none; color: #ff3b30; cursor: pointer; padding: 4px; }

/* 
   ================= 核心修复：Input, Select & Button ================= 
   强制统一高度和样式
*/

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

/* 1. iOS 风格输入框 */
.ios-textarea {
  background: var(--bg-secondary, #f2f2f7) !important;
  border: 1px solid transparent !important;
  border-radius: 12px !important;
  padding: 12px !important;
  font-size: 15px !important;
  resize: none;
}
.ios-textarea:focus { background: var(--card-bg, #fff) !important; box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2) !important; }

/* 2. iOS 风格下拉框 (修复截断问题) */
/* 使用 :deep 穿透 Ant Design 内部样式 */
:deep(.ios-select) {
  width: 100%; /* 占满格子 */
  height: 50px; /* 增加高度，更容易点击 */
}

:deep(.ios-select .ant-select-selector) {
  background-color: var(--bg-secondary, #f2f2f7) !important;
  border: 1px solid transparent !important;
  border-radius: 12px !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  padding: 0 12px !important;
}

:deep(.ios-select.ant-select-focused .ant-select-selector) {
  background-color: var(--card-bg, #fff) !important;
  box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2) !important;
}

:deep(.ios-select .ant-select-selection-item) {
  font-weight: 500;
  font-size: 15px;
  line-height: 50px; /* 垂直居中 */
  color: var(--text-primary);
}

/* 3. iOS 风格主按钮 */
.ios-primary-btn {
  width: 100%; 
  height: 50px; /* 与下拉框高度一致 */
  background: var(--primary-color, #007aff); 
  color: white; 
  border: none; 
  border-radius: 14px; 
  font-size: 17px; 
  font-weight: 600; 
  cursor: pointer; 
  transition: all 0.2s; 
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ios-primary-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0, 122, 255, 0.4); }
.ios-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ================= Preview Section (完美契合修复) ================= */
.preview-card {
  flex: 0 0 auto;
  /* 默认高度用于展示 Placeholder */
  min-height: 400px;
  display: flex; flex-direction: column; padding: 0; overflow: hidden;
  transition: all 0.3s ease;
}

/* 有图时，移除最小高度限制，让图片决定高度 */
.preview-card.auto-height {
  min-height: 0;
  height: auto;
  /* 限制最大高度，防止把历史记录挤没了 */
  max-height: 65vh; 
}

.preview-header { padding: 20px 24px 10px; flex-shrink: 0; }

.preview-viewport {
  flex: 1; width: 100%; position: relative;
  background: var(--bg-secondary, #f5f5f7);
  border-top: 1px solid rgba(0,0,0,0.03);
  display: flex; align-items: center; justify-content: center;
}

/* 有图时：移除背景色，变为紧贴模式 */
.preview-viewport.fit-content {
  background: transparent;
  border: none;
  display: block; /* 不再 flex center，让 img block */
}

.placeholder-state, .loading-state {
  text-align: center; color: var(--text-secondary); padding: 40px;
}
.placeholder-icon-bg { font-size: 48px; margin-bottom: 12px; opacity: 0.2; }

/* 完美契合的生成图容器 */
.image-perfect-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  font-size: 0;
  display: flex;
  justify-content: center;
  background: transparent; /* 确保无底色 */
}

.result-image {
  /* 
     关键：这里不强制 width 100%，而是 max-width 100%
     高度也 max-height，这样它会按原比例渲染，且不会超出容器
  */
  max-width: 100%;
  /* 限制图片高度不超过 viewport 的最大高度 */
  max-height: 55vh; 
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 0 0 24px 24px; /* 底部圆角顺应卡片 */
  /* 如果不需要底部圆角，可以去掉 */
}

.glass-action-bar {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  padding: 6px; border-radius: 30px;
  display: flex; align-items: center; gap: 4px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.4);
  opacity: 0; transition: opacity 0.3s;
}
.image-perfect-wrapper:hover .glass-action-bar { opacity: 1; }
.glass-action-bar button { background: transparent; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #1d1d1f; font-size: 20px; transition: background 0.2s; }
.glass-action-bar button:hover { background: rgba(255,255,255,0.5); }
.glass-action-bar .divider { width: 1px; height: 24px; background: rgba(0,0,0,0.15); margin: 0 4px; }

/* ================= History Waterfall (修复白透Bug) ================= */
.history-section { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0; background: transparent; box-shadow: none; border: none; }
.history-header { padding: 0 0 16px 0; display: flex; justify-content: space-between; align-items: center; }
.history-scroll-container { flex: 1; overflow-y: auto; padding-right: 8px; }

.waterfall-container {
  column-count: auto; 
  column-width: 150px; 
  column-gap: 16px;
  padding-top: 2px; /* Prevent crop */
}

.waterfall-item {
  break-inside: avoid;
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  transition: transform 0.3s;
  /* 修复：给卡片加个背景色，防止图片加载前的透明区域透出底色 */
  background: var(--bg-secondary, #e5e5e5); 
  transform: translateZ(0); /* 开启GPU加速，修复渲染bug */
}

/* 包裹层：确保有背景 */
.waterfall-img-box {
  background: var(--bg-secondary, #e5e5e5);
  min-height: 100px; /* 防止高度塌陷 */
}

.waterfall-item img {
  display: block; width: 100%; height: auto;
  opacity: 1; /* 确保不透明 */
  transition: opacity 0.3s;
}

.waterfall-item:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.12); z-index: 2; }

.hover-glass-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
.waterfall-item:hover .hover-glass-overlay { opacity: 1; }
.action-row-glass { display: flex; gap: 8px; }
.action-row-glass button { background: rgba(255, 255, 255, 0.3); border: 1px solid rgba(255, 255, 255, 0.5); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; backdrop-filter: blur(8px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.2s; }
.action-row-glass button:hover { background: rgba(255, 255, 255, 0.9); color: #000; transform: scale(1.1); }

/* ================= Dark Mode ================= */
:global(html.dark) .card { --card-bg: #1c1c1e; border-color: rgba(255,255,255,0.08); }
:global(html.dark) .ios-segmented-control { background: #2c2c2e; }
:global(html.dark) .segment-glider { background: #636366; }
:global(html.dark) .segment-item.active { color: #fff; }
:global(html.dark) .segment-item { color: #8e8e93; }
:global(html.dark) .premium-upload-box { background: #2c2c2e; border-color: #3a3a3c; }
:global(html.dark) .upload-content { color: #8e8e93; }
:global(html.dark) .icon-circle { background: #3a3a3c; }
:global(html.dark) .glass-overlay { background: rgba(28,28,30,0.8); border-top-color: rgba(255,255,255,0.1); }
:global(html.dark) .file-name { color: #fff; }
:global(html.dark) .ios-textarea, :global(html.dark) .select-wrapper { background: #000000; }
:global(html.dark) .ios-textarea:focus { background: #1c1c1e !important; }

/* Dark Mode Waterfall */
:global(html.dark) .waterfall-item, 
:global(html.dark) .waterfall-img-box { background: #2c2c2e; } /* 关键修复：深色模式底色 */

:global(html.dark) .glass-action-bar { background: rgba(40,40,40,0.7); border: 1px solid rgba(255,255,255,0.1); }
:global(html.dark) .glass-action-bar button { color: #fff; }
:global(html.dark) .glass-action-bar button:hover { background: rgba(255,255,255,0.15); }
:global(html.dark) .glass-action-bar .divider { background: rgba(255,255,255,0.2); }

.full-image-container { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; cursor: zoom-out; }
.full-image-container img { max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 20px 80px rgba(0,0,0,0.5); }

@media (max-width: 1000px) { .home-container { flex-direction: column; height: auto; overflow-y: auto; } .control-panel { width: 100%; } .preview-panel { height: auto; overflow: visible; } .preview-card { min-height: 400px; } .history-section { height: 600px; } }
</style>
