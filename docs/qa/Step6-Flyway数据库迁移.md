# Step 6 · Flyway 数据库迁移 + User 表设计 · 问答归档

> 📅 日期：2026-06-17
> 🎯 阶段：Step 6 · Flyway 数据库迁移 + User 表设计

---

## 涉及代码

- [`pom.xml`](../interview-arena-backend/pom.xml)（加 Flyway + JDBC Starter）
- [`application.yaml`](../interview-arena-backend/src/main/resources/application.yaml)（加 Flyway 配置 + allowPublicKeyRetrieval）
- [`V1__create_user_table.sql`](../interview-arena-backend/src/main/resources/db/migration/V1__create_user_table.sql)

---

## Q1：什么是 Flyway？为什么需要它？

### 痛点

3 个开发协作，各自改数据库 → 谁的表结构是对的？怎么同步？新人怎么建表？上线漏执行 SQL 怎么办？

### Flyway 解决方案

```
项目结构:
src/main/resources/db/migration/
  ├── V1__create_user_table.sql         ← 第 1 次迁移:建 user 表
  ├── V2__add_question_table.sql        ← 第 2 次迁移:建题目表
  └── V3__add_user_phone_field.sql      ← 第 3 次迁移:加字段

应用启动时:
  Flyway 自动扫描 SQL 文件
  → 查 flyway_schema_history 表
  → 只执行没跑过的 SQL
  → 记录执行历史
  → 所有人表结构一致
```

**一句话**：Flyway 是数据库版本控制工具，就像 Git 管代码一样管数据库结构。

---

## Q2：Flyway SQL 文件命名规则

```
V{版本号}__{描述}.sql
```

| 规则 | 示例 |
|------|------|
| `V` 开头（大写） | V1 / V2 / V3 |
| 版本号 | 1 / 2 / 1.1 / 20240101 |
| **两个下划线** `__` | `V1__` 不是 `V1_` |
| 描述用下划线 | `create_user_table` |
| 后缀 `.sql` | `V1__create_user_table.sql` |

---

## Q3：User 表设计要点

| 字段 | 类型 | 说明 | 设计理由 |
|------|------|------|---------|
| `id` | `BIGINT` | 主键自增 | 对应 Java Long，当前阶段用自增，后续可改雪花算法 |
| `username` | `VARCHAR(64)` | 用户名 | UNIQUE 约束 |
| `password` | `VARCHAR(128)` | 密码加密后 | BCrypt 60 字符，留余量 |
| `gender` | `TINYINT` | 性别 0/1/2 | 枚举用数字，省空间 |
| `role` | `VARCHAR(16)` | 角色 | user/admin |
| `status` | `TINYINT` | 状态 | 0禁用 1正常 |
| `create_time` | `DATETIME` | 创建时间 | `DEFAULT CURRENT_TIMESTAMP` 自动维护 |
| `update_time` | `DATETIME` | 更新时间 | `ON UPDATE CURRENT_TIMESTAMP` 自动更新 |
| `is_deleted` | `TINYINT` | 逻辑删除 | 0未删 1已删 |

### 关键 SQL 语法

| 语法 | 作用 |
|------|------|
| `ENGINE=InnoDB` | 支持事务（MyISAM 不支持） |
| `CHARSET=utf8mb4` | 支持 emoji（utf8 是阉割版） |
| `COLLATE=utf8mb4_unicode_ci` | 查询不区分大小写 |
| `UNIQUE KEY uk_username` | `uk_` 前缀 = unique key |
| `DEFAULT CURRENT_TIMESTAMP` | 自动填创建时间 |
| `ON UPDATE CURRENT_TIMESTAMP` | 自动更新修改时间 |

---

## Q4：Flyway 不执行？缺 JDBC Starter（踩坑 1）

### 现象

Flyway 依赖加了，application.yaml 配了，但启动日志完全没有 Flyway 输出。

### 根因

**缺少 `spring-boot-starter-jdbc` 依赖**。虽然有 MySQL 驱动和 Flyway，但没有 JDBC Starter，Spring Boot 不会自动配置 DataSource，Flyway 无从连接。

### 解决

pom.xml 加：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```

---

## Q5：CREATE command denied？权限不足（踩坑 2）

### 现象

```
CREATE command denied to user 'root'@'117.147.29.83' for table 'flyway_schema_history'
```

### 根因

服务器 MySQL 的 root 用户对远程连接没有 CREATE 权限。

### 解决

SSH 到服务器，进 MySQL 执行：

```sql
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

---

## Q6：Public Key Retrieval is not allowed（踩坑 3）

### 现象

```
java.sql.SQLNonTransientConnectionException: Public Key Retrieval is not allowed
```

### 根因

MySQL 8 默认用 `caching_sha2_password` 认证插件，客户端需要获取服务器公钥来加密密码，但默认不允许。

### 解决

连接 URL 加参数 `allowPublicKeyRetrieval=true`：

```yaml
url: jdbc:mysql://117.72.62.12:3306/interview_arena?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
```

---

## Q7：分布式架构要不要现在做？

### 决策

**当前阶段用自增 id，不用分布式。但简历预留分布式演进方案。**

| 阶段 | 架构 | 主键 | 理由 |
|------|------|------|------|
| 当前 | 单体 | 自增 id | 用户量 < 100万，单库够用 |
| 将来 | 分布式 | 雪花算法 | 分库分表时需要全局唯一 ID |

### 面试话术

> "当前用自增 id，后续改雪花算法（MyBatis-Plus 内置 ASSIGN_ID，配置一行就能切）。什么时候该拆？单库 QPS > 5000、单表 > 1000 万时。"

---

## 验证结果

| 组件 | 状态 | 验证方式 |
|------|------|---------|
| MySQL 连接 | ✅ UP | HikariPool Start completed |
| Flyway 迁移 | ✅ 成功 | Successfully applied 1 migration |
| user 表 | ✅ 已创建 | V1 执行成功 |
| flyway_schema_history | ✅ 已创建 | 记录迁移历史 |
| 健康检查 | ✅ 全 UP | db + redis + ping |

---

## 衍生面试题（可背）

1. **Flyway 是什么？为什么用？**
   → 数据库版本控制工具，SQL 文件按版本号顺序执行，记录到 flyway_schema_history 表，保证团队表结构一致。

2. **Flyway 文件命名规则？**
   → `V{版本号}__{描述}.sql`，V 大写，两个下划线，版本号递增。

3. **MySQL utf8 和 utf8mb4 区别？**
   → utf8 最多 3 字节存不了 emoji，utf8mb4 是真正的 UTF-8（4 字节）。

4. **逻辑删除 vs 物理删除？**
   → 逻辑删除标记 is_deleted=1，数据还在，可恢复、合规、审计。物理删除 DELETE 数据没了。

5. **MySQL 8 Public Key Retrieval is not allowed 怎么解决？**
   → URL 加 `allowPublicKeyRetrieval=true`，因为 MySQL 8 默认用 caching_sha2_password 认证。

6. **Spring Boot 3.x Flyway 不执行怎么排查？**
   → 检查是否加了 spring-boot-starter-jdbc（DataSource 自动配置前置条件）。

7. **分布式 ID 方案有哪些？什么时候用？**
   → 自增 id（单机）、雪花算法（分布式）、UUID（不推荐）。单表 > 1000 万或分库分表时用雪花算法。
