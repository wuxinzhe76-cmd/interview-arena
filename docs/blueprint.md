# interview-arena · 项目蓝图

> 项目代号:**interview-arena**(面试刷题平台,AI 原生)
> 后端工程目录:`MyProject/interview-arena/backend/`
> 文档目录:`MyProject/interview-arena/docs/`
> 任务追踪:`MyProject/interview-arena/tasks/`
> 本文档由原有 mianti-next-backend 代码 + V2 重构计划整合而成,作为 interview-arena 开发的完整参考。
> 阅读本文档即可了解项目现状、技术细节、数据库设计、AI 面试核心逻辑及下一步开发方向。

---

## 一、项目定位

对标面试鸭 + 牛客网 AI 面试,打造一个 **AI 原生的面试题库与模拟面试平台**。

核心差异化:深度 AI 集成(不是简单的 AI 对话包装,而是贯穿全流程的智能辅助)。

### 目标用户

- 2028 秋招在校生(刷题 + AI 模拟面试)
- 技术面试备考者(多轮对话面试 + 智能追问)

---

## 二、技术选型

### 当前版本(原 mianti-next-backend,已迁移到 interview-arena-backend)

| 层 | 技术 | 版本 |
|----|------|------|
| JDK | Java | 17 |
| 框架 | Spring Boot | 3.2.4 |
| AI | Spring AI Alibaba | 1.0.0-M3.1(预览版,API 已过时) |
| ORM | MyBatis-Plus | 3.5.2 |
| 连接池 | Druid | 1.2.23 |
| 缓存 | Redis + Redisson | 3.21.0 |
| 搜索 | Elasticsearch | Spring Boot Data ES |
| 认证 | Sa-Token | 1.39.0 |
| 限流 | Sentinel | 2021.0.5.0 |
| 配置中心 | Nacos | 0.2.11 |
| API 文档 | Knife4j | 4.4.0 |
| 热点探测 | JD HotKey | 0.0.4-SNAPSHOT(system scope) |
| 错误监控 | Sentry | — |
| 消息队列 | RabbitMQ | — |
| 数据库迁移 | Flyway | — |

### V2 目标版本

| 层 | 技术 | 版本 | 变更原因 |
|----|------|------|----------|
| JDK | Java | **21** | 虚拟线程提升 AI 推理并发 |
| 框架 | Spring Boot | **3.4.x** | Spring AI 1.1.x 要求 |
| AI | Spring AI Alibaba | **1.1.x** | M3.1 已过时,1.1.x 是 GA |
| ORM | MyBatis-Plus | **3.5.x** | 小版本升级 |
| groupId | — | **com.charles** | 修正模板残留 `com.yupi` |
| 前端 | Next.js 14 | — | 替换 Vue 3(V2 计划) |
| 判题沙箱 | Docker | — | 替换本地进程沙箱 |
| 文件存储 | MinIO | — | 替换本地存储 |

---

## 三、系统架构

```
                         ┌─────────────────┐
                         │   Gateway 网关   │
                         └──┬───┬───┬───┬──┘
                            │   │   │   │
                 ┌──────────┘   │   │   └──────────┐
                 ▼              ▼   ▼              ▼
          ┌──────────┐  ┌────────┐ ┌────────┐ ┌────────────┐
          │ user-svc │  │qbank-svc│ │judge-svc│ │ ai-service │
          │          │  │        │ │        │ │            │
          │ Sa-Token │  │ ES搜索 │ │ Docker │ │ 通义千问    │
          │ Redis    │  │ MySQL  │ │ 沙箱   │ │ Spring AI  │
          │ MySQL    │  │Caffeine│ │ MQ     │ │ Alibaba    │
          └──────────┘  └────────┘ └────────┘ │            │
                                               │ RAG 模块    │
                                               │  PgVector  │
                                               │  Embedding │
                                               │  QA Advisor│
                                               │            │
                                               │ Agent 模块  │
                                               │  @Tool     │
                                               │  ChatMemory│
                                               │  状态机     │
                                               │            │
                                               │ MCP 模块   │
                                               │  MCP Server│
                                               └─────┬──────┘
                                                     │
                                          ┌──────────┼──────────┐
                                          │          │          │
                                          ▼          ▼          ▼
                                    ┌────────┐ ┌────────┐ ┌────────┐
                                    │PgVector│ │ MySQL  │ │ Redis  │
                                    │向量存储 │ │记忆持久化│ │会话缓存 │
                                    └────────┘ └────────┘ └────────┘
```

