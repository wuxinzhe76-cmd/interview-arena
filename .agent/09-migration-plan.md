# 迁移计划

> 从当前 agent 目录结构迁移到 6 机制 + 横切层新架构的执行计划。

---

## 一、新目录结构总览

```
agent/
├── core/                                # 统一抽象
│   ├── AgentContext.java                # Agent 上下文(systemPrompt+messages+tokenUsage)
│   ├── AgentResult.java                 # Agent 执行结果
│   └── AgentIdentity.java               # 身份(userId+sessionId)
│
├── perception/                          # 机制1:感知与输入
│   ├── PerceptionService.java           # 感知处理主线(7步管线)
│   ├── validation/
│   │   ├── InputFormatValidator.java    # 文本非空/字段完整/JSON Schema
│   │   ├── FileValidator.java           # MIME 白名单/文件大小/数量
│   │   └── ResourceLimitValidator.java  # Token 预估/请求频率/并发
│   ├── parsing/
│   │   ├── PdfContentParser.java        # PDF -> 页面文本+表格+页码
│   │   ├── ImageContentParser.java      # 图片 -> OCR/VLM 描述
│   │   └── ToolResultParser.java        # ToolResult -> Observation
│   ├── normalization/
│   │   ├── TextNormalizer.java          # Unicode/不可见字符/换行
│   │   └── ObservationNormalizer.java   # 多模态结果统一
│   ├── intent/
│   │   ├── IntentClassifier.java        # 两级路由:规则 + LLM(DeepSeek v4flash)
│   │   └── EntityExtractor.java         # 实体提取
│   └── model/
│       ├── RawInput.java
│       ├── Observation.java
│       ├── PerceptionResult.java
│       ├── Intent.java
│       ├── RiskAssessment.java
│       └── TrustLevel.java
│
├── memory/                              # 机制2:记忆(管过去)
│   ├── MemoryFacade.java                # 用例级方法(loadForInterview/recordTurn/consolidateInterview)
│   ├── conversation/
│   │   ├── ConversationMemoryService.java  # 短期记忆(消息记录,Redis)
│   │   └── ConversationMessage.java
│   ├── working/
│   │   ├── WorkingMemoryService.java    # 工作记忆(当前任务语义信息)
│   │   └── WorkingMemory.java
│   ├── episodic/
│   │   ├── EpisodicMemoryService.java   # 情景记忆(MySQL)
│   │   └── InterviewEpisode.java
│   ├── semantic/
│   │   ├── SemanticMemoryService.java   # 语义记忆(MySQL+Milvus)
│   │   ├── KnowledgeProfileAnalyzer.java # 从 profile/ 合入
│   │   └── model/
│   │       ├── KnowledgeWeakness.java
│   │       └── UserKnowledgeProfile.java
│   ├── retrieval/
│   │   ├── MemoryRetriever.java
│   │   ├── MemoryRanker.java
│   │   ├── MemoryDeduplicator.java
│   │   ├── MultiStrategyMemoryRetriever.java  # 四路+RRF(已有)
│   │   └── KnowledgeRetriever.java      # 知识检索接口(已有)
│   ├── consolidation/
│   │   ├── MemoryConsolidationService.java  # 记忆整合(已有)
│   │   └── MemoryWritePolicy.java       # 写入策略
│   └── lifecycle/
│       ├── MemoryExpirationPolicy.java
│       └── MemoryDeletionService.java
│
├── runtime/                             # 状态(独立于 memory)
│   └── state/
│       ├── InterviewAgentState.java     # 状态 record(含 version 乐观锁)
│       ├── InterviewStage.java          # 阶段枚举
│       ├── AgentStateStore.java         # 状态存储(Redis)
│       └── StateCheckpointService.java  # 检查点(第一版可不做)
│
├── context/                             # ContextAssembler(独立于 memory)
│   ├── ContextAssembler.java            # Memory+State -> AgentContext
│   ├── ContextCompressor.java           # 6步压缩(第一版简化)
│   └── TokenBudgetManager.java          # Token 截断
│
├── planning/                            # 机制3:规划与推理
│   ├── react/                           # 机制层:Agent 运行时推理
│   │   ├── ReActExecutor.java           # (已有,从 react/ 移入)
│   │   ├── ReActRequest.java
│   │   ├── ReActResult.java
│   │   ├── ReActStep.java
│   │   └── ReActTrace.java
│   ├── harness/                         # 机制层:规划防护
│   │   ├── GoalTracker.java             # 升级自 GoalDriftDetector
│   │   ├── ErrorClassifier.java         # 升级自 StructuredErrorHandler
│   │   ├── LoopDetector.java            # 循环检测
│   │   ├── ReplanPolicy.java            # 重规划策略
│   │   └── ProductionConstraints.java   # 生产约束
│   ├── application/                     # 应用层:规划思想的应用
│   │   └── LearningPathPlanner.java     # 学习路径规划(从 learning/ 移入)
│   └── model/
│       ├── DriftResult.java
│       └── ErrorType.java
│
├── tool/                                # 机制4:工具调用
│   ├── api/
│   │   ├── Tool.java                    # (已有)
│   │   ├── ToolExecutor.java            # (已有,加沙箱化)
│   │   ├── ToolRegistry.java            # (已有)
│   │   ├── ToolInput.java               # (已有)
│   │   └── ToolResult.java              # (已有,加安全标记)
│   ├── impl/                            # 6 个工具(已有)
│   │   ├── PickQuestionTool.java
│   │   ├── GetQuestionDetailTool.java
│   │   ├── GetWeakPointsTool.java
│   │   ├── RetrieveKnowledgeTool.java
│   │   ├── RetrieveMemoryTool.java
│   │   └── WebSearchTool.java
│   ├── harness/
│   │   ├── ToolErrorClassifier.java     # 六分类
│   │   ├── ToolResultSanitizer.java     # 沙箱化
│   │   └── ToolRouter.java              # 工具路由(第一版不需要)
│   └── model/
│       ├── ToolRiskLevel.java           # READ/WRITE/EXECUTE/CRITICAL
│       └── ToolErrorType.java           # 六分类枚举
│
├── orchestration/                       # 机制5:编排与调度
│   ├── api/
│   └── AgentOrchestrator.java           # 统一接口
│   ├── interviewer/                     # 面试官 Agent
│   │   ├── InterviewOrchestrator.java   # (已有,从 orchestrator/ 移入)
│   │   ├── InterviewService.java        # 薄层(已有)
│   │   ├── InterviewServiceImpl.java    # 薄层(已有)
│   │   ├── InterviewLlmService.java     # 面试话术(已有)
│   │   ├── PdfReportService.java        # PDF 报告(已有)
│   │   ├── InterviewReportProducer.java # MQ(从 mq/ 移入)
│   │   ├── InterviewReportConsumer.java # MQ(从 mq/ 移入)
│   │   └── InterviewMqConfig.java       # MQ 配置(从 mq/ 移入)
│   ├── ask/                             # 询问助手 Agent
│   │   ├── AskOrchestrator.java         # 新增(从 QuickAskService 升级)
│   │   ├── AskService.java              # 薄层
│   │   └── AgenticRagService.java       # Agentic RAG(从 service/ 移入)
│   └── harness/                         # 编排防护
│       ├── ThreeLayerController.java    # 三层控制(已有)
│       ├── AskFallbackController.java   # 询问降级控制
│       └── ProductionConstraints.java   # 生产约束
│
├── reflection/                          # 机制6:反思与自修正
│   ├── ReflectionService.java           # 统一入口
│   ├── harness/
│   │   ├── OutputValidator.java         # 输出校验(从 LlmInvoker 抽出)
│   │   ├── RepairRetryHandler.java      # 修复重试(从 LlmInvoker 抽出)
│   │   ├── CorrectionPromptBuilder.java # 纠正提示(从 ReActExecutor 抽出)
│   │   └── ReflectionLimitPolicy.java   # 轮次限制
│   └── model/
│       ├── ReflectionResult.java
│       └── ErrorCorrection.java
│
├── guardrail/                           # 横切:安全护栏
│   ├── input/                           # 输入安全
│   │   ├── InputGuardrail.java
│   │   ├── PromptInjectionDetector.java # 升级自 InputSanitizer
│   │   ├── InputRiskClassifier.java
│   │   └── SensitiveInputFilter.java
│   ├── output/                          # 输出安全
│   │   ├── OutputMonitor.java           # (已有)
│   │   ├── OutputSanitizer.java
│   │   └── LeakDetector.java            # 从 InterviewLlmService 抽出
│   ├── tool/                            # 工具安全
│   │   ├── ToolPermission.java          # (已有)
│   │   ├── ToolRiskClassifier.java
│   │   └── ToolAccessControl.java
│   └── memory/                          # 记忆安全
│       ├── MemoryIsolation.java
│       └── MemoryWriteGuard.java
│
├── llm/                                 # LLM 基础设施
│   ├── config/
│   │   ├── LlmConfig.java               # (已有)
│   │   └── LlmProperties.java           # (已有)
│   ├── core/
│   │   ├── LlmInvoker.java              # (已有,反思逻辑抽到 reflection/)
│   │   └── LlmResult.java               # (已有)
│   ├── prompt/
│   │   ├── PromptManager.java           # (已有)
│   │   └── PromptRequest.java           # (已有)
│   └── cache/                           # Prompt Cache(后续迭代)
│       └── PromptCacheManager.java
│
├── harness/                             # 跨机制共享 Harness
│   └── common/
│       ├── CircuitBreaker.java          # (已有,从 resilience/ 移入)
│       ├── TokenBudget.java             # (已有,从 resilience/ 移入)
│       ├── FallbackChain.java           # (已有,从 resilience/ 移入)
│       └── HarnessConfig.java           # (已有,从 harness/ 移入)
│
├── aop/                                 # 横切 AOP
│   ├── SentinelConfig.java              # (已有,从 tool/core/ 移入)
│   ├── LoggingAspect.java               # 日志 AOP(新增)
│   ├── AuditAspect.java                 # 审计 AOP(新增)
│   └── MonitoringAspect.java            # 监控 AOP(新增)
│
├── mcp/                                 # MCP 协议
│   └── McpInterviewTools.java           # (已有)
│
├── rag/                                 # RAG 基础设施(检索/重排/缓存)
│   ├── event/
│   │   └── QuestionChangedEvent.java    # (已有)
│   ├── model/
│   │   ├── QuestionEsDoc.java           # (已有)
│   │   ├── RagChatResponse.java         # (已有)
│   │   └── SourceQuestion.java          # (已有)
│   └── service/
│       ├── BM25Retriever.java           # (已有)
│       ├── DocumentDeduplicator.java    # (已有)
│       ├── HybridRetriever.java         # (已有)
│       ├── LostInTheMiddleRearranger.java # (已有)
│       ├── PdfImportService.java        # (已有,解析逻辑拆到 perception/)
│       ├── QueryRewriteTransformer.java # (已有)
│       ├── QuestionSearchService.java   # (已有)
│       ├── RagEvaluator.java            # (已有)
│       ├── RagGapDetectionService.java  # (已有)
│       ├── RagService.java              # (已有)
│       ├── RerankService.java           # (已有)
│       ├── SemanticCache.java           # (已有)
│       └── UserKnowledgeBaseService.java # (已有)
│
└── controller/                          # HTTP 入口
    ├── InterviewController.java         # (已有)
    └── AskController.java               # (已有)
```

