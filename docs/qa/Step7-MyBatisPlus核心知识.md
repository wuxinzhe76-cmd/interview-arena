# Step 7 补充：MyBatis-Plus 核心知识

> 📅 创建时间：2026-06-18
> 🎯 目的：系统学习 MyBatis-Plus，为后续 CRUD 开发打基础

---

## 一、MyBatis-Plus 是什么？

### 一句话定义

**MyBatis 的增强工具包**——在不改变 MyBatis 原有功能的前提下，提供 CRUD 自动生成、条件构造器、分页插件等便捷功能。

### 和 MyBatis 的关系

```
MyBatis         → 手写 SQL，灵活但繁琐
MyBatis-Plus    → MyBatis + 自动 CRUD（底层还是 MyBatis）
```

### 类比

| 框架 | 类比 |
|------|------|
| JDBC | 手动挡（踩离合、挂挡、加油） |
| MyBatis | 半自动挡（写 SQL，自动映射） |
| MyBatis-Plus | 自动挡（单表 CRUD 不用写 SQL） |

---

## 二、核心架构

```
你的代码
  ↓
MyBatis-Plus（增强层）
  ├── BaseMapper        → 提供 insert/delete/update/select 方法
  ├── IService          → 提供 save/getById/update 等 Service 层方法
  ├── ServiceImpl       → IService 的实现基类
  ├── 条件构造器         → LambdaQueryWrapper / QueryWrapper
  └── 插件               → 分页 / 乐观锁 / 逻辑删除
  ↓
MyBatis（底层）
  ├── SqlSession
  └── Mapper XML（可选，复杂 SQL 仍写 XML）
  ↓
数据库
```

---

## 三、三层 API（核心！）

MyBatis-Plus 提供了 3 层 API，能力从底到高：

### 第 1 层：BaseMapper（Mapper 接口层）

```java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 继承后自动拥有以下方法，不用写任何 SQL
}
```

**自动拥有的方法**：

| 方法 | 作用 | 等价 SQL |
|------|------|---------|
| `insert(entity)` | 插入 | `INSERT INTO user ...` |
| `deleteById(id)` | 按 id 删除 | `DELETE FROM user WHERE id = ?` |
| `deleteByIds(idList)` | 批量删除 | `DELETE FROM user WHERE id IN (...)` |
| `updateById(entity)` | 按 id 更新 | `UPDATE user SET ... WHERE id = ?` |
| `selectById(id)` | 按 id 查询 | `SELECT * FROM user WHERE id = ?` |
| `selectList(wrapper)` | 条件查询 | `SELECT * FROM user WHERE ...` |
| `selectPage(page, wrapper)` | 分页查询 | `SELECT * FROM user WHERE ... LIMIT ?` |
| `selectCount(wrapper)` | 计数 | `SELECT COUNT(*) FROM user WHERE ...` |

**使用示例**：

```java
@Autowired
private UserMapper userMapper;

// 插入
userMapper.insert(user);

// 按 id 查
User user = userMapper.selectById(1L);

// 按 id 删
userMapper.deleteById(1L);
```

---

### 第 2 层：IService + ServiceImpl（Service 层）

```java
// 接口
public interface UserService extends IService<User> {}

// 实现
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {
    // 继承后自动拥有以下方法
}
```

**为什么有了 BaseMapper 还要 IService？**

| 层 | 特点 | 示例 |
|----|------|------|
| BaseMapper | 单表原子操作 | `insert(user)` |
| IService | **业务封装**，含批量操作 + 事务 | `saveBatch(userList)` 一次插入 100 条 |

**IService 比 BaseMapper 多的方法**：

| 方法 | 作用 | BaseMapper 有吗？ |
|------|------|------------------|
| `save(entity)` | 插入 | ≈ insert |
| `saveBatch(list)` | **批量插入** | ❌ 没有 |
| `saveOrUpdate(entity)` | 存在就更新，不存在就插入 | ❌ 没有 |
| `removeById(id)` | 删除 | ≈ deleteById |
| `getById(id)` | 查询 | ≈ selectById |
| `updateById(entity)` | 更新 | ≈ updateById |
| `lambdaQuery()` | **Lambda 条件构造器** | ❌ 没有 |
| `lambdaUpdate()` | **Lambda 更新构造器** | ❌ 没有 |