---

## 四、数据库设计

### 4.1 核心业务表

#### user(用户表)

```sql
create table if not exists user (
    id           bigint auto_increment primary key,
    userAccount  varchar(256) not null comment '账号',
    userPassword varchar(512) not null comment '密码',
    unionId      varchar(256) null comment '微信开放平台id',
    mpOpenId     varchar(256) null comment '公众号openId',
    userName     varchar(256) null comment '用户昵称',
    userAvatar   varchar(1024) null comment '用户头像',
    userProfile  varchar(512) null comment '用户简介',
    userRole     varchar(256) default 'user' not null comment '角色: user/admin/ban',
    editTime     datetime default CURRENT_TIMESTAMP not null,
    createTime   datetime default CURRENT_TIMESTAMP not null,
    updateTime   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    isDelete     tinyint default 0 not null comment '是否删除',
    index idx_unionId (unionId)
);
```

#### question_bank(题库表)

```sql
create table if not exists question_bank (
    id          bigint auto_increment primary key,
    title       varchar(256) null comment '标题',
    description text null comment '描述',
    picture     varchar(2048) null comment '图片',
    userId      bigint not null comment '创建用户 id',
    editTime    datetime default CURRENT_TIMESTAMP not null,
    createTime  datetime default CURRENT_TIMESTAMP not null,
    updateTime  datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    isDelete    tinyint default 0 not null,
    index idx_title (title)
);
```

#### question(题目表)

```sql
create table if not exists question (
    id         bigint auto_increment primary key,
    title      varchar(256) null comment '标题',
    content    text null comment '内容',
    tags       varchar(1024) null comment '标签列表(json 数组)',
    answer     text null comment '推荐答案',
    type       varchar(50) default 'PROGRAMMING' comment '类型: PROGRAMMING/CHOICE/FILL_IN',
    difficulty varchar(20) default 'MEDIUM' comment '难度: EASY/MEDIUM/HARD',
    template   text null comment '代码模板(JSON)',
    timeLimit  int default 1000 comment '时间限制(ms)',
    memoryLimit int default 256 comment '内存限制(MB)',
    acceptedCount int default 0 comment '通过人数',
    submissionCount int default 0 comment '提交次数',
    acceptanceRate decimal(5,2) default 0 comment '通过率',
    userId     bigint not null comment '创建用户 id',
    editTime   datetime default CURRENT_TIMESTAMP not null,
    createTime datetime default CURRENT_TIMESTAMP not null,
    updateTime datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    isDelete   tinyint default 0 not null,
    index idx_title (title),
    index idx_userId (userId)
);
```

#### question_bank_question(题库题目关联表)

```sql
create table if not exists question_bank_question (
    id             bigint auto_increment primary key,
    questionBankId bigint not null comment '题库 id',
    questionId     bigint not null comment '题目 id',
    userId         bigint not null comment '创建用户 id',
    createTime     datetime default CURRENT_TIMESTAMP not null,
    updateTime     datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    UNIQUE (questionBankId, questionId)
);
```

### 4.2 判题系统表

#### test_case(测试用例表)

```sql
create table if not exists test_case (
    id          bigint auto_increment primary key,
    questionId  bigint not null,
    input       text not null comment '输入样例',
    output      text not null comment '输出样例',
    isExample   tinyint default 0 comment '0-隐藏, 1-示例',
    score       int default 100 comment '分值',
    userId      bigint not null,
    createTime  datetime default CURRENT_TIMESTAMP not null,
    updateTime  datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    isDelete    tinyint default 0 not null,
    index idx_questionId (questionId)
);
```

#### submission(代码提交表)

```sql
create table if not exists submission (
    id              bigint auto_increment primary key,
    questionId      bigint not null,
    userId          bigint not null,
    languageCode    varchar(100) not null comment 'java/python/cpp/javascript',
    code            text not null,
    status          varchar(50) default 'PENDING' comment 'PENDING/JUDGING/ACCEPTED/WA/TLE/MLE/RE/CE',
    executionTime   int null comment 'ms',
    executionMemory int null comment 'KB',
    testCaseScore   int null,
    totalTestCase   int null,
    passedTestCase  int null,
    errorMessage    text null,
    ip              varchar(100) null,
    createTime      datetime default CURRENT_TIMESTAMP not null,
    updateTime      datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    index idx_questionId (questionId),
    index idx_userId (userId),
    index idx_status (status)
);
```

#### judge_result(判题结果详情表)

