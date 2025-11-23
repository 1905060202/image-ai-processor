require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./lib/database'); // 引入数据库初始化函数

// --- 全局代理设置 (保持不变) ---
try {
  const proxyUrl = process.env.PROXY_URL;
  if (proxyUrl && proxyUrl.trim()) {
    const { setGlobalDispatcher, ProxyAgent } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[network] 已启用全局代理: ${proxyUrl}`);
  } else {
    console.log('[network] 未设置 PROXY_URL，直连上游');
  }
} catch (e) {
  console.warn('[network] 代理初始化失败（忽略并直连）：', e && (e.message || e.toString()));
}

// --- Express 应用设置 ---
const app = express();
const PORT = process.env.PORT || 3000;
const imageProcessorRoutes = require('./routes/imageProcessor');

// --- 中间件配置 ---
app.use(cors());
app.use(express.json());

// --- 静态文件服务配置 (顺序很重要) ---
// 1. 提供 public 目录下的所有静态文件 (js, css, 等)
app.use(express.static(path.join(__dirname, 'public')));

// 2. 提供 generated 目录下的图片
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// --- API 路由配置 ---
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const creditsRoutes = require('./routes/credits');

// --- API 路由配置 ---
app.use('/api/auth', authRoutes);
app.use('/api/v1', imageProcessorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/explore', require('./routes/explore'));
app.use('/api/profile', require('./routes/profile'));

// --- 登录页面路由 ---
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- 后台管理页面路由 ---
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- 发现页面路由 ---
app.get('/explore', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explore.html'));
});

// --- 个人主页路由 ---
app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// --- 修复点：为根路径 '/' 提供前端主页面 ---
// 这将确保访问 http://localhost:3000 时返回 index.html
app.get('/', (req, res) => {
  // 确保您的 index.html 位于 public 文件夹内
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- 初始化并启动服务器 ---
console.log('Initializing database...');
// --- 初始化数据库并启动服务器 ---
const startServer = async () => {
  await initializeDatabase(); // 等待数据库连接和模型同步完成
  app.listen(PORT, () => {
    console.log(`🚀 Server is running and ready at http://localhost:${PORT}`);
  });
};

startServer().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});