import { App } from "obsidian";
import { PluginInfo } from "../types";

const ZH_DESCRIPTIONS: Record<string, string> = {
  "calendar": "在侧边栏显示日历视图，点击日期快速跳转到对应的日记文件",
  "editing-toolbar": "在编辑器顶部添加格式化工具栏，支持加粗、斜体、标题等常用排版操作",
  "ishibashi-web-clipper": "一键将网页内容裁剪保存到 Vault，支持正文提取和 Markdown 转换",
  "karpathywiki": "基于 LLM 的知识库管理工具，支持 ingest / query / lint 等 AI 工作流",
  "notebook-navigator": "增强型文件夹导航面板，以笔记本形式展示 Vault 目录结构",
  "obsidian-excalidraw-plugin": "在 Obsidian 中嵌入 Excalidraw 白板，支持手绘图表和思维导图",
  "periodic-notes": "管理日记、周记、月记等周期性笔记，配合 Calendar 插件使用效果更佳",
  "yy-obsidian-dashboard": "LLM Wiki 工作流仪表盘，集成文件统计、Token 用量、指令执行等功能",
};

export class PluginManageService {
  constructor(private app: App) {}

  getInstalledPlugins(): PluginInfo[] {
    const plugins = (this.app as any).plugins;
    if (!plugins) return [];

    const manifests = plugins.manifests ?? {};

    const enabledSet: Set<string> | Record<string, boolean> = plugins.enabledPlugins ?? {};
    const isEnabled = (id: string): boolean => {
      if (enabledSet instanceof Set) return enabledSet.has(id);
      return !!(enabledSet as Record<string, boolean>)[id];
    };

    return Object.entries(manifests)
      .map(([id, manifest]: [string, any]) => ({
        id,
        name: manifest.name ?? id,
        version: manifest.version ?? "?",
        enabled: isEnabled(id),
        hasSettings: !!(plugins.plugins?.[id]?.settingsDisplay || plugins.plugins?.[id]?.onSettingsTab),
        description: ZH_DESCRIPTIONS[id] ?? manifest.description ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async togglePlugin(pluginId: string, enable: boolean): Promise<void> {
    const plugins = (this.app as any).plugins;
    if (!plugins) throw new Error("无法访问插件管理器");
    if (enable) {
      await plugins.enablePluginAndSave(pluginId);
    } else {
      await plugins.disablePluginAndSave(pluginId);
    }
  }

  openPluginSettings(): void {
    (this.app as any).setting?.open?.();
    (this.app as any).setting?.openTabById?.("community-plugins");
  }

  openSpecificPluginSettings(pluginId: string): void {
    (this.app as any).setting?.open?.();
    (this.app as any).setting?.openTabById?.(pluginId);
  }
}
