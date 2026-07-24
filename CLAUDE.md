# yyObsidianDashboard

Obsidian 仪表盘插件，为 LLM 驱动的知识库管理提供一站式工作面板。

## 技术栈

- TypeScript (ES2018, ESNext)，纯 DOM UI（无框架）
- esbuild 打包为单 CJS 文件 `main.js`，CSS 从 `styles/` 下 12 个文件合并为 `styles.css`
- esbuild 构建时 tree-shaking，模块通过命名导出 + `import type` 实现编译隔离
- 运行时依赖仅 `xregexp`，Git 操作通过 Node.js `child_process.execFileSync`

## 目录结构

```
src/
├── main.ts              # 插件入口：onload, commands, settings tab
├── types.ts             # DashboardSettings, MODULE_IDS, DEFAULT_SETTINGS
├── ui/DashboardView.ts  # ItemView：模块编排、渲染循环、自动刷新
├── shared/              # BaseComponent 抽象基类、工具函数
├── services/            # FileService, VaultPersistenceService
├── utils/lunar.ts       # 中国农历转换
└── modules/             # 10 个功能模块，每个模块独立目录
```

## 构建 & 部署

```bash
npm run build   # tsc -noEmit + esbuild + cat styles/*.css > styles.css
npm run dev     # 监听模式
```

**每次代码修改后必须执行部署**：
```bash
npm run build && cp main.js styles.css manifest.json /Users/yinyan/personalWarehouse/.obsidian/plugins/yy-obsidian-dashboard/
```

## 模块架构

每个模块遵循统一模式：
- `index.ts` — 导出 Component 和 Service
- `{Name}Component.ts extends BaseComponent` — render/update/destroy 生命周期
- `{Name}Service.ts` — 业务逻辑（可选）
- `types.ts` — 模块专用类型
- `settings.ts` — 模块设置逻辑（可选）

10 个模块（`src/types.ts` 中 `MODULE_IDS` 定义）：
1. `file-stats` — 文件统计、文件夹柱状图、异常检测、健康度
2. `heatmap` — GitHub 风格贡献热力图 + 报告生成
3. `llm-command` — OpenAI 兼容 API 调用（ingest/query/lint-wiki）
4. `operation-log` — 操作日志
5. `git-sync` — Git 集成（status/commit/push/pull/rollback）
6. `remotely-save` — 读取 Remotely Save 插件同步记录
7. `task-quickadd` — 快速任务添加
8. `plugin-manage` — 插件管理（列表/启用/禁用）
9. `voice-transcription` — 录音 + Whisper API 转写（默认隐藏）
10. `large-files` — 大文件列表

顶部固定区域（非滚动模块）：
- `header` — 标题、时钟、农历、Token 用量栏、模型配置按钮
- `search` — 全文模糊搜索
- `workspace-bar` — 快捷操作（今日报告、最近文件、LLM 输出）

## 核心数据流

1. `DashboardView.onOpen()` → `render()`
2. `render()` 调用 `refreshData()` 并行获取所有服务数据
3. 数据传递给各 Component 的 `update()` 方法
4. Vault 变更事件（modify/create/delete/rename）触发 debounced `refresh()`
5. 切回 Dashboard 标签页时自动刷新（5 分钟冷却）
6. 每 30 分钟检查一次可见性

## 设置系统

配置通过 Obsidian Plugin API 的 `loadData()`/`saveData()` 持久化到 `data.json`。各模块通过 `view.getSettings()` / `view.updateSettings()` 读写设置。

模块可见性、设备可见性、排序通过 `DashboardSettings` 中的字段控制，在 `DashboardView` 渲染时过滤。
