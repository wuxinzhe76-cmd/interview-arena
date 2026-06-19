# interview-arena · 开发进度追踪

> 📅 最后更新:2026-06-18(Step 9 完成,下次开始 Step 10)
> 🎯 目的:跨会话延续上下文,避免下次重新解释项目背景

> ⭐ **目录结构**:
> - 源码:[`backend/`](./backend/)
> - 文档:[`docs/`](./docs/)（blueprint + QA 问答归档）
> - 任务:本文件

---

## 一、项目核心定位(必读)

| 项 | 内容 |
|----|------|
| **项目代号** | `interview-arena` |
| **业务定位** | AI 原生的面试题库与模拟面试平台(对标面试鸭 + 牛客网) |
| **核心差异化** | 深度 AI 集成,贯穿全流程的智能辅助(不是简单 AI 对话包装) |
| **目标用户** | 2028 秋招在校生 / 技术面试备考者 |
| **简历叙事** | "用 Spring AI Alibaba 构建 AI 面试官系统,RAG/Agent/Memory/Tool/MCP 模块化" |

---

## 二、当前已完成(2026-06-17 截至本次)

### 2.1 架构与文档

| 项 | 文件 | 状态 |
|----|------|------|
| 项目总览 README | [`MyProject/README.md`](../../README.md) | ✅ |
| 项目蓝图(完整) | [`docs/blueprint.md`](../docs/blueprint.md) | ✅ |
| 重构方案讨论 | 已确认:Java 全栈 + Python LangGraph 双栈对照 | ✅ |
| 项目命名 | mianti → **interview-arena** | ✅ |

### 2.2 项目骨架(已编码)

**位置**:[`backend/`](../backend/)

| 项 | 实现 | 状态 |
|----|------|------|
| Spring Boot 版本 | **3.5.15**(最新稳定版) | ✅ |
| JDK | **Java 21**(虚拟线程) | ✅ |
| groupId | `com.charles.interview` | ✅ |
| artifactId | `interview-arena-backend` | ✅ |
| 主类 | `InterviewArenaApplication.java` | ✅ |
| 测试类 | `InterviewArenaApplicationTests.java` | ✅ |
| application.yaml | `name: interview-arena-backend` | ✅ |
| **第一个接口** | `GET /api/health` | ✅ 已跑通 |

### 2.3 已写代码

#### `HealthController.java`

```java
package com.charles.interview.arena.controller;

import java.util.HashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public Map<String, String> health() {
        Map<String, String> result = new HashMap<>();
        result.put("status", "ok");
        result.put("service", "interview-arena");
        return result;
    }
}
```

**验证结果**:`http://localhost:8080/api/health` 返回 `{"status":"ok","service":"interview-arena"}` ✅

### 2.4 现有依赖(pom.xml)

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.15</version>
</parent>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 三、下一步:从这里继续(关键!)

### Step 2 已完成 ✅(2026-06-17)

- [x] 新建包 `common/`
- [x] [`BaseResponse.java`](../backend/src/main/java/com/charles/interview/arena/common/BaseResponse.java) `@Data + @AllArgsConstructor + Serializable`
- [x] [`ErrorCode.java`](../backend/src/main/java/com/charles/interview/arena/common/ErrorCode.java) 枚举,8 个错误码
- [x] [`ResultUtils.java`](../backend/src/main/java/com/charles/interview/arena/common/ResultUtils.java) 静态工厂方法
- [x] [`HealthController.java`](../backend/src/main/java/com/charles/interview/arena/controller/HealthController.java) 改造完成
- [x] pom.xml 引入 Lombok
- [x] 4 个设计决策已定:`code=0` 成功 / `Serializable` 实现 / 引入 Lombok / `ErrorCode` 用枚举
- [x] 问答归档:[`docs/qa/Step2-统一响应封装.md`](../docs/qa/Step2-统一响应封装.md)(Q1~Q4)

### 立即任务:Step 3 全局异常处理(下次开始)

**目标**:用 `@RestControllerAdvice` 统一捕获异常,Controller 不再写 try-catch。

**待写代码**:

