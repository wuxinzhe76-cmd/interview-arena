# 代码规约

> 所有代码必须符合阿里巴巴 Java 开发规范,遵循六大设计原则。

---

## 一、阿里巴巴代码规范要点

### 1. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | UpperCamelCase | `InterviewOrchestrator` |
| 方法名 | lowerCamelCase | `startInterview` |
| 变量名 | lowerCamelCase | `sessionId` |
| 常量 | UPPER_SNAKE_CASE | `MAX_STEPS` |
| 包名 | 全小写 | `com.charles.interview.arena.agent` |
| 枚举 | UpperCamelCase | `ActionDirectiveEnum` |
| 接口 | 不加 `I` 前缀 | `Tool`(不是 `ITool`) |
| 实现类 | `XxxImpl` 或 `XxxService` | `InterviewServiceImpl` |
| 抽象类 | `AbstractXxx` | `AbstractLlmTool` |
| 异常类 | `XxxException` | `BusinessException` |
| 测试类 | `XxxTest` | `LoopDetectorTest` |
| Boolean 变量 | 不加 `is` 前缀 | `success`(不是 `isSuccess`) |

### 2. 格式规范

- 缩进:4 个空格(不用 Tab)
- 行宽:120 字符
- 大括号:K&R 风格(左括号不换行)
- import:按 `java.*` -> `javax.*` -> `org.*` -> `com.*` 分组
- 注解:一个注解一行
- 方法间空一行

### 3. OOP 规范

- **禁止使用过时的方法**:标注 `@Deprecated` 并给出替代方案
- **equals 方法**:常量在前 `"".equals(str)` 而非 `str.equals("")`
- **包装类比较**:用 `equals()` 不用 `==`
- **构造方法禁止业务逻辑**:复杂逻辑放 `@PostConstruct`
- **POJO 类禁止默认值**:必须用包装类型(Integer 不用 int)
- **toString 方法**:POJO 类必须实现,用于日志
- **final 关键字**:不可变类/方法/变量用 `final`

### 4. 集合规范

- **空集合返回**:返回空集合而非 `null` `return Collections.emptyList()`
- **ArrayList vs LinkedList**:随机访问用 ArrayList,频繁插入用 LinkedList
- **HashMap 初始化**:指定初始容量 `new HashMap<>(expectedSize / 0.75 + 1)`
- **foreach 不修改集合**:遍历时修改用 Iterator

### 5. 并发规范

- **线程创建**:用线程池,禁止 `new Thread()`
- **SimpleDateFormat**:线程不安全,用 `DateTimeFormatter`
- **HashMap**:多线程用 `ConcurrentHashMap`
- **synchronized**:选择合适锁粒度,优先用 `ReentrantLock`

### 6. 异常规范

- **捕获异常**:不要捕获 `Exception`,捕获具体异常
- **异常处理**:不要空 catch,至少记日志
- **业务异常**:用 `BusinessException` + `ErrorCode`
- **异常链**:保留 cause `throw new XxxException("msg", e)`

### 7. 日志规范

- **日志框架**:SLF4J + Lombok `@Slf4j`
- **日志级别**:
  - ERROR:系统异常/数据丢失
  - WARN:业务异常/降级
  - INFO:关键流程/状态变更
  - DEBUG:调试信息
- **占位符**:用 `{}` 不用字符串拼接 `log.info("sessionId={}", sessionId)`
- **敏感信息**:日志中禁止打印密码/Token

---

## 二、六大设计原则(SOLID)

### 1. 单一职责原则(Single Responsibility Principle, SRP)

**一个类/方法只做一件事**。

```java
// ✅ 好:ToolExecutor 只负责工具执行
public class ToolExecutor {
    public ToolResult execute(String toolName, ToolInput input) { ... }
}

// ❌ 坏:一个类既做执行又做注册又做权限
public class ToolManager {
    public void register(Tool tool) { ... }
    public ToolResult execute(String name, ToolInput input) { ... }
    public boolean checkPermission(Tool tool) { ... }
}
```

**项目应用**:
- `MemoryFacade` 只负责记忆调度,不负责上下文组装(那是 `ContextAssembler`)
- `AgentStateStore` 只负责状态存储,不负责记忆
- `GoalTracker` 只负责漂移检测,不负责循环检测(那是 `LoopDetector`)

### 2. 开闭原则(Open-Closed Principle, OCP)

