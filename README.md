# Reii小店

一个面向已授权数字商品的卡密商城 MVP，包含商品规格、订单创建、支付宝支付、事务发卡、订单查询、加密库存和管理后台。

## 本地运行

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

打开 `http://localhost:3000`。开发环境管理员令牌默认为 `dev-admin-token`。

## 环境变量

- `LICENSE_KEY_SECRET`：卡密 AES-256-GCM 加密密钥，生产环境必须更换。
- `ADMIN_TOKEN`：管理后台 API 访问令牌，生产环境必须使用高强度随机值。
- `PAYMENT_MODE`：本地开发设为 `mock`；生产环境不得启用模拟支付。
- `NEXT_PUBLIC_STORE_NAME`：预留的店铺名称配置。
- `DATABASE_PATH`：SQLite 文件路径；Railway 建议设为 `/app/data/card-store.sqlite`。
- `TURNSTILE_SITE_KEY`：Cloudflare Turnstile 公开站点密钥，用于购买页人机验证。
- `TURNSTILE_SECRET_KEY`：Turnstile 私密服务器密钥；配置后订单接口会强制验签。
- `TURNSTILE_ALLOWED_HOSTNAMES`：允许的验证域名，生产环境建议设为 `reiishop.cn,www.reiishop.cn`。
- `SEED_DEMO_CATALOG`：仅本地开发设为 `true`；生产环境不要设置。

## Railway 部署

1. 将仓库连接到 Railway，构建和启动命令会从 railway.json 自动读取。
2. 创建持久化 Volume，并挂载到 /app/data。
3. 设置 DATABASE_PATH=/app/data/card-store.sqlite。
4. 设置高强度的 ADMIN_TOKEN 和永久保存的 LICENSE_KEY_SECRET。
5. 设置 NEXT_PUBLIC_STORE_NAME，生产环境不要启用 PAYMENT_MODE=mock 或 SEED_DEMO_CATALOG。
6. 部署成功后，Railway 会通过 /api/health 检查服务和数据库状态。

SQLite 数据库、WAL 文件、环境变量和卡密库存均不能提交到 Git。生产 Volume 需要定期备份。

## 支付宝接入

项目已实现电脑网站支付 `alipay.trade.page.pay`、RSA2 异步通知验签、商户/应用/金额核对、幂等支付入账和事务发卡。异步通知地址为：

```text
https://你的域名/api/payments/alipay/notify
```

在支付宝开放平台取得沙箱或正式应用参数后配置：

```text
APP_URL=https://你的域名
ALIPAY_MODE=sandbox
ALIPAY_APP_ID=应用ID
ALIPAY_SELLER_ID=商户PID
ALIPAY_PRIVATE_KEY=应用RSA2私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_KEY_TYPE=PKCS8
```

`ALIPAY_PRIVATE_KEY` 是应用私钥，不是应用公钥或支付宝公钥。Railway 变量支持多行 PEM；也可以把换行保存为 `\n`。沙箱联调时使用沙箱参数并保持 `ALIPAY_MODE=sandbox`；正式上线改为 `ALIPAY_MODE=production`。启用支付宝时必须删除 `PAYMENT_MODE=mock`，不要把任何密钥提交到 Git。

浏览器支付完成返回页只负责查询状态，绝不直接发卡。只有支付宝服务器对通知完成 RSA2 验签，且应用 ID、商户 PID、订单号和金额全部匹配后，服务端才会扣减库存并交付卡密。

## 上线前

- 取得商品官方经销授权并确认支付平台允许该商品类目。
- 更换所有开发密钥，启用 HTTPS，并把 SQLite 迁移到托管 PostgreSQL/MySQL。
- 将管理员令牌升级为正式登录、双因素认证和分级权限。
- 增加邮件通知、退款流程、备份、监控和限流。
