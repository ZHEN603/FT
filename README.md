# 外贸报价平台

面向外贸企业的一体化报价与客户管理系统，涵盖产品管理、报价单、客户跟进、WhatsApp 沟通中心。

---

## 本地开发

### 前置条件

- [Node.js](https://nodejs.org/) v20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（用于本地 PostgreSQL）

### 启动步骤

```bash
# 1. 安装依赖
npm install

# 2. 启动本地数据库
npm run db:up

# 3. 复制环境变量
cp .env.example .env.local

# 4. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看前台，[http://localhost:3000/admin](http://localhost:3000/admin) 进入后台。

**默认管理员账号**
- 用户名：`admin`
- 密码：`admin123`

数据库表结构和初始数据在首次启动时自动创建，无需手动执行任何 SQL。

### 常用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run db:up    # 启动本地数据库
npm run db:down  # 停止本地数据库
```

---

## 生产部署（Docker）

```bash
# 1. 克隆代码
git clone <仓库地址> && cd <项目目录>

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写 DB_PASSWORD

# 3. 启动
docker compose -f docker-compose.prod.yml up -d --build
```

配好 Nginx 反代到 3000 端口，申请 SSL 证书后将 `.env` 中 `COOKIE_SECURE` 设为 `true` 并重启。

### 更新部署

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `DB_PASSWORD` | ✅（生产） | 数据库密码（docker-compose 使用） |
| `COOKIE_SECURE` | — | 配好 HTTPS 后设为 `true` |
| `WHATSAPP_ACCESS_TOKEN` | — | Meta Cloud API Token |
| `WHATSAPP_PHONE_NUMBER_ID` | — | WhatsApp 业务号码 ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | — | Webhook 验证 Token |
| `DEEPL_API_KEY` | — | 翻译 API（消息自动翻译） |
| `SENDGRID_API_KEY` | — | 邮件发送 |
| `ANTHROPIC_API_KEY` | — | AI 文案生成 |

完整变量说明见 `.env.example`。