| 文件 | 包路径 | 内容 |
|------|--------|------|
| `BusinessException.java` | `com.charles.interview.arena.exception` | 自定义业务异常,继承 `RuntimeException`,持有 ErrorCode |
| `ThrowUtils.java` | `com.charles.interview.arena.exception` | `throwIf(condition, errorCode)` 工具,优雅断言 |
| `GlobalExceptionHandler.java` | `com.charles.interview.arena.exception` | `@RestControllerAdvice` 统一异常处理 |

**需捕获的异常类型**:
1. `BusinessException` → 业务异常,返回 ErrorCode 中定义的 code/message
2. `MethodArgumentNotValidException` → @Valid 校验失败(Step 4 才用,先留接口)
3. `Exception` → 兜底,转 SYSTEM_ERROR + 打日志

**待讨论的设计要点**:
- [ ] BusinessException 构造器要几个重载?(ErrorCode / ErrorCode+message / int+String)
- [ ] 是否打印异常堆栈?线上/线下区分?
- [ ] 用 `@Slf4j` Lombok 注解还是手动 `private static final Logger log`?

### Step 3 已完成 ✅(2026-06-17)

- [x] 新建包 `exception/`
- [x] [`BusinessException.java`](../backend/src/main/java/com/charles/interview/arena/exception/BusinessException.java) 继承 `RuntimeException`,3 个构造器重载,正确调 `super(message)`
- [x] [`ThrowUtils.java`](../backend/src/main/java/com/charles/interview/arena/exception/ThrowUtils.java) 静态断言工具 `throwIf(condition, errorCode)`,私有构造
- [x] [`GlobalExceptionHandler.java`](../backend/src/main/java/com/charles/interview/arena/exception/GlobalExceptionHandler.java) `@RestControllerAdvice` + 3 个 `@ExceptionHandler`
- [x] 3 个设计决策已定:3 个构造器重载 / BusinessException warn + Exception error 打堆栈 / `@Slf4j`
- [x] 问答归档:[`docs/qa/Step3-全局异常处理.md`](../docs/qa/Step3-全局异常处理.md)(Q1~Q6)
- [x] 深度理解:Stream 链式调用 / Optional / 方法引用 / 异常体系 / `@RestControllerAdvice` 原理 / 工具类私有构造

### Step 4 已完成 ✅(2026-06-17)

- [x] pom.xml 加 `spring-boot-starter-validation` 依赖
- [x] pom.xml 加 `maven-compiler-plugin` + `annotationProcessorPaths`(Spring Boot 3.x Lombok 必需)
- [x] 新建包 `model.dto`
- [x] [`UserRegisterDTO.java`](../backend/src/main/java/com/charles/interview/arena/model/dto/UserRegisterDTO.java) `@Data` + `@NotBlank`/`@Size`/`@Email`/`@Pattern` 校验注解
- [x] [`UserController.java`](../backend/src/main/java/com/charles/interview/arena/controller/UserController.java) `@PostMapping` + `@Valid` + `@RequestBody`
- [x] 3 个设计决策已定:model.dto 包路径 / 只返回第一个错误 / 先学 @Valid
- [x] 问答归档:[`docs/qa/Step4-引入Validation.md`](../docs/qa/Step4-引入Validation.md)(Q1~Q8)
- [x] 深度理解:Validation vs StringUtils / @NotBlank vs @NotNull vs @NotEmpty / Java 正则转义 / Spring Boot 3.x Lombok 配置 / HTTP 方法语义 / @RequestParam vs @RequestBody
- [x] 验证通过:3 个测试场景(curl + Apifox)

### Step 5 已完成 ✅(2026-06-17)

- [x] 方案调整:连远程服务器中间件(117.72.62.12),不需要本地 Docker
- [x] pom.xml 加 MySQL 驱动 + Spring Data Redis + devtools + JDBC Starter
- [x] application.yaml 配置 datasource + redis + devtools
- [x] 服务器创建 `interview_arena` 数据库(utf8mb4)
- [x] 验证:Redis UP(7.2.14) / devtools 生效(restartedMain)
- [x] 问答归档:[`docs/qa/Step5-中间件连接.md`](../docs/qa/Step5-中间件连接.md)(Q1~Q5)
- [x] 技术决策:MySQL 8.0 / Redis 无密码 / 挂载数据卷 / 引入 devtools
- [x] 向量库变更:PgVector → **Milvus**(服务器已有)

### Step 6 已完成 ✅(2026-06-17)

