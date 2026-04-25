# 麻薯计分

一款专为麻将等棋牌游戏设计的多人实时计分工具，手机浏览器即开即用，无需下载 App。

**[👉 立即使用](https://mashu-counting.vercel.app)**

> 国内用户需使用代理访问

---

## 功能

- **多人实时同步** — 所有玩家的分数变动即时同步，无需刷新
- **房间制** — 4位数字创建或加入房间，最多6人（4名场上 + 2名备战席）
- **转账** — 玩家间互相转分
- **公池** — 共享分数池，交公池 / 收公池
- **换座** — 房主可自由调整所有玩家座位
- **历史记录** — 完整交易记录，支持撤回
- **备战席** — 第5、6位玩家以观战身份加入，可转账但不可收公池
- **无账号体系** — 设备本地记录身份，关掉页面重新打开自动恢复

---

## 使用方法

1. 打开 [mashu-counting.vercel.app](https://mashu-counting.vercel.app)
2. 点击「创建房间」，输入一个4位数字作为房间号
3. 将房间号分享给其他玩家，他们点击「加入房间」输入同一号码
4. 每人选择头像和姓名后进入麻将桌，开始计分

---

## 本地开发

**环境要求：** Node.js 18+，一个 [Supabase](https://supabase.com) 项目

```bash
git clone https://github.com/RichyLin/mashu-counting.git
cd mashu-counting/mashu-app
npm install
```

在 `mashu-app/` 目录下创建 `.env.local`：

```
VITE_SUPABASE_URL=你的_supabase_url
VITE_SUPABASE_ANON_KEY=你的_anon_key
```

初始化数据库：将 `mashu-app/supabase/schema.sql` 和 `mashu-app/supabase/rpc.sql` 在 Supabase SQL Editor 中依次执行。

```bash
npm run dev
```

---

## 技术栈

- **前端：** React 19 + Vite + React Router
- **数据库 & 实时同步：** Supabase（PostgreSQL + Realtime）
- **部署：** Vercel

---

## License

MIT
