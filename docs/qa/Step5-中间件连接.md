# Step 5 · Docker Compose / 远程中间件 · 问答归档

> 📅 日期：2026-06-17
> 🎯 阶段：Step 5 · 连接远程 MySQL + Redis + devtools

---

## 涉及代码

- [`pom.xml`](../interview-arena-backend/pom.xml)（加 MySQL 驱动 + Redis + devtools）
- [`application.yaml`](../interview-arena-backend/src/main/resources/application.yaml)（datasource + redis + devtools + actuator 配置）

---

## Q1：spring-boot-devtools 是干什么的？

### 核心功能

**一句话**：开发时自动重启工具，改完代码保存，应用自动重启，不用手动停再启动。

### 没有 devtools 的痛点

```
1. 改 UserController
2. 忘了保存 / 忘了重启
3. 请求返回 50000 系统异常
4. 排查半天才发现："我刚刚没有保存文件"
```

### 有 devtools

```
1. 改代码
2. 保存（Cmd + S）
3. devtools 检测到 classpath 变化
4. 自动重启应用（1~2 秒）
5. 刷新浏览器就能看到新代码效果
```

### 双 ClassLoader 原理（为什么快）

```
┌─────────────────────────────────────────────┐
│  Base ClassLoader（第三方 jar，不变）         │
│  spring-boot / mysql / redis / lombok ...   │
│  → 只加载一次,重启时不重新加载               │
└─────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────┐
│  Restart ClassLoader（你的代码，会变）        │
│  com.charles.interview.arena.*              │
│  → 改代码后只重新加载这一层                  │
│  → 比"完全重启"快很多（1~2 秒 vs 5~10 秒）   │
└─────────────────────────────────────────────┘
```

普通重启要重新加载所有 jar（几百 MB），devtools 只重新加载你的代码（几百 KB），快 5~10 倍。

### 验证 devtools 生效

启动日志线程名：
- 没有 devtools：`[main]`
- 有 devtools：`[restartedMain]` ← ★ 生效标志

### 注意点

| 注意项 | 说明 |
|--------|------|
| 只对开发环境生效 | `scope=runtime` + `optional=true`，打包时不包含 |
| 触发条件是 class 编译 | 改 `.java` 后要等 IDE 自动编译 |
| 改 yaml 不一定触发 | devtools 监控 `target/classes`，IDE 编译 yaml 到 target 才触发 |
| 生产环境禁用 | 打成 jar 包后 devtools 自动失效 |

---

## Q2：pom.xml 的 devtools 标黄是什么原因？

### 原因

IDE 标黄是**警告（Warning）**，不是错误，不影响编译。最常见原因：

1. **IDEA 提示「DevTools 会自动重启」**：检测到 devtools 依赖，提醒应用会自动重启
2. **`optional=true` 的提示**：optional 依赖不会被传递给其他模块（单模块项目无影响）

### 解决方法

**不用管**，标黄 ≠ 报错。

---

## Q3：远程服务器中间件方案 vs 本地 Docker

### 方案选择

用户中间件在远程服务器 `117.72.62.12`，不需要本地装 Docker，直接连远程。

### 服务器中间件清单

| 服务 | 地址 | 端口 | 认证 | 用途 |
|------|------|------|------|------|
| MySQL 8.0 | 117.72.62.12 | 3306 | root | Step 5~9 用户/题库 |
| Redis 7.2 | 117.72.62.12 | 6379 | 无密码 | Step 8 Sa-Token Session |
| RabbitMQ | 117.72.62.12 | 5672/15672 | admin | 后续消息队列 |
| Elasticsearch | 117.72.62.12 | 9200/9300 | 无 | 后续搜索 |
| Milvus | 117.72.62.12 | 19530 | 无 | Step 10 AI 向量检索 |

### 安全风险（记录，不阻塞开发）

- MySQL 3306 暴露公网 + root 用户 → 建议后续改 SSH 隧道或限制 IP
- Redis 6379 暴露公网 + 无密码 → 极易被挖矿木马扫描利用，建议尽快加密码

### 向量库变更

之前决策用 PgVector，但服务器上跑的是 **Milvus**。后续 Step 10 AI 模块改用 Milvus（更专业，功能更强）。

---

## Q4：MySQL 8.0 连接 URL 参数含义

```yaml
url: jdbc:mysql://117.72.62.12:3306/interview_arena?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai
```

| 参数 | 含义 | 为什么这样设 |
|------|------|------------|
| `useUnicode=true` | 启用 Unicode 支持 | 支持中文等多字节字符 |
| `characterEncoding=utf-8` | 编码方式 | 与数据库 utf8mb4 对应 |
| `useSSL=false` | 不用 SSL | 服务器没配 SSL 证书 |
| `serverTimezone=Asia/Shanghai` | 时区 | 避免 MySQL 时间和系统时间不一致 |

---

## Q5：为什么数据库要用 utf8mb4 而不是 utf8？

| 编码 | 最大字节数 | 支持 emoji？ | 说明 |
|------|----------|------------|------|
| MySQL `utf8` | 3 字节 | ❌ | 阉割版，存不了 emoji 和部分生僻字 |
| MySQL `utf8mb4` | 4 字节 | ✅ | 真正的 UTF-8 |

**创建数据库语句**：

```sql
CREATE DATABASE IF NOT EXISTS interview_arena
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

`utf8mb4_unicode_ci`：`_ci` = case insensitive，查询时不区分大小写。

---

## 验证结果

| 服务 | 状态 | 验证方式 |
|------|------|---------|
| Redis | ✅ UP (7.2.14) | `/actuator/health` 显示 redis 组件 UP |
| devtools | ✅ 生效 | 日志 `[restartedMain]` |
| MySQL | ✅ 连通 | nc 测试端口可达，数据库已创建 |
| actuator | ✅ 配置 | `show-details: always` 显示组件详情 |

---

## 衍生面试题（可背）

1. **spring-boot-devtools 的原理？为什么比手动重启快？**
   → 双 ClassLoader：Base ClassLoader 加载第三方 jar（不重启），Restart ClassLoader 加载应用代码（重启时只重新加载这一层）。

2. **devtools 生产环境会有问题吗？**
   → 不会。`scope=runtime` + `optional=true`，打包时自动排除。

3. **MySQL 的 utf8 和 utf8mb4 区别？**
   → MySQL 的 utf8 是阉割版（最多 3 字节），存不了 emoji；utf8mb4 是真正的 UTF-8（4 字节）。

4. **Spring Boot 如何验证数据库连接？**
   → Actuator 的 `/actuator/health` 端点，配置 `show-details: always` 可看到 db 组件状态。

5. **Spring Boot 连接 MySQL 的 URL 参数有哪些？**
   → useUnicode / characterEncoding / useSSL / serverTimezone 是常用参数。
