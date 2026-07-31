# 机制 5:编排与调度(Orchestration)

> Orchestrator 是 Agent 的中枢神经,协调 Model + Tools + Memory 三者交互。
> **核心价值**:把流程控制权从模型手里拿回到代码手里。确定性步骤代码控制,非确定性决策委托 LLM。

---

## 一、解决什么问题

当前最大问题:**两个 Agent 编排模式不一致**
- 面试 Agent:有专门 `InterviewOrchestrator`(10 步编排)
- 询问助手:**没有 Orchestrator**,编排逻辑塞在 `QuickAskService` 里

需要:统一 Orchestrator 抽象,让两个 Agent 编排模式对齐。

## 二、核心职责

### 职责 1:控制流管理

| 模式 | 本项目使用场景 |
|------|---------------|
| **状态机** | 面试流程:创建->提问->等待回答->评价->追问/换题/结束 |
| **循环** | ReAct 循环:while (step <= MAX_STEPS && !hasFinalAnswer) |
| DAG | 第一版不需要(面试顺序流程,询问也是顺序) |

### 职责 2:单 Agent 结构(不需要多 Agent 拓扑)

```
面试官 Agent          询问助手 Agent
(单独运行)            (单独运行)
  └── ReAct            └── ReAct
  └── 3 工具            └── 3 工具
  └── 三层控制          └── 降级链路
```

不需要 Supervisor/Hierarchical/Peer/Swarm 多 Agent 拓扑。

### 职责 3:生产约束四重

| 约束 | 实现 | 当前值 |
|------|------|--------|
| 轮次熔断 | ThreeLayerController + ReAct MAX_STEPS | 单题3轮/总10轮/ReAct 5步 |
| 超时控制 | CompletableFuture.get(timeout) | 60s(PDF报告) |
| 权限规则 | ToolPermission | READ/WRITE/EXECUTE/CRITICAL |
| 成本限流 | TokenBudget + Sentinel | 100k/20k/5k + QPS限流 |

## 三、Orchestrator 与 ReAct 的关系

```
Orchestrator(编排层)
├── 确定性步骤:代码控制(记忆写入、轮次推进、护栏检查)
├── 非确定性决策:委托给 ReAct 循环(评估回答、追问/换题)
│   └── ReActExecutor(MAX_STEPS=5)
│       ├── Step 1: Think -> Act(pickQuestion) -> Observe
│       ├── Step 2: Think -> Act(getQuestionDetail) -> Observe
│       └── Step 3: Think -> final_answer
└── 生产约束:ThreeLayerController(状态机兜底)
```

**关键设计原则**:模型不能自己决定终止。Orchestrator 用代码强制:到 maxRounds 就结束,到 maxQuestionRounds 就换题。

## 四、Java 类设计

```
agent/orchestration/
├── api/
│   └── AgentOrchestrator.java            # ★ 统一 Orchestrator 接口
├── interviewer/                          # 面试官 Agent 编排
│   ├── InterviewOrchestrator.java        # (已有,从 orchestrator/ 移入)
│   ├── InterviewService.java             # 薄层接口(已有)
│   ├── InterviewServiceImpl.java         # 薄层实现(已有)
│   ├── InterviewLlmService.java          # 面试话术生成(已有)
│   ├── PdfReportService.java             # PDF 报告(已有)
│   ├── InterviewReportProducer.java      # MQ 生产者(从 mq/ 移入)
│   └── InterviewReportConsumer.java      # MQ 消费者(从 mq/ 移入)
├── ask/                                  # 询问助手 Agent 编排
│   ├── AskOrchestrator.java              # ★ 新增(从 QuickAskService 升级)
│   ├── AskService.java                   # ★ 薄层(新增)
│   └── AgenticRagService.java            # Agentic RAG(从 service/ 移入)
└── harness/                              # 编排层防护
    ├── ThreeLayerController.java         # 三层控制(已有,面试专用)
    ├── AskFallbackController.java        # ★ 询问助手降级控制(新增)
    └── ProductionConstraints.java        # 生产约束统一管理
```

### 统一 Orchestrator 接口

```java
public interface AgentOrchestrator {
    OrchestratorResult orchestrate(OrchestratorRequest request);
}
```

## 五、面试 Orchestrator(已有,10 步编排)

```
1. 输入清洗(InputSanitizer)           ← 代码控制
2. 目标漂移检测(GoalTracker)           ← 代码控制
3. 记忆写入(recordTurn)               ← 代码控制
4. 轮次推进(AgentStateStore)          ← 代码控制
5. 循环检测(LoopDetector)             ← 代码控制
6. ReAct 决策(评估回答/追问/换题/结束) ← 模型决策
7. 答案泄露检测(isAnswerLeaked)        ← 代码控制
8. 输出监控(OutputMonitor)            ← 代码控制
9. 状态对齐(ThreeLayerController)     ← 代码控制
10. 指令路由(DEEP_DIVE/NEXT/END)      ← 代码路由
```

10 步中只有第 6 步是模型决策,其余 9 步都是代码控制。

## 六、询问 Orchestrator(★ 新增,从 QuickAskService 升级)