**使用示例**（你现在的写法）：

```java
// this 代表 UserServiceImpl 自己
this.save(user);                              // 插入
this.getById(userId);                         // 查询
this.lambdaQuery().eq(User::getUsername, name).count();  // 条件查询
```

---

### 第 3 层：条件构造器（查询/更新的核心）

#### QueryWrapper（字符串版）

```java
QueryWrapper<User> wrapper = new QueryWrapper<>();
wrapper.eq("username", "charles")
       .gt("age", 18)
       .orderByDesc("create_time");
List<User> users = userMapper.selectList(wrapper);
```

**缺点**：字段名是字符串 `"username"`，写错不报错，重构时不会自动更新。

#### LambdaQueryWrapper（Lambda 版，推荐）

```java
LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(User::getUsername, "charles")
       .gt(User::getAge, 18)
       .orderByDesc(User::getCreateTime);
List<User> users = userMapper.selectList(wrapper);
```

**优点**：`User::getUsername` 是方法引用，编译期检查，重构自动更新。

#### 通过 IService 的 lambdaQuery()（最推荐，你现在的写法）

```java
// 链式调用，最简洁
List<User> users = this.lambdaQuery()
    .eq(User::getUsername, "charles")
    .gt(User::getAge, 18)
    .orderByDesc(User::getCreateTime)
    .list();    // 终端操作：返回 List
```

---

## 四、条件构造器方法速查（核心！）

### 比较条件

| 方法 | 等价 SQL | 示例 |
|------|---------|------|
| `.eq(field, value)` | `field = value` | `.eq(User::getStatus, 1)` |
| `.ne(field, value)` | `field != value` | `.ne(User::getStatus, 0)` |
| `.gt(field, value)` | `field > value` | `.gt(User::getAge, 18)` |
| `.ge(field, value)` | `field >= value` | `.ge(User::getAge, 18)` |
| `.lt(field, value)` | `field < value` | `.lt(User::getAge, 60)` |
| `.le(field, value)` | `field <= value` | `.le(User::getAge, 60)` |
| `.between(field, v1, v2)` | `field BETWEEN v1 AND v2` | `.between(User::getAge, 18, 60)` |
| `.notBetween(field, v1, v2)` | `field NOT BETWEEN v1 AND v2` | |
| `.isNull(field)` | `field IS NULL` | `.isNull(User::getEmail)` |
| `.isNotNull(field)` | `field IS NOT NULL` | `.isNotNull(User::getEmail)` |

### 模糊匹配

| 方法 | 等价 SQL | 示例 |
|------|---------|------|
| `.like(field, value)` | `field LIKE '%value%'` | `.like(User::getName, "charles")` |
| `.notLike(field, value)` | `field NOT LIKE '%value%'` | |
| `.likeLeft(field, value)` | `field LIKE '%value'` | `.likeLeft(User::getPhone, "1380")` |
| `.likeRight(field, value)` | `field LIKE 'value%'` | `.likeRight(User::getPhone, "138")` |

### 集合

| 方法 | 等价 SQL | 示例 |
|------|---------|------|
| `.in(field, list)` | `field IN (...)` | `.in(User::getId, Arrays.asList(1L, 2L))` |
| `.notIn(field, list)` | `field NOT IN (...)` | |
| `.inSql(field, sql)` | `field IN (SQL)` | `.inSql(User::getId, "SELECT id FROM ...")` |

### 排序

| 方法 | 等价 SQL |
|------|---------|
| `.orderByAsc(field)` | `ORDER BY field ASC` |
| `.orderByDesc(field)` | `ORDER BY field DESC` |

### 逻辑连接

| 方法 | 作用 | 示例 |
|------|------|------|
| `.and(consumer)` | AND 嵌套 | `.and(w -> w.eq(...).gt(...))` |
| `.or()` | 下一个条件用 OR 连接 | `.eq(...).or().eq(...)` |
| `.or(consumer)` | OR 嵌套 | `.or(w -> w.eq(...).gt(...))` |
| `.nested(consumer)` | 括号嵌套 | `.nested(w -> w.eq(...).gt(...))` |

