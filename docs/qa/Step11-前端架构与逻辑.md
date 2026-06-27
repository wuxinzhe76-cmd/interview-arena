# Step11 - 前端架构与逻辑

> 整理日期:2026-06-19 | 模块:前端架构

---

## F1: 前端技术栈选型

**Q: 为什么用 Next.js 而不是纯 React?**

A: Next.js 在 React 基础上加了:
- **文件路由系统**: `src/app/banks/page.tsx` 自动映射到 `/banks` 路由,不用手写路由配置
- **API 代理(rewrites)**: `next.config.mjs` 里配置 `/api/*` 代理到后端 8080,解决跨域
- **SSR/SSG 能力**: 部署时可预渲染,首屏加载快
- **Image/Font 优化**: 内置图片和字体优化

技术栈:
```
Next.js 14 + React 18 + TypeScript + Tailwind CSS
Monaco Editor(代码编辑器) + Zustand(状态管理) + SWR(数据缓存)
lucide-react(图标) + react-markdown(MD渲染) + @tailwindcss/typography(排版)
```

---

## F2: 目录结构

**Q: 前端代码怎么组织的?**

A:
```
frontend/src/
├── app/                    # 页面(App Router)
│   ├── layout.tsx          # 根布局(包含 Navbar)
│   ├── page.tsx            # 首页 /
│   ├── banks/page.tsx      # 题库分类页 /banks
│   ├── problems/
│   │   ├── page.tsx        # 题目列表页 /problems
│   │   └── [id]/page.tsx   # 题目详情页 /problems/1
│   ├── algorithms/page.tsx # 算法题列表页 /algorithms
│   └── login/page.tsx      # 登录注册页 /login
├── components/
│   ├── layout/Navbar.tsx   # 导航栏
│   └── QuestionList.tsx    # 共享题目列表组件
├── lib/
│   ├── api.ts              # API 调用封装
│   ├── request.ts          # axios 实例 + 拦截器
│   └── utils.ts            # 工具函数
├── store/
│   └── user.ts             # Zustand 用户状态
└── types/
    └── index.ts            # TypeScript 类型定义
```

---

## F3: 导航栏三个入口

**Q: 题库、题目、算法三个导航有什么区别?**

A:
| 导航 | 路径 | 内容 |
|------|------|------|
| **题库** | `/banks` | 分类卡片(算法题/Redis八股/MySQL八股/Spring八股) |
| **题目** | `/problems` | 八股题列表(fixedType=FILL_IN) |
| **算法** | `/algorithms` | 算法题列表(fixedType=PROGRAMMING) |

代码位置: [Navbar.tsx](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/src/components/layout/Navbar.tsx)

---

## F4: 题库分类卡片页

**Q: /banks 页面的分类卡片是怎么实现的?**

A: [banks/page.tsx](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/src/app/banks/page.tsx)

定义了 4 个分类(算法/Redis/MySQL/Spring),每个分类:
1. 并行调 API 查询题目数量(`pageSize=1` 只为拿 total)
2. 卡片展示图标(渐变色)、标题、描述、数量
3. 点击跳转到对应列表页

```tsx
const BANK_CATEGORIES = [
  { key: 'algorithm', title: 'LeetCode 算法题', icon: Code2, gradient: 'from-blue-500 to-indigo-600', href: '/algorithms' },
  { key: 'redis', title: 'Redis 八股面试题', icon: Database, gradient: 'from-red-500 to-rose-600', href: '/problems?category=redis' },
  // ...
];
```

---

## F5: 共享题目列表组件 QuestionList

**Q: /problems 和 /algorithms 怎么复用同一个组件?**

A: [QuestionList.tsx](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/src/components/QuestionList.tsx)

组件接收 props:
```tsx
<QuestionList title="题目" subtitle="八股面试题" fixedType="FILL_IN" />
<QuestionList title="算法" subtitle="LeetCode 算法题" fixedType="PROGRAMMING" />
```

- `fixedType` 为空 → 显示"全部/算法/八股"切换按钮
- `fixedType` 有值 → 锁定该类型,不显示切换按钮

---

## F6: 两层筛选设计

**Q: 题目页的两层筛选是怎么做的?**

A:
**第一层(技术分类)**: Redis / MySQL / Spring / Java基础 ...
- 点击切换技术,查询 tags=[技术名]
- 八股题特有,算法题不显示

**第二层(板块)**: 应用场景 / 数据类型 / 持久化 ...
- 根据选中的技术,显示对应的板块列表(BAGWEN_MODULES 配置)
- 点击板块,查询 tags=[技术名, 板块名]

```tsx
const BAGWEN_MODULES = {
  Redis: ['应用场景', '数据类型', '持久化', '内存管理', '事务', '集群', '缓存问题', '性能优化', '原理'],
  MySQL: ['索引', '事务', '锁', 'SQL优化', '架构', '日志'],
  // ...
};
```

