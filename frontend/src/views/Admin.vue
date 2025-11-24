<template>
  <div class="admin-container">
    <div class="glass-panel">
      <!-- 顶部标题 -->
      <div class="panel-header">
        <h2>后台管理控制台</h2>
      </div>

      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange" class="custom-tabs">
        
        <!-- Tab 1: 用户管理 -->
        <a-tab-pane key="users" tab="用户管理">
          <div class="toolbar">
            <a-input-search
              v-model:value="searchText"
              placeholder="搜索用户名..."
              class="ios-search"
              @search="fetchUsers"
            />
          </div>
          
          <div class="table-wrapper">
            <a-table 
              :columns="userColumns" 
              :data-source="users" 
              :loading="loading" 
              row-key="id" 
              :scroll="{ x: 800 }" 
              :pagination="{ pageSize: 10, showSizeChanger: false }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'role'">
                  <span class="role-badge" :class="record.role">
                    {{ record.role === 'admin' ? '管理员' : '用户' }}
                  </span>
                </template>
                <template v-if="column.key === 'createdAt'">
                  <span class="date-text">{{ new Date(record.createdAt).toLocaleDateString() }}</span>
                </template>
                <template v-if="column.key === 'action'">
                  <button class="action-btn" @click="openRechargeModal(record)">管理</button>
                </template>
              </template>
            </a-table>
          </div>
        </a-tab-pane>

        <!-- Tab 2: 充值记录 -->
        <a-tab-pane key="recharges" tab="充值记录">
          <div class="table-wrapper">
            <a-table 
              :columns="rechargeColumns" 
              :data-source="recharges" 
              :loading="loading" 
              row-key="id" 
              :scroll="{ x: 800 }"
              :pagination="{ pageSize: 10, showSizeChanger: false }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'amount'">
                  <span class="amount-text">+{{ record.amount }}</span>
                </template>
                <template v-if="column.key === 'createdAt'">
                  <span class="date-text">{{ new Date(record.createdAt).toLocaleString() }}</span>
                </template>
              </template>
            </a-table>
          </div>
        </a-tab-pane>

        <!-- Tab 3: 数据统计 -->
        <a-tab-pane key="stats" tab="数据统计">
          <div class="stats-grid">
            <div class="stat-card gradient-blue">
              <div class="stat-title">总调用次数</div>
              <div class="stat-value">{{ stats.totalUsage }}</div>
              <div class="stat-icon">🔥</div>
            </div>
            <div class="stat-card gradient-purple">
              <div class="stat-title">免费调用</div>
              <div class="stat-value">{{ stats.freeUsage }}</div>
              <div class="stat-icon">🎁</div>
            </div>
            <div class="stat-card gradient-orange">
              <div class="stat-title">总消耗积分</div>
              <div class="stat-value">{{ stats.totalCost }}</div>
              <div class="stat-icon">💎</div>
            </div>
          </div>

          <h3 class="section-title">分类详情</h3>
          <div class="table-wrapper">
            <a-table :columns="usageColumns" :data-source="stats.usageByType" :pagination="false" row-key="type">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'type'">
                  <span class="type-tag">{{ record.type === 'text-to-image' ? '文生图' : '图生图' }}</span>
                </template>
              </template>
            </a-table>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- Modal -->
    <a-modal
      v-model:visible="modalVisible"
      title="用户管理"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
      class="glass-modal"
      centered
    >
      <a-form layout="vertical">
        <a-form-item label="用户角色">
          <a-select v-model:value="modalForm.role" class="ios-select" dropdownClassName="ios-dropdown">
            <a-select-option value="user">普通用户</a-select-option>
            <a-select-option value="admin">管理员</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="充值积分">
          <a-input-number v-model:value="modalForm.amount" style="width: 100%" placeholder="输入金额" class="ios-input" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="modalForm.reason" placeholder="充值原因" class="ios-input" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'

const activeTab = ref('users')
const loading = ref(false)
const searchText = ref('')
const users = ref([])
const recharges = ref([])
const stats = ref({ totalUsage: 0, freeUsage: 0, totalCost: 0, usageByType: [] })
const modalVisible = ref(false)
const modalLoading = ref(false)
const currentUserId = ref(null)
const modalForm = ref({ role: 'user', amount: null, reason: '' })

const userColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '角色', dataIndex: 'role', key: 'role' },
  { title: '积分余额', dataIndex: 'credits', key: 'credits' },
  { title: '免费次数', dataIndex: 'freeTextToImageCount', key: 'freeCount' },
  { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action' }
]

const rechargeColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '充值用户', dataIndex: ['User', 'username'], key: 'user' },
  { title: '金额', dataIndex: 'amount', key: 'amount' },
  { title: '操作人', dataIndex: ['Operator', 'username'], key: 'operator' },
  { title: '备注', dataIndex: 'reason', key: 'reason' },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt' }
]

const usageColumns = [
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '总调用次数', dataIndex: 'count', key: 'count' },
  { title: '总消耗积分', dataIndex: 'totalCost', key: 'totalCost' }
]

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/admin/users?search=${searchText.value}`)
    users.value = res.data.users
  } catch (err) { message.error('加载失败') } finally { loading.value = false }
}

const fetchRecharges = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/recharges')
    recharges.value = res.data.recharges
  } catch (err) { message.error('加载失败') } finally { loading.value = false }
}

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/usage-stats')
    stats.value = res.data
  } catch (err) { message.error('加载失败') } finally { loading.value = false }
}

const handleTabChange = (key) => {
  if (key === 'users') fetchUsers()
  if (key === 'recharges') fetchRecharges()
  if (key === 'stats') fetchStats()
}

const openRechargeModal = (user) => {
  currentUserId.value = user.id
  modalForm.value = { role: user.role, amount: null, reason: '' }
  modalVisible.value = true
}

const handleModalOk = async () => {
  modalLoading.value = true
  try {
    await axios.patch(`/api/admin/users/${currentUserId.value}/role`, { role: modalForm.value.role })
    if (modalForm.value.amount && modalForm.value.amount > 0) {
      await axios.post(`/api/admin/users/${currentUserId.value}/recharge`, { amount: modalForm.value.amount, reason: modalForm.value.reason })
    }
    message.success('操作成功')
    modalVisible.value = false
    fetchUsers()
  } catch (err) { message.error('操作失败') } finally { modalLoading.value = false }
}

onMounted(() => { fetchUsers() })
</script>

<style scoped>
.admin-container {
  max-width: 1200px;
  margin: 0 auto;
}

.glass-panel {
  background: var(--card-bg, #fff);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
  min-height: 80vh;
  transition: background-color 0.3s ease;
}

.panel-header h2 {
  font-size: 24px; font-weight: 700; margin-bottom: 24px; color: var(--text-primary);
}

.toolbar { margin-bottom: 24px; }

/* iOS Search */
.ios-search :deep(.ant-input) {
  border-radius: 20px; background: var(--bg-secondary, #f5f5f7); border: none; padding-left: 16px; color: var(--text-primary);
}
.ios-search :deep(.ant-input-search-button) {
  border-radius: 0 20px 20px 0; border: none; background: transparent; color: var(--text-secondary);
}

/* Stats Cards */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 40px; }
.stat-card { border-radius: 20px; padding: 24px; position: relative; overflow: hidden; color: white; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
.gradient-blue { background: linear-gradient(135deg, #007aff 0%, #00c6ff 100%); }
.gradient-purple { background: linear-gradient(135deg, #bf5af2 0%, #ff5e3a 100%); }
.gradient-orange { background: linear-gradient(135deg, #ff9500 0%, #ffcc00 100%); }
.stat-title { font-size: 14px; opacity: 0.9; margin-bottom: 8px; font-weight: 500; }
.stat-value { font-size: 32px; font-weight: 700; letter-spacing: -1px; }
.stat-icon { position: absolute; right: 20px; bottom: 20px; font-size: 40px; opacity: 0.2; transform: rotate(-15deg); }

/* Table Wrapper */
.table-wrapper {
  background: var(--bg-secondary, #fbfbfd);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(0,0,0,0.03);
}

/* ================== 表格通用样式 ================== */
:deep(.ant-table) { background: transparent !important; }
:deep(.ant-table-container), :deep(.ant-table-content) { background: transparent !important; }
:deep(.ant-table-thead > tr > th) { background: transparent; color: var(--text-secondary); font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.05); }
:deep(.ant-table-tbody > tr > td) { border-bottom: 1px solid rgba(0,0,0,0.03); color: var(--text-primary); transition: background 0.3s; }
:deep(.ant-table-tbody > tr:hover > td) { background: rgba(0,0,0,0.02) !important; }

/* Badges & Text */
.role-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.role-badge.admin { background: rgba(0, 122, 255, 0.15); color: #007aff; }
.role-badge.user { background: rgba(0,0,0,0.05); color: var(--text-secondary); }
.amount-text { color: #34c759; font-weight: 600; font-family: monospace; font-size: 15px; }
.date-text { color: var(--text-secondary); font-size: 13px; }

.action-btn {
  background: transparent; border: 1px solid var(--border-color, #e5e5ea); color: var(--text-primary);
  padding: 4px 12px; border-radius: 14px; font-size: 12px; cursor: pointer; transition: all 0.2s;
}
.action-btn:hover { border-color: #007aff; color: #007aff; }
.section-title { margin: 32px 0 16px; color: var(--text-primary); font-size: 18px; font-weight: 600; }

/* ================== Modal & Inputs ================== */
.ios-input, :deep(.ios-select .ant-select-selector) {
  border-radius: 12px !important; background: var(--bg-secondary, #f5f5f7) !important; border: none !important; color: var(--text-primary);
}
:deep(.ant-modal-content) { border-radius: 20px; overflow: hidden; background: var(--card-bg, #fff); }
:deep(.ant-modal-header) { background: var(--card-bg, #fff); border-bottom: 1px solid rgba(0,0,0,0.05); }
:deep(.ant-modal-title) { color: var(--text-primary); }

/* ================== Dark Mode 核心修复 ================== */
/* 背景与容器 */
:global(html.dark) .glass-panel { background: #1c1c1e; border-color: rgba(255,255,255,0.1); }
:global(html.dark) .table-wrapper { background: #2c2c2e; border-color: rgba(255,255,255,0.05); }

/* 表格暗夜适配 - 暴力覆盖 */
:global(html.dark) .ant-table,
:global(html.dark) .ant-table-container,
:global(html.dark) .ant-table-content {
  background: transparent !important;
  color: #f5f5f7;
}

:global(html.dark) .ant-table-thead > tr > th {
  background: rgba(255,255,255,0.05) !important;
  color: #a1a1a6;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

:global(html.dark) .ant-table-tbody > tr > td {
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: #f5f5f7;
  background: transparent !important; /* 强制去除默认白色背景 */
}

/* 鼠标悬停 */
:global(html.dark) .ant-table-tbody > tr:hover > td {
  background: rgba(255,255,255,0.08) !important;
}

/* 分页器 */
:global(html.dark) .ant-pagination-item a { color: #fff; }
:global(html.dark) .ant-pagination-item-active { background: #007aff; border-color: #007aff; }
:global(html.dark) .ant-pagination-prev .ant-pagination-item-link,
:global(html.dark) .ant-pagination-next .ant-pagination-item-link {
  color: #fff; background: transparent;
}

/* Tabs */
:global(html.dark) .ant-tabs-tab { color: #86868b; }
:global(html.dark) .ant-tabs-tab-active .ant-tabs-tab-btn { color: #fff !important; }

/* 其他组件 */
:global(html.dark) .ios-search :deep(.ant-input) { background: #000; color: #fff; }
:global(html.dark) .role-badge.user { background: rgba(255,255,255,0.1); color: #999; }
:global(html.dark) .action-btn { border-color: #444; color: #fff; }
:global(html.dark) .action-btn:hover { background: #fff; color: #000; }

/* Modal & Form Dark Mode */
:global(html.dark) .ant-modal-content,
:global(html.dark) .ant-modal-header {
  background: #1c1c1e;
}
:global(html.dark) .ant-modal-title { color: #fff; }
:global(html.dark) .ant-modal-close-x { color: #fff; }
:global(html.dark) .ios-input, 
:global(html.dark) .ios-select .ant-select-selector {
  background: #000 !important; color: #fff;
}
:global(html.dark) label { color: #a1a1a6 !important; }
</style>