```sql
create table if not exists judge_result (
    id              bigint auto_increment primary key,
    submissionId    bigint not null,
    questionId      bigint not null,
    userId          bigint not null,
    languageCode    varchar(100) not null,
    code            text not null,
    verdict         varchar(50) not null comment 'ACCEPTED/WA/TLE/MLE/RE/CE',
    executionTime   int null,
    executionMemory int null,
    passedTestCase  int null,
    totalTestCase   int null,
    testCaseResults text null comment '各用例结果(JSON)',
    compileOutput   text null,
    runOutput       text null,
    errorMessage    text null,
    judgeServer     varchar(256) null,
    judgeTime       datetime null,
    createTime      datetime default CURRENT_TIMESTAMP not null,
    index idx_submissionId (submissionId),
    index idx_userId (userId)
);
```

#### programming_language(编程语言表)

```sql
create table if not exists programming_language (
    id          bigint auto_increment primary key,
    languageName varchar(256) not null,
    languageCode varchar(100) not null comment 'java/python/cpp/javascript',
    version      varchar(100) null,
    compileCommand varchar(512) null,
    runCommand     varchar(512) null,
    icon         varchar(1024) null,
    isActive     tinyint default 1 not null,
    userId       bigint not null,
    createTime   datetime default CURRENT_TIMESTAMP not null,
    updateTime   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    isDelete     tinyint default 0 not null,
    unique key uk_languageCode (languageCode)
);
```

### 4.3 AI 面试表

#### interview_session(面试会话表)

```sql
create table if not exists interview_session (
    id          bigint not null comment '主键(雪花算法)' primary key,
    user_id     bigint not null comment '面试者 ID',
    mode        tinyint not null comment '模式: 1-指定题库, 2-大厂随机',
    bank_id     bigint null comment '关联题库 ID(模式1有值)',
    status      tinyint default 0 not null comment '0-进行中, 1-已结束, 2-已生成报告',
    score       int null comment '本次面试综合评分(AI生成)',
    create_time datetime default CURRENT_TIMESTAMP not null,
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    is_delete   tinyint default 0 not null,
    index idx_user_id (user_id),
    index idx_bank_id (bank_id)
);
```

#### interview_record(面试问答明细表)

```sql
create table if not exists interview_record (
    id          bigint auto_increment primary key,
    session_id  bigint not null comment '关联的面试会话 ID',
    question_id bigint null comment '当前讨论的具体题目 ID',
    role        varchar(20) not null comment 'user 或 assistant',
    content     text null comment '回答或提问内容',
    round_num   int null comment '当前对话属于第几轮',
    create_time datetime default CURRENT_TIMESTAMP not null,
    index idx_session_id (session_id)
);
```

### 4.4 V2 规划新增表(未实现)

| 表 | 用途 | 状态 |
|----|------|------|
| interview_report | 面试综合评估报告(雷达图+学习路径) | ⬜ 未实现 |
| resume | 简历解析与 AI 分析 | ⬜ 未实现 |
| exam_paper | 组卷与考试 | ⬜ 未实现 |
| exam_record | 考试记录 | ⬜ 未实现 |
| post | 社区讨论帖 | ⬜ 未实现 |
| note | 用户笔记 | ⬜ 未实现 |
| learning_path | 学习路径 | ⬜ 未实现 |
| user_answer | 用户答题统计 | ⬜ 未实现 |
| user_favorite_question | 收藏/错题本 | ⬜ 未实现 |

---

## 五、核心模块功能与实现

### 5.1 用户模块

**现有代码**: `UserController` / `UserService` / `UserServiceImpl`

| 功能 | API | 说明 |
|------|-----|------|
| 用户注册 | POST `/user/register` | 账号+密码+确认密码 |
| 用户登录 | POST `/user/login` | Sa-Token 登录 |
| 用户登出 | POST `/user/logout` | Sa-Token 登出 |
| 获取当前用户 | GET `/user/current` | 从 Sa-Token 获取 |
| 微信登录 | GET `/user/login/wx_open` | WxJava SDK |
| 用户管理 | POST `/user/add` `/user/update` `/user/delete` | 管理员权限 |

**认证方案**: Sa-Token,token 有效期 30 天,UUID 风格,不允许同账号多端登录。

**权限注解**: `@AuthCheck(mustRole = "admin")` 通过 AOP 拦截器实现。

### 5.2 题库管理模块

**现有代码**: `QuestionBankController` / `QuestionController` / `QuestionBankQuestionController`

