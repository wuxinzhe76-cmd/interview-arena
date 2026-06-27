# interview-arena · RAG 模块升级 TODO + 对话上下文

> 📅 创建时间：2026-06-24  
> 🎯 用途：新对话恢复上下文，继续实现 Advanced RAG 全模块  
> 🔗 关联文件：`blueprint.md` §5.5、`RAG_CONTEXT.md`

---

## 一、上次对话讨论的 RAG 待补模块（12 个）

### Pre-Retrieval（检索前）

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 1 | QueryRewriteTransformer | LLM 查询改写：纠正术语（"双亲委托"→"双亲委派"）、扩展短 query | 高 |
| 2 | 查询路由 | 按 category 路由到不同检索策略（Java/Python 分库） | 中 |

### Retrieval（检索中）

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 3 | metadata 加 title + category | ETL 入库时加题目标题和题库分类（通过 question_bank_question 关联表查） | 高 |
| 4 | 元数据过滤 | HybridRetriever 支持 `filterExpression("category == 'Java基础'")` | 高 |
| 5 | 增量入库 | addQuestion / updateQuestion / deleteQuestion，题目增删改时同步更新 Milvus + ES | 高 |

### Post-Retrieval（检索后）

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 6 | DocumentDeduplicator | RRF 融合后可能有内容重复的文档，按文本相似度去重 | 中 |
| 7 | ContextCompressor | 长文档做摘要压缩再拼接，控制 Prompt token 数 | 中 |
| 8 | Lost-in-the-middle 重排 | 最相关文档放 Prompt 首尾，防止 LLM 忽略中间内容 | 中 |

### Generation（生成）

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 9 | 自定义中文 Prompt 模板 | 替换 Spring AI 默认英文模板，明确"只能基于检索到的面试题回答" | 高 |
| 10 | 引用标注（溯源） | 返回命中的 questionId 列表 + 题目标题，前端展示"参考题目" | 高 |
| 11 | RagChatResponse DTO | ragChat 返回结构化响应（answer + sourceQuestions），不只是 String | 高 |

### 缓存

| # | 模块 | 说明 | 优先级 |
|---|------|------|--------|
| 12 | SemanticCache TTL 过期 | Redis key 设 1 小时 TTL，数据更新后缓存自动失效 | 高（bug） |

---

## 二、ES 搜索需求（用户明确补充）

用户引入 Elasticsearch 除了 RAG 的 BM25 检索外，还要实现**搜索栏前缀/后缀匹配**：

- 用户在搜索栏输入 "Java" → 下拉显示 "Java 的特性"、"Java 面向对象"、"Java 集合" 等
- 这不是 RAG 场景，是**题目搜索 autocomplete** 场景
- 用 ES 的 `prefix` 查询或 `suggest` API 实现
- 需要新建一个 `QuestionSearchService` 或在现有 `QuestionController` 加 `/question/suggest` 接口

---

## 三、已实现文件清单

### RAG 模块现有文件（11 个）

| 文件 | 路径 | 功能 |
|------|------|------|
| QuestionEsDoc.java | `rag/model/` | ES 文档实体（倒排索引映射，IK 分词） |
| BM25Retriever.java | `rag/service/` | ES BM25 关键词检索（multi_match + 权重提升） |
| HybridRetriever.java | `rag/service/` | 向量+BM25 RRF 融合（k=60，两路 Top-20 → Top-10） |
| HybridDocumentRetriever.java | `rag/service/` | Spring AI DocumentRetriever 适配器 |
| RerankService.java | `rag/service/` | DashScope gte-rerank Cross-Encoder 精排 |
| RerankDocumentPostProcessor.java | `rag/service/` | Spring AI DocumentPostProcessor 适配器 |
| SemanticCache.java | `rag/service/` | 语义缓存（Redis + cosine > 0.95） |
| RagEvaluator.java | `rag/service/` | Hit Rate@5 + MRR 评估（未串入链路） |
| RagService.java | `rag/service/` | 服务入口（ETL 全量导入 + ragChat 问答） |
| RagConfig.java | `config/` | ChatClient Bean + RetrievalAugmentationAdvisor Bean |
| RagController.java | `rag/controller/` | /rag/chat + /rag/import API |

