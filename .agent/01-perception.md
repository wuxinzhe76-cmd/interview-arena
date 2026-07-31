# 机制 1:感知与输入(Perception)

> 将外部输入转换成 Agent 内部能够识别、校验、继续处理的标准数据。
> 感知层不生成最终 Prompt,不组装完整 Context,只输出 `PerceptionResult`。

---

## 一、解决什么问题

LLM Agent 的输入来源多样(用户文本、PDF、图片、工具返回、API 响应),格式不一、信任级别不同、可能携带注入攻击。感知层负责统一接入、校验、解析、标准化、意图识别,输出结构化的 `PerceptionResult`,为后续编排层提供可靠输入。

## 二、接收什么、输出什么

### 输入

```
用户文本          ──┐
PDF/图片/文件       ──┤
ToolResult(工具返回)──┼──> PerceptionService
请求元数据          ──┤     (userId/sessionId/requestId)
用户和会话信息      ──┘
```

### 输出

```java
public record PerceptionResult(
        List<Observation> observations,   // 标准化观察列表(含来源/可信级别)
        Intent intent,                    // 识别出的意图
        Map<String, Object> entities,     // 提取的实体(domain/knowledgePoint 等)
        RiskAssessment riskAssessment,    // 风险评估结果
        TrustLevel trustLevel             // 整体可信级别
) {}
```

### 处理管线(7 步)

```
原始输入
  ↓
1. 输入类型识别
  ↓
2. 格式与资源校验(Validation)
  ↓
3. 文本或多模态解析(Parsing)
  ↓
4. 数据标准化(Normalization)
  ↓
5. 意图和实体提取(Intent & Entity)
  ↓
6. 安全与信任检查(Guardrail)
  ↓
7. 输出 PerceptionResult
```

### 不负责(单一职责)

- 读取长期记忆 -> Memory 层
- 决定下一步 -> Planning 层
- 完整上下文组装 -> ContextAssembler
- 执行工具 -> Tool 层
- 循环控制 -> Orchestrator
- 反思 -> Reflection 层

### 关键边界

感知层只识别意图(IntentClassifier),真正决定把请求交给哪个执行流程由编排层完成(RouteDispatcher):
```
感知层:识别这是什么请求
编排层:决定由谁处理这个请求
```

## 三、Java 类设计

### 主目录

```
agent/perception/
├── PerceptionService.java          # 感知处理主线,编排 7 步管线
├── validation/
│   ├── InputFormatValidator.java   # 文本非空/字段完整/JSON Schema 校验
│   ├── FileValidator.java          # MIME 白名单/文件大小/数量限制
│   └── ResourceLimitValidator.java # Token 预估/请求频率/并发限制
├── parsing/
│   ├── PdfContentParser.java       # PDF -> 页面文本+表格+页码(复用 PDFBox)
│   ├── ImageContentParser.java     # 图片 -> OCR/VLM 描述
│   └── ToolResultParser.java       # ToolResult -> 标准 Observation
├── normalization/
│   ├── TextNormalizer.java         # Unicode 规范化/不可见字符清理/换行统一
│   └── ObservationNormalizer.java  # 多模态结果统一为 Observation 结构
├── intent/
│   ├── IntentClassifier.java       # 两级路由:规则优先 + LLM 兜底
│   └── EntityExtractor.java        # 实体提取(domain/knowledgePoint 等)
└── model/
    ├── RawInput.java               # 原始输入封装(含类型/来源/元数据)
    ├── Observation.java            # 标准化观察(content/source/trustLevel)
    ├── PerceptionResult.java       # 感知结果(record)
    ├── Intent.java                 # 意图枚举
    ├── RiskAssessment.java         # 风险评估结果
    └── TrustLevel.java             # UNTRUSTED/TRUSTED/VERIFIED
```

### 横切安全

```
agent/guardrail/input/
├── InputGuardrail.java             # 安全门面,组合下面三个
├── PromptInjectionDetector.java    # 四层注入检测(规则->分类器->LLM->兜底)
├── InputRiskClassifier.java        # 风险分级(LOW/MEDIUM/HIGH/CRITICAL)
└── SensitiveInputFilter.java       # 敏感信息检测/脱敏(邮箱/手机号/身份证)
```

