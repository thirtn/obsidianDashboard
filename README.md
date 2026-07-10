# yyObsidianDashboard

一个 Obsidian 仪表盘插件，用于 LLM 驱动的知识库管理工作流。

## 功能

- **文件统计** — 展示 Vault 总文件数、自定义文件夹文件数、孤立/无来源/空白页面统计及健康度评分
- **Token 用量** — 显示今日/本月本地 token 消耗，支持查询 API 余额（兼容 OpenAI / DeepSeek 等）
- **操作日志** — 展示最近的 ingest/query/lint 操作记录，可快速打开完整日志
- **LLM 指令执行** — 内建 query、ingest、lint-wiki 三个指令，直接粘贴内容执行
- **工作热力图** — 基于本地操作记录展示当月活跃度日历
- **插件管理** — 查看已安装插件列表，一键启用/禁用
- **文件夹展开联动** — 点击文件统计中的文件夹名称，自动在侧边栏文件浏览器中定位并展开/折叠

## 安装

### 手动安装

```bash
cd <vault>/.obsidian/plugins
git clone <repo-url> yy-obsidian-dashboard
cd yy-obsidian-dashboard
npm install
npm run build
```

然后在 Obsidian 设置 → 第三方插件 中启用 **yyObsidianDashboard**。

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
| 余额接口地址 | 选填，如 DeepSeek: `https://api.deepseek.com/user/balance` | `https://...` |
| 统计文件夹 | 逗号分隔的文件夹路径 | `raw, wiki, raw/子目录` |

## 使用方法

1. 点击左侧 Ribbon 图标或执行命令 `打开 yyObsidianDashboard` 打开仪表盘
2. 在**文件统计**模块点击 `+ 增加文件统计` 选择需要单独统计的文件夹
3. 鼠标悬停在孤立/无来源/空白数字上可查看文件列表，点击文件名直接打开
4. 点击文件夹名称可在左侧文件浏览器中定位该文件夹
5. 在**LLM 指令执行**模块选择指令、粘贴内容后点击执行