### ES 基础设施（3 个）

| 文件 | 功能 |
|------|------|
| `elasticsearch/Dockerfile` | ES 8.17 + IK 中文分词器 |
| `elasticsearch/docker-compose-es.yml` | Docker Compose 配置 |
| `elasticsearch/question-index-mapping.json` | 索引映射（IK 分词） |

---

## 四、新对话恢复指令

在新对话中只需说：

> "继续实现 interview-arena RAG 模块升级，读 `docs/RAG_UPGRADE_TODO.md` + `docs/blueprint.md` §5.5"

教练会自动：
1. 读本文件了解 12 个待补模块
2. 读 blueprint 了解项目全貌
3. 按优先级从高到低实现
4. 编译验证
5. 更新 blueprint + 学习进度

---

## 五、技术栈版本

| 组件 | 版本 |
|------|------|
| Java | 21 |
| Spring Boot | 3.4.x |
| Spring AI | 1.1.2 |
| Spring AI Alibaba | 1.0.0.2 |
| Milvus | 2.x（HNSW + COSINE，1024 维） |
| Elasticsearch | 8.17 + IK 分词器 |
| DashScope | qwen-plus + text-embedding-v3 + gte-rerank |
| MySQL | 8.x |
| Redis | 7.x |

---

## 六、服务器信息

- 服务器 IP：117.72.62.12
- MySQL：3306
- Redis：6379
- RabbitMQ：5672
- Elasticsearch：9200（待部署）
- Milvus：19530

---

## 七、实现进度（2026-06-24 更新）

### ✅ 已完成（10/12 + ES autocomplete）

| # | 模块 | 状态 | 实现文件 |
|---|------|------|----------|
| 1 | QueryRewriteTransformer | ✅ | `rag/service/QueryRewriteTransformer.java` |
| 3 | metadata 加 title + category | ✅ | `QuestionEsDoc` + `RagService.importQuestionsToVectorStore` |
| 4 | 元数据过滤 | ✅ | `HybridRetriever.retrieve(query, filterExpression)` + `BM25Retriever` bool query |
| 5 | 增量入库 | ✅ | `QuestionChangedEvent` + `RagService.onQuestionChanged` @EventListener + `QuestionServiceImpl` 发布事件 |
| 6 | DocumentDeduplicator | ✅ | `rag/service/DocumentDeduplicator.java` |
| 8 | Lost-in-the-middle 重排 | ✅ | `rag/service/LostInTheMiddleRearranger.java` |
| 9 | 自定义中文 Prompt 模板 | ✅ | `RagService.SYSTEM_PROMPT` + `RAG_PROMPT_TEMPLATE`（手动编排，弃用 Advisor 黑盒） |
| 10 | 引用标注（溯源） | ✅ | `SourceQuestion` + `RagService.extractSources` |
| 11 | RagChatResponse DTO | ✅ | `rag/model/RagChatResponse.java`（answer + sourceQuestions + cacheHit） |
| 12 | SemanticCache TTL | ✅ | `SemanticCache.CACHE_TTL = Duration.ofHours(1)` |
| ES | autocomplete | ✅ | `QuestionSearchService` + `/rag/suggest`（match_phrase_prefix） |

### ❌ 评估后不实现（2 个）

| # | 模块 | 原因 |
|---|------|------|
| 2 | 查询路由（多策略） | 元数据过滤（`filterExpression("category == 'Java基础'")`）已实现软路由，按 category 走不同检索参数/TopK 属于过度设计 |
| 7 | ContextCompressor | Top-5 文档量 Prompt token 可控，再加一次 LLM 摘要调用增加延迟+成本，得不偿失 |

### 关键架构变更

- **ragChat 改为手动 DAG 编排**：不再使用 `RetrievalAugmentationAdvisor` 黑盒，手动串联 查询改写 → 混合检索 → Rerank → 去重 → Lost-in-the-middle 重排 → 拼接 Prompt → 生成，模块可插拔（#176 Modular RAG）
- **增量入库事件解耦**：`QuestionServiceImpl` 发布 `QuestionChangedEvent`，`RagService` @EventListener 监听，避免循环依赖
- **Document ID = questionId**：Milvus 文档 ID 设为 questionId 字符串，支持增量删除