### 终端操作（通过 IService 的 lambdaQuery）

| 方法 | 返回类型 | 作用 |
|------|---------|------|
| `.list()` | `List<T>` | 返回列表 |
| `.one()` | `T` | 返回单条（多条会抛异常） |
| `.count()` | `long` | 计数 |
| `.page(page)` | `IPage<T>` | 分页 |

---

## 五、实战示例（15 个场景）

### 场景 1：按用户名查单条

```java
User user = this.lambdaQuery()
    .eq(User::getUsername, "charles")
    .one();   // 只期望一条，多条会抛 TooManyResultsException
```

### 场景 2：按状态查列表

```java
List<User> users = this.lambdaQuery()
    .eq(User::getStatus, 1)
    .list();
```

### 场景 3：模糊搜索 + 分页

```java
Page<User> page = this.lambdaQuery()
    .like(User::getUsername, "char")
    .eq(User::getStatus, 1)
    .orderByDesc(User::getCreateTime)
    .page(new Page<>(1, 10));   // 第 1 页，每页 10 条
```

### 场景 4：统计数量

```java
long count = this.lambdaQuery()
    .eq(User::getStatus, 1)
    .count();
```

### 场景 5：IN 查询

```java
List<Long> ids = Arrays.asList(1L, 2L, 3L);
List<User> users = this.lambdaQuery()
    .in(User::getId, ids)
    .list();
```

### 场景 6：OR 条件

```java
// WHERE username = 'charles' OR phone = '13800138000'
List<User> users = this.lambdaQuery()
    .eq(User::getUsername, "charles")
    .or()
    .eq(User::getPhone, "13800138000")
    .list();
```

### 场景 7：AND 嵌套（复杂条件）

```java
// WHERE status = 1 AND (username LIKE 'char%' OR phone LIKE '138%')
List<User> users = this.lambdaQuery()
    .eq(User::getStatus, 1)
    .and(w -> w.like(User::getUsername, "char")
               .or()
               .like(User::getPhone, "138"))
    .list();
```

### 场景 8：更新（LambdaUpdate）

```java
// UPDATE user SET status = 0 WHERE id = 1
this.lambdaUpdate()
    .eq(User::getId, 1L)
    .set(User::getStatus, 0)
    .update();
```

### 场景 9：批量插入

```java
List<User> users = Arrays.asList(user1, user2, user3);
this.saveBatch(users);   // 一次 INSERT 多条
```

### 场景 10：存在就更新，不存在就插入

```java
this.saveOrUpdate(user);   // 有 id 就 update，没 id 就 insert
```

### 场景 11：只查询部分字段

```java
// SELECT id, username FROM user WHERE status = 1
List<User> users = this.lambdaQuery()
    .select(User::getId, User::getUsername)
    .eq(User::getStatus, 1)
    .list();
```

### 场景 12：分组统计

```java
// 需要 QueryWrapper 版（lambdaQuery 不支持 groupBy）
QueryWrapper<User> wrapper = new QueryWrapper<>();
wrapper.select("status, COUNT(*) as count")
       .groupBy("status");
List<Map<String, Object>> result = userMapper.selectMaps(wrapper);
// [{status: 1, count: 50}, {status: 0, count: 3}]
```

### 场景 13：自定义 SQL（复杂查询仍写 XML）

```java
// UserMapper.java
@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM user WHERE username = #{username}")
    User selectByUsername(@Param("username") String username);
}
```

### 场景 14：分页 + 条件（分页插件）

```java
// 需要 MybatisPlusInterceptor 配置（见下方插件章节）
Page<User> page = new Page<>(1, 10);  // 第1页,每页10条
Page<User> result = this.lambdaQuery()
    .eq(User::getStatus, 1)
    .orderByDesc(User::getCreateTime)
    .page(page);

result.getRecords();    // 当前页数据 List<User>
result.getTotal();      // 总记录数
result.getPages();      // 总页数
result.getCurrent();    // 当前页码
result.getSize();       // 每页条数
```

