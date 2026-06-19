# Step 4 · 引入 Validation · 问答归档

> 📅 日期：2026-06-17
> 🎯 阶段：Step 4 · Bean Validation 参数校验

---

## 涉及代码

- [`UserRegisterDTO.java`](../interview-arena-backend/src/main/java/com/charles/interview/arena/model/dto/UserRegisterDTO.java)
- [`UserController.java`](../interview-arena-backend/src/main/java/com/charles/interview/arena/controller/UserController.java)
- [`pom.xml`](../interview-arena-backend/pom.xml)（加 `spring-boot-starter-validation` + Lombok 注解处理器配置）

---

## Q1：StringUtils 也能判断，Validation 更实用吗？

### 两者不冲突，职责不同

| 方案 | 定位 | 场景 |
|------|------|------|
| StringUtils | 字符串操作工具 | 业务逻辑判断、字符串处理 |
| Validation | 声明式校验框架 | DTO 字段格式校验（非空/长度/格式） |

### 对比

```java
// 方案 A：StringUtils 手动校验（命令式）
if (StringUtils.isBlank(request.getUsername())) {
    throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名不能为空");
}
if (request.getUsername().length() < 4 || request.getUsername().length() > 20) {
    throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名长度 4-20");
}
// ... 每个字段 3-5 行

// 方案 B：Validation 声明式校验
public class UserRegisterDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 4, max = 20, message = "用户名长度 4-20")
    private String username;
}

// Controller 一行
@PostMapping("/register")
public BaseResponse<Long> register(@Valid @RequestBody UserRegisterDTO dto) {
    return ResultUtils.success(userService.register(dto));
}
```

### 5 大维度对比

| 维度 | StringUtils 手动校验 | Validation 声明式 |
|------|---------------------|------------------|
| 代码量 | 每字段 3-5 行 if | DTO 上 1 行注解 |
| 校验规则位置 | 散落在 Controller | 集中在 DTO |
| 复用性 | 同一 DTO 多接口要重复写 | 写一次到处用 |
| 维护性 | 改规则翻遍 Controller | 改 DTO 一处 |
| 文档性 | 看 Controller 才知道规则 | 看 DTO 字段就知道 |

### 真实项目分工

```
请求进来
   ↓
① Validation 做"格式校验"     ← 字段非空、长度、格式、范围
   ↓ (通过)
② Service 里做"业务校验"       ← 用户名是否已存在、密码是否正确
   ↓ (通过)
③ 业务逻辑执行
```

**结论**：格式校验用 Validation，业务逻辑用 StringUtils，两者分工配合。

---

## Q2：@NotBlank vs @NotNull vs @NotEmpty 区别？

| 注解 | null 通过？ | "" 通过？ | "  " 通过？ | 适用类型 |
|------|------------|----------|------------|---------|
| `@NotNull` | ❌ | ✅ | ✅ | 任意类型 |
| `@NotEmpty` | ❌ | ❌ | ✅ | String/Collection/Map/Array |
| `@NotBlank` | ❌ | ❌ | ❌ | String 专用 |

**记忆口诀**：
- `@NotNull`：只管 null
- `@NotEmpty`：管 null + 空串/空集合
- `@NotBlank`：最严格，连纯空格都不通过

### 为什么 @Email 不需要 @NotBlank？

`@Email` 校验器对 **null 值直接通过**（返回 valid）。这是 Bean Validation 的设计约定：**大多数约束注解对 null 放行**，因为 null 的校验应该交给 `@NotNull` / `@NotBlank`。

如果邮箱是选填的，只加 `@Email` 即可：
- null → 通过（不填邮箱 OK）
- "bad" → 失败（填了但格式错）
- "a@b.com" → 通过

如果邮箱必填，才需要 `@NotBlank + @Email` 组合。

---

## Q3：Java 正则在字符串里为什么要写 \\d？

### 报错现场

```java
@Pattern(regexp = '^1[3-9]\d{9}$')      // ❌ 单引号 + \d 非法转义
```

### 两个错误

#### 错误 1：单引号是 char 字面量，不是 String

```java
char c = 'a';        // ✅ 单引号 = 单个字符
String s = "abc";    // ✅ 双引号 = 字符串
String s = 'abc';    // ❌ 编译错误
```

#### 错误 2：Java 字符串里 \d 是非法转义

Java 字符串的转义符是反斜杠 `\`：

| 写法 | 含义 |
|------|------|
| `\\` | 一个反斜杠 `\` |
| `\n` | 换行 |
| `\t` | Tab |
| `\"` | 双引号 |
| `\d` | ❌ 非法转义！编译错误 |

**正则引擎需要 `\d`，但 Java 字符串里 `\` 是转义符，所以要写 `\\d`**，Java 编译后变成 `\d` 传给正则引擎。

### 正确写法

```java
@Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式错误")
```

### Java 字符串转义速查

| Java 字符串 | 编译后实际值 | 用途 |
|------------|------------|------|
| `\\d` | `\d` | 正则数字匹配 |
| `\\w` | `\w` | 正则单词字符 |
| `\\.` | `\.` | 正则字面点号 |
| `\\\\` | `\\` | 字面反斜杠 |

---

## Q4：Spring Boot 3.x 的 Lombok 配置为什么要加 annotationProcessorPaths？

### 报错现象

22 个编译错误，全是"找不到符号"：
- `ErrorCode` 构造器"需要: 没有参数"
- `找不到符号 方法 getCode()/getMessage()`
- `GlobalExceptionHandler 找不到变量 log`

### 根本原因

**Lombok 注解处理器没有生效**：`@Getter`/`@Data`/`@Slf4j`/`@AllArgsConstructor` 都没运行。

### Spring Boot 2.x vs 3.x

```xml
<!-- Spring Boot 2.x：只要有依赖,Lombok 自动生效 -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>

