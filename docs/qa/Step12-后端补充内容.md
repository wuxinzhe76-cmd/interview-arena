# Step12 - 后端补充内容

> 整理日期:2026-06-19 | 模块:RabbitMQ / TestCase / 编程语言 / 八股题导入

---

## B1: RabbitMQ 连接问题排查

**Q: 后端启动卡在 RabbitMQ 连接超时,怎么排查?**

A: 三层排查:
1. **Docker 容器**: `docker ps | grep rabbit` 确认容器在运行
2. **云服务商安全组**: 5672 端口需要在云控制台的安全组里放行(不是服务器 UFW)
3. **账号密码**: `docker exec rabbitmq rabbitmqctl list_users` 查用户,`rabbitmqctl change_password admin admin` 重置

最终配置 `application.yaml`:
```yaml
spring:
  rabbitmq:
    host: 117.72.62.12
    port: 5672
    username: admin
    password: admin
```

---

## B2: TestCaseController

**Q: 测试用例管理接口有哪些?**

A: [TestCaseController.java](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/backend/src/main/java/com/charles/interview/arena/controller/TestCaseController.java)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/testCase/add` | POST | 添加测试用例 |
| `/api/testCase/update/{id}` | POST | 更新测试用例 |
| `/api/testCase/delete/{id}` | DELETE | 删除测试用例 |
| `/api/testCase/list/{questionId}` | GET | 查询某题的所有用例 |
| `/api/testCase/get/{id}` | GET | 查询单个用例 |

---

## B3: programming_language 表

**Q: 编程语言配置表是干什么的?**

A: 存储支持的编程语言和编译/运行命令:
- Java: `javac Solution.java` + `java Solution`
- Python: 无编译 + `python3 solution.py`

当前 DockerCodeSandbox 里是写死的,这张表是后续优化用(加新语言不改代码,只 INSERT 数据)。

---

## B4: 八股题数据导入

**Q: Redis 52 道八股题怎么导入的?**

A: 用独立 JDBC 程序(不走 Flyway):
1. 解析 `Redis面试题.md`:`- [ ] 题目?` 是题干,`> 引用块` 是答案
2. content = 题干(不含答案),answer = 引用块内容
3. type=FILL_IN,tags=["Redis","八股"]

**为什么不走 Flyway?** Flyway 管 schema(表结构),日常数据更新走 JDBC 直连。

---

## B5: Redis 题目板块分类

**Q: 52 道 Redis 题怎么分成 9 个板块的?**

A: 逐题根据内容分类,更新 tags:
```
["Redis", "八股"] → ["Redis", "八股", "应用场景"]
```

9 个板块:
| 板块 | 题数 | 内容 |
|------|:---:|------|
| 应用场景 | 13 | 缓存、分布式锁、排行榜 |
| 原理 | 10 | 为什么快、跳表、单线程 |
| 集群 | 8 | 主从、哨兵、Cluster |
| 数据类型 | 6 | String/List/Set/ZSet/Hash |
| 性能优化 | 4 | Pipeline、BigKey |
| 缓存问题 | 3 | 穿透、击穿、雪崩 |
| 事务 | 3 | MULTI/EXEC、Lua |
| 内存管理 | 3 | 过期、淘汰、碎片 |
| 持久化 | 2 | RDB、AOF |

---

## B6: 接口白名单(公开访问)

**Q: 哪些接口不需要登录?**

A: [JwtInterceptor.java](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/backend/src/main/java/com/charles/interview/arena/common/JwtInterceptor.java)

```java
WHITE_LIST = [
  "/api/user/register", "/api/user/login", "/api/user/refresh",
  "/api/health", "/swagger-ui", "/v3/api-docs",
  "/api/question/list/page/vo", "/api/question/get/vo",  // 题目浏览公开
  "/api/questionBank/list/page/vo", "/api/questionBank/get/vo"
];
```

像 LeetCode 一样,未登录也能浏览题目,只有提交代码和用户操作需要登录。

---

## B7: Flyway 版本管理策略

**Q: 为什么补充题目内容不走 Flyway?**

A: Flyway 的设计哲学:
- ✅ **管 schema**: V1 建表、V2 加字段 → 用 Flyway
- ✅ **一次性初始化**: V4 导入 431 道题骨架 → 用 Flyway
- ❌ **日常数据更新**: 补充内容、加用例 → 不用 Flyway

原因:Flyway 文件不可删除(删了报 validation error),版本号会膨胀到 V100+。

当前:V1~V4(schema + 初始化),后续数据更新走 JDBC 直连。

---

## B8: MySQL max_allowed_packet

**Q: 导入八股题时报 "Packet for query is too large" 怎么解决?**

A: 答案内容超过 MySQL 默认的 max_allowed_packet(2MB)。

服务器执行:
```bash
docker exec mysql mysql -uroot -proot -e "SET GLOBAL max_allowed_packet=67108864"
```

注意:SET GLOBAL 需要重新连接才生效。
