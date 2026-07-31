# 机制 3:规划与推理(Planning & Reasoning)

> 推理模式(ReAct)负责"单步怎么想",规划机制负责"多步怎么组织"。
> 面试场景流程确定(start->pick->evaluate->route),不需要复杂 DAG/任务分解,但需要目标漂移防护和错误分类。

---

## 一、解决什么问题

1. **推理**:LLM 如何在单步中思考(评估回答/决定追问/换题/结束)── ReAct
2. **规划**:多步如何组织(确定性步骤代码控制 + 非确定性决策委托 LLM)
3. **目标追踪**:防止 LLM 在多轮对话中忘记原始目标(漂移到知识讲解器)
4. **错误分类**:决定重试/修正/重规划策略

## 二、接收什么、输出什么

### 推理(ReAct)

```
接收                              输出
─────                            ─────
PerceptionResult                  ReActResult {
AgentContext(memory+state)          finalAnswer: Map
工具白名单                           traces: List<ReActTrace>
任务描述                             success: boolean
                                  }
```

### 目标追踪

```
接收                              输出
─────                            ─────
用户输入                          DriftResult {
当前目标                            isDrift: boolean
                                  violationCount: int
                                  action: WARN/FORCE_NEXT_QUESTION
                                }
```

### 错误分类

```
接收                              输出
─────                            ─────
Exception                        ErrorType {
                                  type: TRANSIENT/SEMANTIC/STRUCTURAL
                                  fixInstructions: String
                                }
```

## 三、Java 类设计

### 机制层与应用层分离

```
agent/planning/
├── react/                               # ★ 机制层:Agent 运行时推理
│   ├── ReActExecutor.java               # ReAct 循环(已有,从 react/ 移入)
│   ├── ReActRequest.java                # (已有)
│   ├── ReActResult.java                 # (已有)
│   ├── ReActStep.java                   # (已有)
│   └── ReActTrace.java                  # (已有)
├── harness/                             # ★ 机制层:规划防护
│   ├── GoalTracker.java                 # 升级自 GoalDriftDetector(第一版保持正则)
│   ├── ErrorClassifier.java             # 升级自 StructuredErrorHandler(三分类)
│   ├── LoopDetector.java                # 循环检测(从 harness/resilience/ 移入)
│   ├── ReplanPolicy.java                # 重规划策略(重试>修正>重规划>降级>人工)
│   └── ProductionConstraints.java       # 生产约束(max_iterations/timeout/budget)
├── application/                         # ★ 应用层:基于规划思想的具体应用
│   └── LearningPathPlanner.java         # 学习路径规划(从 learning/ 移入,重命名)
└── model/
    ├── DriftResult.java
    └── ErrorType.java                   # TRANSIENT/SEMANTIC/STRUCTURAL
```

### 跨机制共享(放 harness/common/)

```
agent/harness/common/
├── CircuitBreaker.java        # 跨机制共享(工具+LLM)
├── TokenBudget.java           # 跨机制共享(感知+规划+工具)
└── FallbackChain.java         # 跨机制共享
```

## 四、职责分离边界

| 层 | 职责 | 调用方 | 调用时机 |
|----|------|--------|---------|
| `planning/react/` | Agent 运行时推理(ReAct 循环) | Orchestrator | 面试中,每轮 |
| `planning/harness/` | 规划防护(漂移/错误/循环) | Orchestrator + ReActExecutor | 面试中,防护 |
| `planning/application/` | 规划思想的应用(学习路径生成) | 面试报告生成 | 面试后,后置 |

三者共享"规划"概念,但调用时机和场景不同,互不干扰。

## 五、Harness 在这一层增强什么

### 增强 1:目标追踪与漂移检测(L5)

当前 `GoalDriftDetector` 用正则检测(用户在"提问"而非"回答"):
- 疑问词开头:什么是/为什么/怎么/请问
- 请求讲解:给我讲讲/帮我解释/详细说说
- 疑问句:5-30字 + 问号结尾

**第一版**:保持正则检测(零成本,<1ms,确定性)
**后续升级**:向量相似度 `drift_score = 1 - cosine_similarity(goal_embedding, action_embedding)`,阈值 0.6 触发

### 增强 2:错误分类与重规划决策(L4)

```
错误三分类                    重规划策略
──────────                   ─────────
TRANSIENT(瞬态:网络/限流)  -> 重试,不重规划
SEMANTIC(语义:参数错误)    -> 修正参数,不重规划
STRUCTURAL(结构:工具不存在) -> 重规划

优先级:重试 > 修正参数 > 重规划 > 降级 > 人工接管
```

