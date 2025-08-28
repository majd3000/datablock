import { Plugin, MarkdownPostProcessorContext, Notice, MarkdownView } from 'obsidian';
import { DataBlockConfig } from 'src/types';
import { DataBlockSettings, DEFAULT_SETTINGS } from 'src/settings';
import { DataBlockSettingTab } from 'src/ui/settings-tab';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { parseDataBlock } from 'src/utils/parser';
import { IDataBlockPlugin } from 'src/plugin-interface';
import { DataBlockConfigModal } from 'src/ui/DataBlockConfigModal';
import { DataBlockRenderer } from 'src/DataBlockRenderer';
import { DatablockApi } from 'src/api';
 
export default class DataBlockPlugin extends Plugin implements IDataBlockPlugin {
  settings: DataBlockSettings;
  jsExecutor: JavaScriptExecutor;
  api: DatablockApi;
 
  async onload() {
    await this.loadSettings();
    
    // Initialize API
    this.api = new DatablockApi(this.app, this);
    (this.app as any).datablock = {
      api: this.api
    };

    // Initialize JavaScript executor
    this.jsExecutor = new JavaScriptExecutor(this.app, this.api);
    
    // Register markdown code block processor
    this.registerMarkdownCodeBlockProcessor('datablock', this.processDataBlock.bind(this));
    
    // Add settings tab
    this.addSettingTab(new DataBlockSettingTab(this.app, this));

    this.addCommand({
      id: 'open-datablock-generator',
      name: 'Create New Datablock',
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          const onSubmit = (config: string) => {
            const datablock = `\`\`\`datablock\n${config}\n\`\`\``;
            
            // Check if we are in 'source' (edit) or 'preview' (reading) mode
            if (view.getMode() === 'source') {
              const editor = view.editor;
              const selection = editor.getSelection();
              if (selection) {
                editor.replaceSelection(datablock);
              } else {
                const doc = editor.getDoc();
                const cursor = doc.getCursor();
                doc.replaceRange(datablock, cursor);
              }
            } else {
              const file = view.file;
              if (file) {
                this.app.vault.append(file, `\n${datablock}`);
              }
            }
          };
          new DataBlockConfigModal(this.app, { ...this.settings.defaultDataBlockConfig }, onSubmit, this.jsExecutor).open();
        } else {
          new Notice('Please open a file to insert a datablock.');
        }
      }
    });
  }

  processDataBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    try {
        const sectionInfo = ctx.getSectionInfo(el);

        // When called from the API, sectionInfo will be null, but we can proceed
        if (!sectionInfo && ctx.sourcePath) {
            // This is a programmatic call, clear the container and render
            el.empty();
        } else if (!sectionInfo) {
            // This can happen if the block is not in the live preview editor
            return;
        }

        const config = parseDataBlock(source, this.settings);
        const renderer = new DataBlockRenderer(this.app, this, this.jsExecutor, config, source, el, ctx.sourcePath, sectionInfo ?? undefined);
        
        // When called programmatically, we don't have a child to add to,
        // so we manually call onload and track the renderer.
        if (!sectionInfo) {
            renderer.onload();
        } else {
            ctx.addChild(renderer);
        }

    } catch (e) {
        console.error("DataBlock Error: ", e);
        el.createEl('div', { text: 'Error parsing DataBlock YAML.', cls: 'datablock-error' });
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // This is the most reliable way to force all blocks to re-render with new settings.
    this.app.workspace.updateOptions();

    // Force a re-render of all datablocks in open markdown files
    this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    });
  }

  public async updateDataBlock(config: DataBlockConfig, newConfig: DataBlockConfig) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
        const renderer = (activeView.previewMode as any).renderer;
        if (renderer && renderer.children) {
            const child = renderer.children.find((c: any) => c.containerEl.classList.contains('datablock-render-child') && c.config.data === config.data);
            if (child) {
                await (child as DataBlockRenderer).updateDataBlock(newConfig);
            }
        }
    }
  }
}