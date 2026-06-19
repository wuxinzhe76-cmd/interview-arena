# Linux/Mac 终端命令速查表

> 📅 整理日期：2026-06-17
> 🎯 用途：开发调试必备命令，日常查阅

---

## 一、文件操作

| 命令 | 作用 | 示例 |
|------|------|------|
| `cat` | 查看文件全部内容 | `cat application.yaml` |
| `head -N` | 看前 N 行 | `head -20 log.txt` |
| `tail -N` | 看后 N 行 | `tail -50 log.txt` |
| `tail -f` | 实时跟踪文件末尾（看日志神器） | `tail -f /tmp/app.log` |
| `less` | 分页查看（大文件） | `less big.log` |
| `wc -l` | 统计行数 | `wc -l log.txt` |

---

## 二、搜索过滤

| 命令 | 作用 | 示例 |
|------|------|------|
| `grep` | 过滤包含某词的行 | `grep "ERROR" log.txt` |
| `grep -i` | 忽略大小写 | `grep -i "flyway" log.txt` |
| `grep -v` | 反向过滤（不包含） | `grep -v "DEBUG" log.txt` |
| `grep -A 3` | 匹配行 + 后 3 行 | `grep -A 3 "Exception" log.txt` |
| `grep -B 3` | 匹配行 + 前 3 行 | `grep -B 3 "ERROR" log.txt` |
| `grep -C 3` | 匹配行 + 前后各 3 行 | `grep -C 3 "Caused by" log.txt` |
| `grep "a\|b"` | 匹配 a 或 b | `grep "error\|warn" log.txt` |

---

## 三、管道与重定向

| 符号 | 作用 | 示例 |
|------|------|------|
| `|` | 管道：前一个输出给后一个 | `cat log \| grep ERROR` |
| `>` | 覆盖写入文件 | `echo "hi" > a.txt` |
| `>>` | 追加写入文件 | `echo "hi" >> a.txt` |
| `2>&1` | 错误流合并到输出流 | `./mvnw run 2>&1` |
| `tee` | 既显示又存文件 | `cmd \| tee log.txt` |
| `> /dev/null` | 丢弃输出 | `cmd > /dev/null` |

---

## 四、进程管理

| 命令 | 作用 | 示例 |
|------|------|------|
| `lsof -i:8080` | 查看占用 8080 端口的进程 | `lsof -i:8080` |
| `lsof -ti:8080` | 只取进程 ID | `lsof -ti:8080` |
| `kill -9 PID` | 强制杀进程 | `kill -9 12345` |
| `ps aux` | 查看所有进程 | `ps aux \| grep java` |

---

## 五、网络工具

| 命令 | 作用 | 示例 |
|------|------|------|
| `curl -s` | 静默发 HTTP 请求 | `curl -s http://localhost:8080/api/health` |
| `curl -X POST` | 指定方法 | `curl -X POST -d '{}' URL` |
| `curl -H` | 加请求头 | `curl -H "Content-Type: application/json"` |
| `curl -d` | 发送数据 | `curl -d '{"k":"v"}'` |
| `nc -z` | 测试端口连通性 | `nc -z 117.72.62.12 3306` |
| `python3 -m json.tool` | 格式化 JSON | `curl ... \| python3 -m json.tool` |

---

## 六、常用组合技

### 杀掉占用端口的进程

```bash
lsof -ti:8080 | xargs kill -9
```

### 启动应用 + 存日志

```bash
./mvnw spring-boot:run 2>&1 | tee /tmp/app.log
```

### 从日志找错误

```bash
cat /tmp/app.log | grep -i "error\|exception\|caused by"
```

### 测试 API + 格式化输出

```bash
curl -s -X POST http://localhost:8080/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"charles","password":"123456"}' | python3 -m json.tool
```

### 实时看日志

```bash
tail -f /tmp/app.log
```

---

## 七、Mac 专属

| 命令 | 作用 |
|------|------|
| `pbcopy` | 复制到剪贴板 |
| `pbpaste` | 从剪贴板粘贴 |
| `open .` | 在 Finder 打开当前目录 |
| `open URL` | 用默认浏览器打开 URL |

示例：

```bash
cat application.yaml | pbcopy    # 复制文件内容到剪贴板
```