当前 `StructuredErrorHandler` 已实现三分类,保留并重命名为 `ErrorClassifier`。

### 增强 3:循环检测(L5)

- 连续相同操作(maxSameAction=3)
- 最大轮次(maxRounds=10)
- Ping-Pong 检测

### 增强 4:生产约束

| 约束 | 当前值 | 说明 |
|------|--------|------|
| max_iterations | 5 (MAX_STEPS) | ReAct 最大步数 |
| token_budget | 100k/20k/5k | TokenBudget(已有) |
| replan_limit | 1 | 修复重试次数(已有 MAX_REPAIR_RETRIES) |
| step_timeout | - | 第一版不加 |
| global_timeout | - | 第一版不加 |

### 不做(面试场景不需要)

- **TDP 框架**(任务解耦):面试流程不复杂,无需 scoped context
- **ATG**(原子任务图):面试是顺序流程,无需递归分解
- **DAG 并行**:面试是顺序问答,无需并行子任务
- **动态重规划**:面试流程固定,ThreeLayerController 兜底足够

## 六、当前代码迁移映射

| 当前代码 | 新位置 | 动作 |
|---------|--------|------|
| `react/ReActExecutor` + 4 个模型类 | `planning/react/` | 整体移动 |
| `harness/resilience/GoalDriftDetector` | `planning/harness/GoalTracker` | 移动 + 重命名(第一版保持正则) |
| `harness/resilience/StructuredErrorHandler` | `planning/harness/ErrorClassifier` | 移动 + 重命名 |
| `harness/resilience/LoopDetector` | `planning/harness/LoopDetector` | 移动 |
| `harness/resilience/CircuitBreaker` | `harness/common/CircuitBreaker` | 移动(跨机制共享) |
| `harness/resilience/TokenBudget` | `harness/common/TokenBudget` | 移动(跨机制共享) |
| `harness/resilience/FallbackChain` | `harness/common/FallbackChain` | 移动(跨机制共享) |
| `learning/LearningPathService` | `planning/application/LearningPathPlanner` | 移动 + 重命名 |
| `orchestrator/ThreeLayerController` | `orchestration/harness/` | 留在编排层(机制5) |

## 七、实现方式选择

| 能力 | 框架/自研 | 说明 |
|------|----------|------|
| ReAct 循环 | 自研 | 已实现,保留 |
| 目标漂移检测 | 自研(正则) | 第一版保持,后续升级向量 |
| 错误分类 | 自研(三分类) | 已实现,保留 |
| 循环检测 | 自研 | 已实现,保留 |
| 重试/退避 | 自研(指数退避) | 已在 LlmInvoker 实现 |
| 熔断器 | 自研 | 跨机制共享,放 harness/common/ |
| Token 预算 | 自研 | 跨机制共享,放 harness/common/ |
| 学习路径生成 | Spring AI ChatClient + 自研 | LLM 生成结构化路径 |

## 八、第一版实现程度

### 做

- [x] ReActExecutor(已有,从 react/ 移入 planning/react/)
- [x] GoalTracker(升级自 GoalDriftDetector,第一版保持正则)
- [x] ErrorClassifier(升级自 StructuredErrorHandler,三分类)
- [x] LoopDetector(从 harness/resilience/ 移入)
- [x] 生产约束(MAX_STEPS=5 + TokenBudget)
- [x] CircuitBreaker/TokenBudget/FallbackChain 移入 harness/common/
- [x] LearningPathPlanner 移入 planning/application/

### 不做

- TDP 框架(任务解耦)
- ATG(原子任务图)
- DAG 并行执行
- 动态重规划
- 向量相似度漂移检测(后续升级)

## 九、调用关系

```
Orchestrator(编排层)
   ↓
Planning Harness(规划防护)
   ├── GoalTracker       (目标漂移检测,正则)
   ├── LoopDetector      (循环检测)
   └── ErrorClassifier   (错误三分类)
   ↓
ReActExecutor(推理循环)
   ├── LlmInvoker        (调 LLM,含熔断/预算)
   ├── ToolExecutor      (执行工具,含限流/权限)
   └── PromptManager     (Prompt 管理)
   ↓
ReActResult
   ↓
Orchestrator(路由决策)

─── 面试后置(独立链路) ───
InterviewReportConsumer
   ↓
LearningPathPlanner(学习路径规划)
   ├── SemanticMemoryService (取薄弱点)
   ├── QuestionMapper        (检索相关题目)
   └── ChatClient            (LLM 生成路径)
   ↓
学习路径 Markdown
```