<!-- Spring Boot 3.x：还必须配置注解处理器路径！ -->
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <configuration>
                <annotationProcessorPaths>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### 为什么 Spring Boot 3.x 要这样？

- JDK 9+ 引入模块系统，注解处理器不再从 classpath 自动发现
- `maven-compiler-plugin` 3.11+ 默认不扫描 dependencies 里的 processor
- 必须显式声明 `annotationProcessorPaths`

---

## Q5：为什么 @GetMapping 要改成 @PostMapping？

### HTTP 语义

| 方法 | 语义 | 幂等？ | 安全？ | 适用场景 |
|------|------|--------|--------|---------|
| GET | 查询 | ✅ | ✅ | 获取资源 |
| POST | 创建 | ❌ | ❌ | 创建资源 |
| PUT | 更新 | ✅ | ❌ | 全量更新 |
| DELETE | 删除 | ✅ | ❌ | 删除资源 |

### 注册接口必须用 POST

| 原因 | 说明 |
|------|------|
| 语义 | 注册是"创建用户"，是创建资源 |
| 安全 | 密码等敏感信息不应出现在 URL（GET 参数在 URL 里） |
| 长度 | GET URL 长度有限制（约 2KB），POST body 无限制 |
| 幂等 | 注册不幂等（同样请求第二次应失败"用户已存在"） |
| RESTful | POST /users = 创建用户 |

---

## Q6：@RequestParam vs @RequestBody 区别？

| 注解 | 数据来源 | 格式 | 适用场景 |
|------|---------|------|---------|
| `@RequestParam` | URL query 参数 | `?username=xxx&password=yyy` | 简单参数、GET 查询 |
| `@RequestBody` | 请求体 | JSON | 复杂对象、POST/PUT |
| `@PathVariable` | URL 路径 | `/user/123` | 资源 ID |
| `@RequestHeader` | 请求头 | `Authorization: Bearer xxx` | Token |

### 为什么注册用 @RequestBody

```java
// ❌ @RequestParam：参数在 URL,密码暴露,且字段多时 URL 很长
POST /api/user/register?username=charles&password=123456&email=a@b.com&phone=13800138000

// ✅ @RequestBody：参数在 body,安全,支持复杂嵌套
POST /api/user/register
Body: {"username":"charles","password":"123456","email":"a@b.com","phone":"13800138000"}
```

---

## Q7：改了代码为什么不生效？（50000 系统异常排查）

### 现象

改完 UserController 后请求返回 `{"code":50000,"message":"系统内部异常"}`

### 排查过程

1. 查看后端日志：`NoResourceFoundException: No static resource api/user/register`
2. 异常含义：Spring 找不到 `/api/user/register` 的 POST 映射，当成静态资源处理
3. 根因：**文件没保存**，启动的还是旧代码（@GetMapping + getMethodName）

### 教训

| 操作 | 必做 |
|------|------|
| 改完代码 | **Cmd + S 保存**（IDE 标签页带 ● 表示未保存） |
| 改了 Controller | **必须重启应用** |
| 怀疑代码没生效 | `mvnw clean spring-boot:run` 强制重新编译 |

---

## Q8：Validation 校验顺序不固定？

### 现象

```json
{"username":"","password":"","email":"bad","phone":"123"}
```

预期返回"用户名不能为空"，实际返回"邮箱格式错误"。

### 原因

Spring Validation **不保证注解执行顺序**。`@NotBlank` 和 `@Email` 哪个先触发不确定，`findFirst()` 只取第一个碰到的错误。

### 解决方案（进阶）

用 `@GroupSequence` 控制校验顺序（后续 Step 讲），当前阶段接受这个行为。

---

## 衍生面试题（可背）

1. **@NotBlank / @NotNull / @NotEmpty 区别？**
   → NotNull 只管 null；NotEmpty 管 null+空串/空集合；NotBlank 最严格，连纯空格都不通过（String 专用）。

2. **为什么 @Email 不需要加 @NotBlank？**
   → Bean Validation 约定：大多数约束注解对 null 放行，null 的校验交给 @NotNull/@NotBlank。

3. **@Valid 和 @Validated 区别？**
   → @Valid 是 JSR 标准，支持嵌套校验；@Validated 是 Spring 扩展，支持分组校验。

4. **Spring Boot 3.x 为什么要配置 annotationProcessorPaths？**
   → JDK 9+ 模块系统 + maven-compiler-plugin 3.11+ 不再自动扫描 processor，必须显式声明。

5. **Java 正则里 \d 为什么写成 \\d？**
   → Java 字符串中 \ 是转义符，\d 是非法转义，\\d 编译后变成 \d 传给正则引擎。

6. **@RequestParam 和 @RequestBody 区别？**
   → @RequestParam 从 URL query 取参数；@RequestBody 从请求体解析 JSON。

7. **GET 和 POST 区别？为什么注册用 POST？**
   → GET 查询幂等安全，POST 创建非幂等。注册是创建资源 + 密码不能暴露在 URL + body 无长度限制。

8. **Bean Validation 校验失败抛什么异常？**
   → `MethodArgumentNotValidException`（被 @RestControllerAdvice 捕获处理）。

9. **Spring Boot 改了代码不生效怎么办？**
   → 检查文件是否保存 → clean 重新编译 → 重启应用。可引入 spring-boot-devtools 实现热重启。
