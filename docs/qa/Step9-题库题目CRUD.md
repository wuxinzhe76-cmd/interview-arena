# Step 9 · 题库/题目 CRUD · 问答归档

> Step 9 进行中,本文件随开发进度持续补充。

---

## Q1:为什么 `JacksonTypeHandler` 必须配 `autoResultMap = true` 才能在 SELECT 时生效?

### 背景

`Question` 实体的 `tags` 字段是 `List<String>`,数据库存 JSON 字符串。用 `@TableField(typeHandler = JacksonTypeHandler.class)` 让 MP 自动转换。但只加这个注解,INSERT/UPDATE 正常,SELECT 时 `tags` 却是 null 或报错。

### 根本原因:写走 MP,读走 MyBatis 内核

| 操作 | 谁控制 | typeHandler 怎么生效 |
|------|--------|---------------------|
| **INSERT/UPDATE** | MyBatis-Plus 生成 SQL | MP 直接把 `@TableField(typeHandler=...)` 写进 SQL 的 `#{tags, typeHandler=...JacksonTypeHandler}` 占位符,**立即生效** |
| **SELECT** | MyBatis 内核做结果映射 | 取决于用 **自动映射** 还是 **ResultMap** |

### SELECT 的两条路径

**默认(`autoResultMap = false`)**:MP 用 MyBatis 的**自动映射**(auto-mapping)。自动映射只认 Java 字段类型,用它默认注册的 TypeHandler。`List<String>` 没有默认 TypeHandler 能把 JSON 字符串转成 List,所以 `tags` 字段要么 null,要么类型转换失败。`@TableField(typeHandler=...)` 注解**被忽略**。

**开启 `autoResultMap = true`**:MP 会为这个实体**生成一个真正的 `<ResultMap>`**,并把注解里的 typeHandler 写进去:

```xml
<resultMap id="questionMap" type="Question">
    <result column="tags" property="tags" typeHandler="JacksonTypeHandler"/>
    ...
</resultMap>
```

有了这个 ResultMap,MyBatis 读 `tags` 列时就知道"用 JacksonTypeHandler 把 JSON 字符串反序列化成 `List<String>`"。

### 一句话总结

> `@TableField(typeHandler=...)` 在**写**时由 MP 直接注入 SQL 占位符,所以默认生效;在**读**时依赖 MyBatis 的 ResultMap 机制,而 MP 默认用自动映射不开 ResultMap,所以必须 `autoResultMap = true` 让 MP 生成 ResultMap,自定义 typeHandler 才能在 SELECT 时被识别。

### 面试加分点

这是 MP 的设计权衡 —— 默认不开 ResultMap 是为了向后兼容和性能(生成 ResultMap 有开销),但代价是 typeHandler 在读路径上需要额外开关。

---

## Q2:`acceptanceRate`(通过率)字段的作用

### 计算公式

```
acceptanceRate = acceptedCount / submissionCount * 100   (DECIMAL(5,2),范围 0.00~100.00)
```

### 4 个实际用途

1. **校验标签难度的真实性** —— 题目标了 `EASY` 但通过率只有 15%,说明这道题实际很难或有坑;标了 `HARD` 但通过率 90%,可能是送分题。用户一眼就能看出"标签难度"和"真实难度"的偏差。

2. **列表排序与筛选** —— 用户刷题时可以按通过率排序,专挑通过率低的难题刷,或先刷通过率高的简单题建立信心。这是刷题平台(LeetCode/牛客)的核心筛选维度。

3. **运维监控** —— 管理员看哪些题通过率异常低(比如 < 5%),往往是题目描述歧义、测试用例错误、或题目本身不合理,需要排查。

4. **反范式冗余存储** —— 这个值本可以实时算 `accepted_count / submission_count`,但题目列表是高频查询,每次都算除法浪费 CPU。存成字段,在提交判题时(Step 10)异步更新,读时直接取,这是典型的**空间换时间**设计。

### 为什么用 `DECIMAL(5,2)` 不用 `FLOAT`?