### 场景 15：你的注册查重场景

```java
// 查用户名是否已存在
long count = this.lambdaQuery()
    .eq(User::getUsername, username)
    .count();
ThrowUtils.throwIf(count > 0, ErrorCode.PARAMS_ERROR, "用户名已存在");
```

---

## 六、常用注解速查

### 实体类注解

| 注解 | 作用 | 示例 |
|------|------|------|
| `@TableName("user")` | 指定表名 | 类名和表名不一致时用 |
| `@TableId(type = IdType.AUTO)` | 主键策略 | AUTO=自增, ASSIGN_ID=雪花算法 |
| `@TableField("create_time")` | 指定列名 | 字段名和列名不一致时用 |
| `@TableField(exist = false)` | 非数据库字段 | 标记该属性不映射数据库列 |
| `@TableLogic` | 逻辑删除 | 标记逻辑删除字段 |

### IdType 主键策略

| 策略 | 说明 | 适合场景 |
|------|------|---------|
| `AUTO` | 数据库自增 | 单机/小项目 |
| `ASSIGN_ID` | 雪花算法（默认） | 分布式 |
| `ASSIGN_UUID` | UUID | 无需有序 |
| `INPUT` | 手动输入 | 特殊需求 |

---

## 七、插件配置（分页插件必配！）

### 分页插件配置类

```java
@Configuration
public class MyBatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        // 分页插件
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

**不配分页插件**：`page()` 方法不会真正分页，会查出全部数据。

---

## 八、逻辑删除

### 配置（你已经在 yaml 配了）

```yaml
mybatis-plus:
  global-config:
    db-config:
      logic-delete-field: isDeleted
      logic-delete-value: 1
      logic-not-delete-value: 0
```

### 实体类

```java
@TableLogic
private Integer isDeleted;
```

### 效果

```java
// 你写的代码
userMapper.deleteById(1L);

// MyBatis-Plus 实际执行的 SQL
UPDATE user SET is_deleted = 1 WHERE id = 1;   // 不是 DELETE!

// 查询时自动过滤已删除
userMapper.selectList(null);
// 实际 SQL: SELECT * FROM user WHERE is_deleted = 0;  // 自动加条件
```

**好处**：数据不会真正删除，可恢复，适合审计需求。

---

## 九、IService vs BaseMapper 对比

| 对比项 | BaseMapper | IService |
|--------|-----------|----------|
| 层级 | Mapper 层 | Service 层 |
| 批量操作 | ❌ | ✅ saveBatch |
| saveOrUpdate | ❌ | ✅ |
| 链式查询 | ❌ | ✅ lambdaQuery() |
| 链式更新 | ❌ | ✅ lambdaUpdate() |
| 事务 | 需手动 | 支持 @Transactional |
| 使用方式 | `userMapper.xxx()` | `this.xxx()`（在 ServiceImpl 里） |

**推荐**：Service 层用 IService 的方法，Mapper 层只在自定义 SQL 时用。

---

## 十、面试高频题

### Q1：MyBatis-Plus 和 MyBatis 的区别？

| 维度 | MyBatis | MyBatis-Plus |
|------|---------|-------------|
| 单表 CRUD | 手写 SQL | 自动生成 |
| 条件构造 | XML/注解 | Lambda 链式 |
| 分页 | 手写或 PageHelper | 内置插件 |
| 逻辑删除 | 手动实现 | 注解 + 自动 |
| 代码生成 | 第三方工具 | 内置 generator |
| 兼容性 | - | 完全兼容 MyBatis |

### Q2：BaseMapper 和 IService 为什么要分两层？

- **BaseMapper**：原子级数据库操作，1:1 对应 SQL
- **IService**：业务级封装，组合多个原子操作 + 事务管理

例：`saveBatch()` 底层循环调 `insert()`，但在一个事务里。

### Q3：LambdaQueryWrapper 比 QueryWrapper 好在哪？

| 维度 | QueryWrapper | LambdaQueryWrapper |
|------|-------------|-------------------|
| 字段名 | 字符串 `"username"` | 方法引用 `User::getUsername` |
| 编译检查 | ❌ 写错不报错 | ✅ 编译期检查 |
| 重构 | ❌ 不会自动更新 | ✅ 改字段名自动更新 |
| 可读性 | 低 | 高 |

### Q4：MyBatis-Plus 的分页原理？

拦截 SQL，自动追加 `LIMIT`：
```
原始 SQL: SELECT * FROM user WHERE status = 1
拦截后:   SELECT * FROM user WHERE status = 1 LIMIT 0, 10
         SELECT COUNT(*) FROM user WHERE status = 1  ← 自动查总数