| 功能 | API | 说明 |
|------|-----|------|
| 题库 CRUD | POST `/questionBank/add` `/update` `/delete` `/get/vo` | 标题+描述+图片 |
| 题库分页 | POST `/questionBank/list/page/vo` | MyBatis-Plus 分页 |
| 题目 CRUD | POST `/question/add` `/update` `/delete` `/get/vo` | 标题+内容+标签+答案+难度+类型 |
| 题目分页 | POST `/question/list/page/vo` | 多维度筛选 |
| 题目搜索 | POST `/question/search/page/vo` | Elasticsearch 全文搜索 |
| 批量删除 | POST `/question/delete/batch` | 批量操作 |
| 关联管理 | POST `/questionBankQuestion/add` `/batchAdd` `/batchRemove` | 题库-题目多对多 |

**搜索**: Elasticsearch 索引 `question`,字段 `title` + `content` + `tags`。

**缓存**: Caffeine 本地缓存 + JD HotKey 热点探测。

### 5.3 判题模块

**现有代码**: `JudgeController` / `JudgeService` / `CodeSandbox` / `SimpleCodeSandbox`

| 功能 | API | 说明 |
|------|-----|------|
| 提交代码 | POST `/judge/submit` | 创建 submission + 异步判题 |
| 查询结果 | GET `/judge/result/{id}` | 轮询判题结果 |
| 测试用例管理 | POST `/testCase/add` `/update` `/delete` | CRUD |

**判题流程**:
1. 用户提交代码 → 创建 submission(status=PENDING)
2. 异步执行: 取测试用例 → CodeSandbox 执行 → 对比输出
3. 保存 judge_result → 更新 submission status
4. 前端轮询 GET `/judge/result/{id}`

**判题状态**: PENDING → JUDGING → ACCEPTED / WA / TLE / MLE / RE / CE

**代码沙箱**: 当前只有 `SimpleCodeSandbox`(本地进程执行,不安全)。V2 计划用 Docker 隔离沙箱。

**CodeSandbox 接口**:
```java
public interface CodeSandbox {
    ExecuteResult execute(String languageCode, String code, String input, int timeLimit, int memoryLimit);
    CompileResult compile(String languageCode, String code);
    enum Verdict { ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, RUNTIME_ERROR, COMPILE_ERROR }
}
```

### 5.4 AI 面试模块(核心)

**现有代码**: `InterviewController` / `InterviewService` / `AiInterviewStrategyService` / `InterviewPromptConstants`

#### 面试模式

| 模式 | 说明 | 技术核心 |
|------|------|----------|
| 指定题库(mode=1) | 从指定题库抽题,定向突击 | 上下文注入: 题目信息作为 System Prompt |
| 大厂随机(mode=2) | 全局随机抽题,全真模拟 | 动态追问: AI 自主深度挖掘 |

#### 核心流程

```
开始面试
  → 创建 interview_session(status=0)
  → 按模式抽第一道题
  → Redis 缓存: 当前题目/轮次/对话历史/已用题目集
  → AI 生成开场提问(generateOpeningQuestion)
  → 返回 sessionId + openingQuestion

提交回答
  → Redis 推进轮次
  → Redis 保存用户回答到对话历史
  → 从 Redis 取当前题目 + 对话历史
  → 调用 AI 评估(evaluateAnswer) → 结构化 JSON 输出
  → 按 actionDirective 路由分发:
      DEEP_DIVE → 继续追问,AI 回复已存 Redis
      NEXT_QUESTION → 抽下一题 → AI 生成过渡提问 → 存 Redis
      END_INTERVIEW → 结束 → 异步刷入 DB → RabbitMQ 生成报告
```

#### 结构化输出 (Structured Output)

AI 返回 JSON:
```json
{
  "reply_to_user": "你的思路很对,利用了 HashMap 的 O(1) 查找特性。那你能进一步讲讲 HashMap 在 JDK 1.8 中的扩容机制吗?",
  "action_directive": "DEEP_DIVE",
  "current_topic_mastery": 80
}
```

**行为指令枚举**:
- `DEEP_DIVE`: 继续追问当前知识点
- `NEXT_QUESTION`: 切换下一道题
- `END_INTERVIEW`: 结束面试

#### Spring AI 调用方式

