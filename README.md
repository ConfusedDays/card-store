# 数字授权中心

一个面向已授权数字商品的卡密商城 MVP，包含商品规格、订单创建、开发支付、事务发卡、订单查询、加密库存和管理后台。

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
- NEXT_PUBLIC_STORE_NAME：预留的店铺名称配置。
- DATABASE_PATH：SQLite 文件路径；Railway 建议设为 /app/data/card-store.sqlite。
- SEED_DEMO_CATALOG：仅本地开发设为 true；生产环境不要设置。

## Railway 部署

1. 将仓库连接到 Railway，构建和启动命令会从 railway.json 自动读取。
2. 创建持久化 Volume，并挂载到 /app/data。
3. 设置 DATABASE_PATH=/app/data/card-store.sqlite。
4. 设置高强度的 ADMIN_TOKEN 和永久保存的 LICENSE_KEY_SECRET。
5. 设置 NEXT_PUBLIC_STORE_NAME，生产环境不要启用 PAYMENT_MODE=mock 或 SEED_DEMO_CATALOG。
6. 部署成功后，Railway 会通过 /api/health 检查服务和数据库状态。

SQLite 数据库、WAL 文件、环境变量和卡密库存均不能提交到 Git。生产 Volume 需要定期备份。

## 正式支付接入

当前支付适配层只实现开发模式。接入微信支付或支付宝时，需要实现订单创建和异步回调验签，并由服务端在确认商户号、订单号、金额及签名后调用发货服务。不要根据浏览器跳转结果发货。

## 上线前

- 取得商品官方经销授权并确认支付平台允许该商品类目。
- 更换所有开发密钥，启用 HTTPS，并把 SQLite 迁移到托管 PostgreSQL/MySQL。
- 将管理员令牌升级为正式登录、双因素认证和分级权限。
- 增加邮件通知、退款流程、备份、监控和限流。
