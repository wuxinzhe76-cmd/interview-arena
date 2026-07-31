# .agent 索引(渐进式披露入口)

> **Trae Agent 必读**:本文件是 .agent 目录的入口。
> 采用**渐进式披露**原则:先看目录结构,需要修改时再查看详细内容。

---

## 一、如何使用本目录

1. **第一次**:读完本 INDEX,了解整体架构和文档分布
2. **实现某层时**:只读该层对应的 `0N-<mechanism>.md` 详细文档
3. **写代码前**:读 `10-architecture-planning.md` 和 `11-code-conventions.md`
4. **写测试时**:读 `12-testing-strategy.md`
5. **迁移时**:读 `09-migration-plan.md` 的对应阶段
6. **前端修改**:读 `13-frontend-modifications.md`
7. **最终测试**:读 `14-final-testing.md`

**不要一次性读完所有文档**,按需加载,节省上下文。

---

## 二、文档清单

### 架构设计(先读)

| 文档 | 内容 | 何时读 |
|------|------|--------|
| `00-architecture-overview.md` | 总纲:6机制+横切层+边界原则 | 第一次 |
| `10-architecture-planning.md` | 项目架构规划设计(技术选型/数据流/部署) | 写代码前 |

### 6 机制详细设计(按需读)

| 文档 | 机制 | 何时读 |
|------|------|--------|
| `01-perception.md` | 机制1:感知与输入 | 实现感知层时 |
| `02-memory-state.md` | 机制2:记忆与状态 | 实现记忆/状态时 |
| `03-planning.md` | 机制3:规划与推理 | 实现规划/ReAct 时 |
| `04-tool.md` | 机制4:工具调用 | 实现工具层时 |
| `05-orchestration.md` | 机制5:编排与调度 | 实现编排层时 |
| `06-reflection.md` | 机制6:反思与自修正 | 实现反思层时 |

### 横切层(按需读)

| 文档 | 内容 | 何时读 |
|------|------|--------|
| `07-guardrail.md` | 安全护栏(贯穿6机制) | 实现安全相关时 |
| `08-implementation-methods.md` | 框架vs自研选择表 | 选型时 |

### 工程规范(必读)

| 文档 | 内容 | 何时读 |
|------|------|--------|
| `11-code-conventions.md` | 代码规约(阿里规范+六大设计原则) | 写代码前 |
| `12-testing-strategy.md` | 测试策略(每层Mock测试) | 写测试时 |

### 执行计划(按需读)

| 文档 | 内容 | 何时读 |
|------|------|--------|
| `09-migration-plan.md` | 迁移计划(6阶段+完整目录结构) | 迁移时 |
| `13-frontend-modifications.md` | 前端修改规划 | 改前端时 |
| `14-final-testing.md` | 最终测试与联调计划 | 最终测试时 |

---

## 三、新目录结构速览(完整版见 09-migration-plan.md)

```
agent/
├── core/                # 统一抽象
├── perception/          # 机制1:感知与输入
├── memory/              # 机制2:记忆(管过去)
├── runtime/state/       # 机制2续:状态(管当前进度)
├── context/             # 机制2续:ContextAssembler
├── planning/            # 机制3:规划与推理
├── tool/                # 机制4:工具调用
├── orchestration/       # 机制5:编排与调度
├── reflection/          # 机制6:反思与自修正
├── guardrail/           # 横切:安全护栏
├── llm/                 # LLM 基础设施
├── harness/common/      # 跨机制共享 Harness
├── aop/                 # 横切 AOP
├── mcp/                 # MCP 协议
├── rag/                 # RAG 基础设施
└── controller/          # HTTP 入口
```

---

## 四、核心原则速查

1. **6机制+横切层**:感知/记忆/规划/工具/编排/反思 + guardrail
2. **Memory/State/Context 三分离**
3. **安全是横切关注点**,不作为第七机制
4. **Harness 混合抽取**:机制特定跟机制走,共享放 harness/common/,AOP 横切放 aop/
5. **两个 Agent 编排对齐**:统一 AgentOrchestrator 接口
6. **阿里规范+六大设计原则**
7. **每层写完必测试**:Mock 输入+大模型输出,测试类放 backend/src/test
