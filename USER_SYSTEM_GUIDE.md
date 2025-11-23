# 用户系统与权限管理实现指南

> 本文档面向大二学生，详细讲解如何从零开始构建一个完整的用户系统、权限管理系统，以及如何操作数据库表结构。

## 📚 目录

1. [系统概述](#系统概述)
2. [数据库设计](#数据库设计)
3. [用户认证系统](#用户认证系统)
4. [权限管理系统](#权限管理系统)
5. [积分与配额系统](#积分与配额系统)
6. [后台管理系统](#后台管理系统)
7. [前端集成](#前端集成)
8. [完整流程演示](#完整流程演示)
9. [社交与发现系统](#社交与发现系统)

---

## 系统概述

### 我们要实现什么？

1. **用户系统**：用户可以注册、登录
2. **权限系统**：区分普通用户和管理员
3. **数据隔离**：普通用户只能看到自己的数据，管理员可以看到所有数据
4. **积分系统**：限制免费使用次数，支持积分充值和扣除
5. **后台管理**：管理员可以管理用户、充值积分、查看统计
6. **安全保护**：使用 JWT Token 进行身份验证

### 技术栈

- **后端**：Node.js + Express
- **数据库**：PostgreSQL + Sequelize ORM
- **认证**：JWT (JSON Web Token)
- **密码加密**：bcrypt

---

## 数据库设计

### 第一步：设计表结构

在开始之前，我们需要设计四个核心表：

#### 1. Users 表（用户表）

```sql
CREATE TABLE Users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  credits INTEGER DEFAULT 0,           -- 用户积分
  freeTextToImageCount INTEGER DEFAULT 0, -- 免费文生图使用次数
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**新增字段**：
- `credits`：用户的积分余额
- `freeTextToImageCount`：记录用户已经免费使用了多少次文生图

#### 2. Images 表（图片表）

```sql
CREATE TABLE Images (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  prompt TEXT,
  originalImage VARCHAR(255),
  userId INTEGER REFERENCES Users(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### 3. UsageRecords 表（使用记录表）

```sql
CREATE TABLE UsageRecords (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES Users(id),
  type VARCHAR(255),          -- 使用类型：'text-to-image' 或 'image-to-image'
  cost INTEGER,               -- 消耗积分
  isFree BOOLEAN,             -- 是否免费
  imageId INTEGER REFERENCES Images(id),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### 4. RechargeRecords 表（充值记录表）

```sql
CREATE TABLE RechargeRecords (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES Users(id),
  amount INTEGER,             -- 充值金额
  operatorId INTEGER REFERENCES Users(id), -- 操作员（管理员）ID
  reason VARCHAR(255),        -- 充值原因
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### 第二步：使用 Sequelize 定义模型

我们使用 Sequelize ORM 来操作数据库，这样就不需要手写 SQL。

#### 文件：`lib/database.js`

```javascript
const { Sequelize, DataTypes } = require('sequelize');

// ... 连接数据库代码 ...

// 1. 定义 User 模型
const User = sequelize.define('User', {
    // ... id, username, password, role ...
    credits: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    freeTextToImageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
});

// 2. 定义 UsageRecord 模型
const UsageRecord = sequelize.define('UsageRecord', {
    // ... 字段定义 ...
});

// 3. 定义 RechargeRecord 模型
const RechargeRecord = sequelize.define('RechargeRecord', {
    // ... 字段定义 ...
});

// 4. 建立关联关系
User.hasMany(Image, { foreignKey: 'userId' });
Image.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(UsageRecord, { foreignKey: 'userId' });
UsageRecord.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(RechargeRecord, { foreignKey: 'userId', as: 'UserRecharges' });
RechargeRecord.belongsTo(User, { foreignKey: 'userId' });

// ... 初始化数据库代码 ...
```

**魔法时刻 🪄**：
当你修改了模型定义（例如添加了 `credits` 字段），重启服务器时，`sequelize.sync({ alter: true })` 会自动检测到变化，并执行 `ALTER TABLE` 语句来更新数据库结构。你不需要写任何迁移脚本！

---

## 用户认证系统

### 第一步：密码加密

**为什么不能直接存储密码？**

如果数据库被攻击，明文密码会直接泄露！所以我们要加密存储。

#### 使用 bcrypt 加密密码

```javascript
const bcrypt = require('bcrypt');

// 注册时：加密密码
const hashedPassword = await bcrypt.hash(password, 10);
// 参数 10 是"盐值轮数"，数字越大越安全但越慢

// 登录时：验证密码
const match = await bcrypt.compare(password, user.password);
// 返回 true 表示密码正确
```

**工作原理**：
- `bcrypt.hash()`：将明文密码转换为不可逆的哈希值
- `bcrypt.compare()`：将输入的密码与存储的哈希值比较
- 即使两个用户密码相同，哈希值也不同（因为有"盐"）

### 第二步：JWT Token 认证

**什么是 JWT？**

JWT (JSON Web Token) 是一个字符串，包含了用户信息。用户登录后，服务器生成一个 Token，客户端保存这个 Token，每次请求都带上它。

**Token 的格式**：`header.payload.signature`

例如：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.xxx`

#### 文件：`routes/auth.js`（认证路由）

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../lib/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 1. 用户注册
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    try {
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(409).json({ error: '用户名已存在' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建用户（默认角色是 'user'）
        const user = await User.create({
            username,
            password: hashedPassword,
            role: 'user'  // 新用户默认是普通用户
        });

        res.status(201).json({ 
            message: '注册成功', 
            userId: user.id 
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 2. 用户登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    try {
        // 查找用户
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 验证密码
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 生成 JWT Token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }  // Token 24小时后过期
        );

        res.json({ 
            message: '登录成功', 
            token, 
            username: user.username, 
            role: user.role 
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

module.exports = router;
```

**流程说明**：

1. **注册流程**：
   ```
   用户输入用户名密码 
   → 检查用户名是否已存在 
   → 加密密码 
   → 保存到数据库 
   → 返回成功
   ```

2. **登录流程**：
   ```
   用户输入用户名密码 
   → 查找用户 
   → 验证密码 
   → 生成 Token 
   → 返回 Token 和用户信息
   ```

### 第三步：Token 验证中间件

每次用户请求 API 时，我们需要验证 Token 是否有效。

#### 文件：`middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_prod';

// 验证 Token 的中间件
const authenticateToken = (req, res, next) => {
    // 从请求头获取 Token
    // 格式：Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // 提取 token 部分

    if (!token) {
        return res.status(401).json({ error: '未授权: 请先登录' });
    }

    // 验证 Token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token 无效或已过期' });
        }
        // 将用户信息附加到请求对象上，供后续路由使用
        req.user = user;
        next(); // 继续执行下一个中间件或路由
    });
};

// 检查是否是管理员的中间件
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: '权限不足: 需要管理员权限' });
    }
};

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
```

**中间件的作用**：

1. `authenticateToken`：
   - 检查请求头中是否有 Token
   - 验证 Token 是否有效
   - 如果有效，将用户信息放到 `req.user` 中
   - 如果无效，返回 401 或 403 错误

2. `requireAdmin`：
   - 检查用户是否是管理员
   - 只有管理员才能访问某些接口

---

## 权限管理系统

### 数据隔离：普通用户 vs 管理员

我们的目标是：
- **普通用户**：只能看到和操作自己创建的图片
- **管理员**：可以看到和操作所有用户的图片

### 实现方式：在查询时过滤

#### 文件：`lib/imageManager.js`

```javascript
const { Image } = require('./database');
const { Op } = require('sequelize');

// 获取分页图片列表
const getPaginatedImages = async ({ 
    page = 1, 
    limit = 12, 
    query = '', 
    userId = null, 
    isAdmin = false 
}) => {
    const offset = (page - 1) * limit;
    let whereCondition = {};

    // 搜索功能
    if (query) {
        whereCondition = {
            [Op.or]: [
                { filename: { [Op.iLike]: `%${query}%` } },
                { prompt: { [Op.iLike]: `%${query}%` } }
            ]
        };
    }

    // 🔑 关键：权限控制
    // 如果不是管理员，只查询当前用户的图片
    if (!isAdmin && userId) {
        whereCondition.userId = userId;
    }
    // 如果是管理员，不添加 userId 条件，可以查询所有图片

    const { count, rows } = await Image.findAndCountAll({
        where: whereCondition,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
    });

    return {
        images: rows,
        totalImages: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
    };
};

module.exports = { getPaginatedImages };
```

**关键代码解释**：

```javascript
if (!isAdmin && userId) {
    whereCondition.userId = userId;
}
```

这行代码的意思是：
- 如果用户**不是管理员**，添加 `userId` 条件
- 生成的 SQL 类似：`SELECT * FROM Images WHERE userId = 1`
- 如果用户**是管理员**，不添加这个条件
- 生成的 SQL 类似：`SELECT * FROM Images`（查询所有）

### 在路由中使用权限控制

#### 文件：`routes/imageProcessor.js`

```javascript
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 🔑 所有路由都需要认证
router.use(authenticateToken);

// 获取图片列表
router.get('/images', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const query = req.query.q || '';
        
        // 从 Token 中获取用户信息
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // 根据权限查询图片
        const result = await imageManager.getPaginatedImages({ 
            page, 
            query, 
            userId, 
            isAdmin 
        });

        res.json({
            images: result.images,
            currentPage: result.currentPage,
            totalPages: result.totalPages,
        });
    } catch (err) {
        res.status(500).json({ error: '无法获取图片列表' });
    }
});

// 创建图片（自动关联到当前用户）
router.post('/upload', upload.array('images', 10), async (req, res) => {
    // ... 处理图片上传 ...
    
    // 🔑 关键：保存图片时关联到当前用户
    await imageManager.addEntry({
        filename: generatedFileName,
        prompt: prompt,
        originalImage: firstOriginalImageForDB,
        userId: req.user.id  // 自动关联到当前登录用户
    });
    
    res.json({ success: true });
});
```

**流程说明**：

1. 用户请求 `/api/v1/images`
2. `authenticateToken` 中间件验证 Token，将用户信息放到 `req.user`
3. 从 `req.user.id` 和 `req.user.role` 获取用户 ID 和角色
4. 调用 `getPaginatedImages`，传入 `userId` 和 `isAdmin`
5. 根据权限返回相应的图片列表

---

## 积分与配额系统

### 设计思路

我们需要一个灵活的系统来控制用户的使用权限：
1. **免费额度**：允许用户免费尝试几次（例如前5次文生图免费）。
2. **积分扣除**：超过免费额度后，或者使用高级功能（图生图），需要消耗积分。
3. **管理员特权**：管理员可以无限制免费使用。

### 实现逻辑

我们将逻辑封装在 `lib/creditManager.js` 中，而不是散落在各个路由里。

#### 1. 检查权限

```javascript
// lib/creditManager.js

const checkTextToImagePermission = async (userId, isAdmin) => {
    // 1. 管理员直接通过
    if (isAdmin) return { allowed: true, reason: '管理员权限' };

    const user = await User.findByPk(userId);

    // 2. 检查是否有免费次数
    if (user.freeTextToImageCount < 5) {
        return { allowed: true, reason: '免费使用' };
    }

    // 3. 检查积分是否足够
    if (user.credits >= 10) {
        return { allowed: true, reason: '使用积分' };
    }

    // 4. 都不满足，拒绝
    return { allowed: false, reason: '积分不足' };
};
```

#### 2. 扣除积分

在图片生成成功**之后**调用。

```javascript
const deductCredits = async (userId, type) => {
    const user = await User.findByPk(userId);
    
    if (type === 'text-to-image' && user.freeTextToImageCount < 5) {
        // 消耗免费次数
        user.freeTextToImageCount += 1;
        await UsageRecord.create({ userId, type, cost: 0, isFree: true });
    } else {
        // 扣除积分
        user.credits -= 10;
        await UsageRecord.create({ userId, type, cost: 10, isFree: false });
    }
    
    await user.save();
};
```

---
## 用户权限改造后的前端集成
### 第一步：登录页面

用户首次访问时，如果没有 Token，跳转到登录页。

#### 文件：`public/login.html`

```html
<form id="login-form">
    <input type="text" id="username" placeholder="用户名" required>
    <input type="password" id="password" placeholder="密码" required>
    <button type="submit">登录</button>
</form>

<script>
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        })
    });
    
    const data = await response.json();
    
    if (response.ok) {
        // 保存 Token 到本地存储
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role);
        
        // 跳转到主页
        window.location.href = '/';
    } else {
        alert(data.error);
    }
});
</script>
```

### 第二步：自动携带 Token

所有 API 请求都需要在请求头中携带 Token。

#### 文件：`public/js/app.js`

```javascript
// 检查是否已登录
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login';
    return;
}

