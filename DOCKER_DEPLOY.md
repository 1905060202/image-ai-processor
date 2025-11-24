# Docker 部署指南

## 快速开始

### 1. 环境准备

确保已安装：
- Docker (>= 20.10)
- Docker Compose (>= 2.0)

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入必要的配置
# 必须配置的变量：
# - POSTGRES_USER
# - POSTGRES_PASSWORD
# - POSTGRES_DB
# - DOUBAO_API_KEY
# - DOUBAO_IMAGE_MODEL
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

## 架构说明

### 多阶段构建

Dockerfile 采用两阶段构建：

**阶段 1 - 前端构建**：
- 使用 Node.js 18 Alpine 镜像
- 安装前端依赖并构建 Vue3 应用
- 生成静态文件到 `dist` 目录

**阶段 2 - 最终镜像**：
- 使用 Node.js 18 Alpine 镜像
- 安装后端生产依赖
- 复制后端代码和前端构建产物
- 启动 Express 服务器

### 服务组成

- **app**：主应用容器（Express + Vue3 静态文件）
- **db**：PostgreSQL 15 数据库

### 数据持久化

- **数据库数据**：`.postgres-data/` 目录
- **生成的图片**：Docker volume `app-generated`
- **上传的文件**：Docker volume `app-uploads`

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f app        # 查看应用日志
docker-compose logs -f db         # 查看数据库日志

# 查看容器状态
docker-compose ps

# 进入容器
docker-compose exec app sh        # 进入应用容器
docker-compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB  # 进入数据库

# 重新构建
docker-compose up -d --build

# 完全清理（包括数据卷）
docker-compose down -v
```

## 生产环境注意事项

### 安全配置

1. **修改默认密码**：
   - 更改 `.env` 中的 `POSTGRES_PASSWORD`
   - 使用强密码

2. **API 密钥管理**：
   - 确保 `DOUBAO_API_KEY` 安全存储
   - 不要将 `.env` 文件提交到版本控制

3. **网络安全**：
   - 如果不需要外部访问数据库，移除 db 服务的 ports 映射
   - 考虑使用防火墙限制访问

### 代理配置

如果生产环境需要代理访问外部 API，在 `docker-compose.yml` 中取消代理配置的注释：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
environment:
  HTTP_PROXY: http://host.docker.internal:7890
  HTTPS_PROXY: http://host.docker.internal:7890
  NO_PROXY: localhost,127.0.0.1,db
```

### 性能优化

1. **资源限制**：
   可以在 docker-compose.yml 中添加资源限制：
   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 1G
   ```

2. **日志轮转**：
   配置 Docker 日志驱动以防止日志文件过大

### 备份

定期备份重要数据：

```bash
# 备份数据库
docker-compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql

# 备份生成的图片
docker run --rm -v image-ai-processor_app-generated:/data -v $(pwd):/backup alpine tar czf /backup/generated-backup.tar.gz -C /data .
```

## 故障排查

### 应用无法启动

```bash
# 查看详细日志
docker-compose logs app

# 常见问题：
# 1. 数据库连接失败 - 检查 DATABASE_URL 配置
# 2. 端口被占用 - 修改 docker-compose.yml 中的端口映射
# 3. 权限问题 - 检查目录权限
```

### 前端页面无法加载

1. 检查前端是否正确构建：
   ```bash
   docker-compose exec app ls -la /usr/src/app/frontend/dist
   ```

2. 检查 server.js 是否正确配置静态文件服务

### 数据库连接问题

```bash
# 测试数据库连接
docker-compose exec app node -e "const pg = require('pg'); const client = new pg.Client(process.env.DATABASE_URL); client.connect().then(() => console.log('Connected')).catch(e => console.error(e))"

# 检查数据库是否就绪
docker-compose exec db pg_isready -U $POSTGRES_USER
```

## 健康检查

应用包含健康检查端点：

```bash
curl http://localhost:3000/api/health
```

如果返回 200 状态码，说明应用运行正常。

## 更新部署

当代码更新后：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建并启动
docker-compose up -d --build

# 3. 查看日志确认启动成功
docker-compose logs -f
```

## 开发环境 vs 生产环境

**开发环境**（使用本地 npm run dev）：
- Vite 开发服务器
- 热重载
- 代理配置到后端

**生产环境**（Docker 部署）：
- 前端构建为静态文件
- Express 服务器提供静态文件
- 无热重载
- 更高性能
