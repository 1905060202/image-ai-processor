# Docker 部署配置改进总结

## 版本信息
- **日期**: 2025-11-24
- **改进类型**: Docker 部署架构优化
- **影响范围**: 容器化部署、构建流程、生产环境配置

## 改进概述

将项目从旧的单容器混合架构迁移到现代化的多容器微服务架构，采用多阶段构建优化镜像大小，实现前后端分离部署。

## 主要变更

### 1. Dockerfile 重构 ⭐️

#### 变更前
```dockerfile
# 单阶段构建，基于 PostgreSQL 镜像
FROM postgres:15-alpine
RUN apk add --no-cache nodejs npm
WORKDIR /usr/src/app
COPY . .
RUN npm install
CMD [ "node", "server.js" ]
```

**问题**：
- ❌ 基于 PostgreSQL 镜像但 PG 进程未启动
- ❌ 包含所有源码和开发依赖
- ❌ 镜像体积过大
- ❌ 未考虑前端构建

#### 变更后
```dockerfile
# 多阶段构建 - 阶段 1: 构建前端
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 阶段 2: 最终镜像
FROM node:20-alpine AS final
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY lib/ routes/ middleware/ server.js ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN mkdir -p generated public/uploads
EXPOSE 3000
CMD [ "node", "server.js" ]
```

**改进**：
- ✅ 使用 Node.js 20 满足 Vite 7.x 要求
- ✅ 多阶段构建，前后端分离
- ✅ 仅安装生产依赖（`--only=production`）
- ✅ 镜像体积显著减小
- ✅ 添加健康检查支持

### 2. docker-compose.yml 优化 🔧

#### 关键改进

**服务分离**：
```yaml
services:
  app:                          # 应用服务
    build: .
    container_name: image-ai-app
    restart: unless-stopped     # 自动重启策略
    
  db:                           # 数据库服务
    image: postgres:15-alpine
    container_name: image-ai-db
    restart: unless-stopped
```

**生产环境配置**：
- ✅ `NODE_ENV: production`（之前是 development）
- ✅ 移除开发模式的卷挂载（`.:/usr/src/app`）
- ✅ 添加 `restart: unless-stopped` 策略
- ✅ 注释掉代理配置（生产环境可选）

**数据持久化**：
```yaml
volumes:
  # 绑定挂载本地目录
  - ./generated:/usr/src/app/generated
  - ./public/uploads:/usr/src/app/public/uploads
```

**网络隔离**：
```yaml
networks:
  app-network:
    driver: bridge
```

**启动顺序控制**：
```yaml
depends_on:
  db:
    condition: service_healthy   # 等待数据库健康检查通过
```

### 3. .dockerignore 优化 📄

创建了完善的 `.dockerignore` 文件：
```
node_modules
*/node_modules
.git
.env
.DS_Store
Dockerfile*
docker-compose*.yml
.postgres-data
generated/*
public/uploads/*
```

**作用**：
- ✅ 减少构建上下文大小
- ✅ 加快构建速度
- ✅ 避免将敏感文件打包到镜像

### 4. 部署文档 📚

新增 `DOCKER_DEPLOY.md`，包含：
- 快速开始指南
- 架构说明
- 常用命令
- 生产环境注意事项
- 故障排查指南
- 备份和恢复说明

## 技术架构变更

### 旧架构
```
单容器（理论上）
├── PostgreSQL（实际未运行）
└── Node.js + 应用代码

实际运行：
├── 容器 1: Node.js（从混合镜像启动）
└── 容器 2: PostgreSQL（docker-compose 单独启动）
```

### 新架构（微服务）
```
多容器架构
├── app 容器
│   ├── Node.js 20
│   ├── Express 后端
│   └── Vue3 静态文件（构建产物）
│
└── db 容器
    └── PostgreSQL 15
    
网络: app-network
数据卷: 
  - ./generated (图片)
  - ./public/uploads (上传)
  - ./.postgres-data (数据库)
```

## 解决的问题

### 问题 1: Node.js 版本兼容性
- **问题**: Vite 7.2.4 要求 Node.js 20+，旧 Dockerfile 使用 Node.js 18
- **解决**: 升级基础镜像到 `node:20-alpine`

### 问题 2: 图片访问失败
- **问题**: 容器使用新的 Docker volume，本地图片无法访问
- **解决**: 改用本地目录绑定挂载（`./generated`）

### 问题 3: 架构混乱
- **问题**: 基于 PostgreSQL 镜像但未运行 PG 进程
- **解决**: 采用标准微服务架构，应用和数据库独立容器

## 性能提升

| 指标 | 旧方案 | 新方案 | 改进 |
|-----|-------|-------|------|
| **镜像层数** | 单层 | 多阶段优化 | ✅ 缓存利用率提升 |
| **生产依赖** | 包含开发依赖 | 仅生产依赖 | ✅ 镜像更小 |
| **前端处理** | 未优化 | 预构建静态文件 | ✅ 运行时性能提升 |
| **启动顺序** | 无控制 | 健康检查控制 | ✅ 可靠性提升 |

## 部署流程变化

### 之前
```bash
docker-compose up -d
# 问题：开发模式运行，挂载源码
```

### 现在
```bash
# 1. 配置环境变量
cp .env.example .env

# 2. 构建并启动（生产模式）
docker-compose up -d --build

# 3. 查看日志
docker-compose logs -f
```

## 验证结果

### ✅ 构建成功
- 前端 Vue3 构建成功
- 后端依赖安装成功
- 镜像大小优化

### ✅ 运行正常
```
✔ Container image-ai-app   Up (healthy)
✔ Container image-ai-db    Up (healthy)
```

### ✅ 功能验证
- 前端页面正常访问（200）
- API 端点正常响应
- 数据库连接成功
- 图片访问正常（655 个文件）

## 迁移指南

### 从旧版本迁移

1. **停止旧容器**
   ```bash
   docker-compose down
   ```

2. **备份数据**（重要！）
   ```bash
   # 备份数据库
   docker-compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
   
   # 备份图片（如果使用了volumes）
   tar czf generated-backup.tar.gz generated/
   ```

3. **更新代码**
   ```bash
   git pull
   ```

4. **重新构建**
   ```bash
   docker-compose up -d --build
   ```

5. **验证**
   ```bash
   docker-compose ps
   curl http://localhost:3000
   ```

## 最佳实践

### ✅ 已实现
- 单一职责原则（一容器一服务）
- 多阶段构建优化
- 健康检查配置
- 数据持久化
- 容器自动重启
- 网络隔离
- 环境变量配置

### 📋 生产环境建议
- 使用强密码
- 配置日志轮转
- 定期备份数据
- 监控容器资源使用
- 考虑使用 secrets 管理敏感信息

## 相关文件

- `Dockerfile` - 应用镜像构建配置
- `docker-compose.yml` - 服务编排配置
- `.dockerignore` - 构建忽略文件
- `DOCKER_DEPLOY.md` - 部署文档
- `frontend/` - Vue3 前端项目

## 技术栈

- **容器**: Docker + Docker Compose
- **前端**: Vue 3.5 + Vite 7 + Ant Design Vue 4
- **后端**: Express 5 + Node.js 20
- **数据库**: PostgreSQL 15
- **基础镜像**: Node.js 20 Alpine

## 总结

本次改进将项目从混乱的单容器架构升级为清晰的微服务架构，遵循 Docker 最佳实践，实现了真正的容器化部署。改进后的配置更易维护、更高性能、更适合生产环境使用。

---

**改进完成日期**: 2025-11-24  
**验证状态**: ✅ 已验证通过  
**适用版本**: v2.0.0+