// 创建带认证的 fetch 函数
const authenticatedFetch = async (url, options = {}) => {
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`  // 🔑 关键：添加 Token
    };
    
    const response = await fetch(url, { ...options, headers });
    
    // 如果 Token 无效，跳转到登录页
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('认证失败');
    }
    
    return response;
};

// 使用示例
async function fetchImages() {
    const response = await authenticatedFetch('/api/v1/images');
    const data = await response.json();
    // ... 处理数据
}
```

---

## 完整流程演示

### 场景 1：用户注册和登录

```
1. 用户访问 http://localhost:3000
   → 前端检查 localStorage 中没有 token
   → 自动跳转到 /login

2. 用户在登录页点击"注册"
   → 输入用户名和密码
   → 前端发送 POST /api/auth/register
   → 后端：检查用户名是否存在
   → 后端：使用 bcrypt 加密密码
   → 后端：创建 User 记录到数据库
   → 返回成功

3. 用户登录
   → 输入用户名和密码
   → 前端发送 POST /api/auth/login
   → 后端：查找用户
   → 后端：使用 bcrypt.compare 验证密码
   → 后端：生成 JWT Token
   → 返回 Token 和用户信息
   → 前端保存 Token 到 localStorage
   → 跳转到主页
```

### 场景 2：普通用户查看图片

```
1. 用户访问主页
   → 前端检查 localStorage 中有 token
   → 前端发送 GET /api/v1/images
   → 请求头：Authorization: Bearer <token>

2. 后端处理
   → authenticateToken 中间件验证 Token
   → 从 Token 中提取用户信息：{ id: 1, role: 'user' }
   → 调用 getPaginatedImages({ userId: 1, isAdmin: false })
   → SQL: SELECT * FROM Images WHERE userId = 1
   → 返回该用户的图片列表

3. 前端显示
   → 只显示当前用户创建的图片
```

### 场景 3：管理员查看所有图片

```
1. 管理员访问主页
   → 前端发送 GET /api/v1/images
   → 请求头：Authorization: Bearer <admin_token>

2. 后端处理
   → authenticateToken 中间件验证 Token
   → 从 Token 中提取：{ id: 2, role: 'admin' }
   → 调用 getPaginatedImages({ userId: 2, isAdmin: true })
   → SQL: SELECT * FROM Images  （没有 userId 条件）
   → 返回所有用户的图片列表

3. 前端显示
   → 显示所有用户的图片
```

### 场景 4：创建图片

```
1. 用户上传图片并生成
   → 前端发送 POST /api/v1/upload
   → 请求头：Authorization: Bearer <token>
   → 请求体：FormData（包含图片和 prompt）

2. 后端处理
   → authenticateToken 验证 Token
   → 处理图片生成
   → 保存到数据库：
     Image.create({
       filename: 'gen-123.png',
       prompt: '...',
       userId: req.user.id  // 🔑 自动关联到当前用户
     })

3. 结果
   → 图片文件保存到服务器
   → 数据库记录关联到用户 ID
   → 普通用户只能看到自己的图片
   → 管理员可以看到所有图片
```

## 后台管理系统

管理员需要一个界面来管理用户和积分。

### 后端 API (`routes/admin.js`)

我们创建了一组专门的 API，只有管理员能访问：

```javascript
// routes/admin.js
router.use(authenticateToken);
router.use(requireAdmin); // 🔐 只有管理员能通过

// 获取用户列表
router.get('/users', async (req, res) => {
    // ... 查询所有用户 ...
});

// 为用户充值
router.post('/users/:id/recharge', async (req, res) => {
    const { amount } = req.body;
    // 调用 creditManager.rechargeCredits 进行充值
});
```

### 前端界面 (`public/admin.html`)

这是一个独立的 HTML 页面，只有管理员能进入。它包含：
- **用户列表**：显示所有用户及其积分。
- **充值功能**：点击用户旁边的"充值"按钮，输入金额。
- **统计图表**：展示系统的总使用量和充值记录。

---

## 前端集成

### 显示积分信息

用户登录后，我们需要在主页显示他的剩余积分和免费次数。

#### 修改 `routes/auth.js`

在 `/me` 接口中返回积分信息：

```javascript
router.get('/me', async (req, res) => {
    // ...
    res.json({
        ...user,
        credits: user.credits,
        remainingFree: 5 - user.freeTextToImageCount
    });
});
```

#### 修改 `public/js/app.js`

```javascript
// 更新 UI 显示
document.getElementById('credits-display').textContent = `积分: ${user.credits}`;
if (user.remainingFree > 0) {
    document.getElementById('free-badge').textContent = `免费剩余: ${user.remainingFree}`;
}
```

---

## 完整流程演示

### 场景 1：新用户免费试用

```
1. 用户注册并登录
   → 数据库：credits=0, freeTextToImageCount=0

2. 用户发起文生图请求
   → 后端 checkTextToImagePermission
   → 发现 freeTextToImageCount (0) < 5
   → 允许生成

3. 生成成功
   → 后端 deductCredits
   → freeTextToImageCount 变为 1
   → 记录 UsageRecord (cost=0, isFree=true)

4. 前端更新显示
   → "免费剩余: 4"
```

### 场景 2：免费用完，充值积分

```
1. 用户已使用 5 次
   → freeTextToImageCount=5

2. 用户再次请求
   → 后端检查：免费次数用完，积分(0) < 10
   → 返回错误 "积分不足"
   → 前端提示用户联系管理员

3. 管理员在后台充值
   → 管理员访问 /admin
   → 找到该用户，点击充值 100
   → 后端 RechargeRecord 记录充值
   → 用户 credits 变为 100

4. 用户再次请求
   → 后端检查：积分(100) >= 10
   → 允许生成
   → 扣除 10 积分，credits 变为 90
```
---

## 社交与发现系统

为了增加用户粘性，我们引入了类似"小红书/抖音"的社交发现功能，让用户可以浏览他人生成的精美图片，并进行互动。

### 1. 数据库设计更新

我们需要记录用户对图片的"点赞"和"收藏"行为。

#### 新增表结构

我们在 `lib/database.js` 中新增了两个模型：

```javascript
// Likes 表：记录点赞
const Like = sequelize.define('Like', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    imageId: { type: DataTypes.INTEGER, allowNull: false }
});

// Favorites 表：记录收藏
const Favorite = sequelize.define('Favorite', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    imageId: { type: DataTypes.INTEGER, allowNull: false }
});

// 建立关联
User.hasMany(Like); Like.belongsTo(User);
Image.hasMany(Like); Like.belongsTo(Image);

User.hasMany(Favorite); Favorite.belongsTo(User);
Image.hasMany(Favorite); Favorite.belongsTo(Image);
```

### 2. 推荐算法实现 (`lib/recommendationManager.js`)

我们实现了一个混合推荐策略，让用户每次刷新都能看到新鲜内容。

**策略组成**：
1. **个性化推荐 (50%)**：分析用户最近生成的 Prompt 关键词，推荐相似图片。
2. **热门/随机 (30%)**：展示其他用户的优质图片（目前使用随机+去重策略）。
3. **最新发布 (20%)**：展示最新的生成作品。

**核心逻辑**：
```javascript
// 1. 获取用户偏好关键词
const keywords = await getUserPreferences(userId);

// 2. 并行查询三类数据
// ... (查询推荐、热门、最新)

// 3. 智能去重与补足
// 如果推荐内容不足，自动用热门/最新内容填充，并确保同一张图片不会重复出现。
```

### 3. 发现页 (`/explore`)

这是一个全新的页面，采用了现代化的设计：

- **瀑布流布局**：使用 CSS Column 布局实现不等高图片的完美展示，并根据图片真实尺寸计算显示高度。
- **无限滚动**：监听滚动事件，触底自动加载下一页数据。
- **交互体验**：
  - 鼠标悬停显示点赞/收藏按钮
  - 点击图片弹出详情模态框
  - 实时反馈点赞/收藏状态

### 4. 个人主页 (`/profile`)

类似于抖音的个人中心，用户可以在这里管理自己的互动内容：

- **用户信息**：展示头像（由用户名首字母生成）、用户名、积分余额。
- **数据统计**：展示获赞数、收藏数。
- **标签页切换**：在"我点赞的"和"我收藏的"之间无缝切换。
- **API 支持**：
  - `GET /api/profile/likes`：获取点赞列表
  - `GET /api/profile/favorites`：获取收藏列表

---

## 总结

通过本次升级，我们不仅实现了基本的用户认证，还构建了一个商业化雏形的积分系统。

### 核心知识点回顾

1. **数据库演进**：通过 Sequelize 自动同步，轻松添加新字段和新表。
2. **业务逻辑封装**：将复杂的积分判断逻辑封装在 `creditManager` 中，保持路由层代码整洁。
3. **权限分层**：
   - 基础认证：`authenticateToken`
   - 角色权限：`requireAdmin`
   - 业务权限：`checkTextToImagePermission`
4. **全栈配合**：后端提供数据和逻辑，前端负责展示和引导，数据库负责记录和一致性。

**祝你学习愉快！** 🎉