## 二、删除的旧目录

迁移完成后删除:
- `agent/react/` -> 移入 `planning/react/`
- `agent/orchestrator/` -> 移入 `orchestration/`
- `agent/profile/` -> 合入 `memory/semantic/`
- `agent/learning/` -> 移入 `planning/application/`
- `agent/service/` -> 移入 `orchestration/interviewer/` 和 `orchestration/ask/`
- `agent/service/impl/` -> 移入 `orchestration/interviewer/`
- `agent/mq/` -> 移入 `orchestration/interviewer/`
- `agent/harness/resilience/` -> 拆分到 `planning/harness/` + `harness/common/`
- `agent/harness/security/` -> 移入 `guardrail/`
- `agent/harness/HarnessConfig` -> 移入 `harness/common/`
- `agent/config/InterviewRedisConstants` -> 移入 `runtime/state/`
- `agent/memory/api/` -> 移入 `memory/MemoryFacade`
- `agent/memory/retrieval/RetrievalRouter` -> 移入 `perception/intent/IntentClassifier`
- `agent/memory/model/RetrievalRoute` -> 移入 `perception/model/Intent`
- `agent/tool/core/SentinelConfig` -> 移入 `aop/`

## 三、迁移阶段(建议 6 阶段)

### 阶段 1:创建新包结构(不破坏现有代码)

