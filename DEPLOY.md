# 🚀 麻将计分 - 云端部署指南

## 方案对比

| 平台 | 优点 | 缺点 | 适合场景 |
|------|------|------|----------|
| **Railway** | 支持 WebSocket，免费额度，简单易用 | 免费额度有限 | ⭐ 推荐首选 |
| **Vercel** | 免费，自动 HTTPS，全球 CDN | Serverless 对 WebSocket 支持有限 | 静态页面 |
| **Render** | 免费额度，支持 WebSocket | 免费实例会休眠 | 中长期使用 |
| **阿里云/腾讯 云** | 国内访问快，稳定 | 需要付费，配置复杂 | 生产环境 |

---

## 方案一：Railway（⭐ 推荐）

### 优势
- ✅ 支持 WebSocket（Socket.IO）
- ✅ 每月 $5 免费额度
- ✅ 自动 HTTPS
- ✅ 一键部署
- ✅ 不需要信用卡

### 步骤

#### 1. 准备代码

确保项目根目录有：
- `package.json` ✅ 已有
- `server.js` ✅ 已有
- `public/index.html` ✅ 已有

#### 2. 上传到 GitHub

```bash
# 进入项目目录
cd C:\Users\Kyle\.homiclaw\workspace\mahjong-score-online

# 初始化 Git（如果没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit - Mahjong Score Online"

# 创建 GitHub 仓库后，添加远程仓库
git remote add origin https://github.com/你的用户名/mahjong-score-online.git

# 推送
git push -u origin main
```

#### 3. 部署到 Railway

1. 访问 https://railway.app
2. 点击 **"Start a New Project"**
3. 选择 **"Deploy from GitHub repo"**
4. 选择你的仓库 `mahjong-score-online`
5. 点击 **"Deploy"**

#### 4. 配置环境变量（可选）

在 Railway 面板：
- 点击项目 → Settings → Variables
- 添加：`PORT=3003`（Railway 会自动分配端口，可不设置）

#### 5. 获取域名

部署完成后：
- 点击 **"Settings"** → **"Networking"**
- 点击 **"Generate Domain"**
- 获得公网 URL：`https://mahjong-score-production.up.railway.app`

#### 6. 测试访问

打开浏览器访问获得的域名，或分享给朋友测试。

---

## 方案二：Render

### 优势
- ✅ 支持 WebSocket
- ✅ 免费额度
- ✅ 自动 HTTPS

### 步骤

1. 访问 https://render.com
2. 注册/登录
3. 点击 **"New +"** → **"Web Service"**
4. 连接 GitHub 仓库
5. 配置：
   - **Name**: mahjong-score-online
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
6. 点击 **"Create Web Service"**
7. 等待部署完成，获得域名

---

## 方案三：Vercel（需要改造）

⚠️ Vercel 是 Serverless 架构，对 WebSocket 支持有限。建议改用方案一或二。

如果坚持使用 Vercel，需要改造为 API Routes + 客户端存储。

---

## 方案四：国内云平台（阿里云/腾讯云）

### 阿里云 - 函数计算 FC

适合有预算、需要稳定生产环境的场景。

### 腾讯云 - 云开发

1. 访问 https://cloud.tencent.com/product/tcb
2. 创建环境
3. 部署 CloudBase Framework 项目

---

## 📋 部署前检查清单

### 代码检查

```bash
# 在项目目录运行
cd mahjong-score-online

# 1. 确认 package.json 有 start 脚本
# "start": "node server.js"

# 2. 确认 server.js 监听正确端口
const PORT = process.env.PORT || 3003;

# 3. 确认静态文件目录正确
app.use(express.static('public'));

# 4. 测试本地运行
npm install
npm start
# 访问 http://localhost:3003
```

### 安全配置

生产环境建议添加：

**server.js 顶部添加：**
```javascript
// 限制 CORS  Origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
```

**添加 .env 文件（本地测试）：**
```
PORT=3003
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## 🔧 常见问题

### Q1: Railway 部署后无法连接？

**检查：**
1. Railway 面板查看日志是否有错误
2. 确认 `package.json` 有正确的 start 命令
3. 检查代码中端口是否使用 `process.env.PORT`

### Q2: WebSocket 连接失败？

**解决：**
```javascript
// server.js 确保 Socket.IO 配置正确
const io = new Server(server, {
  cors: {
    origin: '*', // 生产环境改为具体域名
    methods: ['GET', 'POST']
  }
});
```

### Q3: 手机无法访问？

**检查：**
1. 使用公网域名（不是 localhost）
2. 确认已生成 Railway 域名
3. 尝试 HTTPS 链接

### Q4: 免费额度用完怎么办？

**方案：**
- Railway: 升级到付费计划（$5/月）
- 切换到 Render 免费层
- 自建服务器（阿里云轻量应用服务器 ~¥24/月）

---

## 📊 部署后优化

### 1. 添加错误监控

```javascript
// server.js 添加
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
```

### 2. 添加访问日志

```javascript
// server.js 添加
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

### 3. 设置房间过期时间

已有代码（24 小时自动清理）：
```javascript
setInterval(() => {
  // 清理过期房间
}, 10 * 60 * 1000);
```

---

## 🎯 推荐部署流程

**最简单方案（Railway）：**

```
1. 创建 GitHub 仓库
2. 推送代码
3. Railway 连接 GitHub
4. 选择仓库 → Deploy
5. 生成域名 → 完成！
```

**预计时间：** 10-15 分钟

---

## 📞 部署后分享

部署成功后，你可以：

1. **分享给朋友：**
   ```
   🀄 麻将计分 - 在线多人版
   访问：https://xxx.up.railway.app
   创建房间后分享房间号即可！
   ```

2. **保存书签：**
   - 手机添加主屏幕
   - 电脑浏览器收藏

3. **监控使用：**
   - Railway 面板查看请求量
   - 检查日志排查问题

---

## ⚠️ 注意事项

1. **免费额度限制**
   - Railway: $5/月免费额度
   - Render: 每月 750 小时免费

2. **数据持久化**
   - 当前版本房间数据在内存
   - 重启服务器后数据丢失
   - 如需持久化需加数据库

3. **HTTPS 强制**
   - Railway/Render 自动提供 HTTPS
   - 浏览器可能要求安全上下文

4. **跨域问题**
   - 确保 CORS 配置正确
   - Socket.IO 需要配置 allowedOrigins

---

**🀄 准备部署了吗？选择一个方案开始吧！**

需要我帮你：
1. 创建 GitHub 仓库？
2. 配置 Railway 部署？
3. 优化代码适应云平台？

告诉我你的选择！🚀