**对扩展开放,对修改关闭**。新增工具/策略时不修改已有代码。

```java
// ✅ 好:新增工具只需实现 Tool 接口,ToolExecutor 不改
public class NewTool implements Tool {
    @Override
    public ToolResult execute(ToolInput input) { ... }
}

// ToolExecutor 通过 ToolRegistry 自动发现新工具,无需修改
```

**项目应用**:
- 新增工具:实现 `Tool` 接口,`@Component` 自动注册
- 新增 Harness 增强:实现接口,不修改已有类
- Prompt 管理:YAML 配置,不改代码

### 3. 里氏替换原则(Liskov Substitution Principle, LSP)

**子类必须能替换父类**。

```java
// ✅ 好:所有 Tool 实现都能替换 Tool 接口
Tool tool = new PickQuestionTool(); // 任何 Tool 实现都行
ToolResult result = tool.execute(input); // 行为一致
```

### 4. 接口隔离原则(Interface Segregation Principle, ISP)

**客户端不应依赖它不需要的接口**。

```java
// ✅ 好:MemoryFacade 只暴露用例级方法
public interface MemoryFacade {
    MemorySnapshot loadForInterview(Long userId, Long sessionId, String topic);
    void recordTurn(Long sessionId, InterviewTurn turn);
    void consolidateInterview(Long userId, InterviewSummary summary);
}

// ❌ 坏:把所有 Redis/MySQL/Milvus 操作都暴露
public interface MemoryFacade {
    void redisPush(String key, String value);
    List<String> redisGetRange(String key, int start, int end);
    void mysqlInsert(InterviewRecord record);
    List<Float> milvusSearch(float[] vector);
    // ... 几十个方法,调用方不需要知道这些
}
```

### 5. 依赖倒置原则(Dependency Inversion Principle, DIP)

**依赖抽象,不依赖具体**。

```java
// ✅ 好:Orchestrator 依赖接口,不依赖具体实现
public class InterviewOrchestrator {
    private final ToolExecutor toolExecutor;        // 接口
    private final MemoryFacade memoryFacade;        // 接口
    private final ReActExecutor reActExecutor;      // 具体类(但通过构造注入)
}

// Spring DI 自动注入,Spring AI ChatClient 也是抽象
```

### 6. 迪米特法则(Law of Demeter, LoD)

**最少知识原则,只与直接朋友通信**。

```java
// ✅ 好:Orchestrator 只调 MemoryFacade,不直接调 Redis/MySQL
public class InterviewOrchestrator {
    private final MemoryFacade memoryFacade; // 直接朋友
    
    public void answerInterview() {
        memoryFacade.recordTurn(sessionId, turn); // 只与 MemoryFacade 通信
        // ❌ 不应该:memoryFacade.getWorkingMemoryService().getRedisTemplate().opsForList()...
    }
}
```

---

## 三、项目特定规范

### 1. 包结构规范

- 每个机制包下分 `api/`(接口) + `impl/`(实现) + `harness/`(增强) + `model/`(模型)
- 跨机制共享放 `harness/common/`
- 横切关注点放 `aop/`

### 2. Record 使用(Java 21)

数据传输用 `record`,不可变且简洁:

```java
public record PerceptionResult(
    List<Observation> observations,
    Intent intent,
    Map<String, Object> entities,
    RiskAssessment riskAssessment,
    TrustLevel trustLevel
) {}
```

### 3. Lombok 使用

- `@Data`:POJO 类
- `@Slf4j`:需要日志的类
- `@RequiredArgsConstructor`:依赖注入(final 字段)
- `@Builder`:复杂对象构建

### 4. Spring AI 使用

- LLM 调用用 `ChatClient.prompt().system().user().call().entity()`
- 结构化输出用 `.entity(DTO.class)` 自动反序列化
- 参数注入用 `.text().param()` 原生注入(防注入)

### 5. 异常处理

- 业务异常:`ThrowUtils.throwIf(condition, ErrorCode, message)`
- 全局异常:`GlobalExceptionHandler` 捕获并转 `BaseResponse`
- 工具异常:`ToolResult.failure(message)`,不向上抛

### 6. 注释规范

- 类注释:说明职责 + 关联蓝图章节 + 设计参考
- 方法注释:说明做什么 + 参数 + 返回值 + 异常
- 关键逻辑:行内注释说明 why(不是 what)
- TODO:`// TODO: 描述 + 负责人 + 日期`
