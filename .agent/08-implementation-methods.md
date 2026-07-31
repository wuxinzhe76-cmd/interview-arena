# 实现方式选择:框架 vs 自研

> 原则:能用框架就用框架;业务特定必须自研;横切关注点用 AOP。

---

## 一、总表:框架 vs 自研

| 能力 | 实现方式 | 所属机制 | 说明 |
|------|----------|---------|------|
| 请求字段校验 | **Spring Validation** `@Valid` + JSR303 | 感知 | 已在用 |
| 限流 | **Sentinel** `@SentinelResource` + Spring AOP | 横切 | 已在用 |
| PDF 解析 | **Apache PDFBox** | 感知 | 已有依赖 |
| 图片 OCR | 多模态模型/OCR 服务 | 感知 | 第一版可简化 |
| 意图分类(规则) | 自研关键词匹配 | 感知 | 零成本 |
| 意图分类(LLM) | **Spring AI ChatClient** + DeepSeek v4flash | 感知 | 小模型,低成本 |
| 实体提取 | **Spring AI ChatClient** + 结构化 DTO | 感知 | LLM 辅助 |
| 短期消息管理 | **Spring AI ChatMemory** + MessageWindowChatMemory | 记忆 | 框架提供滑动窗口 |
| 消息持久化 | **Spring AI ChatMemoryRepository** | 记忆 | 可自定义 Redis 实现 |
| 向量检索 | **Spring AI VectorStore**(Milvus) | 记忆/RAG | 已在用 |
| 记忆压缩摘要 | **Spring AI SummaryChatMemoryAdvisor** | 记忆 | 后续迭代 |
| ReAct 循环 | 自研 | 规划 | 已实现 |
| 目标漂移检测 | 自研(正则) | 规划 | 第一版保持 |
| 错误分类 | 自研(六分类) | 工具 | 升级自三分类 |
| 循环检测 | 自研 | 规划 | 已实现 |
| 工具注册 | 自研 ToolRegistry | 工具 | 已实现 |
| 工具执行+限流 | **Sentinel** + 自研 | 工具 | 已实现 |
| 工具权限 | 自研 + **Spring AOP** | 工具 | 已实现,加 EXECUTE |
| MCP 协议 | **Spring AI MCP Starter** | 工具 | 已在用 |
| 工具返回沙箱化 | 自研 ToolResultSanitizer | 工具 | 新增 |
| Orchestrator 编排 | 自研 | 编排 | 已实现 |
| 状态机(三层控制) | 自研 ThreeLayerController | 编排 | 已实现 |
| 降级链路 | 自研 FallbackChain | 编排 | 已实现 |
| 生产约束 | 自研 + **Spring `@Value`** | 编排 | 已有配置 |
| 结构化输出校验 | **Spring Validation** + 自研 | 反思 | 已有 |
| 修复重试 | 自研 | 反思 | 已有 |
| 纠正提示 | 自研 | 反思 | 已有 |
| 注入检测(规则) | 自研正则 | guardrail | 确定性 |
| 注入检测(LLM) | **Spring AI ChatClient** | guardrail | 后续迭代 |
| 敏感信息脱敏 | 自研正则 | guardrail | 邮箱/手机号/身份证 |
| 输出监控 | 自研 | guardrail | 堆栈/敏感路径/异常 |
| 答案泄露检测 | 自研 | guardrail | 滑动窗口字符匹配 |
| 记忆隔离 | 自研 + **MyBatis-Plus** | guardrail | userId 过滤 |
| 熔断器 | 自研 | harness/common | 跨机制共享 |
| Token 预算 | 自研 | harness/common | 跨机制共享 |
| Prompt 管理 | 自研(YAML + PromptManager) | llm | 需版本化 |
| LLM 调用 | **Spring AI ChatClient** | llm | 已在用 |
| Prompt Cache | 自研/框架辅助 | llm/cache | 后续迭代 |

## 二、三条原则

### 原则 1:能用框架就用框架