- `FLOAT` 是浮点数,有精度丢失(`0.1 + 0.2 != 0.3`)
- `DECIMAL` 是定点数,精确存储,适合"百分比"这种需要精确展示的场景
- Java 侧对应 `BigDecimal`,避免 `double` 的精度坑

---

## Q3:为什么需要 MyBatis-Plus 分页插件,不直接用 `LIMIT offset, size`?

### 背景

原生 MySQL 分页确实就是 `LIMIT 10 OFFSET 0`。但分页不只是"取一页数据"那么简单,还有 4 件事要处理。

### 1. 你还要查总数(算总页数)

前端列表页要显示「共 128 条,第 1/13 页」,需要 `SELECT COUNT(*) FROM question WHERE ...`。这意味着要**写两份 SQL**:一份查数据,一份查总数,而且 WHERE 条件要保持同步。改一处忘改另一处,数据就错了。

### 2. `LIMIT` 在动态查询里拼接很烦

```java
// 手写的话,得自己拼
StringBuilder sql = "SELECT * FROM question WHERE 1=1";
if (title != null) sql += " AND title LIKE '%" + title + "%'";
if (difficulty != null) sql += " AND difficulty = '" + difficulty + "'";
sql += " LIMIT " + (current - 1) * pageSize + ", " + pageSize;
```

手拼 SQL 除了烦,还有 **SQL 注入风险** —— 上面的 `title` 如果是用户输入 `'; DROP TABLE question;--`,就完蛋了。

### 3. MyBatis-Plus 分页插件帮你做了 6 件事

`PaginationInnerInterceptor` 基于 JSqlParser 做 SQL 拦截改写,自动完成:

| 事件 | 插件做了什么 | 你手写要做什么 |
|------|------------|--------------|
| **拼 LIMIT** | 解析原 SQL,自动追加 `LIMIT 0, 10` | 手算 offset,手拼字符串 |
| **生成 COUNT** | 自动改写一条 `SELECT COUNT(*)` SQL | 再写一份相同 WHERE 的查询 |
| **COUNT 优化** | 去掉 `ORDER BY`(排序不影响计数)、去掉 `LEFT JOIN`(如果 JOIN 不影响行数) | 不会优化,COUNT 也很慢 |
| **防恶意分页** | size 上限 500,防 `pageSize=999999` 拖垮 DB | 自己加校验 |
| **溢出处理** | current > totalPages 时自动回退到最后一页 | 自己算 |
| **结果封装** | 填充 `Page` 对象的 records/total/size/current/pages | 手动组装返回 |

### 4. 看一条 SQL 被插件改写的过程

你写:
```java
this.page(new Page<>(1, 10), wrapper);
```

插件拦截后,**实际执行两条 SQL**:

```sql
-- ① 自动生成的 COUNT(去掉 ORDER BY 优化)
SELECT COUNT(*) AS total FROM question WHERE is_deleted = 0 AND title LIKE '%HashMap%'

-- ② 自动追加 LIMIT 的数据查询
SELECT id, title, content, ... FROM question 
WHERE is_deleted = 0 AND title LIKE '%HashMap%' 
ORDER BY create_time DESC 
LIMIT 10
```

最后返回的 `Page<Question>` 对象自动填充:
```json
{
  "records": [...10条数据...],
  "total": 128,
  "size": 10,
  "current": 1,
  "pages": 13
}
```

### 一句话总结

> 原生 `LIMIT` 只解决「取一页数据」这一件事,而分页插件解决「分页全流程」:自动 COUNT + COUNT 优化 + 防恶意分页 + 溢出处理 + 结果封装。JSqlParser 做的是 **SQL 级别的拦截改写**,你只管 `page()`,插件在底层把 LIMIT 和 COUNT 都补齐了。

### 为什么需要 `mybatis-plus-jsqlparser` 依赖?

MP 3.5.9+ 把 JSqlParser(SQL 解析器)拆成独立模块 —— 因为 JSqlParser 体积大且有维护更新,拆分后 MP 核心包更轻量。分页插件需要 JSqlParser 来解析和改写 SQL,所以单独引入。

