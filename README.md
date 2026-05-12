# LabDM 实验室设备管理 MVP

Phase 1 版本聚焦二维码主路径和基础借还闭环。当前实现不依赖 npm 安装，直接使用原生 ES modules、浏览器 localStorage 和一个内置静态服务器，便于先验证业务流程。

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

## 后续接 Supabase 的建议

当前数据存在浏览器 localStorage，适合验证流程，不适合多人生产使用。正式化时建议把 `src/app.js` 中的状态读写封装替换为 Supabase：

- `equipment`：设备主表。
- `equipment_labels`：二维码/NFC 标签表。
- `equipment_events`：不可变审计流水。
- `users`、`locations`、`categories`：辅助表。
- 使用 Supabase Auth 和 RLS 做权限边界。
- Netlify Functions 仅处理微信登录、服务端标签/PDF生成、定时提醒和需要 service role 的任务。
