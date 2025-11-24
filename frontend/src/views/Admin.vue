<template>
  <div class="admin-container">
    <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
      <!-- Users Management -->
      <a-tab-pane key="users" tab="用户管理">
        <div class="toolbar">
          <a-input-search
            v-model:value="searchText"
            placeholder="搜索用户名..."
            style="width: 300px"
            @search="fetchUsers"
          />
        </div>
        
        <a-table :columns="userColumns" :data-source="users" :loading="loading" row-key="id" :scroll="{ x: 800 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <a-tag :color="record.role === 'admin' ? 'blue' : 'default'">
                {{ record.role === 'admin' ? '管理员' : '用户' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ new Date(record.createdAt).toLocaleDateString() }}
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="link" @click="openRechargeModal(record)">管理/充值</a-button>
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- Recharge Records -->
      <a-tab-pane key="recharges" tab="充值记录">
        <a-table :columns="rechargeColumns" :data-source="recharges" :loading="loading" row-key="id" :scroll="{ x: 800 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'amount'">
              <span style="color: #52c41a; font-weight: bold">+{{ record.amount }}</span>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ new Date(record.createdAt).toLocaleString() }}
            </template>
          </template>
        </a-table>
      </a-tab-pane>

      <!-- Statistics -->
      <a-tab-pane key="stats" tab="数据统计">
        <div class="stats-grid">
          <a-card>
            <a-statistic title="总调用次数" :value="stats.totalUsage" />
          </a-card>
          <a-card>
            <a-statistic title="免费调用" :value="stats.freeUsage" />
          </a-card>
          <a-card>
            <a-statistic title="总消耗积分" :value="stats.totalCost" />
          </a-card>
        </div>

        <h3 style="margin: 24px 0 16px">使用详情</h3>
        <a-table :columns="usageColumns" :data-source="stats.usageByType" :pagination="false" row-key="type" :scroll="{ x: 600 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              {{ record.type === 'text-to-image' ? '文生图' : '图生图' }}
            </template>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>

    <!-- Recharge/Edit Modal -->
    <a-modal
      v-model:visible="modalVisible"
      title="用户管理"
      @ok="handleModalOk"
      :confirmLoading="modalLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="用户角色">
          <a-select v-model:value="modalForm.role">
            <a-select-option value="user">普通用户</a-select-option>
            <a-select-option value="admin">管理员</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="充值积分 (留空则不充值)">
          <a-input-number v-model:value="modalForm.amount" style="width: 100%" placeholder="输入金额" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="modalForm.reason" placeholder="充值原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'

// State
const activeTab = ref('users')
const loading = ref(false)
const searchText = ref('')

// Data
const users = ref([])
const recharges = ref([])
const stats = ref({ totalUsage: 0, freeUsage: 0, totalCost: 0, usageByType: [] })

// Modal State
const modalVisible = ref(false)
const modalLoading = ref(false)
const currentUserId = ref(null)
const modalForm = ref({
  role: 'user',
  amount: null,
  reason: ''
})

// Columns
const userColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '角色', dataIndex: 'role', key: 'role' },
  { title: '积分余额', dataIndex: 'credits', key: 'credits' },
  { title: '免费次数', dataIndex: 'freeTextToImageCount', key: 'freeCount' },
  { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action' }
]

const rechargeColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
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

// Methods
const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/admin/users?search=${searchText.value}`)
    users.value = res.data.users
  } catch (err) {
    message.error('加载用户失败')
  } finally {
    loading.value = false
  }
}

const fetchRecharges = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/recharges')
    recharges.value = res.data.recharges
  } catch (err) {
    message.error('加载充值记录失败')
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/admin/usage-stats')
    stats.value = res.data
  } catch (err) {
    message.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
}

const handleTabChange = (key) => {
  if (key === 'users') fetchUsers()
  if (key === 'recharges') fetchRecharges()
  if (key === 'stats') fetchStats()
}

const openRechargeModal = (user) => {
  currentUserId.value = user.id
  modalForm.value = {
    role: user.role,
    amount: null,
    reason: ''
  }
  modalVisible.value = true
}

const handleModalOk = async () => {
  modalLoading.value = true
  try {
    // Update Role
    await axios.patch(`/api/admin/users/${currentUserId.value}/role`, {
      role: modalForm.value.role
    })

    // Recharge if amount > 0
    if (modalForm.value.amount && modalForm.value.amount > 0) {
      await axios.post(`/api/admin/users/${currentUserId.value}/recharge`, {
        amount: modalForm.value.amount,
        reason: modalForm.value.reason
      })
    }

    message.success('操作成功')
    modalVisible.value = false
    fetchUsers() // Refresh list
  } catch (err) {
    message.error('操作失败')
  } finally {
    modalLoading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.admin-container {
  background: #fff;
  padding: 24px;
  border-radius: 16px;
  min-height: 100%;
}

.toolbar {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}
</style>