## 四、Harness 在这一层增强什么(4 类)

### 第一类:输入治理

| 治理项 | 说明 | 实现 |
|--------|------|------|
| 文本长度限制 | 防止超长输入撑爆上下文 | 自研 ResourceLimitValidator |
| 文件大小和数量限制 | 防止超大/批量文件 | 自研 FileValidator |
| Token 预估 | 防止 Abandoned Consumption | 自研(复用 TokenBudget 估算) |
| 请求频率限制 | 防 DoS | Sentinel `@SentinelResource` |
| 文件类型白名单 | 只允许安全 MIME | 自研 FileValidator |
| 资源消耗限制 | 防Denial of Wealth | 自研 ResourceLimitValidator |

### 第二类:标准化

| 标准化项 | 说明 | 实现 |
|---------|------|------|
| Unicode 规范化 | 检测 Unicode 混淆攻击 | 自研 TextNormalizer |
| 不可见字符清理 | 零宽字符/控制字符 | 自研 TextNormalizer |
| 换行和编码统一 | UTF-8 规范 | 自研 TextNormalizer |
| JSON Schema 校验 | 结构化输入格式 | Spring Validation + 自研 |
| ToolResult 格式统一 | 工具返回标准化 | 自研 ToolResultParser |
| PDF/图片解析结构化 | 保留结构不扁平化 | 自研 PdfContentParser/ImageContentParser |

### 第三类:信任与安全标记

```
用户输入          -> UNTRUSTED
外部 PDF/网页/API -> UNTRUSTED
工具返回          -> UNTRUSTED(可能含间接注入)
系统内部状态      -> TRUSTED
经过验证的 DB 事实 -> VERIFIED
```

不直接删除"可疑文字",而是给内容标记来源和可信等级。后续 ContextAssembler 根据信任级别决定如何注入 Prompt。

### 第四类:输入风险检测

| 检测项 | 说明 | 实现 |
|--------|------|------|
| Prompt Injection | 四层分层检测 | guardrail/input/PromptInjectionDetector |
| 敏感信息 | 邮箱/手机号/身份证/银行卡 | guardrail/input/SensitiveInputFilter |
| 恶意文件 | 文件含恶意指令 | FileValidator + 解析后扫描 |
| 越权意图 | 识别越权请求 | InputRiskClassifier |
| 异常编码 | Base64 隐藏指令等 | TextNormalizer 检测 |
| 间接注入 | 工具返回中的注入 | ToolResultParser 标记不可信 |

#### Prompt Injection 四层检测

```
第一层:确定性规则检测(低成本,快速)
  - 威胁短语匹配("ignore previous instructions" 等)
  - Unicode 规范化检测
  - 不可见字段检查
  - Base64 异常编码检查
  - HTML/Markdown 隐藏内容过滤
  - 超长/重复字符串检查

第二层:分类器检测(中等成本)  ← 第一版可选,后续增强
  - 小模型分类器识别规则绕过

第三层:隔离的 LLM 检测(高成本,兜底)  ← 第一版可选
  - 独立 LLM 安全判断

第四层:执行入口兜底(基础防护)
  - 工具白名单 + 权限校验 + 参数 Schema(在 tool 层)
```

## 五、IntentClassifier 设计(两级路由)

### 第一级:规则路由(最快,处理已知意图)

```java
// 关键词匹配,80% 请求在此分流
if (containsKeyword(query, "开始面试", "面试")) return Intent.START_INTERVIEW;
if (containsKeyword(query, "上次", "之前", "历史")) return Intent.MEMORY_QUERY;
if (containsKeyword(query, "什么是", "原理", "区别")) return Intent.KNOWLEDGE_QUERY;
// 默认走 LLM
```

### 第二级:LLM 路由(规则不命中时)

```java
// 使用小模型(DeepSeek v4flash)做意图分类
// Spring AI ChatClient + 结构化 DTO
IntentResult result = chatClient.prompt()
    .system("你是意图分类器,输出 JSON: {intent: '...', confidence: 0.9}")
    .user(query)
    .call()
    .entity(IntentResult.class);
```

### Intent 枚举

