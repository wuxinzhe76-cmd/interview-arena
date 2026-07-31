# 测试策略

> 每层写完后必须进行 Bug 修复和自我检测。
> 对每一步都写一个测试类,通过 Mock 输入和大模型输出来测试该层是否运行正确。

---

## 一、测试原则

1. **每层必测**:每个机制层完成后,立即写测试
2. **Mock 优先**:用 Mockito Mock 外部依赖(LLM/Redis/MySQL/Milvus)
3. **自我检测**:写完代码先自测,再提交
4. **测试类位置**:统一放 `backend/src/test/java/com/charles/interview/arena/agent/`

## 二、测试目录结构

```
backend/src/test/java/com/charles/interview/arena/agent/
├── perception/
│   ├── PerceptionServiceTest.java
│   ├── IntentClassifierTest.java
│   └── PromptInjectionDetectorTest.java
├── memory/
│   ├── MemoryFacadeTest.java
│   ├── ConversationMemoryServiceTest.java
│   └── AgentStateStoreTest.java
├── planning/
│   ├── ReActExecutorTest.java
│   ├── GoalTrackerTest.java
│   └── LoopDetectorTest.java          # 已有,迁移
├── tool/
│   ├── ToolExecutorTest.java
│   ├── ToolErrorClassifierTest.java
│   └── ToolResultSanitizerTest.java
├── orchestration/
│   ├── InterviewOrchestratorTest.java
│   ├── AskOrchestratorTest.java
│   └── ThreeLayerControllerTest.java  # 已有,迁移
├── reflection/
│   ├── OutputValidatorTest.java
│   └── RepairRetryHandlerTest.java
├── guardrail/
│   ├── InputGuardrailTest.java
│   ├── OutputMonitorTest.java         # 已有,迁移
│   └── LeakDetectorTest.java
└── context/
    └── ContextAssemblerTest.java
```

## 三、Mock 策略

### 用 Mockito Mock 外部依赖

```java
@ExtendWith(MockitoExtension.class)
class InterviewOrchestratorTest {

    @Mock
    private ToolExecutor toolExecutor;
    @Mock
    private MemoryFacade memoryFacade;
    @Mock
    private ReActExecutor reActExecutor;
    @Mock
    private AgentStateStore agentStateStore;
    @Mock
    private GoalTracker goalTracker;

    @InjectMocks
    private InterviewOrchestrator orchestrator;

    @Test
    void testStartInterview_Success() {
        // given - Mock 输入
        InterviewStartDTO dto = new InterviewStartDTO();
        dto.setMode(1);
        dto.setBankId(1L);

        // Mock 工具返回
        Question question = new Question();
        question.setId(1L);
        question.setTitle("HashMap 底层原理");
        when(toolExecutor.execute(eq("pickQuestion"), any(ToolInput.class)))
            .thenReturn(ToolResult.success(question));

        // Mock LLM 返回
        AiInterviewResponseDTO aiResp = new AiInterviewResponseDTO();
        aiResp.setReplyToUser("让我们开始讨论 HashMap");
        // ...

        // when - 执行
        InterviewStartVO vo = orchestrator.startInterview(dto, 1L);

        // then - 验证
        assertNotNull(vo.getSessionId());
        assertEquals("让我们开始讨论 HashMap", vo.getOpeningQuestion());
        verify(memoryFacade).rememberTurn(any(), any(), eq("assistant"), any(), any());
    }
}
```

### Mock LLM 输出

```java
@Test
void testReActExecutor_LLMReturnsFinalAnswer() {
    // Mock LLM 返回 final_answer
    LlmResult<ReActStep> llmResult = LlmResult.success(
        new ReActStep("评估回答", null, null, Map.of("answer", "测试答案"))
    );
    when(llmInvoker.invoke(any(), any(), eq(ReActStep.class)))
        .thenReturn(llmResult);

    ReActResult result = reActExecutor.run(request);

    assertTrue(result.isSuccess());
    assertEquals("测试答案", result.getFinalAnswer().get("answer"));
}
```

### Mock 异常场景

