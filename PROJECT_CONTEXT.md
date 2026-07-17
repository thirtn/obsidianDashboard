# yyObsidianDashboard — 项目上下文

> 供 AI 会话快速了解本仓库。用户功能说明见 [README.md](./README.md)。

## 一句话

Obsidian 第三方插件，提供 **LLM 驱动的知识库工作流仪表盘**：文件统计、热力图、LLM 指令、Git 同步、Remotely Save 记录、任务快添、全文搜索、插件管理。

## 标识与构建

| 项 | 值 |
|---|---|
| npm 包名 | `llm-wiki-dashboard` |
| 插件 ID | `yy-obsidian-dashboard` |
| 主类 | `LLMWikiDashboardPlugin`（`src/main.ts`） |
| View 类型 | `yy-obsidian-dashboard`（`DASHBOARD_VIEW_TYPE`） |
| 入口构建 | `src/main.ts` → `main.js`（esbuild） |
| 样式 | `styles.css`（Obsidian 插件标准） |
| 配置持久化 | Obsidian `data.json`（`loadData` / `saveData`） |

```bash
npm install
npm run dev      # esbuild watch
npm run build    # tsc 类型检查 + 生产构建
```

安装位置：`<vault>/.obsidian/plugins/yy-obsidian-dashboard/`

## 目录结构

```
src/
├── main.ts                 # 插件入口、SettingTab、activateView
├── types.ts                # 全部类型 + DEFAULT_SETTINGS
├── services/               # 业务逻辑（无 DOM）
│   ├── FileService.ts      # 文件统计、健康度、最近修改
│   ├── HeatmapService.ts   # 活动热力图数据追踪
│   ├── LLMService.ts       # OpenAI Compatible API、Token 统计、流式
│   ├── GitService.ts       # 通过 child_process 执行 git（仅桌面）
│   ├── LogService.ts       # 读取/写入 wiki/log 操作日志
│   ├── PluginManageService.ts
│   ├── RemotelySaveService.ts  # 读 IndexedDB（Remotely Save 插件）
│   ├── ReportService.ts    # 周/月/季/年报表路径、模板、缺失检测
│   └── VaultPersistenceService.ts  # vault 内 JSON 读写 + localStorage
├── ui/
│   ├── DashboardView.ts    # ItemView 主视图，组装 services + components
│   └── components/         # UI 模块，均继承 BaseComponent
│       ├── BaseComponent.ts
│       ├── HeaderComponent.ts      # 标题、刷新、Obsidian 版本、实时时钟 + 农历/干支/时辰、Token 条、模型配置入口
│       ├── SearchComponent.ts      # 全文搜索（固定顶部，不在 moduleOrder）
│       ├── WorkspaceBarComponent.ts # 今日工作区顶栏（固定顶部）
│       ├── FileStatsComponent.ts
│       ├── HeatmapComponent.ts
│       ├── LLMCommandComponent.ts  # 支持流式输出
│       ├── OperationLogComponent.ts # 读取 wiki/log 展示最近 LLM 记录
│       ├── GitSyncComponent.ts
│       ├── RemotelySaveComponent.ts # 标题：云同步记录
│       ├── TaskQuickAddComponent.ts
│       ├── PluginManageComponent.ts
│       └── utils.ts        # 相对时间、popover、模块折叠状态、上次 LLM 输出
├── modals/                 # Obsidian Modal 弹窗
│   ├── ModelConfigModal.ts
│   ├── FolderConfigModal.ts
│   ├── ReportConfigModal.ts
│   └── GitConfigModal.ts
└── utils/                  # 纯工具（无 DOM、无 Obsidian API）
    └── lunar.ts            # 农历/干支/生肖/时辰（1900–2100 数据表）
```

## 架构模式

```
LLMWikiDashboardPlugin
  ├── registerView → DashboardView
  ├── PluginSettingTab（全局设置：API、报表、Git 等）
  └── saveSettings → 广播到所有打开的 DashboardView

DashboardView (ItemView)
  ├── Services（单例 per view）
  ├── Components（map by id）
  └── render()
        ├── header + search（固定顺序，不参与拖拽）
        └── moduleOrder 顺序渲染可拖拽模块
```

**分层约定：**

- **Service**：纯逻辑，调用 Obsidian API / 外部 HTTP / git / IndexedDB
- **Component**：DOM 渲染，继承 `BaseComponent`，实现 `id` + `render()`
- **Modal**：复杂表单配置，从 Component 或 SettingTab 打开
- **Settings**：集中在 `types.ts` 的 `DashboardSettings`，变更通过 `saveSettings` 持久化并 `updateSettings` 广播

