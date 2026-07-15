# yyObsidianDashboard

一个 Obsidian 仪表盘插件，为 LLM 驱动的知识库管理提供一站式工作面板。

## 功能模块

### 文件统计
- 全库文件总数 + 按文件夹柱状图
- 异常检测：孤儿文件（无反向链接）、无来源文件、空白文件，悬浮查看列表并一键打开
- 健康度评分
- 最近修改文件列表
- 点击文件夹名自动在侧边栏文件浏览器中定位

### 活动热力图
- GitHub 风格 12 个月贡献热力图，支持年份切换
- 每个格子悬浮显示操作次数
- 点击格子创建/打开对应日记
- 周/月/年操作量汇总

### LLM 指令执行
- 支持三种模式：**ingest**（入库）、**query**（问答）、**lint-wiki**（审阅）
- 兼容所有 OpenAI 格式 API（OpenAI / DeepSeek / 本地模型等）
- 执行结果可导出到 vault 文件
- Token 用量本地追踪 + 可选的外部 API 统计
- 余额查询（支持 DeepSeek 等平台的 balance 接口）

### Git 同步
- 初始化仓库、查看状态、暂存文件、提交、推送/拉取
- 支持 HTTPS 认证（username + token）
- 自动推送（可配置间隔）
- 文件回滚
- 近期提交记录（悬浮查看变更文件）

### Remotely Save 同步记录
- 读取 Remotely Save 插件的历史同步数据
- 展开显示每次同步的上传/下载/删除文件列表
- 点击文件路径直接打开

### 快速添加任务
- 三种优先级：紧急 / 一般 / 低优先级
- 进行中任务支持百分比标记
- 自动追加到每日报告对应标题下

### 全文搜索
- 实时索引 vault 中所有 markdown 文件
- 支持文件名、Frontmatter 标题、别名、标签搜索
- `#tag` 语法 + 模糊匹配

### 插件管理
- 列出所有已安装插件，显示版本和启用状态
- 一键启用/禁用
- 点击跳转插件设置页

### 报告生成
- 日/周/月/季/年报告自动创建
- 可配置目录、文件名格式（moment.js 风格）、模板
- 创建前确认开关

### 其他
- 所有模块支持拖拽排序，顺序持久化
- 仪表盘标题和描述可自定义
- 支持文件夹筛选（仅统计指定目录）

## 安装

### 手动安装

```bash
cd <vault>/.obsidian/plugins
git clone <repo-url> yy-obsidian-dashboard
cd yy-obsidian-dashboard
npm install
npm run build
```

然后在 Obsidian 设置 → 第三方插件中启用 **yyObsidianDashboard**。

### 开发

```bash
npm run dev     # 监听模式
npm run build   # 生产构建
```

## 设置

| 选项 | 说明 | 示例 |
|------|------|------|
| API Base URL | OpenAI Compatible 接口地址 | `https://api.openai.com/v1` |
| API Key | API 密钥 | `sk-...` |
| 模型名称 | 模型 ID | `gpt-4o` |
| Temperature | 生成温度 (0–2) | `0.7` |
| Max Tokens | 最大输出 token 数 | `2048` |
| 用量接口地址 | 选填，token 用量统计 API | `https://...` |
| 余额接口地址 | 选填，如 DeepSeek | `https://api.deepseek.com/user/balance` |
| 统计文件夹 | 逗号分隔的文件夹路径 | `raw, wiki` |
| Git 远程地址 | Git 远程仓库 URL | `https://github.com/...` |
| 自动推送 | 启用/禁用 + 间隔（分钟） | `30` |
| 提交模板 | 提交信息模板，支持 `{{date}}` `{{time}}` | `auto: {{date}} {{time}}` |

## 使用方法

1. 点击左侧 Ribbon 图标或执行命令 `打开 Dashboard` 打开仪表盘
2. 点击标题栏齿轮图标配置模型参数和余额接口
3. 点击刷新按钮手动刷新数据
4. 在**文件统计**模块通过设置选择要追踪的文件夹
5. 鼠标悬浮异常数字查看详情，点击文件名直接打开
6. 在**LLM 指令执行**模块选择指令、输入内容后执行
7. 拖拽模块标题栏调整布局顺序
