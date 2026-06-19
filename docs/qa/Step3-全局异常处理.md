# Step 3 · 全局异常处理 · 问答归档

> 📅 日期：2026-06-17
> 🎯 阶段：Step 3 · GlobalExceptionHandler + BusinessException + ThrowUtils

---

## 涉及代码

- [`BusinessException.java`](../interview-arena-backend/src/main/java/com/charles/interview/arena/exception/BusinessException.java)
- [`ThrowUtils.java`](../interview-arena-backend/src/main/java/com/charles/interview/arena/exception/ThrowUtils.java)
- [`GlobalExceptionHandler.java`](../interview-arena-backend/src/main/java/com/charles/interview/arena/exception/GlobalExceptionHandler.java)

---

## Q1：为什么 BusinessException 继承 RuntimeException 而不是 Exception？

### 基础分类

```
Throwable
  ├── Error            ← 系统级错误(JVM 挂了),程序无法恢复
  └── Exception
       ├── 受检异常      ← 编译器强制处理(IOException/SQLException)
       └── RuntimeException ← 非受检异常,运行时才暴露
```

### 核心理由（Spring 项目最关键的一条）

**Spring `@Transactional` 默认只在抛出 `RuntimeException` 或 `Error` 时回滚事务**，抛出受检 `Exception` **不回滚**！

```java
@Service
public class UserService {
    @Transactional
    public void register(User user) {
        userMapper.insert(user);
        if (exists) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR);  // ✅ RuntimeException → 回滚
        }
        // 如果 BusinessException 继承 Exception:
        // throw new BusinessException(...);  → ❌ 不回滚!数据库已经写进去了
    }
}
```

如果要强制受检异常也回滚：

```java
@Transactional(rollbackFor = Exception.class)
```

### 其他理由

| 理由 | 说明 |
|------|------|
| 避免签名污染 | 受检异常强制 `throws` 声明，100 个 Service 方法要写 100 遍 |
| 业务异常是"预期内的失败" | 不是 bug，不该让编译器强制处理 |
| 与 Spring/JDK 设计一致 | `IllegalArgumentException` / `NullPointerException` 全是 RuntimeException |

**结论**：Spring 生态下的业务异常约定就是 `RuntimeException`，这是阿里、美团、京东等大厂内部规范的共识。

---

## Q2：BusinessException 构造器要不要调 super(message)？

### 字段遮蔽问题

```java
// ❌ 错误写法：字段遮蔽
public class BusinessException extends RuntimeException {
    private final String message;   // 遮蔽了 Throwable.detailMessage
}
```

**问题**：

- 父类 `Throwable` 内部有 `private String detailMessage` 字段，通过 `getMessage()` 访问
- 你重新定义 `message` 字段会**遮蔽**父类字段
- 没调 `super(message)` → 父类 `detailMessage` 永远是 `null`
- `@Getter` 生成的 `getMessage()` 覆盖了父类的，虽然能工作，但：
  - 某些库（Dubbo/gRPC）直接反射读 `detailMessage` → 拿到 null
  - `Throwable` 序列化时 `detailMessage` 字段是 null

### 正确写法

```java
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());    // ✅ 调 super,父类 detailMessage 被正确赋值
        this.code = errorCode.getCode();
    }
}
```

**结论**：调 `super(message)` 是**最标准、最安全**的写法。Java 所有自定义异常都这么写。

---

## Q3：GlobalExceptionHandler 的执行流程

### 工作流程

```
1. 任意层(Service/Controller)抛出 BusinessException
      ↓ (异常沿调用栈冒泡)
2. Controller 方法没有 catch,异常继续冒泡
      ↓
3. Spring DispatcherServlet 捕获异常   ← ★ 拦截发生在这里
      ↓
4. @RestControllerAdvice 接管
      ↓
5. 按异常类型匹配 @ExceptionHandler:
   ① BusinessException        → handleBusinessException()
   ② MethodArgumentNotValidEx → handleMethodArgumentNotValid()
   ③ 其他 Exception           → handleException()(兜底)
      ↓
6. handler 返回 BaseResponse → Spring 序列化为 JSON → 前端
```

### 关键点

- 异常可以在 **Service 层**抛出，不一定要在 Controller 抛
- 只要异常最终冒泡到 `DispatcherServlet`，`@RestControllerAdvice` 都能捕获
- Spring 按异常类型**精确度匹配**：`BusinessException` 优先匹配专属 handler，匹配不到才走 `Exception` 兜底

---

## Q4：Stream 链式调用执行过程

### 代码

```java
String message = e.getBindingResult()       // ①
                  .getFieldErrors()         // ②
                  .stream()                 // ③
                  .findFirst()              // ④
                  .map(FieldError::getDefaultMessage)  // ⑤
                  .orElse("参数校验失败");   // ⑥
```

### 逐步数据流转

| 步骤 | 方法 | 返回类型 | 作用 |
|------|------|---------|------|
| ① | `e.getBindingResult()` | `BindingResult` | 拿到校验结果对象 |
| ② | `.getFieldErrors()` | `List<FieldError>` | 拿到所有字段错误列表 |
| ③ | `.stream()` | `Stream<FieldError>` | 把 List 转成 Stream |
| ④ | `.findFirst()` | `Optional<FieldError>` | 取第一个元素 |
| ⑤ | `.map(FieldError::getDefaultMessage)` | `Optional<String>` | 把 FieldError 映射成错误消息 |
| ⑥ | `.orElse("参数校验失败")` | `String` | 有值取值，无值取兜底 |

