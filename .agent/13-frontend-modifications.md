# 前端修改规划

> 前端当前状态:Next.js 14 + TypeScript + Tailwind CSS,已有面试页和 RAG 搜索。

---

## 一、当前前端状态

| 页面 | 路径 | 功能 | 状态 |
|------|------|------|------|
| 首页 | `/` | Hero + RAG 搜索(Quick Ask) | ✅ 已有 |
| 登录 | `/login` | 登录注册 | ✅ 已有 |
| 题目列表 | `/problems` | 题库浏览 | ✅ 已有 |
| 题目详情 | `/problems/[id]` | 题目+代码编辑+判题 | ✅ 已有 |
| 面试 | `/interview` | AI 模拟面试 | ✅ 已有 |
| 算法 | `/algorithms` | 算法题 | ✅ 已有 |
| 题库 | `/banks` | 题库管理 | ✅ 已有 |

## 二、API 对接状态

当前 `lib/api.ts` 已包含:

```typescript
// 面试 API(已有)
interviewApi.start({ mode, bankId })     // POST /api/interview/start
interviewApi.answer({ sessionId, answer }) // POST /api/interview/answer
interviewApi.end(sessionId)                // POST /api/interview/end/{id}

// RAG API(已有)
ragApi.chat(message)                       // POST /api/rag/chat
ragApi.suggest(prefix)                     // GET /api/rag/suggest
ragApi.quickAsk({ query })                 // POST /api/rag/quick-ask
ragApi.saveToKb({ question, answer })      // POST /api/rag/save-to-kb
ragApi.importQuestions()                   // POST /api/rag/import
```

**结论**:API 层已完整对接,前端无需大改。

## 三、需要优化的地方

### 3.1 面试页面优化

**当前问题**:
- 无面试结束后的报告展示
- 无学习路径展示
- 无历史面试记录查看

**优化项**:

| 优化点 | 说明 | 优先级 |
|--------|------|--------|
| 面试报告展示 | 面试结束后展示 AI 评估报告(雷达图+学习建议) | P1 |
| 学习路径展示 | 展示基于薄弱点的学习路径 | P2 |
| 掌握度实时显示 | 每轮回答后显示 currentTopicMastery 进度条 | P1 |
| 面试历史 | 历史面试列表+详情回看 | P2 |

### 3.2 Quick Ask 优化

**当前问题**:
- 搜索结果未展示引用来源(sourceQuestions)
- 未展示联网来源(webSources)
- 无"保存到知识库"按钮

**优化项**:

| 优化点 | 说明 | 优先级 |
|--------|------|--------|
| 引用来源展示 | 显示命中的题库题目(questionId+title) | P1 |
| 联网来源标注 | 显示 webSearch 的 URL,标注"参考" | P1 |
| 保存到知识库 | 答案下方加"存入我的知识库"按钮 | P2 |
| 缓存命中提示 | 显示 cacheHit 标识 | P2 |

### 3.3 新增页面(可选)

| 页面 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| 知识库管理 | `/knowledge-base` | 用户个人知识库 CRUD | P2 |
| 面试报告 | `/interview/report/[id]` | 面试报告详情 | P1 |

## 四、前端修改实施计划

### Phase 1:面试页面优化(与后端重构同步)

1. 面试页面增加掌握度进度条
   - 使用 `currentTopicMastery` 字段
   - 显示 0-100 进度,颜色:红(<60)/黄(60-80)/绿(>80)

2. 面试结束后展示报告
   - 调用报告接口(待后端新增)
   - 展示 AI 评估(优势/不足/建议)
   - 展示学习路径(Markdown 渲染)

### Phase 2:Quick Ask 优化

1. RagSearch 组件增强
   - 展示 `sourceQuestions`(题库引用)
   - 展示 `webSources`(联网参考)
   - 加"存入知识库"按钮

### Phase 3:新增页面

1. 面试报告页 `/interview/report/[id]`
2. 知识库管理页 `/knowledge-base`

## 五、前端代码规范

- 组件:`PascalCase`(`InterviewPage`)
- 文件:`kebab-case` 或 `PascalCase`(与 Next.js 一致)
- 状态管理:Zustand(全局) + useState(局部)
- 数据获取:SWR 或直接 axios
- 样式:Tailwind CSS,无自定义 CSS
- 类型:TypeScript strict mode
- API 调用:统一走 `lib/api.ts`,不直接 axios
