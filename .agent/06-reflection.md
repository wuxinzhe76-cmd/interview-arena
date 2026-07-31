# 机制 6:反思与自修正(Reflection)

> Agent 不只向外解决问题,还向内自查自检。
> ReAct 是你在做题,Reflection 是你做完后回头检查。

---

## 一、解决什么问题

当前反思机制**分散在两处**,没有统一抽象:
- `LlmInvoker` 的修复重试(结构化输出校验失败 -> 修复指令 -> 重试 1 次)
- `ReActExecutor` 的纠正提示(无 action / 白名单外工具 / 重复调用)

需要:将分散的反思能力收敛到 `reflection/` 包,统一轮次限制。

## 二、两个循环的关系

```
ReAct 主循环(向外):Think -> Act -> Observe -> 循环
    ↑ 每步都在执行,解决外部问题

Reflection 子循环(向内):Review -> Evaluate -> Correct -> Replan
    ↑ 周期性自查,检查自己做得对不对
```

## 三、评估三方面 + 纠错四类

### 评估三方面

| 方面 | 问什么 | 不满足时的动作 | 当前实现 |
|------|--------|---------------|---------|
| 信息完整性 | 我有足够信息吗? | 信息不足 -> 补检索 | ❌ 缺失(后续迭代) |
| 结果准确性 | 我的输出对吗? | 结果有误 -> 修复重试 | ✅ LlmInvoker |
| 路径合理性 | 我走的路对吗? | 路径不对 -> 换工具/重规划 | ✅ ReActExecutor |

### 纠错四类

| 错误类型 | 识别方式 | 纠正方式 | 当前实现 |
|---------|---------|---------|---------|
| 参数错误 | 工具返回参数不合法 | 修正参数,重试同一工具 | ✅ ReActExecutor |
| 工具选错 | 工具返回空或不相关 | 换一个工具 | ✅ ReActExecutor |
| 信息不足 | 结果不够全面 | 补充检索(多调一个工具) | ❌ 缺失(后续) |
| 逻辑错误 | 推理过程有误 | 重新推理,可能重规划 | ❌ 缺失(后续) |

## 四、Java 类设计

```
agent/reflection/
├── ReflectionService.java             # ★ 反思统一入口
├── harness/
│   ├── OutputValidator.java           # 输出校验(从 LlmInvoker 抽出)
│   ├── RepairRetryHandler.java        # 修复重试(从 LlmInvoker 抽出)
│   ├── CorrectionPromptBuilder.java   # 纠正提示构建(从 ReActExecutor 抽出)
│   └── ReflectionLimitPolicy.java     # ★ 反思轮次限制(最多2-3轮)
└── model/
    ├── ReflectionResult.java
    └── ErrorCorrection.java           # 纠错四类枚举
```

## 五、当前反思机制(已有,需整合)

### 反思机制 1:LLM 输出修复(LlmInvoker 中)

```
调 LLM -> 3 层校验(JSON解析 -> Bean Validation -> 业务语义)
    ↓ 失败
生成修复指令(ErrorClassifier 分类错误 + 给出修复建议)
    ↓
带修复指令回罐给 LLM 重试 1 次
    ↓ 仍失败
VALIDATION_FAILED -> 走降级
```

这是 Reflexion 中的 Self-Reflection:告诉模型"你哪里错了,怎么改"。

### 反思机制 2:ReAct 循环中的纠正提示

```
模型输出无 action 且无 final_answer
    -> Observation: "你的输出既没有 action 也没有 final_answer,请二选一"
    (占一步,模型下一轮可以纠正)

模型请求白名单外工具
    -> Observation: "工具 'xxx' 不存在或不可用,可用工具见系统提示词"
    (占一步,模型下一轮换工具)

模型重复调用相同工具相同参数
    -> Observation: "你重复了与上一步完全相同的调用,请基于已有结果给出 final_answer"
    (占一步,模型下一轮换路)
```

