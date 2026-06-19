# Step 10 · Docker 沙箱 · 问答归档

> Step 10 判题模块中关于 Docker 沙箱的问答。

---

## D1:Docker 在项目中是怎么用的?需要在 `application.yaml` 里配置吗?

### 核心区别

| 中间件 | 使用方式 | 需要 yaml 配置吗 |
|--------|---------|:---------------:|
| **RabbitMQ** | Spring Boot 通过 TCP(AMQP 协议)连接 | ✅ 配 host/port |
| **Docker** | Java 通过 `ProcessBuilder` 执行本地 `docker` 命令 | ❌ 不配,直接调命令 |

### RabbitMQ 用法(网络调用)

```yaml
spring:
  rabbitmq:
    host: 117.72.62.12
    port: 5672
```

```java
@Autowired
private RabbitTemplate rabbitTemplate;

rabbitTemplate.convertAndSend("judge.queue", submissionId);
```

### Docker 用法(本地命令行调用)

你的 [`DockerCodeSandbox.java`](file:///Users/a1234/Desktop/学习总规划/MyProject/interview-arena/backend/src/main/java/com/charles/interview/arena/judge/codesandbox/DockerCodeSandbox.java) 里,ProcessBuilder 执行的命令等价于在终端敲:

```bash
docker run --rm --cpus=1 --memory=256m --network=none \
  -v /tmp/judge_xxx:/code -w /code \
  judge-java:latest \
  sh -c "javac Solution.java && java Solution < input.txt"
```

```java
ProcessBuilder pb = new ProcessBuilder(command);
Process process = pb.start();  // ← 相当于终端执行 docker run
```

### 一句话总结

> Docker 不是通过网络协议调用的中间件,而是**在运行 Java 代码的服务器上直接执行 `docker` 命令**。所以不需要 yaml 配置,前提是那台服务器已经装了 Docker。

---

## D2:Java 代码里哪个方法真正给 Docker 发送命令?

### 不是某个"发命令"的专用方法

没有 `DockerClient.run()` 这种东西。核心就两步:

```java
// DockerCodeSandbox.java
List<String> command = List.of(
    "docker", "run", "--rm",
    "--cpus=1",
    "--memory=" + memoryLimit + "m",
    "--network=none",
    "-v", tempDirStr + ":/code",
    "-w", "/code",
    image,
    "sh", "-c", runCmd
);

ProcessBuilder pb = new ProcessBuilder(command);
Process process = pb.start();           // ← 真正启动 docker 进程
boolean finished = process.waitFor(timeLimit, TimeUnit.MILLISECONDS);
```

| 代码 | 作用 |
|------|------|
| `new ProcessBuilder(command)` | 把字符串列表组装成要执行的系统命令 |
| `pb.start()` | **真正调用操作系统**,启动 docker 子进程 |
| `process.waitFor(...)` | 等待 docker 容器执行完毕或超时 |

### 等价于你在终端里手动敲

```java
List.of("docker", "run", "--rm", ..., "judge-java:latest", "sh", "-c", "javac ...")
```

就是这条命令:

```bash
$ docker run --rm ... judge-java:latest sh -c "javac Solution.java && java Solution < input.txt"
```

`ProcessBuilder` 是 Java 标准库提供的"调用系统命令"的工具类。

---

## D3:本地 Mac 没装 Docker / 内存不够,怎么测试判题?

### 当前情况

```
你的 Mac(本地开发)
  ├ Java 后端代码
  ├ 连远程 MySQL/Redis/RabbitMQ
  └ 没装 Docker → ProcessBuilder 执行 docker 命令会报错

远程服务器 117.72.62.12
  ├ MySQL ✅
  ├ Redis ✅
  ├ RabbitMQ ✅
  ├ Docker ✅
  └ judge-java 镜像 ❓(还没构建)
```

### 3 种方案

| 方案 | 做法 | 推荐度 | 适合场景 |
|------|------|:------:|---------|
| **A. 本地装 Docker Desktop** | Mac 直接装官方 Docker | ⭐⭐⭐ | 开发调试,最方便 |
| **B. 后端部署到服务器** | jar 包部署到 117.72.62.12,和 Docker 同机 | ⭐⭐⭐ | 生产环境 |
| **C. 轻量级 Docker 运行时** | 装 **Colima** 或 **OrbStack**,比 Docker Desktop 省内存 | ⭐⭐⭐⭐⭐ | Mac 内存紧张 |
| **D. Mock 沙箱** | 写一个假沙箱,本地只测 JudgeService 逻辑 | ⭐⭐ | 先跑通逻辑,不依赖 Docker |

### 推荐:方案 C(轻量级 Docker 运行时)

Mac 内存紧张时,**Colima** 或 **OrbStack** 比 Docker Desktop 轻量很多:

#### Colima

```bash
# 1. 安装
brew install colima

# 2. 启动(默认 2CPU / 2GB 内存,可调整)
colima start --cpu 2 --memory 4

# 3. 测试
docker run --rm hello-world
```

#### OrbStack

```bash
brew install --cask orbstack
```

OrbStack 启动快、占用内存小,体验和 Docker Desktop 接近。

### 推荐:方案 D(Mock 沙箱)作为过渡

如果你暂时不想装任何 Docker,可以先用 Mock 沙箱跑通判题逻辑:

```java
@Component
public class MockCodeSandbox implements CodeSandbox {
    @Override
    public ExecuteResponse execute(String languageCode, String code,
                                   String input, int timeLimit, int memoryLimit) {
        // 模拟执行结果
        return ExecuteResponse.builder()
            .stdout("mock output")
            .exitCode(0)
            .executionTime(10)
            .build();
    }
}
```

等环境搭好了,再切换成 `DockerCodeSandbox`。

---

## D4:DockerCodeSandbox 的完整执行流程是什么?

### 时间线

```
① 写临时文件(1ms)    ② docker run 执行(可能 45ms 或超时)    ③ 收集结果(1ms)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       │                         │                              │
       ▼                         ▼                              ▼
  创建 tempDir                Process 执行 docker            process.waitFor() 返回
  写入 Solution.java          容器内:                         收集 stdout/stderr/exitCode
  写入 input.txt              ├ javac 编译
                              ├ java Solution < input.txt
                              └ stdout → "0 1"
```

### 关键代码(来自 DockerCodeSandbox.java)

```java
// 1. 创建临时目录
Path tempDir = Files.createTempDirectory("judge_");

// 2. 写代码文件 + 输入文件
Files.writeString(tempDir.resolve("Solution.java"), code);
Files.writeString(tempDir.resolve("input.txt"), input);

// 3. 拼 docker 命令
List<String> command = List.of(
    "docker", "run", "--rm",
    "--cpus=1",
    "--memory=" + memoryLimit + "m",
    "--network=none",
    "-v", tempDir + ":/code",
    "-w", "/code",
    "judge-java:latest",
    "sh", "-c", "javac Solution.java && java Solution < input.txt"
);

// 4. 执行 + 计时
long start = System.currentTimeMillis();
Process process = new ProcessBuilder(command).start();
boolean finished = process.waitFor(timeLimit, TimeUnit.MILLISECONDS);
long executionTime = System.currentTimeMillis() - start;

// 5. 超时处理
if (!finished) {
    process.destroyForcibly();
    return ExecuteResponse.builder()
        .errorMessage("Time Limit Exceeded")
        .exitCode(-1)
        .build();
}

// 6. 正常结束,收集结果
String stdout = new String(process.getInputStream().readAllBytes());
String stderr = new String(process.getErrorStream().readAllBytes());
int exitCode = process.exitValue();
```

### 一句话总结

> 写文件 → 拼 docker 命令 → 启动容器执行 → 等待或超时杀进程 → 收集 stdout/stderr/exitCode。

---

## D5:怎么防止用户提交恶意代码?

### Docker 提供的隔离手段

| 危险行为 | 防护措施 | Docker 参数 |
|---------|---------|------------|
| 访问外网、攻击内网 | 禁止容器网络 | `--network=none` |
| 死循环/大量计算 | 限制 CPU | `--cpus=1` |
| 占用大量内存 | 限制内存 | `--memory=256m` |
| 写恶意文件到宿主机 | 只挂载临时目录 + 目录只读(可选) | `-v /tmp/xxx:/code` `--read-only` |
| 执行时间过长 | 超时强制杀掉 | `process.waitFor(timeLimit)` + `destroyForcibly()` |
| 读取宿主机敏感文件 | 只挂载指定的临时目录,不挂载 `/` 等 | `-v` 范围最小化 |

### 当前代码已加的防护

```java
List<String> command = List.of(
    "docker", "run", "--rm",
    "--cpus=1",                          // CPU 限制
    "--memory=" + memoryLimit + "m",     // 内存限制
    "--network=none",                    // 禁网
    "-v", tempDirStr + ":/code",         // 只暴露临时目录
    "-w", "/code",
    image,
    "sh", "-c", runCmd
);
```

### 面试讲法

> "沙箱安全靠 Docker 容器隔离:网络禁用、CPU/内存受限、只挂载临时目录、执行超时强制销毁。生产环境还会配合非 root 用户运行容器、禁止危险系统调用(seccomp)、以及资源审计日志。"

---

## D6:怎么实现 LeetCode 模式(用户只写方法,不写 main)?

### 两种模式对比

**模式 1:用户写完整程序(当前实现)**

```java
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // 自己读输入、调逻辑、输出
    }
}
```

**模式 2:LeetCode 模式(只写方法)**

```java
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // 只写解题逻辑
    }
}
```

### 实现方式:后端拼接测试代码

```
用户代码(只有方法)
    +
后端生成的 Main.java(解析 input → 调用方法 → 打印结果)
    =
完整程序 → 扔进 Docker 执行
```

### 示例(两数之和)

```java
// 用户只写这个
class Solution {
    public int[] twoSum(int[] nums, int target) {
        // ... 逻辑
    }
}

// 后端根据题目自动生成 Main.java
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();

        Solution sol = new Solution();
        int[] res = sol.twoSum(nums, target);
        System.out.println(res[0] + " " + res[1]);
    }
}
```

### 本项目当前选择

当前项目先采用**模式 1**(用户写完整程序),因为:
- 实现简单,通用性强
- 不需要为每道题生成不同的 Main.java

后续如果要更像 LeetCode,再升级到模式 2。

---

## D7:本地没 Docker,能先把 JudgeService 逻辑跑通吗?

可以,用 **Mock 沙箱**。

```java
@Component
@Primary  // Spring 优先注入这个实现
public class MockCodeSandbox implements CodeSandbox {
    @Override
    public ExecuteResponse execute(String languageCode, String code,
                                   String input, int timeLimit, int memoryLimit) {
        // 根据 input 简单返回,验证 JudgeService 的判题流程
        return ExecuteResponse.builder()
            .stdout(input.trim())  // 假设用户代码把输入原样输出
            .exitCode(0)
            .executionTime(10)
            .build();
    }
}
```

这样本地开发不依赖 Docker,专注验证:
- 从 submission 取代码
- 从 test_case 取用例
- 循环每个用例跑沙箱
- 对比 output 判定 AC/WA/TLE/RE
- 存结果

等 Docker 环境搭好,把 `@Primary` 去掉或删除 Mock 实现即可。