- 创建所有新包(空目录)
- 创建 `core/` 统一抽象(AgentContext/AgentResult/AgentIdentity)
- 创建 `harness/common/`,移入 CircuitBreaker/TokenBudget/FallbackChain

### 阶段 2:迁移基础设施

- `llm/` 保持,反思逻辑暂不抽
- `aop/SentinelConfig` 从 `tool/core/` 移入
- `rag/` 保持
- `mcp/` 保持

### 阶段 3:迁移 6 机制(自底向上)

按依赖顺序:
1. `perception/`(机制1)── 新增 PerceptionService + model,拆 RetrievalRouter
2. `memory/`(机制2)── 拆 WorkingMemoryService,合入 profile/,升级 MemoryFacade
3. `runtime/state/`── 从 WorkingMemoryService 抽出状态
4. `context/`── 新增 ContextAssembler(简化版)
5. `planning/`(机制3)── 移入 react/,harness/resilience/ 相关
6. `tool/`(机制4)── 移入 tool/api/,加六分类+沙箱化
7. `reflection/`(机制6)── 从 LlmInvoker/ReActExecutor 抽出反思逻辑

### 阶段 4:迁移编排层

- `orchestration/interviewer/`── 移入 InterviewOrchestrator + Service + LlmService + MQ
- `orchestration/ask/`── QuickAskService 升级为 AskOrchestrator
- `orchestration/harness/`── 移入 ThreeLayerController