---

## Q4:`queryWrapper.like()` 是"查 title 列"吗?和 `SELECT title` 一样吗?

### 错误理解

> "`queryWrapper.like("title", "Java")` 是不是相当于 `SELECT title FROM questionBank`?"

**完全不是**。`queryWrapper` 只管 WHERE 条件,不管查哪些列。

### 正确理解:两个概念要分清

| 概念 | SQL 里 | QueryWrapper 里 |
|------|--------|-----------------|
| **查哪些列**(SELECT 子句) | `SELECT id, title, ...` | MP 默认 `SELECT *`,不指定就查全部列 |
| **过滤哪些行**(WHERE 子句) | `WHERE title LIKE '%Java%'` | `queryWrapper.like("title", "Java")` ← **这个** |

### 案例代码

```java
// QuestionBankServiceImpl.listQuestionBankVOByPage
QueryWrapper<QuestionBank> queryWrapper = new QueryWrapper<>();
queryWrapper.like(StringUtils.isNotBlank(dto.getTitle()), "title", dto.getTitle());

Page<QuestionBank> page = this.page(
    new Page<>(dto.getCurrent(), dto.getPageSize()),
    queryWrapper
);
```

生成的 SQL:

```sql
-- ❌ 不是:SELECT title FROM question_bank LIMIT 10
-- ✅ 实际是:
SELECT *                          -- 查所有列(MP 默认)
FROM question_bank
WHERE title LIKE '%Java%'         -- like() 加的 WHERE 条件
LIMIT 10                          -- page() 加的分页
```

### 为什么用 `like` 不用 `eq`?

- `like("title", "Java")` → `WHERE title LIKE '%Java%'` —— 模糊匹配,搜"Java"能匹配到"Java基础"、"Java并发"
- `eq("title", "Java")` → `WHERE title = 'Java'` —— 精确匹配,只能匹配标题恰好是 "Java" 的

题库列表的搜索框是模糊查询,所以用 `like`。

---

## Q5:`queryWrapper.like()` 第一个布尔参数为什么是条件开关?

### 错误理解

> "为什么要传一个布尔变量?直接 `like("title", dto.getTitle())` 不行吗?"

直接传也可以,但如果 `dto.getTitle()` 是 null,会生成 `WHERE title LIKE 'null%'`,查出空结果或错误结果。

### 不用布尔开关的传统写法(手写 if-else)

```java
QueryWrapper<QuestionBank> wrapper = new QueryWrapper<>();
if (dto.getTitle() != null && !dto.getTitle().isEmpty()) {
    wrapper.like("title", dto.getTitle());
}
if (dto.getUserId() != null) {
    wrapper.eq("user_id", dto.getUserId());
}
// 每个可选条件都要包一层 if,5 个条件就是 15 行
```

### MP 的布尔开关:一行搞定

```java
// QuestionBankServiceImpl 实际代码
queryWrapper.like(StringUtils.isNotBlank(dto.getTitle()), "title", dto.getTitle());
//             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//             true  → 拼接 WHERE title LIKE '%xxx%'
//             false → 跳过这个条件,SQL 里完全没有这行
```

5 个条件写 5 行,无 if-else:

```java
wrapper.like(isNotBlank(dto.getTitle()), "title", dto.getTitle());
wrapper.eq(nonNull(dto.getUserId()), "user_id", dto.getUserId());
wrapper.eq(isNotBlank(dto.getType()), "type", dto.getType());
wrapper.eq(isNotBlank(dto.getDifficulty()), "difficulty", dto.getDifficulty());
wrapper.orderBy(true, false, "create_time");
```

### MP 源码原理

```java
public Children like(boolean condition, R column, Object val) {
    return maybeDo(condition, () -> ...);  // condition=false 就不执行
}
```

`maybeDo` 检查 condition,false 时直接返回当前 wrapper 不做任何修改。**MP 把 if 判断内聚到方法里**,外部调用更简洁。