```
1. 语义缓存查询                        ← 代码控制
2. 意图分类(IntentClassifier)         ← 代码控制(机制1)
3. ReAct 决策(检索策略)               ← 模型决策
4. 工具轨迹提取引用来源                ← 代码控制
5. 缓存写入(未用记忆的答案才共享)     ← 代码控制
6. 降级链路(ReAct失败时)              ← 代码控制
```

## 七、ThreeLayerController(面试专用)

```
AI 返回 action_directive
       │
 ┌─────▼─────┐
 │ 代码兜底 1 │  单题追问 > 3 轮?
 │ 强制换题   │  是 -> NEXT_QUESTION(覆盖 AI 指令)
 └─────┬─────┘  否 -> 保持 AI 指令
       │
 ┌─────▼─────┐
 │ 代码兜底 2 │  总轮次 >= 10?
 │ 强制结束   │  是 -> END_INTERVIEW(覆盖 AI 指令)
 └─────┬─────┘  否 -> 保持 AI 指令
       │
 ┌─────▼─────┐
 │ 最终路由   │  DEEP_DIVE / NEXT_QUESTION / END_INTERVIEW
 └───────────┘
```

询问助手不需要三层控制(没有"换题"概念),但有降级链路(ReAct 失败时走确定性管道)。

## 八、当前代码迁移映射

| 当前代码 | 新位置 | 动作 |
|---------|--------|------|
| `orchestrator/InterviewOrchestrator` | `orchestration/interviewer/InterviewOrchestrator` | 移动 |
| `orchestrator/ThreeLayerController` | `orchestration/harness/ThreeLayerController` | 移动 |
| `service/QuickAskService` | `orchestration/ask/AskOrchestrator` | 升级为 Orchestrator |
| `service/InterviewService` | `orchestration/interviewer/InterviewService` | 移动(薄层) |
| `service/impl/InterviewServiceImpl` | `orchestration/interviewer/InterviewServiceImpl` | 移动(薄层) |
| `service/InterviewLlmService` | `orchestration/interviewer/InterviewLlmService` | 移动(面试话术) |
| `service/AgenticRagService` | `orchestration/ask/AgenticRagService` | 移动(询问用) |
| `service/PdfReportService` | `orchestration/interviewer/PdfReportService` | 移动(面试报告) |
| `mq/InterviewReportProducer` | `orchestration/interviewer/InterviewReportProducer` | 移入面试编排 |
| `mq/InterviewReportConsumer` | `orchestration/interviewer/InterviewReportConsumer` | 移入面试编排 |
| `mq/InterviewMqConfig` | `orchestration/interviewer/InterviewMqConfig` | 移入面试编排 |
| 无 | `orchestration/api/AgentOrchestrator` | 新增统一接口 |
| 无 | `orchestration/ask/AskOrchestrator` | 新增 |
| 无 | `orchestration/harness/ProductionConstraints` | 新增 |

## 九、实现方式选择

| 能力 | 框架/自研 | 说明 |
|------|----------|------|
| Orchestrator 编排 | 自研 | 已实现面试编排,询问需升级 |
| 状态机(三层控制) | 自研 ThreeLayerController | 已实现 |
| ReAct 循环控制 | 自研 ReActExecutor | 已实现 |
| 降级链路 | 自研 FallbackChain | 已实现 |
| 生产约束 | 自研 + Spring `@Value` | 已有配置 |
| 多 Agent 拓扑 | 不需要 | 单 Agent 结构 |

## 十、第一版实现程度

### 做

- [x] 统一 AgentOrchestrator 接口
- [x] InterviewOrchestrator(已有,移入 orchestration/interviewer/)
- [x] AskOrchestrator(从 QuickAskService 升级)
- [x] ThreeLayerController(已有,移入 orchestration/harness/)
- [x] InterviewLlmService/PdfReportService 移入 orchestration/interviewer/
- [x] MQ 组件移入 orchestration/interviewer/
- [x] AgenticRagService 移入 orchestration/ask/
- [x] InterviewService 薄层保留

### 不做

- DAG 并行执行
- 多 Agent 拓扑(Supervisor/Hierarchical/Peer/Swarm)
- A2A 协议

## 十一、调用关系

```
Controller
   ↓
Service (薄层:参数校验+鉴权+委托)
   ↓
Orchestrator (编排层)
   ├── 确定性步骤(代码控制)
   │   ├── InputSanitizer          (guardrail/input/)
   │   ├── GoalTracker             (planning/harness/)
   │   ├── MemoryFacade            (memory/)
   │   ├── AgentStateStore         (runtime/state/)
   │   ├── LoopDetector            (planning/harness/)
   │   ├── OutputMonitor           (guardrail/output/)
   │   └── ThreeLayerController    (orchestration/harness/)
   │
   ├── 非确定性决策(模型决策)
   │   └── ReActExecutor           (planning/react/)
   │       ├── LlmInvoker          (llm/core/)
   │       └── ToolExecutor        (tool/api/)
   │
   └── 副作用(代码控制)
       ├── InterviewReportProducer (MQ)
       └── MemoryFacade.consolidateInterview
```
