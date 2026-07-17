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
- **Git**：`gitEnabled`, `gitRemoteURL`, `gitRemoteName`, `gitBranchName`, `gitUsername`, `gitPassword`, `gitAutoPush*`, `gitCommitTemplate`, `gitPollInterval`（状态轮询秒），`gitPushTimeout`（push/pull 单次超时，分钟，0=不限时）
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
- 全部走 `execFileSync("git", args, …)`（argv 而非 shell）—— 路径含中文/空格/emoji/括号都能正确传给 git
- `getStatusFiles` 用 `git status --porcelain=v1 -z`（NUL 分隔），正确处理 rename、CRLF、BOM
- HTTPS 认证：`gitUsername` + `gitPassword`（GitHub Token）通过 `-c http.extraHeader=Authorization: Basic <b64>` 传入，**token 不进 URL / reflog / 进程参数**
- push 用 remote 名字 + `--set-upstream`，且成功后主动 `git fetch` 一次同步本地 `refs/remotes/<remote>/<branch>`
- `push` 内置**超时校验回退**：`execFileSync` TIMEOUT 时不直接抛错，先跑 `verifyRemoteMatchesLocal`（fetch 后比较本地 HEAD 与远端 tip 的 SHA），相等就返回「推送成功（客户端超时，但服务端已完成）」，避免「已推送但 Dashboard 显示领先 1 次提交」的假失败
- push/pull 单次超时可配置（`gitPushTimeout`，分钟，0=不限时；本地命令如 status/commit/log 固定 30 秒）
- `ensureRemote` 检测已有同 URL remote 就复用，避免重复添加
- 支持 init、remote、stage、commit、push、pull、log、checkout 回滚