### 一句话总结

> 第一个布尔参数是**条件开关**:true 才拼这个 WHERE 条件,false 就跳过。省去手写 if-else,让动态查询写成链式一行流。配合 `StringUtils.isNotBlank()` 判空,实现"传了才查,不传查全部"。这是 MP 面试高频题。

---

## Q6:`SELECT *` 查所有列不是浪费吗?要不要只查需要的列?

### 背景

`question_bank` 表有 8 列,QuestionBankVO 只用了 6 列(不含 `is_deleted`)。`SELECT *` 会把 `is_deleted` 也查出来,虽然量小但没必要。

### 要不要优化?分情况

| 场景 | 建议 |
|------|------|
| **题库列表**(当前,数据量小) | 暂不优化,简单优先,`SELECT *` 可读性好 |
| **题目列表**(content/answer 是 TEXT 大字段) | **必须优化**,列表页不展示题目正文,查出来浪费网络带宽和内存 |
| **高并发接口**(管理后台、C 端列表) | 优化,即使量小也该养成习惯 |

### 怎么只查指定列?MP 两种写法

```java
// 方式 1:字符串列名
queryWrapper.select("id", "title", "description", "picture", "user_id", "create_time", "update_time");

// 方式 2:lambda 方式(类型安全,推荐)
queryWrapper.select(
    QuestionBank::getId,
    QuestionBank::getTitle,
    QuestionBank::getDescription,
    QuestionBank::getPicture,
    QuestionBank::getUserId,
    QuestionBank::getCreateTime,
    QuestionBank::getUpdateTime
);
```

生成的 SQL:
```sql
SELECT id, title, description, picture, user_id, create_time, update_time  -- 不含 is_deleted
FROM question_bank
WHERE title LIKE '%Java%'
LIMIT 10
```

### 本项目决策

- **题库列表**:先不优化(字段小,8 列而已)
- **题目列表**:必须优化 —— `content` 和 `answer` 是 TEXT 大字段,列表页只展示标题/标签/难度/通过率,不需要正文

### 面试讲法

> "小表列表查询可以 `SELECT *`,但大字段表(如 question 有 content/answer TEXT)的列表查询必须用 `.select()` 指定列,避免把 TEXT 大字段也查出来浪费带宽。这是**网络 IO 优化**,比存储空间更关键 —— 列表接口返回 JSON 时,大字段会显著增大响应体,拖慢前端渲染。"

---

## Q7:`BeanUtils.copyProperties` 的 Null Analysis 警告怎么回事?

### 警告内容

```
Null type safety: The expression of type 'QuestionBankAddDTO' 
needs unchecked conversion to conform to '@NonNull Object'
```

### 触发点(QuestionBankServiceImpl 里有 4 处)

| 行 | 代码 | 原因 |
|----|------|------|
| 32 | `BeanUtils.copyProperties(dto, questionBank)` | `dto` 是方法参数,可能为 null |
| 42 | 同上 | 同上 |
| 60 | `BeanUtils.copyProperties(questionBank, vo)` | `questionBank` 从 `getById` 取出,返回值标注 `@Nullable` |
| 82 | lambda 里的 `BeanUtils.copyProperties(questionBank, vo)` | 同 60 |

### 原因

这是 IDE 的 **Null Analysis(空值分析)** 警告,不是编译错误。Spring 的 `BeanUtils.copyProperties` 源码标注了 `@NonNull`,但编译器**无法静态证明** `dto` 不是 null —— 因为它是方法参数,调用方可能传 null。

### 为什么不是真实 bug

- Controller 层用了 `@Valid @RequestBody`,Spring 保证 `dto` 非 null
- `getById` 返回 null 的场景前面已有 `ThrowUtils.throwIf(questionBank == null, ...)` 拦截了

### 3 种处理方式