- [x] pom.xml 加 Flyway(flyway-core + flyway-mysql)+ JDBC Starter
- [x] 新建 `db/migration/V1__create_user_table.sql`
- [x] application.yaml 加 Flyway 配置 + allowPublicKeyRetrieval=true
- [x] 服务器授权 `GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'`
- [x] 验证:Flyway 成功迁移 V1 / user 表已创建 / 健康检查全 UP(db + redis)
- [x] 问答归档:[`docs/qa/Step6-Flyway数据库迁移.md`](../docs/qa/Step6-Flyway数据库迁移.md)(Q1~Q7)
- [x] 踩坑记录:① 缺 JDBC Starter ② 权限不足 ③ Public Key Retrieval
- [x] 技术决策:自增 id(预留雪花算法) / 逻辑删除 / 数据库自动维护时间
- [x] Linux 命令速查表归档:[`docs/qa/Linux命令速查表.md`](../docs/qa/Linux命令速查表.md)

### Step 7 已完成 ✅(2026-06-18)

- [x] pom.xml 加 `mybatis-plus-spring-boot3-starter` 3.5.12
- [x] [`User.java`](../backend/src/main/java/com/charles/interview/arena/model/entity/User.java) 实体类,`@TableName`/`@TableId`/`@TableLogic`/`@TableField(fill=...)`
- [x] [`UserMapper.java`](../backend/src/main/java/com/charles/interview/arena/mapper/UserMapper.java) 继承 `BaseMapper<User>`
- [x] [`UserService.java`](../backend/src/main/java/com/charles/interview/arena/service/UserService.java) 继承 `IService<User>`
- [x] [`UserServiceImpl.java`](../backend/src/main/java/com/charles/interview/arena/service/impl/UserServiceImpl.java) 继承 `ServiceImpl`,实现注册逻辑
- [x] [`UserVO.java`](../backend/src/main/java/com/charles/interview/arena/model/vo/UserVO.java) 脱敏返回(无 password/isDeleted)
- [x] [`UserController.java`](../backend/src/main/java/com/charles/interview/arena/controller/UserController.java) `@RequiredArgsConstructor` 注入,接真实 Service
- [x] [`MyMetaObjectHandler.java`](../backend/src/main/java/com/charles/interview/arena/common/MyMetaObjectHandler.java) 自动填充 createTime/updateTime
- [x] [`InterviewArenaApplication.java`](../backend/src/main/java/com/charles/interview/arena/InterviewArenaApplication.java) 加 `@MapperScan`
- [x] application.yaml 加 MyBatis-Plus 配置(驼峰/逻辑删除)
- [x] 5 个设计决策已定:BCrypt 加密 / IService 继承 / 引入 Knife4j / VO 脱敏 / `@RequiredArgsConstructor`
- [x] 验证通过:注册成功 / 重复注册拦截 / 校验失败拦截 / 密码密文入库
- [x] 踩坑:① `@MapperScan` 缺失 ② `java.sql.Date`→`LocalDateTime` ③ `MetaObjectHandler` 缺失
- [x] 问答归档:[`docs/qa/Step7-MyBatisPlus核心知识.md`](../docs/qa/Step7-MyBatisPlus核心知识.md)

### Step 8 已完成 ✅(2026-06-18)