## 仪表盘模块

| moduleOrder ID | Component | 说明 |
|---|---|---|
| `file-stats` | FileStatsComponent | 文件夹统计、异常检测、健康度、最近文件 |
| `heatmap` | HeatmapComponent | GitHub 风格热力图，点击开/建日报 |
| `llm-command` | LLMCommandComponent | ingest / query / lint-wiki（流式） |
| `operation-log` | OperationLogComponent | 展示 wiki/log 最近 8 条 LLM 记录 |
| `git-sync` | GitSyncComponent | init / status / commit / push / pull |
| `remotely-save` | RemotelySaveComponent | 云同步记录（Remotely Save 历史） |
| `task-quickadd` | TaskQuickAddComponent | 追加任务到当日日报 |
| `plugin-manage` | PluginManageComponent | 启用/禁用插件 |

固定顶部（不在 `moduleOrder`，不参与拖拽/折叠）：`header`、`search`、`workspace-bar`

每个模块支持：
- **拖拽排序**：`moduleOrder` 持久化到 `data.json`
- **折叠/展开**：状态存 `localStorage`（key `llm-wiki-dashboard-module-collapsed`）
- **显示/隐藏**：`moduleVisibility` 存 `data.json`，在设置 → 模块显示 中切换

默认顺序见 `DEFAULT_SETTINGS.moduleOrder`（`types.ts`）。可选模块 ID 见 `MODULE_IDS` + `MODULE_LABELS`。

## 核心类型与设置

所有设置在 `DashboardSettings`（`src/types.ts`），关键字段：

- **LLM**：`apiBaseUrl`, `apiKey`, `modelName`, `temperature`, `maxTokens`
- **Token**：`tokenUsageApiUrl`, `tokenBalanceApiUrl`, `tokenUsageDataPath`
- **文件统计**：`trackedFolders`（默认 `raw, wiki, outputs, concepts, entities`）
- **报表**：`reportConfigs`（daily/weekly/monthly/quarterly/yearly，含目录、文件名格式、模板）
- **任务**：`taskDefaults`（各优先级默认输入、进行中任务百分比）
- **Git**：`gitEnabled`, `gitRemoteURL`, `gitRemoteName`, `gitBranchName`, `gitUsername`, `gitPassword`, `gitAutoPush*`, `gitCommitTemplate`
- **UI**：`dashboardTitle`, `dashboardDesc`, `moduleOrder`, `moduleVisibility`
- **启动行为**：`openOnStartup`（Obsidian 启动后自动打开 Dashboard）
- **持久化路径**：`heatmapDataPath`, `tokenUsageDataPath`

设置合并：`loadSettings` 对 `reportConfigs`、`taskDefaults` 做 deep-merge，新字段自动补默认值。

## Vault 约定（插件假设的目录）

插件面向 **LLM Wiki 工作流**，默认路径如下（可在设置中改）：

| 路径 | 用途 |
|---|---|
| `raw/` | 原始素材 |
| `wiki/` | 结构化 wiki |
| `outputs/` | LLM 指令输出（如 `outputs/ingest-{timestamp}.md`） |
| `concepts/`, `entities/` | 知识实体 |
| `raw/dayReport/` | 日报（默认 `YYYY/MM/YYYY-MM-DD.md`） |
| `raw/weekReport/`, `monthReport/`, … | 周/月/季/年报 |
| `wiki/log/` | 操作日志（LogService 解析 ingest/query/lint） |
| `.dashboard/heatmap.json` | 热力图数据（vault 持久化） |
| `.dashboard/token-usage.json` | Token 用量（vault 持久化） |

Frontmatter 约定（FileService 异常检测）：

- **无来源**：缺少 `source` / `sources` / `origin`
- **孤儿**：无任何反向链接（links + embeds）

任务快添写入日报的 Markdown 小节：`### 🔴 紧急/重要`、`### 🟡 一般`、`### 🟢 低优先级`、持续任务段。

## 各 Service 要点

### FileService
- `getStats(trackedFolders)` → 总数、文件夹计数、orphan/nosource/empty、healthScore
- 健康度公式在 `calcHealthScore` 内
- 支持点击文件夹名定位到 Obsidian 文件浏览器

### HeatmapService
- `vault.on("modify")` 计数，`localStorage` + vault JSON 双写
- `startTracking` / `stopTracking` 绑定 view 生命周期