### 两种链式调用

1. **普通方法链**（①②）：每步返回对象，下一步继续调用
2. **Stream 链**（③④⑤⑥）：Java 8 Stream API，函数式风格

### Stream 的 5 大核心优势

| 优势 | 说明 |
|------|------|
| ① 声明式 | 关注"要什么"而非"怎么做" |
| ② 链式组合 | 每个操作职责单一，像流水线 |
| ③ 懒加载 | 中间操作不立即执行，遇到终端操作才触发 |
| ④ 自动防 NPE | `findFirst()` 等返回 Optional |
| ⑤ 一键并行 | `.parallelStream()` 多核加速 |

### Stream 操作分类

| 类型 | 代表方法 | 特点 |
|------|---------|------|
| 创建 | `stream()` / `parallelStream()` | 把集合变成流 |
| 中间操作 | `filter` / `map` / `sorted` / `distinct` / `limit` | 返回 Stream，懒加载 |
| 终端操作 | `collect` / `findFirst` / `forEach` / `reduce` / `count` | 触发执行，返回非 Stream |

### 拼接所有错误消息的写法

```java
String message = e.getBindingResult()
                  .getFieldErrors()
                  .stream()
                  .map(FieldError::getDefaultMessage)
                  .collect(Collectors.joining("; "));
// 结果: "用户名不能为空; 密码至少6位"
```

---

## Q5：不用 Stream 怎么处理 List？Stream 优势是什么？

### 传统写法 vs Stream

```java
// 传统（命令式）
List<FieldError> fieldErrors = e.getBindingResult().getFieldErrors();
String message;
if (fieldErrors != null && !fieldErrors.isEmpty()) {
    FieldError first = fieldErrors.get(0);
    message = first.getDefaultMessage();
} else {
    message = "参数校验失败";
}

// Stream（声明式）
String message = e.getBindingResult()
                  .getFieldErrors()
                  .stream()
                  .findFirst()
                  .map(FieldError::getDefaultMessage)
                  .orElse("参数校验失败");
```

### 复杂例子对比

需求：从用户列表中筛选成年人姓名，按姓名排序，去重，前 10 个

```java
// 传统写法 ❌ 10 行
List<String> result = new ArrayList<>();
Set<String> seen = new HashSet<>();
for (User user : users) {
    if (user.getAge() >= 18) {
        String name = user.getName();
        if (seen.add(name)) {
            result.add(name);
        }
    }
}
Collections.sort(result);
if (result.size() > 10) {
    result = result.subList(0, 10);
}

// Stream 写法 ✅ 7 行
List<String> result = users.stream()
    .filter(u -> u.getAge() >= 18)
    .map(User::getName)
    .distinct()
    .sorted()
    .limit(10)
    .collect(Collectors.toList());
```

### 什么时候用 Stream？什么时候用 for？

| 场景 | 推荐 | 理由 |
|------|------|------|
| 集合过滤/映射/收集 | ✅ Stream | 声明式更清晰 |
| 分组/统计 | ✅ Stream | `Collectors.groupingBy` 一行搞定 |
| 需要 break/continue | ❌ for | Stream 没有 break 语义 |
| 修改外部变量 | ❌ for | Stream 应无副作用 |
| 性能极致场景 | ❌ for | for-loop 比 Stream 快 |
| 大数据量并行 | ✅ `parallelStream` | 多核加速 |

---

## 衍生面试题（可背）

1. **Java 异常体系？受检 vs 非受检？**
   → Error / Exception(受检) / RuntimeException(非受检)。受检异常编译期强制处理，非受检运行时才暴露。
2. **Spring `@Transactional` 回滚规则？**
   → 默认只回滚 `RuntimeException` 和 `Error`，受检异常不回滚。可用 `rollbackFor = Exception.class` 修改。
3. **自定义异常为什么要继承 RuntimeException？**
   → ① 不污染方法签名 ② 业务异常是预期内失败 ③ 配合 `@Transactional` 自动回滚。
4. **`@RestControllerAdvice` 的工作原理？**
   → Spring MVC 的 `ExceptionHandlerExceptionResolver` 扫描所有 `@ControllerAdvice` bean，按异常类型匹配 `@ExceptionHandler` 方法。
5. **Java 8 Stream 的懒加载是什么？**
   → 中间操作不立即执行，遇到终端操作（collect/findFirst/forEach）才触发整个流水线执行。
6. **Optional 是什么？为什么引入？**
   → Java 8 引入的容器对象，解决 NPE 问题。强制开发者处理空值情况（`orElse` / `orElseThrow`）。
7. **`findFirst()` vs `findAny()` 区别？**
   → `findFirst()` 串行流返回第一个，并行流也返回第一个（有顺序约束，较慢）；`findAny()` 并行流返回任意一个（更快）。
8. **方法引用 `FieldError::getDefaultMessage` 是什么？**
   → Lambda `fe -> fe.getDefaultMessage()` 的简写，`类名::方法名` 表示调用实例方法。