- [x] 方案调整:放弃 Sa-Token,改用 **自研 JWT + Redis 双 Token**(贴合大厂实践)
- [x] pom.xml 删 Sa-Token 依赖,加 `jjwt-api` / `jjwt-impl` / `jjwt-jackson` 0.12.6
- [x] application.yaml 删 Sa-Token 配置
- [x] [`JwtUtil.java`](../backend/src/main/java/com/charles/interview/arena/common/JwtUtil.java) JWT 工具类(生成/解析/验证 accessToken + refreshToken)
- [x] [`JwtInterceptor.java`](../backend/src/main/java/com/charles/interview/arena/common/JwtInterceptor.java) 拦截器:白名单放行 + JWT 验签 + Redis 白名单校验
- [x] [`WebMvcConfigure.java`](../backend/src/main/java/com/charles/interview/arena/config/WebMvcConfigure.java) 注册拦截器
- [x] [`UserLoginDTO.java`](../backend/src/main/java/com/charles/interview/arena/model/dto/UserLoginDTO.java) 登录 DTO
- [x] [`LoginVO.java`](../backend/src/main/java/com/charles/interview/arena/model/vo/LoginVO.java) 双 token + 用户信息返回
- [x] [`UserService.java`](../backend/src/main/java/com/charles/interview/arena/service/UserService.java) 加 login/refreshToken/getLoginUser/logout
- [x] [`UserServiceImpl.java`](../backend/src/main/java/com/charles/interview/arena/service/impl/UserServiceImpl.java) 登录逻辑 + 限流 + Redis 白名单
- [x] [`UserController.java`](../backend/src/main/java/com/charles/interview/arena/controller/UserController.java) login/logout/me/refresh 接口
- [x] 4 个设计决策:双 token(大厂标准) / token+用户信息返回 / 登录限流(5次锁30分钟) / 注册登录放行
- [x] 验证通过 7 个场景:未登录401 / 登录成功 / 带 token 访问 /me / 登出 / 登出后失效 / refreshToken 刷新 / 限流锁定
- [x] 面试亮点归档:[`docs/面试亮点.md`](../docs/面试亮点.md)
- [x] 八股补充:[Spring面试题.md](../../2-Java相关内容/spring框架/Spring面试题.md) 拦截器源码 + @RequiredArgsConstructor 详解

### Step 9 已完成 ✅(2026-06-18)

- [x] 4 个设计决策:多对多关系 / JSON 数组标签 / MP 内置分页 / VO 脱敏
- [x] [`V2__create_question_bank_tables.sql`](../backend/src/main/resources/db/migration/V2__create_question_bank_tables.sql) 3 张表:question_bank / question / question_bank_question(联合唯一索引)
- [x] [`QuestionBank.java`](../backend/src/main/java/com/charles/interview/arena/model/entity/QuestionBank.java) / [`Question.java`](../backend/src/main/java/com/charles/interview/arena/model/entity/Question.java) / [`QuestionBankQuestion.java`](../backend/src/main/java/com/charles/interview/arena/model/entity/QuestionBankQuestion.java) 实体类
- [x] Question 用 `autoResultMap=true` + `JacksonTypeHandler` 让 `List<String> tags` ↔ JSON 互转
- [x] 3 个 Mapper(均继承 BaseMapper)
- [x] 4 个 DTO:QuestionBankAddDTO / QuestionAddDTO / QuestionBankQueryDTO / QuestionQueryDTO
- [x] 2 个 VO:QuestionBankVO / QuestionVO(脱敏,无 isDeleted)
- [x] 3 个 Service + Impl:QuestionBankService / QuestionService / QuestionBankQuestionService
- [x] 2 个 Controller:QuestionBankController(CRUD+分页) / QuestionController(CRUD+分页+关联管理)
- [x] [`MybatisPlusConfig.java`](../backend/src/main/java/com/charles/interview/arena/config/MybatisPlusConfig.java) 分页插件配置 + pom.xml 加 `mybatis-plus-jsqlparser` 依赖
- [x] 用户手写 2 个分页查询方法(练习 MP QueryWrapper / like / eq / apply / page / convert)
- [x] 验证通过 9 个场景:创建题库/创建题目(带标签)/查详情(tags反序列化✅)/分页查询/标签筛选(JSON_CONTAINS✅)/题目加入题库/查题库下题目/重复加入拦截/未登录401
- [x] 问答归档:[`docs/qa/Step9-题库题目CRUD.md`](../docs/qa/Step9-题库题目CRUD.md)(Q1~Q9)
- [x] 深度理解:autoResultMap 原理 / acceptanceRate 反范式 / 分页插件 JSqlParser / QueryWrapper 条件构造器 / BaseMapper+IService 封装 / JSON_CONTAINS 标签筛选 / apply 防注入

### 立即任务:Step 10 判题模块(Docker 沙箱)(下次开始)

**目标**:实现代码提交 + Docker 沙箱执行 + 判题结果回写,为 AI 面试模块提供编程题判题能力。

**待写代码**(参考 blueprint 5.3 节):

| 文件 | 包路径 | 内容 |
|------|--------|------|
| `V3__create_judge_tables.sql` | db/migration | test_case / submission / judge_result / programming_language 表 |
| `TestCase.java` / `Submission.java` / `JudgeResult.java` | model.entity | 判题实体 |
| `CodeSandbox.java` | service | 判题沙箱接口(execute / compile) |
| `DockerCodeSandbox.java` | service.impl | Docker 沙箱实现 |
| `JudgeService.java` + Impl | service | 判题流程编排 |
| `JudgeController.java` | controller | submit / result 接口 |