```java
// AiInterviewStrategyServiceImpl
AiInterviewResponseDTO response = chatClient.prompt()
        .system(systemPrompt)    // System Prompt 含题目信息 + 面试规则
        .user(userPrompt)        // User Prompt 含对话历史 + 当前回答
        .call()
        .entity(AiInterviewResponseDTO.class);  // 自动反序列化 JSON → DTO
```

#### System Prompt 设计

```
你是一个资深的 Java 架构师面试官。你的目标是考察候选人的真实水平。

【面试规则】
1. 每次只问一个问题,不要一次性抛出多个问题。
2. 如果候选人回答正确且该知识点有深度,请继续追问底层原理。
3. 如果候选人连续两次回答偏题,或明确表示不懂,请简短指出正确方向,
   并将 action_directive 设置为 'NEXT_QUESTION'。
4. 如果针对当前题目的提问已经超过 3 轮,无论候选人回答如何,
   请将 action_directive 设置为 'NEXT_QUESTION'。
5. 你的输出必须是严格的 JSON 格式,包含 reply_to_user, action_directive,
   current_topic_mastery 三个字段。

【当前题目信息】
题目: {{questionTitle}}
描述: {{questionContent}}
参考答案: {{questionAnswer}}
```

#### Redis 数据结构

| Key | 类型 | 说明 | TTL |
|-----|------|------|-----|
| `interview:history:{sessionId}` | RList<String> | 对话历史(role: content) | 2h |
| `interview:question:{sessionId}` | RBucket<Long> | 当前题目 ID | 2h |
| `interview:round:{sessionId}` | RAtomicLong | 当前轮次 | 2h |
| `interview:used:{sessionId}` | RSet<Long> | 已使用题目集 | 2h |

#### 消息队列

`InterviewReportProducer` 在面试结束时发送 RabbitMQ 消息,异步生成面试报告。

### 5.5 RAG 深度检索模块（★ 核心区分度）

> ⚠️ 当前 blueprint 中 RAG 模块仅为基础向量检索（PgVector → 已改为 Milvus）。
> 以下 4 个深度模块为 V2 新增，是 interview-arena 区分度的核心来源。

#### 5.5.1 混合检索（HybridRetriever）

**为什么不能只用向量检索？**
- 向量检索擅长语义相似，但不擅长精确关键词匹配
- 面试题场景：用户问"HashMap 的 put 方法"，向量检索可能返回"ConcurrentHashMap 的 put"（语义相近但不对），BM25 能精确命中"HashMap put"

**实现**：
```
用户提问
  ├── VectorRetriever.search(embedding) → Top-20 语义相似 Chunk（Milvus）
  ├── BM25Retriever.search(keywords)    → Top-20 关键词匹配 Chunk（MySQL 全文索引）
  └── RRF 融合（Reciprocal Rank Fusion）→ 合并去重排序 → Top-10
```

**RRF 公式**：`score(d) = Σ 1/(k + rank_i(d))`，k=60

**面试讲点**：向量 vs BM25 的互补性，RRF 为什么比简单加权好（无需调权重超参）

#### 5.5.2 重排序（RerankService）

```
Top-10 候选 Chunk → Reranker 模型精排 → Top-5 注入 Prompt
```

**为什么需要 Rerank？**
- 召回阶段用 Bi-Encoder（速度快但精度低）
- 精排阶段用 Cross-Encoder（逐对打分，精度高但慢）
- 两阶段架构：召回 100→10，精排 10→5

**技术选型**：DashScope Rerank API 或本地 BGE-Reranker-v2-m3

**面试讲点**：Bi-Encoder vs Cross-Encoder 的区别，为什么不能全用 Cross-Encoder（性能）

#### 5.5.3 RAG 评估（RagEvaluator）

**评测集**：构建 100 道面试题 + 标准答案的评测集

**评估指标**：
| 指标 | 含义 | 计算方式 |
|------|------|----------|
| Hit Rate@5 | Top-5 中是否包含正确答案 | 命中数/总数 |
| MRR | 第一个正确答案的平均排名倒数 | `1/rank` 的均值 |
| Faithfulness | 回答是否忠于检索到的上下文 | LLM 评判 |

**对比实验**（产出量化数据）：
```
配置 A: 纯向量检索        → Hit Rate@5 = 68%
配置 B: 混合召回           → Hit Rate@5 = 79%
配置 C: 混合召回 + Rerank  → Hit Rate@5 = 89%
```

**面试讲点**：有量化数据，"Rerank 让 Hit Rate@5 从 79% 提升到 89%"

#### 5.5.4 语义缓存（SemanticCache）

