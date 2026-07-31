# Agent 架构总纲

> 本文档记录 interview-arena 后端 `agent/` 目录重新设计的整体架构决策。
> 详细机制设计见 `01-perception.md` ~ `06-reflection.md`。
> 横切层设计见 `07-guardrail.md`。
> 实现方式选择见 `08-implementation-methods.md`。

---

## 一、设计原则

1. **机制与 Harness 分层**:Agent 机制负责核心能力,Harness 工程层负责工程化增强。Harness 作为子包内嵌在各机制下。
2. **安全是横切关注点**:安全护栏(guardrail)不作为独立机制,而是贯穿所有机制的横切能力,在各机制中设置执行点。
3. **Memory / State / Context 三者分离**:Memory 管过去,State 管当前进度,Context 管这一轮给模型看什么。
4. **感知与编排分离**:感知层识别意图(IntentClassifier),编排层决定路由(RouteDispatcher)。
5. **能用框架就用框架**:Spring AI Advisor / Spring AOP / Spring Validation / MCP Starter 优先;业务特定逻辑自研。

## 二、6 机制 + 横切层

```
agent/
├── core/                    # 统一抽象(AgentContext/AgentResult/AgentIdentity)
├── perception/              # 机制1:感知与输入
├── memory/                  # 机制2:记忆(管过去)
├── runtime/state/           # 机制2续:状态(管当前进度,独立于 memory)
├── context/                 # 机制2续:ContextAssembler(Memory+State -> AgentContext)
├── planning/                # 机制3:规划与推理
├── tool/                    # 机制4:工具调用
├── orchestration/           # 机制5:编排与调度
├── reflection/              # 机制6:反思与自修正
├── guardrail/               # 横切:安全护栏(input/output/tool/memory)
├── llm/                     # LLM 基础设施(含 Prompt Cache)
├── aop/                     # 横切:AOP(日志/审计/限流/监控)
├── mcp/                     # MCP 协议层
├── mq/                      # 消息队列
└── controller/              # HTTP 入口
```

## 三、关键边界

| 边界 | 原则 |
|------|------|
| Memory vs State | Memory 放 `memory/`,State 放 `runtime/state/`。State 是流程控制权威依据,不只是给模型看的记忆 |
| Memory vs Context | Memory 提供候选,ContextAssembler 组装。Context 是临时视图,不持久化 |
| Perception vs Orchestration | 感知识别意图(IntentClassifier),编排决定路由(RouteDispatcher) |
| Safety vs Mechanism | 安全规则集中 `guardrail/`,各机制按需调用。纵深防御 |
| Prompt Cache vs Memory | Cache 放 `llm/cache/`。优化前缀重复计算,不替代对话记忆 |
| Harness 与机制 | 机制特定 harness 跟机制走(子包);跨机制共享放 `harness/common/`;AOP 横切放 `aop/` |

## 四、Harness 抽取策略(混合)

| harness 类型 | 抽取方式 | 示例 |
|---|---|---|
| 机制特定 harness | 跟机制走(子包) | perception/harness/、planning/harness/ |
| 跨机制共享 harness | 统一 harness/common/ | CircuitBreaker、TokenBudget |
| AOP 横切 harness | 独立 aop/ 包 | 日志、审计、限流、监控 |
| Spring AI Advisor | 跟 llm/ 或 memory/ 走 | MessageChatMemoryAdvisor、SummaryAdvisor |

## 五、实现方式选择原则

1. **能用框架就用框架**:Spring AI Advisor(记忆/RAG) / Spring AOP(横切) / Spring Validation(校验) / MCP Starter
2. **业务特定必须自研**:熔断 / 预算 / 漂移 / 循环 / 错误分类 / Prompt 管理 / 注入检测
3. **横切关注点用 AOP**:日志 / 审计 / 限流 / 监控 - 不侵入业务代码

详见 `08-implementation-methods.md`。

## 六、推进方式

逐机制讨论,每个机制分析五件事:
1. 这一层解决什么问题
2. 这一层接收什么、输出什么
3. 应该有哪些 Java 类
4. Harness 在这一层增强什么
5. 项目第一版需要实现到什么程度

确认后写入对应 `0N-<mechanism>.md`,最后汇总迁移。