### LLMService
- `executeCommand("ingest"|"query"|"lint-wiki", input, onChunk?)` → POST `/chat/completions`
- 若传入 `onChunk`，走 `fetch` + SSE 流式（`stream: true`），边生成边回调；否则走 `requestUrl` 一次性返回
- `testConnection()` → GET `/models`
- Token：本地按日累计 + 可选外部 usage/balance API（DeepSeek 等）
- 需 `setApp()` 注入 vault 以持久化

### GitService
- **仅桌面端**：`Platform.isMobile` 时抛错
- 使用 `execSync` 在 vault 根目录执行 git
- HTTPS 认证：`gitUsername` + `gitPassword`（GitHub Token）
- 支持 init、remote、stage、commit、push、pull、log、checkout 回滚

### RemotelySaveService
- 读浏览器 IndexedDB：`remotelysavedb` / `syncplanshistory`
- 依赖用户已安装并使用过 [Remotely Save](https://github.com/remotely-save/remotely-save) 插件

### LogService
- 扫描 `wiki/log/*.md`，解析最近 N 条 ingest/query/lint 记录

## DashboardView 生命周期行为

- **onOpen**：热力图追踪、vault 变更 debounce 刷新文件统计、Git 轮询/自动 push、tab 切换超 5 分钟自动 refresh
- **render**：离屏构建 DOM → 原子替换，保留 scroll；模块拖拽改 `moduleOrder` 并 save
- **onClose**：清理 timer、vault/workspace 监听、Git 组件 destroy

## UI / CSS 约定

- 根容器：`.dashboard-root`，可滚动区：`.dashboard-scroll`
- 模块：`.dashboard-module`，标题：`.dashboard-module-header`
- 拖拽把手：`.dashboard-module-drag-handle`（render 时动态插入）
- 悬浮提示/Popover：`.dashboard-heatmap-tip`, `.dashboard-popover`（render 前清理 body 残留）
- 样式全部在 `styles.css`，组件内少量 inline style

## 开发注意事项

1. **不要 bundle obsidian**：esbuild `external` 已配置
2. **Git 功能**：移动端不可用，改 GitService 时需考虑 `Platform.isMobile`
3. **敏感信息**：API Key、GitHub Token 存在 `data.json`，勿提交到 git
4. **新增模块步骤**：
   - 新建 `*Component.ts` 继承 `BaseComponent`，定义唯一 `id`
   - 在 `DashboardView` 注册 component + 必要时新建 Service
   - 将 `id` 加入 `DEFAULT_SETTINGS.moduleOrder`
5. **设置变更**：Component 通过回调 `onSettingsChange` → plugin `saveSettings` → 所有 view `updateSettings`
6. **类型优先改 `types.ts`**，DEFAULT 与接口保持同步
7. **中文 UI**：用户面向文案多为中文，新功能保持一致

## 与 README 的差异

- README 面向最终用户；本文面向开发者/AI 会话
- `package.json` 名 `llm-wiki-dashboard` vs 展示名 `yyObsidianDashboard` / manifest `dashboard`
- `search`、`workspace-bar` 固定渲染在 header 下方，不在 `moduleOrder`、不可拖拽/折叠
- `MODULE_IDS` 定义了「可拖拽 + 可开关」模块的白名单，与 `DEFAULT_SETTINGS.moduleOrder` 同步

## 常见改动入口

| 需求 | 首选文件 |
|---|---|
| 新增全局设置项 | `types.ts` + `main.ts` (SettingTab) + 相关 Component |
| 改 LLM 行为/提示词 | `LLMService.ts`, `LLMCommandComponent.ts` |
| 改文件统计逻辑 | `FileService.ts`, `FileStatsComponent.ts` |
| 改热力图/报表创建 | `HeatmapService.ts`, `HeatmapComponent.ts`, `ReportConfigModal.ts` |
| 改 Git 流程 | `GitService.ts`, `GitSyncComponent.ts` |
| 改模块布局/拖拽 | `DashboardView.ts`, `styles.css` |
| 改样式 | `styles.css` |

## 依赖

- **运行时**：Obsidian API（`obsidian` npm 包，devDependency）
- **构建**：TypeScript 5、esbuild 0.19
- **无运行时 npm 依赖**（Git 用 Node `child_process`）

---

## 待办优化（Roadmap）

以下是已知但尚未落地的优化，按优先级排列。做的时候可作为开发指引。

### P1 — 架构级重构（收益大、需要设计）

1. **`render()` 局部化 / 增量刷新**
   - 现状：`DashboardView.render()` 每次都整页重建 DOM，输入框状态、popover 会被清空/闪烁。
   - 方案：让 `BaseComponent` 的 `render()` 只做首次挂载，`update(data?)` 做增量刷新；`DashboardView` 首次构建后只在必要时调用具体组件的 `update()`，避免全量 render。
   - 变动面：`BaseComponent`、每个 Component 的 render 方法要区分「首次」和「更新」两种状态。
2. **`FileService.getStats` 缓存 + 失效**
   - 现状：每次 render 或 vault 变更 debounce 后都完整重算。
   - 方案：在 `FileService` 内加缓存字段；订阅 `metadataCache.on("changed")` / `vault.on("modify")` 置 dirty，`getStats` 命中缓存直接返回；vault 大时收益明显。
3. **Services 集中注入到 Component**
   - 现状：`RemotelySaveComponent`、`LLMCommandComponent`、`FileStatsComponent` 内部再次 `new` service，和 `DashboardView` 里的实例重复。
   - 方案：所有 service 只在 `DashboardView` new 一次，通过构造函数传给 Component；便于设置广播和资源统一释放。
4. **`GitService.execSync` → `execFile`（异步）**
   - 现状：`git status` / `git log` 大仓库上会阻塞 Obsidian 主线程若干毫秒。
   - 方案：改成 `execFile` + Promise，`GitService` 所有方法都 async；`GitSyncComponent` 已经在 await，改动集中在 service 内部。

### P2 — 长期改进（无紧迫性）

1. **统一走 Obsidian 事件 API**：`onOpen` 里的 `vault.on` / `workspace.on` 手动 off 改为 `this.registerEvent`；DOM 事件用 `this.registerDomEvent`。防止将来漏 off 造成内存泄漏。
2. **`styles.css` 按模块拆分**：目前 1700+ 行单文件；可拆成 `header.css` / `module.css` / `heatmap.css` / `git.css` / `sync.css` / `popover.css` 等，esbuild 打包时合并。
3. **Component 生命周期统一**：目前只有 `GitSyncComponent` 实现了 `destroy()`。为将来加带 timer/listener 的组件铺路：`DashboardView.onClose` 遍历 `this.components` 调 `destroy()`；每个组件默认 `destroy` no-op，需要清理的 override。
4. **全局悬浮元素统一管理**：`popover` / `heatmap-tip` 各组件在 `document.body` 上直接 create；建议统一放到 `.dashboard-root` 下（或加个共享的 `PopoverManager`），组件销毁时自动清理。

### 已完成的优化（本轮 P0）

- Git 状态轮询默认 30s，可在设置中配置（`gitPollInterval`）；设 0 关闭轮询
- 清理所有 `console.log("[yyDashboard] ...")` 调试输出
- `LLMService` 构造函数直接接受 `app`，去掉二段初始化的 `setApp`
- `HeaderComponent.refreshTokenBar` 用实例引用替代 `document.getElementById`（避免多 tab 冲突）
- `HeatmapService.startTracking` 同时监听 `modify` / `create` / `rename`
- API Key、GitHub Token 设置项加显式明文存储提醒

### 已完成的优化（第二轮 bug 扫查）

- **Heatmap ◀▶ 切换年份重复叠加**：切换前 `container.empty()`
- **`DashboardView.onClose` 清理悬浮元素**：`.dashboard-heatmap-tip` / `.dashboard-popover` 遗留问题；同时对所有 `components` 遍历调 `destroy()`
- **Heatmap 计数重复**：`create` + `modify` 会对同一动作 +2，改成 300ms debounce
- **`GitSyncComponent` / `FileStatsComponent` 去全局 ID**：改用组件内 `modEl` / `statsContainer` / `recentContainer` 引用，避免多 Dashboard tab 干扰；`FileStatsComponent` 新增 `refreshExternal()` 供 vault change 调用
- **LM 流式保护 + AbortController**：`LLMService.executeCommand` 支持 `signal`；`LLMCommandComponent` 执行中「▶ 执行」变成「⏹ 中止」；执行中 `render()` 直接复用现有 `modEl`，不再重建；`destroy()` 中止请求；导出前用 `adapter.exists("outputs")` 检查目录，报错提示改为 Notice
- **Search 索引懒构建**：`SearchComponent` 用 `indexDirty` 标志，仅在 vault `create/delete/rename` + `metadataCache.changed` 时置脏，focus 时按需重建；`destroy()` 清理监听

---

*最后通读日期：2026-07-17（P0/P1 优化后 + 二轮 P0 补丁）*