**场景**：用户问"HashMap 底层原理"和"HashMap 的实现原理"，语义相同但字面不同

**实现**：
```
用户提问 → Embedding → Redis 查相似向量（cosine > 0.95）→ 命中返回缓存 → 未命中调 LLM
```

**面试讲点**：语义缓存 vs 精确缓存的区别，相似度阈值如何选取（precision/recall trade-off）

#### 5.5.5 RAG 模块包结构

```
ai-service/rag/
├── DocumentIngestService.java       # 文档解析分块（已有）
├── VectorRetriever.java             # 向量检索（已有，Milvus）
├── BM25Retriever.java               # ★ 新增：BM25 关键词检索
├── HybridRetriever.java             # ★ 新增：RRF 融合
├── RerankService.java               # ★ 新增：重排序
├── RagEvaluator.java                # ★ 新增：评估指标
└── SemanticCache.java               # ★ 新增：语义缓存
```

### 5.6 基础设施模块

| 组件 | 实现 | 说明 |
|------|------|------|
| 统一响应体 | `BaseResponse<T>` | code(0=成功) + message + data |
| 全局异常 | `GlobalExceptionHandler` | `@RestControllerAdvice` + `@ExceptionHandler` |
| 业务异常 | `BusinessException` | 携带 ErrorCode |
| 权限拦截 | `AuthInterceptor` + `@AuthCheck` | AOP 注解式权限校验 |
| 请求日志 | `LogInterceptor` | URL + 参数 + 耗时 |
| IP 黑名单 | `BlackIpFilter` + `NacosListener` | Nacos 动态配置黑名单 |
| 限流 | `Sentinel` | SentinelRulesManager 规则管理 |
| CORS | `CorsConfig` | 跨域配置 |
| MyBatis-Plus | `MyBatisPlusConfig` | 分页插件 + 逻辑删除 |
| Redisson | `RedissonConfig` | 分布式锁客户端 |

---

## 六、API 接口清单

### 6.1 用户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
| POST | `/api/user/logout` | 用户登出 |
| GET | `/api/user/current` | 获取当前登录用户 |
| GET | `/api/user/login/wx_open/app_id` | 获取微信 AppId |
| GET | `/api/user/login/wx_open` | 微信登录 |
| POST | `/api/user/add` | 添加用户(admin) |
| POST | `/api/user/update` | 更新用户(admin) |
| POST | `/api/user/delete` | 删除用户(admin) |
| POST | `/api/user/list/page` | 分页查询(admin) |
| POST | `/api/user/my/list/page` | 我的列表 |
| POST | `/api/user/update/my` | 更新个人信息 |

### 6.2 题库接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/questionBank/add` | 创建题库 |
| POST | `/api/questionBank/update` | 更新题库 |
| POST | `/api/questionBank/delete` | 删除题库 |
| GET | `/api/questionBank/get/vo` | 获取题库详情 |
| POST | `/api/questionBank/list/page/vo` | 分页查询题库 |
| POST | `/api/questionBank/my/list/page/vo` | 我的题库 |

### 6.3 题目接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/question/add` | 创建题目 |
| POST | `/api/question/update` | 更新题目 |
| POST | `/api/question/delete` | 删除题目 |
| POST | `/api/question/delete/batch` | 批量删除 |
| GET | `/api/question/get/vo` | 获取题目详情 |
| POST | `/api/question/list/page/vo` | 分页查询 |
| POST | `/api/question/my/list/page/vo` | 我的题目 |
| POST | `/api/question/search/page/vo` | ES 搜索 |

### 6.4 判题接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/judge/submit` | 提交代码 |
| GET | `/api/judge/result/{id}` | 查询判题结果 |
| POST | `/api/testCase/add` | 添加测试用例 |
| POST | `/api/testCase/update` | 更新测试用例 |
| POST | `/api/testCase/delete` | 删除测试用例 |

### 6.5 AI 面试接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/interview/start` | 开始面试(mode + bankId) |
| POST | `/api/interview/answer` | 提交回答(sessionId + answer) |

---

## 七、后端代码包结构

