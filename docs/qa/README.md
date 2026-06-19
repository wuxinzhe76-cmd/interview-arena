# interview-arena · 实践问答归档

> 📁 用途：专门存放 interview-arena 项目实践过程中提出的问题与解答
> 📅 起始日期：2026-06-17
> 📌 命名规则：`Step{N}-{主题}.md`，每个 Step 一份

---

## 索引

| 文件 | 对应阶段 | 主题 |
|------|----------|------|
| [Step2-统一响应封装.md](./Step2-统一响应封装.md) | Step 2 | BaseResponse / ErrorCode / ResultUtils 的设计原理与序列化机制 |
| [Step3-全局异常处理.md](./Step3-全局异常处理.md) | Step 3 | BusinessException / ThrowUtils / GlobalExceptionHandler + Stream API |
| [Step4-引入Validation.md](./Step4-引入Validation.md) | Step 4 | Bean Validation 参数校验 + Lombok 注解处理器 + HTTP 方法语义 |
| [Step5-中间件连接.md](./Step5-中间件连接.md) | Step 5 | 远程 MySQL/Redis 连接 + devtools 热重启 + utf8mb4 |
| [Step6-Flyway数据库迁移.md](./Step6-Flyway数据库迁移.md) | Step 6 | Flyway 迁移 + User 表设计 + 3 个踩坑记录 |
| [Linux命令速查表.md](./Linux命令速查表.md) | 通用 | 开发调试必备终端命令速查 |

---

## 使用约定

- **每完成一个 Step**，把过程中提出的问题汇总一份 Markdown 归档到此目录
- **同一个 Step 内的多个问题**，全部追加到同一份文件，按时间顺序
- **复习时**：先看 `interview-arena-progress.md` 了解推进顺序，再看本目录看技术细节
- **写简历 / 准备面试**：本目录的内容可以直接作为项目深度解释的素材
