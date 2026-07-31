# 项目架构规划设计

> 补充项目架构规划设计,包含整体架构、技术选型、数据流、部署架构。

---

## 一、整体架构图

```
                         ┌─────────────────────────────────┐
                         │          Frontend (Next.js 14)    │
                         │  刷题 / 判题 / RAG 问答 / AI 面试  │
                         └────────────────┬────────────────┘
                                          │ HTTP API
                         ┌────────────────▼────────────────┐
                         │     Backend (Spring Boot 3.5)     │
                         │  ┌──────────┐  ┌───────────────┐ │
                         │  │ Agent    │  │ RAG 基础设施   │ │
                         │  │ 6机制    │  │ Hybrid+Rerank │ │
                         │  │ +Harness │  │ +语义缓存      │ │
                         │  └────┬─────┘  └───────┬───────┘ │
                         │       │                │         │
                         │  ┌────▼────────────────▼───────┐ │
                         │  │  LLM (MiniMax-M3)           │ │
                         │  │  Embedding (DashScope v3)   │ │
                         │  │  Rerank (DashScope)         │ │
                         │  │  Intent (DeepSeek v4flash)  │ │
                         │  └─────────────────────────────┘ │
                         └────────────────┬────────────────┘
                                          │
          ┌───────────┬───────────┬───────┴───────┬──────────┐
          ▼           ▼           ▼               ▼          ▼
    ┌──────────┐┌──────────┐┌──────────┐  ┌──────────┐┌──────────┐
    │  MySQL   ││  Redis   ││  Milvus  │  │   ES     ││ RabbitMQ │
    │ 持久化   ││ 会话缓存 ││ 向量检索 │  │ BM25检索 ││ 异步报告 │
    └──────────┘└──────────┘└──────────┘  └──────────┘└──────────┘
```

## 二、技术选型

| 层 | 技术 | 版本 | 用途 |
|----|------|------|------|
| JDK | Java | 21 | 虚拟线程提升 AI 推理并发 |
| 框架 | Spring Boot | 3.5.15 | 应用框架 |
| AI | Spring AI | 1.1.2 | LLM/Embedding/Rerank/MCP |
| AI | Spring AI Alibaba | 1.0.0.2 | DashScope 集成 |
| LLM | MiniMax-M3 | - | 主聊天模型(面试官/询问助手) |
| LLM | DeepSeek v4flash | - | 意图分类(小模型,低成本) |
| Embedding | DashScope v3 | - | 向量化(题库/薄弱点) |
| Rerank | DashScope | - | Cross-Encoder 精排 |
| 向量库 | Milvus | 2.3+ | 语义检索(HNSW+COSINE) |
| 搜索 | Elasticsearch | 8.x | BM25 关键词检索(IK 分词) |
| 缓存 | Redis | 7.0+ | 会话缓存/语义缓存/状态 |
| 消息队列 | RabbitMQ | 3.12+ | 异步报告生成 |
| ORM | MyBatis-Plus | 3.5.12 | MySQL 持久化 |
| 限流 | Sentinel | 1.8.8 | QPS 限流+熔断 |
| 数据库迁移 | Flyway | - | 版本化 SQL 迁移 |
| 前端 | Next.js 14 | - | TypeScript+Tailwind |
| 代码编辑器 | Monaco Editor | - | 刷题代码编辑 |
| 状态管理 | Zustand+SWR | - | 前端状态 |

## 三、两个 Agent 数据流

### 面试官 Agent 数据流