### RemotelySaveService
- 读浏览器 IndexedDB：`remotelysavedb` / `syncplanshistory`
- 依赖用户已安装并使用过 [Remotely Save](https://github.com/remotely-save/remotely-save) 插件

### LogService
- 扫描 `wiki/log/*.md`，解析最近 N 条 ingest/query/lint 记录

### utils/lunar.ts（纯工具）
- `getLunarInfo(date)` → `{ganzhiYear, zodiac, lunarMonth, lunarDay, shichen}`
- 内置 1900–2100 年农历数据表（每年 16 位编码：闰月位 + 12 个月大小 + 闰月是否 30 天）
- 干支纪年：`(year - 4) % 60` → 10 天干 + 12 地支，1900 甲子起
- 十二时辰：23-1 子时、17-19 酉时……按小时切分
- 完全离线、无依赖；HeaderComponent 每秒 tick 时按「日期+小时」变化才刷新，省 CPU

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
4. **`GitService` 同步 → `spawn` 异步（未完成）**
   - 现状：`execFileSync` 已用 argv 版本，但仍是**同步阻塞**。push 大 pack 时 Obsidian 主线程假死；用户看不到 `Writing objects: x%` 进度；「取消」按钮无法真正 kill git 进程。
   - 方案：改成 `spawn` + Promise + 事件流：stdout/stderr 逐块 emit 用于进度条、`child.kill('SIGTERM')` 支持中止、返回 Promise 让 `GitSyncComponent` 保持 await；本地 status/log 之类快命令可继续用同步版本。
   - 依赖 UI 侧：`GitSyncComponent` 需要新增进度条 DOM 和 Cancel 按钮。

### P1.5 — 待决策：云同步记录持久化

**背景**：`RemotelySaveComponent` 直接从 Remotely Save 的 IndexedDB (`remotelysavedb.syncplanshistory`) 读取历史。Remotely Save 有自己的清理策略（版本不同上限 5~100 条不等），超上限就删最老的；用户重装 / 清缓存也会全部丢失。Dashboard 目前只是「实时快照」，长期回看不可靠。

**触发条件**：先跑诊断脚本确认 Remotely Save 当前保留上限，若 ≥ 100 条且用户日均同步 < 20 次，可不做。否则做。

**方案（做的话）**：
1. `RemotelySaveService` 新增 `snapshotHistory()`：读 IndexedDB → 与 `.dashboard/sync-history.json` 合并 → 按 `ts` 去重 → 落盘
2. `DashboardView` 在 view 打开时和 vault 每次变更 debounce 后调用 `snapshotHistory()`
3. `getSyncHistory` 优先读 vault JSON，回落到 IndexedDB
4. 新增设置项 `syncHistoryRetentionDays`（默认 90 天），清理超期条目
5. 保持向前兼容：无 JSON 文件时行为等同现状

**代价**：多一个 vault 文件（跟 `heatmap.json` / `token-usage.json` 同级）、每次同步后多一次落盘、需要处理 IndexedDB 打不开时的回退。

**收益**：不受 Remotely Save 清理策略和缓存清理影响，可长期回看；跟 heatmap 同一模型，一致性好。

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

### 已完成的优化（Git 同步模块深度修复）

- **删除废弃的 ReportHubComponent**（功能与热力图重复），从 `moduleOrder` / `MODULE_IDS` / `MODULE_LABELS` / `moduleVisibility` 默认值全部移除
- **修复 Dashboard 折叠状态在 `update()` 重建后丢失**：body 隐藏改用 CSS 类而不是重建 DOM
- **修复「一次只能同步一个文件」**：所有 git 命令改用 `execFileSync` 走 argv，不再走 shell 拼接；路径含空格/中文/emoji/括号都能正确传入
- **`getStatusFiles` 改用 `--porcelain=v1 -z`**：NUL 分隔避免 CRLF/BOM，正确处理 rename 的成对路径
- **修复 push 超时后弹窗卡死**：`GitSyncComponent` push modal 分「stage 失败 → 保留弹窗」/「commit 成功但 push 超时 → 提示可能已同步 + 关弹窗」/「commit 成功但 push 其他错 → 提示已本地提交 + 关弹窗」三种处理，都不再卡
- **新增 `gitPushTimeout` 设置项**：分钟单位，0 = 不限时；齿轮弹窗 + 全局设置页两处入口；本地命令固定 30 秒不受影响
- **push/pull 认证改走 extraHeader**：`git -c http.extraHeader=Authorization: Basic <b64> push …`，token 不再进 URL / reflog / 进程参数
- **push 加 `--set-upstream`**：建立本地 remote-tracking，Dashboard 的 ahead/behind 数字终于准了
- **`ensureRemote` 检测已有同 URL remote 就复用**：避免出现 `origin` 和 `personalWarehouse` 两个 remote 指向同一 URL 的冗余
- **push 超时校验回退**：`execFileSync` TIMEOUT 时先 fetch 一次校验本地 HEAD == remote/branch SHA，相等则视为成功。彻底修复「push 已成功但 Dashboard 报超时 + 显示领先 1 次提交」的假失败现象
- **修复热力图切年份误伤父容器**：`container.empty()` → 抽出 `renderBody(body)` 只重建自己的 body，不再清空其他模块
- **修复插件管理开关状态错乱**：用 `plugins.plugins[id]` 兜底判断，比 `enabledPlugins` Set 更权威
- **放大模块折叠按钮**：18px + 22×22 点击热区 + hover 背景

### 已完成的优化（Header 增强）

- **Obsidian 版本徽章旁新增实时时钟**：`YYYY-MM-DD 周X HH:MM:SS`，每秒刷新，`font-variant-numeric: tabular-nums` 数字等宽
- **时钟后追加农历/干支/时辰**：`丙午马年·农历六月初四·酉时`；农历只在日期或整点变化时重算（key 比较 `toDateString + hour`），CPU 开销可忽略
- **`HeaderComponent.destroy()`** 清理 `setInterval`；tick 内检测 `isConnected` 双重保险

---

*最后通读日期：2026-07-17（Git 深度修复 + Header 时钟/农历）*
