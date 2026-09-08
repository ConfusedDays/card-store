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

## 余宽聚合支付 V2 接入

设置以下服务器环境变量（示例不包含真实密钥）：

```text
PAYMENT_MODE=epay
APP_URL=https://你的商城域名
EPAY_GATEWAY=https://zf.yk520.top/xpay/epayn/
EPAY_PID=后台商户ID
EPAY_PRIVATE_KEY=商户私钥
EPAY_PUBLIC_KEY=平台公钥
```

`EPAY_GATEWAY` 请以后台当前 V2 线路为准，必须使用 HTTPS 并保留 `/xpay/epayn/`；不要填经典 MD5 网关。`EPAY_PUBLIC_KEY` 是平台公钥，不是应用公钥。私钥支持 PKCS8 PEM 或裸 Base64；PEM 支持多行或字面量 `\n`。不要使用 `NEXT_PUBLIC_` 前缀，也不要覆盖现有 `LICENSE_KEY_SECRET`。曾在聊天或截图中公开过的私钥应先重置，再将新私钥直接写入服务器变量。

当前实现使用页面支付 `POST api/pay/submit`，不使用 API 下单生成二维码。请求按字段名字典序排列，排除 `sign`、`sign_type` 和空值，拼接原始值并使用 RSA-SHA256；协议字段发送 `sign_type=RSA`。参考：[平台 API 页面](https://www.mzafu2.cn/user/api)、[通知字段说明](https://www.mzafu2.cn/docs/epay_notify.md)。

流程：创建订单并保存平台标识 → 30 分钟有效的签名链接 → 服务端按数据库金额生成 POST 表单 → 平台收银台 → 异步回调验签 → `POST api/pay/query` 主动查单并验证平台签名 → 核对商户、订单、金额、渠道、流水及已支付状态 → 事务入账和自动发卡。查询响应时间戳允许 5 分钟偏差，服务器需保持时钟同步。回调允许平台延迟重试，重复通知仍会查单，但只入账、发卡一次；缺货保留 `paid_no_stock`。

回调地址为 `https://你的商城域名/api/payments/epay/notify`，支持 GET 和表单 POST。确认完成才返回纯文本 `success`；查单失败、未支付或校验不通过返回 `failure`，让平台重试。公网回调路径不能被登录页、验证码或 Cloudflare Access 拦截。

返回页的 URL 参数不能证明付款：浏览器只通过下单邮箱查询订单，必要时触发服务器查单补偿。旧订单保留原支付平台归属；切换支付配置后也不会通过另一个平台发货。开发环境显式设置 `PAYMENT_MODE=epay` 也会真实跳转，且这类订单禁止模拟支付。

部署前备份 SQLite Volume。启动时自动增加 `orders.payment_provider` 列，旧订单无需改写。更新 Railway 变量并部署代码后，再做小额真实联调，核对平台到账、回调、卡密交付、重复通知和断网重试。本地测试使用临时数据库、临时生成的 RSA 密钥和模拟网关响应，不能替代真实通道联调。

## 官方支付宝接入（保留旧订单兼容）

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
