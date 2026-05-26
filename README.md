# LabDM 实验室设备管理 MVP

Phase 1 版本聚焦二维码主路径和基础借还闭环。当前实现不依赖 npm 安装，直接使用原生 ES modules、浏览器 localStorage、可选 Supabase 同步和一个内置静态服务器，便于先验证业务流程。

## 功能范围

- 设备台账：名称、型号、资产编号、分类、位置、状态、标签短码。
- 标签入口：`/t/{tagId}` 可通过二维码或 NFC URL 打开设备详情。
- 借还状态机：在库、借出、维修、报废。
- 审计流水：所有入库、借用、归还、报修、恢复、报废动作都会追加记录。
- 登录与权限：登录、注册、改密由 Supabase Auth 管理；应用内保留超级管理员、管理员、学生三级角色。
- 账户与类别管理：管理员可新增学生账户、重置学生密码、维护设备分类；超级管理员可创建/调整管理员账户。
- 扫码页：支持浏览器 `BarcodeDetector` 的设备可直接扫码；其他浏览器可手动输入短码。
- 标签打印：生成可打印标签，勾选后只打印已选二维码；二维码图片由公共二维码服务渲染，短码文本可作为降级入口。
- PWA：包含 manifest 和 service worker，可添加到主屏幕。
- Supabase 同步：配置后可把当前 MVP 状态同步到 Supabase，支持多端共享；匿名用户可读取设备状态，只有登录用户可写入状态。

## 账户说明

当前版本已迁移到 Supabase Auth：

- 应用使用 Supabase Auth 登录，同时按产品需求在应用状态中记录明文密码，且只在超级管理员账户页显示。
- 学生通过注册页自助创建 Supabase Auth 账号。
- 管理员新增账户时只预建账户资料，用户需要使用相同邮箱完成注册。
- 管理员重置密码会向账户邮箱发送 Supabase 改密邮件。
- 超级管理员可查看应用记录到的当前密码；通过邮件在 Supabase 外部改密后，应用会在用户下次成功登录时更新记录。
- 注销账户会删除应用账户资料，并在应用内禁用该 Supabase Auth 用户继续登录；Supabase Auth 控制台中的用户记录需要手动清理。超级管理员账户页会显示待清理列表和用户管理入口。
- 超级管理员 `Knight` 的邮箱为 `a.bit.bright@gmail.com`，需要在 Supabase Auth 中创建同邮箱账户，登录后会自动绑定现有超级管理员资料。

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

当前 build 会检查必需文件，并对 `src/app.js` 做语法检查。发布目录为项目根目录。

## Supabase 配置

当前 Supabase 接入使用单表 JSON 状态同步 + Supabase Auth。配置步骤：

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 在 `config.js` 中填写项目 URL 和 anon publishable key。
3. 在 Supabase Dashboard 的 Authentication 中启用 Email 登录。开发阶段建议关闭 Confirm email，或按实际邮箱完成验证。
4. 在 Authentication 的 URL Configuration 中配置 Site URL 和 Redirect URLs：
   - 本地：`http://localhost:4173`
   - Netlify：你的正式站点 URL
5. 在 Supabase Auth Users 中创建超级管理员邮箱账户：`a.bit.bright@gmail.com`，邮箱需与应用资料里的 `Knight` 邮箱一致。
6. 重新打开页面。首次连接时，如果远端还没有数据，会把当前本地状态初始化到 Supabase。

`config.js` 只能填写 anon key，不能填写 service_role key。

## 后续 Supabase 正式化建议

当前接入仍是单表状态同步，适合先跑通多人共享，不是最终数据库模型。正式化时建议进一步拆表：

- `equipment`：设备主表。
- `equipment_labels`：二维码/NFC 标签表。
- `equipment_events`：不可变审计流水。
- `users`、`locations`、`categories`：辅助表。
- 使用 Supabase Auth 和 RLS 做权限边界。
- Netlify Functions 仅处理微信登录、服务端标签/PDF生成、定时提醒和需要 service role 的任务。