```java
@Test
void testToolExecutor_RateLimitTriggered() {
    // Mock Sentinel 限流
    // 验证返回 ToolResult.failure("系统繁忙")
}

@Test
void testToolExecutor_PermissionDenied() {
    Tool tool = mock(Tool.class);
    when(tool.getPermissionLevel()).thenReturn(ToolPermission.Level.CRITICAL);

    ToolResult result = toolExecutor.execute("dangerousTool", input);

    assertFalse(result.isSuccess());
    assertTrue(result.getErrorMessage().contains("CRITICAL"));
}
```

## 四、每层测试要求

### 机制1:感知层

| 测试类 | 测试点 |
|--------|--------|
| PerceptionServiceTest | 7步管线完整流程 |
| IntentClassifierTest | 规则匹配 + LLM 兜底 |
| PromptInjectionDetectorTest | 12种注入模式检测 |
| InputFormatValidatorTest | 空输入/超长/格式错误 |

### 机制2:记忆与状态

| 测试类 | 测试点 |
|--------|--------|
| MemoryFacadeTest | loadForInterview/recordTurn/consolidateInterview |
| ConversationMemoryServiceTest | 滑动窗口/FIFO淘汰 |
| AgentStateStoreTest | 状态读写/乐观锁/清理 |
| MemoryConsolidationServiceTest | 记忆整合流程 |

### 机制3:规划与推理

| 测试类 | 测试点 |
|--------|--------|
| ReActExecutorTest | 正常循环/超步数/白名单外工具/重复调用 |
| GoalTrackerTest | 正则检测/违规计数/强制换题 |
| LoopDetectorTest | 连续相同/Ping-Pong/最大轮次(已有) |

### 机制4:工具调用

| 测试类 | 测试点 |
|--------|--------|
| ToolExecutorTest | 限流/权限/审计/异常兜底 |
| ToolErrorClassifierTest | 六分类正确性 |
| ToolResultSanitizerTest | 大小限制/脱敏/注入扫描 |
| PickQuestionToolTest | 记忆驱动/随机/排除已用 |

### 机制5:编排与调度

| 测试类 | 测试点 |
|--------|--------|
| InterviewOrchestratorTest | 开始/回答/结束/漂移/循环/强制换题 |
| AskOrchestratorTest | 缓存命中/ReAct成功/降级链路 |
| ThreeLayerControllerTest | 三层控制兜底(已有) |

### 机制6:反思

| 测试类 | 测试点 |
|--------|--------|
| OutputValidatorTest | JSON校验/Bean Validation/业务语义 |
| RepairRetryHandlerTest | 修复重试/超次数降级 |

### 横切:guardrail

| 测试类 | 测试点 |
|--------|--------|
| InputGuardrailTest | 注入检测/敏感信息/脱敏 |
| OutputMonitorTest | 堆栈泄漏/敏感路径/异常模式(已有) |
| LeakDetectorTest | 30字符匹配/答案泄露 |

## 五、自我检测流程

每层写完后执行:

```
1. 编译通过
   ./mvnw compile

2. 运行该层单元测试
   ./mvnw test -Dtest="PerceptionServiceTest,IntentClassifierTest"

3. 检查测试覆盖率
   ./mvnw test -Dtest="PerceptionServiceTest" jacoco:report

4. 手动验证关键路径
   - 检查 Mock 是否覆盖正常/异常/边界场景
   - 检查 verify() 是否验证了副作用

5. 修复发现的 Bug
   - 记录 Bug 原因
   - 修复后重测
   - 确保不引入新问题
```

## 六、测试命名规范

```java
// 方法名:test<被测方法>_<场景>
@Test
void testStartInterview_Success() { ... }

@Test
void testStartInterview_EmptyBank() { ... }

@Test
void testAnswerInterview_DriftDetected() { ... }

@Test
void testToolExecutor_RateLimitTriggered() { ... }
```

## 七、已有测试迁移

| 当前位置 | 新位置 | 动作 |
|---------|--------|------|
| `agent/harness/resilience/LoopDetectorTest` | `agent/planning/LoopDetectorTest` | 迁移 |
| `agent/harness/security/OutputMonitorTest` | `agent/guardrail/OutputMonitorTest` | 迁移 |
| `agent/orchestrator/ThreeLayerControllerTest` | `agent/orchestration/ThreeLayerControllerTest` | 迁移 |

## 八、测试依赖(pom.xml 已有)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<!-- 包含 JUnit 5 + Mockito + AssertJ + Spring Test -->
```