**待讨论的设计要点**:
- [ ] Docker 沙箱:用 docker-java 还是直接调用 docker CLI?
- [ ] 判题异步化:线程池还是消息队列?
- [ ] 代码沙箱的安全限制:CPU/内存/网络/文件系统怎么隔离?
- [ ] 支持哪些语言?(Java/Python/C++ 先选 1-2 个)

### 历史:Step 8 立即任务存档(已完成)

**目标**:引入 JWT + Redis 双 Token,实现完整注册+登录+登出+获取当前用户+刷新 token。

**待写代码**:

| 文件 | 包路径 | 内容 |
|------|--------|------|
| pom.xml | - | 加 `mybatis-plus-spring-boot3-starter` |
| `User.java` | `com.charles.interview.arena.model.entity` | 实体类,`@TableName`/`@TableId`/`@TableLogic` |
| `UserMapper.java` | `com.charles.interview.arena.mapper` | 继承 `BaseMapper<User>` |
| `UserService.java` | `com.charles.interview.arena.service` | Service 接口 |
| `UserServiceImpl.java` | `com.charles.interview.arena.service.impl` | 继承 `ServiceImpl` |
| `UserRegisterDTO.java` | `com.charles.interview.arena.model.dto` | 已有,需补充确认密码字段 |
| `UserController.java` | `com.charles.interview.arena.controller` | 改造 register,接真实 Service |
| application.yaml | - | 加 MyBatis-Plus 配置(取消注释) |

**待讨论的设计要点**:
- [ ] 密码加密用 BCrypt 还是 MD5+Salt?
- [ ] UserService 继承 MyBatis-Plus IService 还是自定义?
- [ ] 是否引入 Knife4j(Swagger)接口文档?
- [ ] VO 层要不要现在引入(脱敏返回)?

**验证目标**:
- `POST /api/user/register` → 密码加密入库 → 返回 userId
- 数据库查到 user 记录,password 是密文

### 历史:Step 2 立即任务存档(已完成)

**目标**:大厂 API 规范,所有接口返回统一格式:

**目标**:大厂 API 规范,所有接口返回统一格式:

```json
{
  "code": 0,
  "message": "success",
  "data": { "status": "ok", "service": "interview-arena" }
}
```

**待写代码**(用户来写,教练辅助):

| 文件 | 包路径 | 内容 |
|------|--------|------|
| `BaseResponse.java` | `com.charles.interview.arena.common` | 泛型响应类 `BaseResponse<T>`,字段:code/message/data |
| `ErrorCode.java` | `com.charles.interview.arena.common` | 错误码枚举:SUCCESS(0)/PARAMS_ERROR(40000)/NOT_LOGIN(40100)/NO_AUTH(40101)/NOT_FOUND(40400)/SYSTEM_ERROR(50000) |
| `ResultUtils.java` | `com.charles.interview.arena.common` | 静态工具方法:`success(T data)` / `error(ErrorCode)` / `error(int code, String message)` |
| 改造 HealthController | 同前 | 返回 `BaseResponse<Map<String,String>>`,用 `ResultUtils.success(...)` |

### 待讨论的设计要点

下次会话开始时,继续讨论这些(用户提了但未答完):

- [ ] `code` 用 0 表示成功(项目惯例)还是 200(HTTP 风格)?
- [ ] `BaseResponse<T>` 要不要 `implements Serializable`?
- [ ] 是否引入 Lombok(`@Data` 简化代码)?
- [ ] `ErrorCode` 用枚举还是常量类?

### 之后的推进顺序

