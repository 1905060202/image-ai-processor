# 步骤 1: 依然使用我们可以成功拉取的 postgres:15-alpine 作为基础
FROM postgres:15-alpine

# 步骤 2: 更换 Alpine 的软件源为国内镜像 (关键修复)
# a. `sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g'` 这个命令会查找源配置文件中官方地址，并替换为阿里云镜像地址
# b. `&&` 符号确保命令按顺序执行
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 步骤 3: 现在，从高速的国内镜像源安装 Node.js 和 npm
# a. `apk update` 更新包列表 (现在会从阿里云更新)
# b. `apk add --no-cache nodejs npm` 安装 nodejs 和 npm
RUN apk update && apk add --no-cache nodejs npm

# 步骤 4: 之后的所有步骤和之前完全一样
# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖。为了加速 npm，我们可以临时将会话的 npm registry 也指向淘宝镜像
RUN npm config set registry https://registry.npmmirror.com && \
    npm install

# 复制项目所有文件到工作目录
COPY . .

# 暴露应用运行的端口
EXPOSE 3000

# 容器启动时运行的命令
CMD [ "node", "server.js" ]