```
用户 POST /api/interview/start
  ↓
PerceptionService(感知层)
  ├── InputFormatValidator(校验)
  ├── TextNormalizer(规范化)
  ├── IntentClassifier(识别 START_INTERVIEW)
  └── InputGuardrail(安全检查)
  ↓ PerceptionResult
Orchestrator(编排层)
  ├── 创建 InterviewSession(MySQL)
  ├── AgentStateStore(初始化状态,Redis)
  ├── ToolExecutor("pickQuestion",记忆驱动出题)
  ├── InterviewLlmService.generateOpening(生成开场)
  ├── MemoryFacade.recordTurn(记忆落库)
  └── 返回 sessionId + openingQuestion
  ↓
用户 POST /api/interview/answer(循环)
  ↓
PerceptionService → PerceptionResult
  ↓
Orchestrator(10步编排)
  ├── 1. InputGuardrail(防注入)
  ├── 2. GoalTracker(漂移检测)
  ├── 3. MemoryFacade.recordTurn(记忆写入)
  ├── 4. AgentStateStore.incrementRound(轮次推进)
  ├── 5. LoopDetector(循环检测)
  ├── 6. ReActExecutor(模型决策)
  │   ├── LlmInvoker(熔断+预算+校验)
  │   └── ToolExecutor(getQuestionDetail/evaluate)
  ├── 7. LeakDetector(答案泄露检测)
  ├── 8. OutputMonitor(输出监控)
  ├── 9. ThreeLayerController(三层控制)
  └── 10. 路由(DEEP_DIVE/NEXT_QUESTION/END_INTERVIEW)
  ↓
用户 POST /api/interview/end/{sessionId}
  ↓
Orchestrator.doEndInterview
  ├── session.status -> 1
  ├── InterviewReportProducer(MQ 异步)
  │   ↓
  │   InterviewReportConsumer
  │   ├── MemoryFacade.consolidateInterview(记忆整合)
  │   ├── PdfReportService(LLM 生成报告)
  │   └── LearningPathPlanner(学习路径)
  └── AgentStateStore.clearAll(清理状态)
```

### 询问助手 Agent 数据流

```
用户 POST /api/rag/quick-ask
  ↓
PerceptionService(感知层)
  ├── IntentClassifier(识别 KNOWLEDGE_QUERY/MEMORY_QUERY/HYBRID)
  └── InputGuardrail(安全检查)
  ↓ PerceptionResult
AskOrchestrator(编排层)
  ├── 1. SemanticCache(语义缓存查询)
  ├── 2. IntentClassifier(路由判定)
  ├── 3. ReActExecutor(模型决策检索策略)
  │   ├── ToolExecutor("retrieveKnowledge",题库检索)
  │   ├── ToolExecutor("retrieveMemory",记忆检索)
  │   └── ToolExecutor("webSearch",联网搜索)
  ├── 4. 工具轨迹提取引用来源
  ├── 5. 缓存写入(未用记忆的答案才共享)
  └── 6. 降级链路(ReAct失败时)
  ↓
QuickAskResponse(answer + sourceQuestions + webSources)
```

## 四、部署架构

```
┌─────────────────────────────────────────────┐
│              Docker Compose                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Backend  │  │ Frontend │  │  Nginx   │   │
│  │ (8080)   │  │ (3000)   │  │ (80)     │   │
│  └────┬─────┘  └──────────┘  └──────────┘   │
│       │                                      │
│  ┌────▼──────────────────────────────────┐  │
│  │         中间件层                        │  │
│  │  MySQL(3306)  Redis(6379)             │  │
│  │  Milvus(19530) ES(9200)  RabbitMQ(5672)│  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

外部服务:
  MiniMax API (Chat)
  DashScope API (Embedding/Rerank)
  DeepSeek API (意图分类)
```

## 五、数据库表概览

| 表 | 用途 | 机制 |
|----|------|------|
| user | 用户 | 基础 |
| question | 题目 | 基础/RAG |
| question_bank | 题库 | 基础 |
| question_bank_question | 题库-题目关联 | 基础 |
| test_case | 测试用例 | 判题 |
| submission | 代码提交 | 判题 |
| judge_result | 判题结果 | 判题 |
| programming_language | 编程语言 | 判题 |
| interview_session | 面试会话 | 编排/记忆 |
| interview_record | 面试问答明细 | 记忆(episodic) |
| user_knowledge_profile | 用户知识画像 | 记忆(semantic) |
| user_memory_summary | 用户记忆摘要 | 记忆(semantic) |

## 六、Redis Key 设计

| Key | 类型 | TTL | 用途 |
|-----|------|-----|------|
| `interview:history:{sessionId}` | List | 2h | 对话历史(滑动窗口10) |
| `interview:question:{sessionId}` | String | 2h | 当前题目ID |
| `interview:round:{sessionId}` | String | 2h | 总轮次 |
| `interview:questionRound:{sessionId}` | String | 2h | 当前题目追问轮次 |
| `interview:used:{sessionId}` | Set | 2h | 已用题目集 |
| `interview:drift:{sessionId}` | String | 2h | 漂移违规计数 |
| `semantic:cache:{hash}` | String | 1h | 语义缓存 |
| `question:detail:{questionId}` | Object | 30m | 题目详情缓存 |