### 阶段 5:迁移 guardrail 横切层

- `guardrail/input/`── InputSanitizer 升级
- `guardrail/output/`── OutputMonitor + LeakDetector
- `guardrail/tool/`── ToolPermission
- `guardrail/memory/`── MemoryIsolation + MemoryWriteGuard

### 阶段 6:清理与验证

- 删除旧目录
- 更新所有 import
- 编译验证
- 运行测试
- 端到端验证(面试流程 + 询问流程)

## 四、迁移原则

1. **不破坏现有功能**:每阶段迁移后确保系统可运行
2. **自底向上**:先迁移底层(感知/记忆/工具),再迁移上层(编排/反思)
3. **先移动后重构**:先按原逻辑移动到新位置,再逐步重构
4. **增量验证**:每阶段完成后编译+测试
5. **保持 import 可追踪**:移动文件时记录旧路径->新路径映射

## 五、新增文件清单(第一版需新建)

### 机制1 感知
- PerceptionService, InputFormatValidator, FileValidator, ResourceLimitValidator
- PdfContentParser, ImageContentParser, ToolResultParser
- TextNormalizer, ObservationNormalizer
- IntentClassifier, EntityExtractor
- RawInput, Observation, PerceptionResult, Intent, RiskAssessment, TrustLevel

### 机制2 记忆与状态
- ConversationMemoryService, ConversationMessage
- WorkingMemory(BO)
- InterviewAgentState, InterviewStage, AgentStateStore
- ContextAssembler, ContextCompressor, TokenBudgetManager
- MemoryWritePolicy, MemoryExpirationPolicy, MemoryDeletionService
- MemoryRanker, MemoryDeduplicator

### 机制3 规划
- GoalTracker(升级), ErrorClassifier(升级), ReplanPolicy, ProductionConstraints
- DriftResult, ErrorType

### 机制4 工具
- ToolErrorClassifier, ToolResultSanitizer
- ToolRiskLevel, ToolErrorType

### 机制5 编排
- AgentOrchestrator(接口), AskOrchestrator, AskService
- AskFallbackController, ProductionConstraints

### 机制6 反思
- ReflectionService, OutputValidator, RepairRetryHandler, CorrectionPromptBuilder
- ReflectionLimitPolicy, ReflectionResult, ErrorCorrection

### 横切 guardrail
- InputGuardrail, PromptInjectionDetector(升级), InputRiskClassifier, SensitiveInputFilter
- OutputSanitizer, LeakDetector
- ToolRiskClassifier, ToolAccessControl
- MemoryIsolation, MemoryWriteGuard

### 横切 aop
- LoggingAspect, AuditAspect, MonitoringAspect

### core
- AgentContext, AgentResult, AgentIdentity
