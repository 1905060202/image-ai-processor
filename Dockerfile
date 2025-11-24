# ========================================
# 多阶段构建 Dockerfile - Vue3 项目
# ========================================

# ============ 阶段 1: 构建前端 ============
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装前端依赖（使用国内镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm install

# 复制前端源码
COPY frontend/ ./

# 构建前端生产版本
RUN npm run build

# 构建产物在 /app/frontend/dist


# ============ 阶段 2: 构建最终镜像 ============
FROM node:20-alpine AS final

# 设置工作目录
WORKDIR /usr/src/app

# 复制后端 package.json
COPY package*.json ./

# 安装后端生产依赖（使用国内镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --only=production

# 复制后端源码
COPY lib/ ./lib/
COPY routes/ ./routes/
COPY middleware/ ./middleware/
COPY server.js ./
COPY .env.example ./

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 创建必要的目录
RUN mkdir -p generated public/uploads

# 暴露应用运行的端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 容器启动时运行的命令
CMD [ "node", "server.js" ]