```java
// 方案 A:加 Objects.requireNonNull(推荐,既消除警告又做了断言)
import java.util.Objects;
BeanUtils.copyProperties(Objects.requireNonNull(dto, "dto 不能为空"), questionBank);

// 方案 B:关闭 IDE 的 null 分析(治标)
// Preferences → Java → Compiler → Errors/Warnings → Null analysis → 关掉

// 方案 C:加 @SuppressWarnings(不推荐,太啰嗦)
@SuppressWarnings("null")
```

### 一句话总结

> 这是 IDE 静态分析的保守警告 —— 它看到"方法参数"或"@Nullable 返回值"就警告,但代码逻辑上不会 null(Controller 保证、ThrowUtils 拦截)。**可以忽略,不影响运行**;想干净就加 `Objects.requireNonNull`。

---

## Q8:`QueryWrapper` 是什么?常见写法有哪些?

### 作用

`QueryWrapper` 是 MP 的**条件构造器** —— 用 Java 代码(而非手写 SQL)拼接 WHERE 条件,解决动态查询的痛点。

没有 QueryWrapper,你要手写:
```sql
SELECT * FROM question WHERE title LIKE '%Java%' AND difficulty = 'HARD' AND type = 'PROGRAMMING'
```

手拼字符串有 SQL 注入风险,且动态条件要写一堆 if-else。QueryWrapper 把这些内聚成链式 API。

### 本项目实际案例(QuestionServiceImpl.listQuestionVOByPage)

```java
QueryWrapper<Question> queryWrapper = new QueryWrapper<>();
queryWrapper.like(StringUtils.isNotBlank(dto.getTitle()), "title", dto.getTitle())
            .eq(StringUtils.isNotBlank(dto.getType()), "type", dto.getType())
            .eq(StringUtils.isNotBlank(dto.getDifficulty()), "difficulty", dto.getDifficulty());

// tags 原生 SQL(JSON_CONTAINS MP 不内置,用 apply 拼)
if (dto.getTags() != null && !dto.getTags().isEmpty()) {
    for (String tag : dto.getTags()) {
        queryWrapper.apply("JSON_CONTAINS(tags, {0})", "\"" + tag + "\"");
    }
}

Page<Question> page = this.page(new Page<>(1, 10), queryWrapper);
```

生成的 SQL:
```sql
SELECT * FROM question WHERE title LIKE '%Java%' AND type = 'PROGRAMMING' AND difficulty = 'HARD' 
AND JSON_CONTAINS(tags, '"HashMap"') LIMIT 10
```

### 常见方法对照表

| 方法 | 生成 SQL | 用途 |
|------|---------|------|
| `eq("col", val)` | `col = val` | 精确等于 |
| `ne("col", val)` | `col != val` | 不等于 |
| `gt/ge/lt/le("col", val)` | `col > / >= / < / <= val` | 大小比较 |
| `like("col", val)` | `col LIKE '%val%'` | 模糊匹配(两端%) |
| `likeLeft("col", val)` | `col LIKE '%val'` | 左模糊 |
| `likeRight("col", val)` | `col LIKE 'val%'` | 右模糊(可走索引) |
| `in("col", list)` | `col IN (a, b, c)` | 范围查询 |
| `notIn("col", list)` | `col NOT IN (a, b, c)` | 排除范围 |
| `between("col", a, b)` | `col BETWEEN a AND b` | 区间 |
| `isNull("col")` | `col IS NULL` | 空值 |
| `isNotNull("col")` | `col IS NOT NULL` | 非空 |
| `orderByDesc("col")` | `ORDER BY col DESC` | 排序 |
| `groupBy("col")` | `GROUP BY col` | 分组 |
| `select("col1", "col2")` | `SELECT col1, col2` | 指定查询列 |
| `apply("SQL", params)` | 原生 SQL 片段 | 复杂条件(MP 不内置的函数) |

### 条件开关(boolean condition)—— 动态查询核心

每个条件方法都有重载,第一个参数是 `boolean`:

```java
// 三参版:condition 为 false 时不拼这个条件
queryWrapper.like(condition, column, value);

// 两参版:无条件拼(不推荐,需要自己 if 判空)
queryWrapper.like(column, value);
```