---

## F7: SWR 数据缓存

**Q: 为什么切换页面后回来不用重新加载?**

A: 用 SWR 替代了 useEffect + axios。

```tsx
const { data, isLoading, isValidating } = useSWR(query, fetcher, {
  keepPreviousData: true,    // 翻页保留旧数据
  revalidateOnFocus: false,  // 切回标签页不重新请求
  dedupingInterval: 10000,   // 10秒内相同请求去重
});
```

机制:
1. **缓存**: 内存里存了每个查询条件的结果,切回来秒显示
2. **后台更新**: 显示缓存的同时,后台静默发新请求
3. **去重**: 10秒内相同请求只发一次

---

## F8: 登录状态管理

**Q: 刷新页面后登录状态怎么保持?**

A: [store/user.ts](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/src/store/user.ts)

用 Zustand + localStorage:
```tsx
loadFromStorage: async () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  set({ accessToken: token });  // 先同步设置,UI立即反映登录
  try {
    const res = await userApi.me();  // 再异步验证token
    set({ user: res.data, accessToken: token });
  } catch {
    // token无效,清除
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  }
}
```

Navbar 在 useEffect 里调用 loadFromStorage,页面挂载时恢复登录状态。

---

## F9: 题目详情页两种布局

**Q: 算法题和八股题的详情页有什么不同?**

A: [problems/[id]/page.tsx](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/src/app/problems/[id]/page.tsx)

根据 `question.type` 切换布局:

**算法题(PROGRAMMING)**:
- 左右分栏(大屏) / 上下堆叠(小屏)
- 左:题目描述(Markdown渲染)
- 右:Monaco编辑器 + 语言选择 + 提交按钮 + 判题结果

**八股题(FILL_IN)**:
- 题目内容(Markdown渲染)
- "点击查看参考答案"(默认隐藏,点击展开)

---

## F10: API 代理配置

**Q: 前端怎么调后端接口?不跨域吗?**

A: [next.config.mjs](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/frontend/next.config.mjs)

```js
async rewrites() {
  return [{
    source: '/api/:path*',
    destination: 'http://localhost:8080/api/:path*',
  }];
}
```

前端请求 `/api/user/login` → Next.js 代理到 `http://localhost:8080/api/user/login`。
浏览器看到的是同源请求,不跨域。

---

## F11: Markdown 渲染

**Q: 题目描述怎么从纯文本改成 Markdown 渲染的?**

A: 安装了 3 个库:
- `react-markdown` —— Markdown 渲染组件
- `remark-gfm` —— GitHub 风格(表格、删除线)
- `@tailwindcss/typography` —— `prose` 排版样式

3 处内容用 ReactMarkdown 渲染:
1. 算法题题目描述
2. 八股题题目内容
3. 八股题参考答案

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {question.content}
</ReactMarkdown>
```

---

## F12: 响应式布局(移动端适配)

**Q: 内嵌浏览器(窄屏)编辑器显示不了怎么修的?**

A: 算法题详情页改为响应式:

```tsx
// 大屏:左右分栏,固定高度
// 小屏:上下堆叠,各自有高度
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:h-[calc(100vh-16rem)]">
  <div className="... max-h-[40vh] lg:max-h-none">  {/* 题目:小屏限40vh */}
  <div className="... h-[50vh] lg:h-auto">          {/* 编辑器:小屏50vh */}
    <div className="flex-1 min-h-0">  {/* min-h-0 防止flex塌缩 */}
```

---

## 📚 八股复习清单（Step 11 · 前端架构与逻辑）

> 完成本步骤后，请背诵以下八股题。完整映射表见 `docs/八股映射表.md`

| # | 八股题 | 题目关键词 | 文件位置 |
|---|--------|-----------|---------|
| 1 | 计算机网络 | **HTTP 与 HTTPS 的区别（TLS 握手过程）** | `2-Java相关内容/Java 面试题/计算机网络面试题速记通关版.pdf` |
| 2 | 计算机网络 | **跨域问题与 CORS（预检请求 OPTIONS）** | `2-Java相关内容/Java 面试题/计算机网络面试题速记通关版.pdf` |
| 3 | 计算机网络 | **Cookie / Session / Token 的区别** | `2-Java相关内容/Java 面试题/计算机网络面试题速记通关版.pdf` |
| 4 | Spring | **拦截器 vs 过滤器的区别（执行顺序）** | `2-Java相关内容/spring框架/Spring面试题.md` |
| 5 | Redis | Token 白名单实现方案（Redis SET + TTL） | `4-后端设计相关内容/Redis/Redis面试题.md` |

⏰ 复习顺序：读 `request.ts` 拦截器 → 背 CORS → **重点背 Cookie/Session/Token** → 背拦截器 vs 过滤器 → 合上文档自述