```
com.charles.interview.arena
├── MainApplication.java          ← 启动类
├── annotation/
│   └── AuthCheck.java            ← 权限校验注解
├── aop/
│   ├── AuthInterceptor.java      ← 权限拦截器
│   └── LogInterceptor.java       ← 日志拦截器
├── blackfilter/
│   ├── BlackIpFilter.java        ← IP 黑名单过滤器
│   ├── BlackIpUtils.java
│   └── NacosListener.java        ← Nacos 动态配置监听
├── common/
│   ├── BaseResponse.java         ← 统一响应体
│   ├── ErrorCode.java            ← 错误码枚举
│   ├── ResultUtils.java          ← 响应工具类
│   ├── DeleteRequest.java
│   └── PageRequest.java          ← 分页请求基类
├── config/
│   ├── CorsConfig.java
│   ├── HotKeyConfig.java         ← JD HotKey 配置
│   ├── InterviewPromptConstants.java  ← AI 面试 Prompt 常量
│   ├── JsonConfig.java
│   ├── MyBatisPlusConfig.java
│   ├── RedissonConfig.java
│   ├── SentryUserFilter.java
│   └── WxOpenConfig.java         ← 微信配置
├── constant/
│   ├── CommonConstant.java
│   ├── InterviewRedisConstants.java  ← 面试 Redis Key 前缀
│   ├── RedisConstant.java
│   └── UserConstant.java
├── controller/                   ← 7 个 Controller
│   ├── UserController.java
│   ├── QuestionBankController.java
│   ├── QuestionController.java
│   ├── QuestionBankQuestionController.java
│   ├── JudgeController.java
│   ├── TestCaseController.java
│   └── InterviewController.java
├── exception/
│   ├── BusinessException.java
│   ├── GlobalExceptionHandler.java
│   └── ThrowUtils.java
├── judge/
│   └── codesandbox/
│       ├── CodeSandbox.java      ← 判题沙箱接口
│       └── impl/
│           └── SimpleCodeSandbox.java  ← 本地进程沙箱(不安全)
├── manager/
│   └── CounterManager.java       ← 计数器管理
├── mapper/                       ← 10 个 Mapper
│   ├── UserMapper.java
│   ├── QuestionMapper.java
│   ├── QuestionBankMapper.java
│   ├── QuestionBankQuestionMapper.java
│   ├── TestCaseMapper.java
│   ├── SubmissionMapper.java
│   ├── JudgeResultMapper.java
│   ├── ProgrammingLanguageMapper.java
│   ├── InterviewSessionMapper.java
│   └── InterviewRecordMapper.java
├── model/
│   ├── entity/                   ← 10 个实体类
│   ├── dto/                      ← 请求 DTO(按模块分包)
│   │   ├── user/
│   │   ├── question/
│   │   ├── questionBank/
│   │   ├── questionBankQuestion/
│   │   ├── interview/
│   │   ├── judge/
│   │   └── file/
│   ├── vo/                       ← 响应 VO
│   └── enums/                    ← 枚举
│       ├── ActionDirectiveEnum.java   ← DEEP_DIVE/NEXT_QUESTION/END_INTERVIEW
│       ├── InterviewModeEnum.java     ← SPECIFIED_BANK/RANDOM_BIG_TECH
│       ├── JudgeVerdictEnum.java
│       ├── QuestionDifficultyEnum.java
│       ├── QuestionTypeEnum.java
│       ├── UserRoleEnum.java
│       └── FileUploadBizEnum.java
├── mq/
│   └── InterviewReportProducer.java  ← RabbitMQ 面试报告生产者
├── satoken/
│   ├── SaTokenConfigure.java
│   ├── StpInterfaceImpl.java     ← Sa-Token 权限实现
│   └── DeviceUtils.java
├── sentinel/
│   ├── SentinelConstant.java
│   ├── SentinelRulesManager.java
│   └── SentinelTest.java
├── service/                      ← 11 个 Service
│   ├── UserService.java
│   ├── QuestionService.java
│   ├── QuestionBankService.java
│   ├── QuestionBankQuestionService.java
│   ├── JudgeService.java
│   ├── TestCaseService.java
│   ├── SubmissionService.java
│   ├── JudgeResultService.java
│   ├── ProgrammingLanguageService.java
│   ├── InterviewService.java              ← 面试核心逻辑
│   ├── AiInterviewStrategyService.java    ← Spring AI 调用
│   └── impl/                              ← 实现类
└── utils/
    ├── DatabaseConnector.java
    ├── NetUtils.java
    ├── SpringContextUtils.java
    └── SqlUtils.java
```

---

## 八、配置说明

### application.yml 核心配置