| 框架 | 用途 | 机制 |
|------|------|------|
| Spring AI ChatClient | LLM 调用 / 意图分类 / 实体提取 | 感知/规划 |
| Spring AI ChatMemory | 短期消息管理(滑动窗口) | 记忆 |
| Spring AI VectorStore | 向量检索(Milvus) | 记忆/RAG |
| Spring AI MCP Starter | MCP 协议(M+N 集成) | 工具 |
| Spring AI Advisor | 记忆压缩/RAG 检索(后续) | 记忆 |
| Spring Validation | 请求字段校验(@Valid + JSR303) | 感知 |
| Spring AOP | 横切关注点(日志/审计/限流/监控) | 横切 |
| Sentinel | 限流(@SentinelResource) | 横切 |
| Spring @Value | 配置注入 | 编排 |
| MyBatis-Plus | 数据访问(含 userId 过滤) | 记忆/guardrail |
| Apache PDFBox | PDF 解析 | 感知 |

### 原则 2:业务特定必须自研

| 自研组件 | 理由 |
|---------|------|
| ReActExecutor | Agent 核心循环,业务特定 |
| ThreeLayerController | 面试三层控制,业务特定 |
| InterviewOrchestrator / AskOrchestrator | Agent 编排,业务特定 |
| AgentStateStore | 状态管理(含乐观锁),业务特定 |
| MemoryConsolidationService | 记忆整合,业务特定 |
| MemoryWritePolicy | 写入策略,业务特定 |
| GoalTracker | 目标漂移检测(正则),业务特定 |
| LoopDetector | 循环检测,业务特定 |
| ErrorClassifier | 错误六分类,业务特定 |
| ToolResultSanitizer | 工具返回沙箱化,业务特定 |
| PromptInjectionDetector | 注入检测(四层),业务特定 |
| OutputMonitor | 输出监控,业务特定 |
| LeakDetector | 答案泄露检测,业务特定 |
| PromptManager | Prompt 版本化管理,业务特定 |
| CircuitBreaker | 熔断器(跨请求状态),业务特定 |
| TokenBudget | Token 预算,业务特定 |

### 原则 3:横切关注点用 AOP

| AOP 增强 | 实现方式 | 作用 |
|---------|---------|------|
| 限流 | `@SentinelResource` 注解 + Sentinel | QPS 控制 |
| 日志 | 自定义注解 + Spring AOP | 调用日志 |
| 审计 | 自定义注解 + Spring AOP | 工具调用审计 |
| 监控 | 自定义注解 + Spring AOP | 耗时/异常监控 |
| 工具权限 | 自定义注解 + Spring AOP | 权限拦截 |

## 三、Spring AI Advisor 使用规划

| Advisor | 用途 | 第一版 | 后续 |
|---------|------|--------|------|
| SimpleLoggerAdvisor | LLM 调用日志 | ✅ 已用 | - |
| MessageChatMemoryAdvisor | 短期消息管理 | ✅ 考虑使用 | - |
| SummaryChatMemoryAdvisor | 对话摘要压缩 | ❌ | ✅ |
| VectorStoreChatMemoryAdvisor | 向量存储记忆 | ❌ | ✅ |
| RetrievalAugmentationAdvisor | 模块化 RAG | ❌(手动 DAG) | ✅(评估) |

**第一版**:手动 DAG 编排 RAG(更灵活),后续评估是否切换到 Advisor。

## 四、存储选型总览

| 存储 | 用途 | 机制 |
|------|------|------|
| Redis | 短期消息 + WorkingMemory + AgentState + 语义缓存 | 记忆/状态/工具 |
| MySQL | 面试记录 + 知识画像 + 长期结构化事实 | 记忆 |
| Milvus | 历史面试语义检索 + 用户弱点检索 + 题库向量 | 记忆/RAG |
| Elasticsearch | BM25 关键词检索 + 题目搜索 | RAG |
| RabbitMQ | 面试报告异步生成 | 编排 |
