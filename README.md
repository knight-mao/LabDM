# LabDM 实验室设备管理 MVP

Phase 1 版本聚焦二维码主路径和基础借还闭环。当前实现不依赖 npm 安装，直接使用原生 ES modules、浏览器 localStorage、可选 Supabase 同步和一个内置静态服务器，便于先验证业务流程。

## 功能范围

- 设备台账：名称、型号、资产编号、分类、位置、状态、标签短码。
- 标签入口：`/t/{tagId}` 可通过二维码或 NFC URL 打开设备详情。
- 借还状态机：在库、借出、维修、报废。
- 审计流水：所有入库、借用、归还、报修、恢复、报废动作都会追加记录。
- 登录与权限：超级管理员、管理员、学生三级角色；管理员可管理学生账户，超级管理员可管理管理员和学生账户。
- 账户与类别管理：管理员可新增学生账户、重置学生密码、维护设备分类；超级管理员可创建/调整管理员账户。
- 扫码页：支持浏览器 `BarcodeDetector` 的设备可直接扫码；其他浏览器可手动输入短码。
- 标签打印：生成可打印标签，勾选后只打印已选二维码；二维码图片由公共二维码服务渲染，短码文本可作为降级入口。
- PWA：包含 manifest 和 service worker，可添加到主屏幕。
- Supabase 同步：配置后可把当前 MVP 状态同步到 Supabase，支持多端共享。

## 账户说明

当前 MVP 使用本地原型账户体系。正式接入 Supabase 后，应迁移到 Supabase Auth 或服务端哈希认证，不应在前端保存明文密码。

## 本地运行

```powershell
node server.mjs
```

打开：

```text
http://localhost:4173
```

静态检查：

```powershell
node scripts/build-check.mjs
```

## Netlify 部署

`netlify.toml` 已配置静态发布和 SPA 路由回退。Netlify 环境有 npm 时会执行：

```text
npm run build
```

当前 build 只做文件存在性检查，发布目录为项目根目录。

## Supabase 配置

当前 Supabase 接入使用单表 JSON 状态同步，优先保证现有 MVP 能多端共享。配置步骤：

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 在 `config.js` 中填写项目 URL 和 anon publishable key。
3. 重新打开页面。首次连接时，如果远端还没有数据，会把当前本地状态初始化到 Supabase。

`config.js` 只能填写 anon key，不能填写 service_role key。

## Netlify 定时盘点

项目包含 Netlify Scheduled Function：`netlify/functions/inventory-keepalive.mts`。发布到 Netlify 后，它会每 5 天自动读取一次 Supabase 状态表，输出设备、账户、流水等计数，用于定期盘点和保持后端项目活跃。

上线前需要在 Netlify Site settings -> Environment variables 设置：

- `SUPABASE_URL`：Supabase 项目地址，例如 `https://xhlyewajwarlxvnrkdrh.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`：Supabase 的 publishable/anon key

定时函数只在 Netlify 已发布部署上运行，本地 `node server.mjs` 不会触发定时任务。

## 后续 Supabase 正式化建议

当前接入仍是 MVP 状态表，适合先跑通多人共享，不是最终数据库模型。正式化时建议进一步拆表：

- `equipment`：设备主表。
- `equipment_labels`：二维码/NFC 标签表。
- `equipment_events`：不可变审计流水。
- `users`、`locations`、`categories`：辅助表。
- 使用 Supabase Auth 和 RLS 做权限边界。
- Netlify Functions 仅处理微信登录、服务端标签/PDF生成、定时提醒和需要 service role 的任务。