```yaml
spring:
  application:
    name: interview-arena-backend
  profiles:
    active: dev
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/interview_arena
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      initial-size: 20
      minIdle: 20
      max-active: 200
  redis:
    database: 1
    host: localhost
    port: 6379
  ai:
    dashscope:
      api-key: ${DASHSCOPE_API_KEY}
      chat:
        options:
          model: qwen-plus
          temperature: 0.7
  elasticsearch:
    uris: http://localhost:9200

server:
  port: 8101
  servlet:
    context-path: /api

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: false
  global-config:
    db-config:
      logic-delete-field: isDelete
      logic-delete-value: 1
      logic-not-delete-value: 0

sa-token:
  token-name: interview-arena
  timeout: 2592000
  is-concurrent: false
  is-share: true
  token-style: uuid
```

### 开发规范

- 后端: Controller → Service → Mapper 三层架构,严格 DTO/VO 分离
- 统一响应: `BaseResponse<T>` with code(0=success) + message + data
- 逻辑删除: `isDelete` 字段(1=deleted, 0=active)
- 权限: `@AuthCheck(mustRole = "admin")` 注解
- AI Prompt: 所有 Prompt 模板集中管理(InterviewPromptConstants)
- 数据库: Flyway 版本化迁移,V2 改用命名 `V{N}__{description}.sql`

---

## 九、V2 重构计划(11 个模块)

| 模块 | 内容 | 核心变更 | 状态 |
|------|------|----------|------|
| M1 基础架构 | 项目骨架 + 用户系统 | Java 21 + Boot 3.4 + groupId 修正 | ⬜ |
| M2 题库管理 | 题库/题目 CRUD + ES 搜索 | 沿用现有,代码规范化 | ⬜ |
| M3 在线判题 | Docker 沙箱 + 多语言 | 替换 SimpleCodeSandbox | ⬜ |
| M4 AI 评分 | Spring AI 答案评分 + SSE | 新增 | ⬜ |
| M5 AI 面试 | 多轮对话 + 状态机 | 沿用现有,升级 Spring AI 1.1.x | ⬜ |
| M6 AI 报告 | 综合评估 + 雷达图 | 新增 | ⬜ |
| M7 简历预测 | 简历解析 + AI 出题 | 新增 | ⬜ |
| M8 AI 编程辅助 | 代码审查 + 优化建议 | 新增 | ⬜ |
| M9 组卷考试 | 智能组卷 + 限时考试 | 新增 | ⬜ |
| M10 社区学习 | 讨论区 + 笔记 + 学习路径 | 新增 | ⬜ |
| M11 部署优化 | Docker Compose + 测试 | 新增 | ⬜ |

---

## 十、下一步开发任务清单

### 第一优先级:Phase 1.1 基础重构

| 任务 | 说明 |
|------|------|
| [ ] 修正 pom.xml | groupId → com.charles, Java → 21, Boot → 3.4.x |
| [ ] 升级 Spring AI | 删除旧 1.0.0-M3.1,后续引入 1.1.x |
| [ ] 代码规范化 | 包结构整理,删除无用代码 |
| [ ] 补测试 | UserService 核心方法单元测试 |
| [ ] Docker Compose | MySQL + Redis + ES 一键启动 |

### 第二优先级:Phase 1.2 ai-service 骨架

| 任务 | 说明 |
|------|------|
| [ ] 新建 ai-service 包 | com.charles.interview.arena.ai |
| [ ] Spring AI Alibaba 1.1.x 依赖 | pom.xml 引入 |
| [ ] DashScope 配置 | application.yml 通义千问配置 |
| [ ] ChatClient 对话跑通 | 基础对话 API |
| [ ] SSE 流式响应 | Flux<ServerSentEvent> |

### 第三优先级:Phase 1.3 RAG 模块

| 任务 | 说明 |
|------|------|
| [ ] PgVector 向量库 | PostgreSQL + pgvector 扩展 |
| [ ] Embedding 服务 | DashScope text-embedding-v2 |
| [ ] 文档入库 | 面试题 → 分块 → Embedding → PgVector |
| [ ] RAG 检索 | 向量相似度搜索 + 上下文注入 |
| [ ] QuestionAnswerAdvisor | Spring AI RAG Advisor |

### 后续模块

| 优先级 | 模块 | 说明 |
|--------|------|------|
| P1 | Agent 模块 | 面试状态机 + @Tool + ChatMemory |
| P1 | MCP 模块 | MCP Server 暴露工具 |
| P2 | 网约车重构 | 派单/状态机/MQ 代码规范化 |
| P2 | 网约车 AI 客服 | 复用 ai-service RAG + Agent |
| P3 | RPC 框架完善 | 代码规范化 + 集成测试 |