配合 `StringUtils.isNotBlank()` 实现"传了才查,不传查全部":

```java
queryWrapper.like(StringUtils.isNotBlank(dto.getTitle()), "title", dto.getTitle())
            .eq(StringUtils.isNotBlank(dto.getType()), "type", dto.getType());
// dto.title 为空 → 跳过 like 条件
// dto.title = "Java" → WHERE title LIKE '%Java%'
```

### `LambdaQueryWrapper`(推荐变体)

普通 `QueryWrapper` 用字符串列名 `"title"`,改字段名时编译不报错,运行时才发现。`LambdaQueryWrapper` 用方法引用,编译期检查:

```java
LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<>();
wrapper.like(StringUtils.isNotBlank(dto.getTitle()), Question::getTitle, dto.getTitle())
       .eq(StringUtils.isNotBlank(dto.getType()), Question::getType, dto.getType());
//                        ^^^^^^^^^^^^^^^^^^^^ 方法引用,改字段名编译报错
```

本项目用字符串版是为了初学易懂,生产环境推荐 Lambda 版。

### `apply` 拼原生 SQL 的注入防护

```java
// ❌ 字符串拼接,有注入风险
wrapper.apply("JSON_CONTAINS(tags, '" + tag + "')");

// ✅ 占位符 {0},参数化查询,防注入
wrapper.apply("JSON_CONTAINS(tags, {0})", "\"" + tag + "\"");
```

`{0}` 是 MP 的参数占位符,底层转成 JDBC 的 `?`,参数化查询,自动转义特殊字符。

---

## Q9:`BaseMapper` 和 `IService` 封装了哪些方法?省了什么代码?

MP 的核心价值:**把单表 CRUD 的 SQL 全部内置,你不写 SQL 也能完成单表操作**。

### `BaseMapper<T>`(Mapper 层继承)

```java
public interface QuestionMapper extends BaseMapper<Question> {}
```

继承后自动拥有 17+ 个方法,无需写 XML:

| 方法 | 生成 SQL | 用途 |
|------|---------|------|
| `insert(entity)` | `INSERT INTO question ...` | 插入 |
| `deleteById(id)` | `DELETE FROM question WHERE id = ?` | 按主键删除 |
| `deleteByIds(idList)` | `DELETE FROM question WHERE id IN (...)` | 批量删除 |
| `delete(wrapper)` | `DELETE FROM question WHERE ...` | 条件删除 |
| `updateById(entity)` | `UPDATE question SET ... WHERE id = ?` | 按主键更新 |
| `update(entity, wrapper)` | `UPDATE question SET ... WHERE ...` | 条件更新 |
| `selectById(id)` | `SELECT * FROM question WHERE id = ?` | 按主键查 |
| `selectByIds(idList)` | `SELECT * FROM question WHERE id IN (...)` | 批量查 |
| `selectOne(wrapper)` | `SELECT * FROM question WHERE ... LIMIT 1` | 查单条 |
| `selectList(wrapper)` | `SELECT * FROM question WHERE ...` | 查列表 |
| `selectPage(page, wrapper)` | `SELECT * FROM question WHERE ... LIMIT ?,?` | 分页查 |
| `selectCount(wrapper)` | `SELECT COUNT(*) FROM question WHERE ...` | 计数 |

**省了什么**:不用写 `QuestionMapper.xml`,不用手写 `INSERT`/`UPDATE`/`SELECT` 的 SQL 和映射。

### `IService<T>`(Service 层继承)+ `ServiceImpl<M, T>`

```java
public interface QuestionService extends IService<Question> {}

@Service
public class QuestionServiceImpl extends ServiceImpl<QuestionMapper, Question> 
        implements QuestionService {}
```

`IService` 在 `BaseMapper` 基础上**再封装一层**,增加批量操作和业务友好方法:

| 方法 | 比 BaseMapper 多了什么 | 用途 |
|------|----------------------|------|
| `save(entity)` | = `insert` + 返回 boolean | 插入,返回成功标志 |
| `saveBatch(list)` | 批量 insert,**自动分批**(默认 1000 条一批) | 批量插入 |
| `saveOrUpdate(entity)` | 自动判断:id 为空 → insert,id 有值 → update | 智能新增或更新 |
| `updateById(entity)` | 同 BaseMapper | 按主键更新 |
| `removeById(id)` | = `deleteById` + 返回 boolean | 逻辑删除(配置了 @TableLogic 自动改 UPDATE) |
| `removeByIds(idList)` | 批量删除 | 批量逻辑删除 |
| `getById(id)` | = `selectById` | 按主键查 |
| `list()` | = `selectList(null)` | 查全部 |
| `list(wrapper)` | = `selectList(wrapper)` | 条件查列表 |
| `page(page, wrapper)` | = `selectPage` + 自动 COUNT | 分页查 |
| `count(wrapper)` | = `selectCount` | 计数 |
| `getOne(wrapper)` | = `selectOne` + 默认抛异常(多条报错) | 查单条 |

### 本项目实际用到的方法对照

| 代码位置 | 调用 | 底层 SQL |
|---------|------|---------|
| `QuestionBankServiceImpl.addQuestionBank` | `this.save(questionBank)` | `INSERT INTO question_bank ...` |
| `QuestionBankServiceImpl.updateQuestionBank` | `this.updateById(questionBank)` | `UPDATE question_bank SET ... WHERE id = ?` |
| `QuestionBankServiceImpl.deleteQuestionBank` | `this.removeById(id)` | `UPDATE question_bank SET is_deleted=1 WHERE id = ?`(逻辑删除) |
| `QuestionBankServiceImpl.getQuestionBankVO` | `this.getById(id)` | `SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0` |
| `QuestionBankServiceImpl.listQuestionBankVOByPage` | `this.page(new Page<>(), wrapper)` | `SELECT * FROM question_bank WHERE ... LIMIT ?` + `SELECT COUNT(*)` |
| `UserServiceImpl.userRegister` | `this.lambdaQuery().eq(User::getUsername, name).count()` | `SELECT COUNT(*) FROM user WHERE username = ?` |
| `QuestionBankQuestionServiceImpl.listQuestionsByBankId` | `this.lambdaQuery().eq(...).list()` | `SELECT * FROM question_bank_question WHERE question_bank_id = ?` |

### `lambdaQuery()` / `lambdaUpdate()`(IService 特有,推荐)

`IService` 还提供 `lambdaQuery()` 和 `lambdaUpdate()`,链式 + Lambda,比 QueryWrapper 更简洁:

```java
// 传统写法
QueryWrapper<User> wrapper = new QueryWrapper<>();
wrapper.eq("username", name);
long count = this.count(wrapper);

// lambdaQuery 链式写法(本项目 UserServiceImpl 用了)
long count = this.lambdaQuery()
        .eq(User::getUsername, name)
        .count();

// lambdaUpdate 链式写法(QuestionBankQuestionServiceImpl 用了)
this.lambdaUpdate()
    .eq(QuestionBankQuestion::getQuestionBankId, bankId)
    .in(QuestionBankQuestion::getQuestionId, questionIds)
    .remove();
```

### 一句话总结

> - **`BaseMapper`**:Mapper 层的单表 CRUD,17+ 方法,免写 XML
> - **`IService` + `ServiceImpl`**:Service 层封装,增加批量操作、`saveOrUpdate`、链式 `lambdaQuery`/`lambdaUpdate`
> - 两者配合,**单表操作零 SQL**,只写业务逻辑。复杂多表 JOIN 才需要自定义 XML

### 面试讲法

> "MP 的 `BaseMapper` 封装了单表 CRUD 的 17 个方法,`IService` 再加一层业务封装(批量、saveOrUpdate、链式 Lambda)。我的项目里 User/QuestionBank/Question 都是单表操作,完全没写 XML,靠继承就完成了增删改查分页。只有后续多表关联查询(如题库下查题目+题库信息)才需要自定义 XML 或 JOIN。"