```java
public enum Intent {
    START_INTERVIEW,      // 开始面试
    ANSWER_QUESTION,      // 提交面试回答
    END_INTERVIEW,        // 结束面试
    KNOWLEDGE_QUERY,      // 知识题查询(原 RAG_ONLY)
    MEMORY_QUERY,         // 历史追问(原 MEMORY_ONLY)
    HYBRID_QUERY,         // 混合查询(原 RAG_AND_MEMORY)
    SAVE_TO_KB,           // 保存到知识库
    UNKNOWN               // 未知意图,交编排层兜底
}
```

## 六、当前代码迁移映射

| 当前代码 | 新位置 | 动作 |
|---------|--------|------|
| `harness/security/InputSanitizer` | `guardrail/input/PromptInjectionDetector` | 移动 + 升级为四层检测 |
| `harness/security/SecurityGuard` | `guardrail/input/InputGuardrail` | 移动 + 重组为门面 |
| `memory/retrieval/RetrievalRouter` | `perception/intent/IntentClassifier`(规则部分) | 拆入,关键词路由升级 |
| `memory/model/RetrievalRoute` | `perception/model/Intent` | 升级为意图枚举 |
| `rag/service/PdfImportService`(解析部分) | `perception/parsing/PdfContentParser` | 解析逻辑拆出 |
| `rag/service/PdfImportService`(索引部分) | 留在 `rag/service/` | 索引逻辑保持 |
| Controller 层 `@Valid` | `perception/validation/InputFormatValidator` | 下沉到感知层 |
| 无 | `PerceptionService` / `PerceptionResult` / `EntityExtractor` 等 | 新增 |

## 七、第一版实现程度

### 做

- [x] 文本输入处理
- [x] PDF 输入解析(复用 PDFBox)
- [x] 图片基础解析(第一版可简化或跳过)
- [x] 格式和大小校验
- [x] 文本规范化(Unicode/不可见字符)
- [x] 基础 Prompt Injection 检测(规则层,第一层)
- [x] 意图分类(规则 + LLM 两级,LLM 用 DeepSeek v4flash)
- [x] 实体提取(LLM 辅助)
- [x] 统一 PerceptionResult 输出

### 不做(后续迭代)

- 复杂音视频解析
- 安全分类模型(第二层)
- 隔离 LLM 检测(第三层)
- 三层复杂动态路由全量(Embedding 层)
- 多模态融合

## 八、实现方式选择

| 能力 | 框架/自研 | 说明 |
|------|----------|------|
| 格式校验 | Spring Validation `@Valid` + JSR303 | 已在用 |
| 资源限制 | 自研 ResourceLimitValidator | 业务特定 |
| PDF 解析 | Apache PDFBox | 已有依赖 |
| 图片 OCR | 多模态模型/OCR 服务 | 第一版可简化 |
| 意图分类(规则) | 自研关键词匹配 | 零成本 |
| 意图分类(LLM) | Spring AI ChatClient + DeepSeek v4flash | 小模型,低成本 |
| 实体提取 | Spring AI ChatClient + 结构化 DTO | LLM 辅助 |
| 限流 | Sentinel `@SentinelResource` | 已在用 |
| 注入检测 | 自研(四层分层) | 业务规则 |
| PerceptionResult 等 | 自研 record/enum | 业务契约 |

## 九、调用关系

```
Controller
   ↓
PerceptionService
   ├── InputFormatValidator        (校验)
   ├── FileValidator               (文件校验)
   ├── ResourceLimitValidator      (资源限制)
   ├── PdfContentParser            (PDF 解析)
   ├── ImageContentParser          (图片解析)
   ├── ToolResultParser            (工具返回解析)
   ├── TextNormalizer              (文本规范化)
   ├── ObservationNormalizer       (观察标准化)
   ├── InputGuardrail              (安全检查)
   │   ├── PromptInjectionDetector
   │   ├── InputRiskClassifier
   │   └── SensitiveInputFilter
   ├── IntentClassifier            (意图识别)
   │   ├── 规则层
   │   └── LLM 层(DeepSeek v4flash)
   └── EntityExtractor             (实体提取)
   ↓
PerceptionResult
   ↓
Orchestrator (编排层路由)
```