```
Step 1  ✅ 项目骨架 + /api/health
Step 2  ✅ BaseResponse + ErrorCode + ResultUtils
Step 3  ✅ GlobalExceptionHandler 全局异常处理
Step 4  ✅ 引入 Validation(@Valid + DTO 校验)
Step 5  ✅ 中间件连接(MySQL + Redis + devtools)
Step 6  ✅ Flyway 数据库迁移 + User 表设计
Step 7  ✅ MyBatis-Plus + UserMapper + 真实注册
Step 8  ✅ JWT + Redis 双 Token 认证(登录/登出/me/刷新/限流)
Step 9  ✅ 题库/题目 CRUD(多对多 + JSON标签 + MP分页)
Step 10 ⬜ ← 下次开始:判题模块(Docker 沙箱)
Step 11 ⬜ AI 面试模块(Spring AI + Milvus RAG)  ← 核心
Step 11a ⬜ RAG 深度:混合召回(BM25 + 向量 + RRF)   ← ★ 区分度
Step 11b ⬜ RAG 深度:Rerank 重排序                  ← ★ 区分度
Step 11c ⬜ RAG 深度:评估指标(Hit Rate@5/MRR)       ← ★ 区分度
Step 11d ⬜ RAG 深度:语义缓存                        ← ★ 区分度
Step 12 ⬜ AI 面试报告 + 学习路径
Step 13 ⬜ 收藏/错题本 + 笔记 + 社区
Step 14 ⬜ 组卷考试 + 简历分析
```

> ⭐ 路线图已从 14 Step 扩展为 18 Step(新增 4 个 RAG 深度模块)。
> 优先级:P0 = Step 7~9 + 11(核心),P1 = Step 10 + 11a~11d + 12(亮点),P2 = Step 13~14(锦上添花)。

---

## 四、关键技术决策记录(已确认,不再讨论)

| 决策 | 结果 | 理由 |
|------|------|------|
| 项目名 | interview-arena | 简历可读性 + 记忆点 |
| 路线选择 | 主攻 Java(Spring AI),Python LangGraph 做对照 | 企业 80%+ Java,Java+AI 复合人才稀缺 |
| AI 微服务粒度 | **合并为单一 ai-service**(模块化单体) | 应届生不要过度设计,讲"何时该拆"加分 |
| Python 定位 | 同业务双实现对照(可讲双栈) | 简历叙事:"Python 懂原理 + Java 能落地" |
| 大模型 | 通义千问 (DashScope) | 国内稳定 + Spring AI Alibaba 原生 |
| 向量库 | PgVector | PostgreSQL 扩展,无需额外运维 |
| 三个项目 | RPC + interview-arena + 网约车 | interview-arena P1,网约车 P2,RPC P3 |
| 网约车定位 | **保留**(展示高并发亮点) + AI 智能客服增强 | 不丢派单/状态机/MQ 已有亮点 |

---

## 五、已删除/已废弃的内容

| 项 | 状态 | 说明 |
|----|------|------|
| `MyProject/mianti/` | ❌ 已删除 | 整个旧 Vue 3 + Spring Boot 3.2.4 项目已拆解为 blueprint 文档 |
| `MyProject/5-项目实战/` | ❌ 已删除 | 内容并入 `MyProject/` |
| `MyProject/Week1/` + `突击里程碑-MVP.md` | ❌ 已删除 | 用户主动要求 |
| `mianti-backend/`(临时项目) | ❌ 已重命名 | → `backend/` |
| `mianti-project-blueprint.md` | ❌ 已重命名 | → `docs/blueprint.md` |

---

## 六、学习方法约定(教练规则)

| 项 | 规则 |
|----|------|
| **学习方式** | 一步一步带,最小工作单元,**用户自己写,教练辅助** |
| **每日时长** | 2 小时(项目实战),不追求一次写完 |
| **代码标准** | 企业落地,不写 demo |
| **教练职责** | Review 代码 + 八股讲解 + 报错诊断 + 设计建议 |
| **不做的事** | 教练**不直接代写**完整功能,只给方向 + 示例 + 纠错 |

---

## 七、跨模块上下文索引

### 同时进行的学习

| 模块 | 当前进度 | 文件 |
|------|----------|------|
| Spring 八股(24 天计划) | Day 1 ✅ 4/5 题(Bean 生命周期遗留 Day 2) | [`2-Java相关内容/spring框架/学习进度.md`](2-Java相关内容/spring框架/学习进度.md) |
| LangChain 学习 | Ch.4 短期记忆进行中,Q1~Q31 已落库 | [`新版langchain+langgraph+MCP的智能体/学习进度.md`](新版langchain+langgraph+MCP的智能体/学习进度.md) |
| 英文词汇 | V1 versatile + V2 multimodality | [`英文词汇表.md`](英文词汇表.md) |
| 艾宾浩斯复习 | 知识点 #1~#29 + 词汇 V1~V2 | [`艾宾浩斯复习追踪.md`](艾宾浩斯复习追踪.md) |