```

### Q5：逻辑删除和物理删除的区别？

| 维度 | 逻辑删除 | 物理删除 |
|------|---------|---------|
| SQL | `UPDATE SET is_deleted=1` | `DELETE FROM` |
| 数据 | 仍在数据库 | 彻底删除 |
| 恢复 | 可恢复 | 不可恢复 |
| 性能 | 查询需过滤，稍慢 | 查询快 |
| 审计 | ✅ 保留记录 | ❌ 无记录 |

---

## 十一、你的项目里用到的 MyBatis-Plus 功能

| 功能 | 代码位置 | 用法 |
|------|---------|------|
| BaseMapper | UserMapper.java | `extends BaseMapper<User>` |
| IService | UserService.java | `extends IService<User>` |
| ServiceImpl | UserServiceImpl.java | `extends ServiceImpl<UserMapper, User>` |
| Lambda 查询 | UserServiceImpl.java | `this.lambdaQuery().eq(User::getUsername, name).count()` |
| 插入 | UserServiceImpl.java | `this.save(user)` |
| 主键自增 | User.java | `@TableId(type = IdType.AUTO)` |
| 逻辑删除 | User.java + yaml | `@TableLogic` + yaml 配置 |
| 驼峰映射 | yaml | `map-underscore-to-camel-case: true` |

---

## 十二、学习路线建议

| 优先级 | 内容 | 掌握标准 |
|--------|------|---------|
| P0 | BaseMapper / IService / ServiceImpl | 能写 CRUD |
| P0 | LambdaQueryWrapper | 能写条件查询 |
| P0 | 分页插件 | 能写分页查询 |
| P1 | 逻辑删除 | 配置 + 使用 |
| P1 | LambdaUpdateWrapper | 能写条件更新 |
| P2 | 代码生成器 | 自动生成 Entity/Mapper |
| P2 | 自定义 SQL | 复杂查询写 XML |

---

## 📚 八股复习清单（Step 7 · MyBatis-Plus 核心知识）

> 完成本步骤后，请背诵以下八股题。完整映射表见 `docs/八股映射表.md`

| # | 八股题 | 题目关键词 | 文件位置 |
|---|--------|-----------|---------|
| 1 | MyBatis | **MyBatis 的执行流程（SqlSession → Executor → StatementHandler）** | `2-Java相关内容/MyBatis/MyBatis面试题.md` |
| 2 | MyBatis | 一级缓存与二级缓存（作用域、失效条件） | `2-Java相关内容/MyBatis/MyBatis面试题.md` |
| 3 | MyBatis | ResultMap vs 自动映射（autoResultMap 的作用） | `2-Java相关内容/MyBatis/MyBatis面试题.md` |
| 4 | MyBatis | TypeHandler 的作用与原理（JacksonTypeHandler） | `2-Java相关内容/MyBatis/MyBatis面试题.md` |
| 5 | MyBatis | **#{} 与 ${} 的区别（SQL 注入防护）** | `2-Java相关内容/MyBatis/MyBatis面试题.md` |
| 6 | 设计模式 | 代理模式（MapperProxy 动态代理） | `4-后端设计相关内容/设计模式/设计模式面试题.md` |
| 7 | 设计模式 | 模板方法模式（BaseExecutor 的 doQuery） | `4-后端设计相关内容/设计模式/设计模式面试题.md` |

⏰ 复习顺序：读 `MybatisPlusConfig.java` → 背执行流程 → **重点背 #{} vs ${}** → 背代理模式 → 合上文档自述
