# Image AI Processor 使用说明（含豆包接入与 Docker 指南）

本项目提供图片生成与管理服务，已接入豆包（火山引擎 Ark，OpenAI 兼容接口）与 Nano 两套生成能力，支持：
- 文生图：输入文本 Prompt 直接生成图片
- 图生图（edits）：上传一张或多张图片并输入 Prompt 生成新图

前端页面提供“模型提供方”下拉选择（豆包 / Nano），后端按请求动态路由到对应提供方。

参考文档：豆包 Ark OpenAI 兼容接口（文生图、图生图）说明  
`https://www.volcengine.com/docs/82379/1541523`

---

## 目录
- 环境准备
- 快速启动（Docker Compose）
- 本地运行（非 Docker）
- 前端使用说明
- API 说明
- Docker 常用命令
- 故障排查

---

## 环境准备
复制 `.env.example` 为 `.env` 并填入你的实际值。

关键变量：
- DATABASE_URL 或 Postgres 三元组（在 docker-compose.yml 中以 POSTGRES_ 环境变量形式提供）
- IMAGE_PROVIDER：默认提供方（可被每次请求覆盖）
  - doubao 或 nano
- DOUBAO_API_KEY：豆包 Ark 的 Bearer API Key
- DOUBAO_IMAGE_MODEL：豆包的模型 ID（例如 `ep-xxxxxxxx`）
- DOUBAO_IMAGE_SIZE：图片尺寸，默认 `1024x1024`
- PROXY_URL：可选，若需要全局代理，如 `http://host.docker.internal:7890`

---

## 快速启动（Docker Compose 推荐）

1) 在项目根目录准备 `.env`  
可参考 `.env.example`。

2) 启动
```bash
cd /Users/huyaning/Documents/code/image-ai-processor
docker compose up --build
```
- 首次建议带 `--build`，后续如未改动代码/依赖/Dockerfile，可直接 `docker compose up -d`。

3) 访问前端  
浏览器打开 `http://localhost:3000`

4) 停止/重启
```bash
# 停止并移除容器（保留镜像）
docker compose down

# 仅停止容器
docker compose stop

# 仅某个服务
docker compose stop app

# 强制重建容器（不重建镜像）
docker compose up -d --force-recreate

# 查看容器状态
docker compose ps
```

注意：`docker compose down -v` 会删除匿名卷，Postgres 数据会丢失，请谨慎使用。

---

## 本地运行（不使用 Docker）

1) 启动 Postgres
```bash
docker run --name pg-ai \
  -e POSTGRES_USER=your_user \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=ai_images \
  -p 5432:5432 -d postgres:15-alpine
```

2) 准备 `.env`
至少包含：
```
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/ai_images
IMAGE_PROVIDER=doubao
DOUBAO_API_KEY=sk-*****
DOUBAO_IMAGE_MODEL=ep-xxxxxxxx
```

3) 安装依赖并启动
```bash
npm ci
npm run dev
# 或生产
# npm start
```

4) 打开 `http://localhost:3000`

---

## 前端使用说明
- 页面顶部“模型提供方”选择：豆包 / Nano。  
  - 文生图与图生图均可切换提供方
- 模式切换：
  - 图生图：上传一张或多张图片，或在“可复用图片”中选择历史图片
  - 文生图：仅输入 Prompt
- 点击“立即生成”后，生成结果展示在右侧预览区域，可下载
- 侧栏“生成历史”中可搜索、重命名、删除历史图片

---

## API 说明（简要）
后端服务由 `server.js` 提供，核心路由在 `routes/imageProcessor.js`：

- POST `/api/v1/generate-text`（文生图）
  - Request JSON: `{ "prompt": "一只坐在月亮上的猫", "provider": "doubao|nano" }`
  - provider 可选，优先级：请求体 > 环境变量 `IMAGE_PROVIDER`
  - Response: `{ "success": true, "generatedUrl": "/generated/xxx.png" }`

- POST `/api/v1/upload`（图生图 / 多图 edits）
  - FormData:
    - `images`: 多个文件（可选；若不上传，可传 `reusableImageFilename` 复用历史图）
    - `prompt`: 文本
    - `keepOriginal`: `true|false`，是否将原图保存到 “可复用图片” 列表
    - `reusableImageFilename`: 复用历史图文件名
    - `provider`: `doubao|nano`
  - Response: `{ "success": true, "generatedUrl": "/generated/xxx.png" }`

- GET `/api/v1/images`（分页历史）
  - Query: `page`, `q`
- DELETE `/api/v1/images/:filename`
- PATCH `/api/v1/images/:filename`（重命名，自动补扩展名）
- GET `/api/v1/uploads`（可复用原始图片，分页/搜索）
- DELETE `/api/v1/uploads/:filename`
- PATCH `/api/v1/uploads/:filename`

图片会保存到 `generated/` 并对外以 `/generated/...` 提供静态访问。

---

## 豆包接入要点
- 客户端：`lib/doubaoClient.js`
  - 文生图：`POST /api/v3/images/generations`，JSON 请求体，返回 `data[].b64_json`
  - 图生图（edits）：`POST /api/v3/images/edits`，`multipart/form-data` 上传 `image` 字段，返回 `data[].b64_json`
  - 通过 `Authorization: Bearer ${DOUBAO_API_KEY}` 认证
- 后端选择逻辑：
  - 每次请求体中的 `provider` 优先生效，其次为环境变量 `IMAGE_PROVIDER`
- 响应解析：
  - 优先解析 `data[0].b64_json`；若是 URL 则回源下载

参考文档：`https://www.volcengine.com/docs/82379/1541523`

---

## Docker 常用命令（快捷表）
```bash
# 首次或需要重建镜像时
docker compose up --build

# 后续未改代码/依赖/Dockerfile
docker compose up -d

# 停止并移除容器
docker compose down

# 仅停止容器
docker compose stop

# 强制重建容器（不重建镜像）
docker compose up -d --force-recreate

# 查看容器状态
docker compose ps
```

---

## 故障排查
- 连接数据库失败
  - 检查 `DATABASE_URL` 或 `POSTGRES_*` 是否正确
  - Postgres 是否已监听在宿主 5432（或 compose 中服务健康）
- 生成失败
  - 检查 `DOUBAO_API_KEY` 与 `DOUBAO_IMAGE_MODEL`
  - 如存在网络限制，设置 `PROXY_URL` 或本机代理
- 图片打不开
  - 查看服务日志，确认已写入 `generated/` 并被静态目录挂载

如需扩展“mask”局部编辑、变体（variations）、风格参数等，可在 `doubaoClient` 与路由中继续扩展；前端参数面板可按 provider 动态呈现。欢迎提需求。 