这是纠错四类中的工具选错和参数错误的纠正。

## 六、Reflexion 范式(后续迭代)

```
Actor(执行者):执行 ReAct 循环,产出结果
    ↓
Evaluator(评估者):评估结果质量
    ↓
Self-Reflection(自我反思):生成语言化的反思总结
    ↓                  "我错在没考虑边界条件"
Memory(记忆):存储反思经验
    ↓                  下次遇到类似问题时
Actor 下一轮带上反思记忆 -> 避免重复犯错
```

**第一版不实现**完整 Reflexion 范式,保留当前的修复重试 + 纠正提示。

## 七、反思轮次限制

```
- LlmInvoker 修复重试:MAX_REPAIR_RETRIES = 1(已有)
- ReActExecutor 最大步数:MAX_STEPS = 5(已有,含纠正步)
- 反思最多 2-3 轮,不能无限循环(Notion 约束)
- 反思失败后走降级链,不无限重试
```

## 八、当前代码迁移映射

| 当前代码 | 新位置 | 动作 |
|---------|--------|------|
| `LlmInvoker` 中的 `doCallAndValidate` + `validate` | `reflection/harness/OutputValidator` | 抽出校验逻辑 |
| `LlmInvoker` 中的修复重试循环 | `reflection/harness/RepairRetryHandler` | 抽出修复重试 |
| `ReActExecutor` 中的纠正提示 | `reflection/harness/CorrectionPromptBuilder` | 抽出提示构建 |
| `planning/harness/ErrorClassifier` | 复用(反思依赖错误分类) | 不移动,跨包调用 |
| 无 | `reflection/ReflectionService` | 新增统一入口 |
| 无 | `reflection/harness/ReflectionLimitPolicy` | 新增轮次限制 |

**注意**:LlmInvoker 和 ReActExecutor 本身保留在原位置(llm/core/ 和 planning/react/),只是把反思逻辑抽到 reflection/ 包,通过依赖注入调用。

## 九、实现方式选择

| 能力 | 框架/自研 | 说明 |
|------|----------|------|
| 结构化输出校验 | Spring Validation + 自研 | 已有,抽到 reflection/ |
| 修复重试 | 自研 | 已有,抽到 reflection/ |
| 纠正提示 | 自研 | 已有,抽到 reflection/ |
| 反思轮次限制 | 自研 ReflectionLimitPolicy | 新增 |
| Reflexion 范式 | 自研(后续迭代) | 第一版不做 |

## 十、第一版实现程度

### 做

- [x] 保留 LlmInvoker 的修复重试(已有)
- [x] 保留 ReActExecutor 的纠正提示(已有)
- [x] 将反思逻辑抽到 reflection/ 包(OutputValidator/RepairRetryHandler/CorrectionPromptBuilder)
- [x] 统一反思轮次限制(ReflectionLimitPolicy)
- [x] ReflectionService 统一入口

### 不做

- 完整 Reflexion 范式(Actor->Evaluator->Self-Reflection->Memory)
- 信息完整性反思(信息不足->补检索)
- 逻辑错误反思(推理有误->重新推理)
- 反思记忆存储(跨会话学习)

## 十一、调用关系

```
LlmInvoker (llm/core/)
   ↓ 调用 LLM 后
ReflectionService
   ├── OutputValidator         (3层校验:JSON/Bean Validation/业务语义)
   ├── RepairRetryHandler      (修复重试,最多1次)
   └── ReflectionLimitPolicy   (轮次限制)
   ↓
LlmResult

─── ReAct 循环中 ───
ReActExecutor (planning/react/)
   ↓ 模型输出异常时
CorrectionPromptBuilder
   ├── 无action/无final_answer -> 纠正提示
   ├── 白名单外工具 -> 纠正提示
   └── 重复调用 -> 纠正提示
   ↓
Observation (回灌 scratchpad)
```