### MCP 工具(已配置可用)

| MCP | 用途 |
|-----|------|
| `mcp_docs-langchain` | 查 LangChain 官方文档 |
| `@enokdev/springdocs-mcp` | 查 Spring 官方文档 |

---

## 八、下次会话开场提示

**用户说什么,教练应该立即响应**:

| 用户说 | 教练应做 |
|--------|----------|
| 「继续 interview-arena」 | 读本文件 + `docs/qa/` → 进入 Step 7:MyBatis-Plus |
| 「Step 7」 / 「写 MyBatis-Plus」 | 直接进入 User 实体 + Mapper + Service 设计要点 |
| 「我学到哪了」 | 读本文件 + 各模块进度文件 + `docs/qa/` |
| 「项目原理细节」 | 查 `docs/qa/` 对应 Step 文件(Step2~6 + Linux 命令速查已归档) |
| 「项目背景是什么」 | 引用第一节"项目核心定位" |

---

## 九、当前目录结构

```
interview-arena/
├── backend/                           ← ★ 源码（Spring Boot 3.5.15）
│   ├── pom.xml
│   ├── src/main/java/com/charles/interview/arena/
│   │   ├── InterviewArenaApplication.java
│   │   ├── common/
│   │   │   ├── BaseResponse.java
│   │   │   ├── ErrorCode.java
│   │   │   └── ResultUtils.java
│   │   ├── controller/
│   │   │   ├── HealthController.java
│   │   │   └── UserController.java
│   │   ├── exception/
│   │   │   ├── BusinessException.java
│   │   │   ├── GlobalExceptionHandler.java
│   │   │   └── ThrowUtils.java
│   │   ├── mapper/
│   │   │   └── UserMapper.java
│   │   ├── model/
│   │   │   ├── dto/
│   │   │   │   └── UserRegisterDTO.java
│   │   │   ├── entity/
│   │   │   │   └── User.java
│   │   │   └── vo/
│   │   │       └── UserVO.java
│   │   └── service/
│   │       ├── UserService.java
│   │       └── impl/
│   │           └── UserServiceImpl.java
│   └── src/main/resources/
│       ├── db/migration/
│       │   └── V1__create_user_table.sql
│       └── application.yaml
├── docs/                              ← ★ 文档
│   ├── blueprint.md                   ← 完整项目蓝图
│   └── qa/                            ← 实践问答归档
│       ├── README.md
│       ├── Linux命令速查表.md
│       ├── Step2-统一响应封装.md
│       ├── Step3-全局异常处理.md
│       ├── Step4-引入Validation.md
│       ├── Step5-中间件连接.md
│       ├── Step6-Flyway数据库迁移.md
│       └── Step7-MyBatisPlus核心知识.md
└── tasks/                             ← ★ 任务追踪
    └── progress.md                    ← 本文件
```

---

## 十、本次会话核心讨论记录(给下次教练参考)

1. **架构选型大讨论**(花了大量时间):
   - Java vs Go vs Python 大厂语言地图
   - 为什么是 Java + Go 组合(各管一层)
   - Spring AI vs Java 调 Python 的本质区别(同进程 vs 跨进程)
   - 结论:**主攻 Spring AI,Python LangGraph 做认知壁垒**

2. **项目整理**:
   - 删除 mianti 老项目,提取核心信息到 blueprint
   - 删除 5-项目实战、Week1、突击里程碑
   - 实习项目移到 `实习经历/`,简历内容回归 `3-通识内容/简历/`

3. **API 测试工具方案**:
   - 大厂金字塔模型(单元测试 → 集成测试 → 契约测试 → E2E)
   - 推荐:JUnit 5 + MockMvc + RestAssured + Apifox + Testcontainers + JMeter/k6 + Spring Cloud Contract
   - 当前阶段够用:MockMvc + Apifox

4. **重命名决策**:
   - mianti / mianti-v2 → **interview-arena**
   - Spring Boot 3.4.5 → **3.5.15**
   - 文件夹/包名/类名/yaml 全部同步更新

---

**给下次的教练:本文件 = 完整上下文。读完即可无缝接续,不要让用户重复解释。**
