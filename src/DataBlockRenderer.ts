import { App, MarkdownRenderChild, TFile, setIcon, Menu, Modal, MarkdownSectionInformation, MarkdownView } from 'obsidian';
import { renderDataBlock } from './renderer';
import { JavaScriptExecutor } from './javascript-executor';
import { DataBlockConfig } from './types';
import { IDataBlockPlugin } from 'src/plugin-interface';
import { DataBlockConfigModal } from 'src/ui/DataBlockConfigModal';
import * as yaml from 'js-yaml';
import { functionToString } from './utils/javascript-helper';

export class DataBlockRenderer extends MarkdownRenderChild {

    constructor(
        private app: App,
        private plugin: IDataBlockPlugin,
        private jsExecutor: JavaScriptExecutor,
        private config: DataBlockConfig,
        private source: string,
        container: HTMLElement,
        private sourcePath: string,
        private sectionInfo?: MarkdownSectionInformation
    ) {
        super(container);
    }

    onload() {
        this.renderOnceDataIsReady();
        this.registerEvent(this.app.vault.on('modify', this.onFileModify.bind(this)));
        this.registerEvent(this.app.vault.on('rename', this.onFileModify.bind(this)));
        this.registerEvent(this.app.vault.on('delete', this.onFileModify.bind(this)));
        this.registerEvent(this.app.vault.on('create', this.onFileModify.bind(this)));
    }

    onFileModify(file: TFile) {
        setTimeout(() => {
            if (file.extension === 'md') {
                const isRelevant = !this.config.folder || this.config.folder === '/' || file.path.startsWith(this.config.folder);
                if (isRelevant) {
                    this.render();
                }
            }
        }, 100);
    }

    renderOnceDataIsReady() {
        this.render();
    }

    async render() {
        this.containerEl.empty();
        this.containerEl.classList.add('datablock-render-child');

        if (this.plugin.settings.showEditButtonOnCodeblock) {
            this.addEditButton();
        }
        await renderDataBlock(this.app, this.jsExecutor, this.config, this.containerEl, this);
    }

    private addEditButton() {
        const buttonEl = this.containerEl.createEl('div', { cls: 'datablock-edit-button' });
        setIcon(buttonEl, 'pencil');
        buttonEl.addEventListener('click', this.openConfigModal.bind(this));
        buttonEl.addEventListener('contextmenu', this.showContextMenu.bind(this));
    }

    private showContextMenu(event: MouseEvent) {
        event.preventDefault();
        const menu = new Menu();
        menu.addItem((item) =>
            item
                .setTitle("Hide edit button")
                .setIcon("eye-off")
                .onClick(() => {
                    this.showConfirmationModal();
                })
        );
        menu.showAtMouseEvent(event);
    }

    private showConfirmationModal() {
        const modal = new Modal(this.app);
        modal.modalEl.addClass('datablock-hide-confirm-modal');
        modal.titleEl.setText("Hide Edit Button");
        modal.contentEl.createEl("div", { text: "You can re-enable it at any time from the plugin settings." });

        const buttonContainer = modal.contentEl.createEl("div", { cls: "modal-button-container" });
        const confirmButton = buttonContainer.createEl("button", { text: "Hide", cls: "mod-cta" });
        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });

        confirmButton.addEventListener("click", () => {
            this.plugin.settings.showEditButtonOnCodeblock = false;
            this.plugin.saveSettings();
            modal.close();
        });

        cancelButton.addEventListener("click", () => {
            modal.close();
        });

        modal.open();
    }

    private async openConfigModal() {
        const onSubmit = async (updatedConfig: string) => {
            const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                const lines = content.split(/\r?\n/);

                if (!this.sectionInfo) {
                    console.error("DataBlock Error: sectionInfo is not available.");
                    return;
                }
                const { lineStart, lineEnd } = this.sectionInfo;

                const newBlockContent = `\`\`\`datablock\n${updatedConfig}\n\`\`\``.split(/\r?\n/);

                lines.splice(lineStart, lineEnd - lineStart + 1, ...newBlockContent);

                const newFileContent = lines.join('\n');
                await this.app.vault.modify(file, newFileContent);
                const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
                if (activeLeaf) {
                    (activeLeaf as any).rebuildView();
                }
            }
        };

        new DataBlockConfigModal(this.app, this.config, onSubmit, this.jsExecutor, false, true).open();
    }

    onunload() {
    }

    async updateDataBlock(newConfig: Partial<DataBlockConfig>) {
        const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);
            if (!this.sectionInfo) {
                console.error("DataBlock Error: sectionInfo is not available.");
                return;
            }
            const { lineStart, lineEnd } = this.sectionInfo;

            const blockContent = lines.slice(lineStart + 1, lineEnd).join('\n');
            const currentConfig = yaml.load(blockContent) as DataBlockConfig;

            const updatedConfig = { ...currentConfig, ...newConfig };

            // Dehydrate functions back to strings before dumping
            const configToDump = JSON.parse(JSON.stringify(updatedConfig, (key, value) => {
                if (typeof value === 'function') {
                    return functionToString(value);
                }
                return value;
            }));

            const newBlockContent = `\`\`\`datablock\n${yaml.dump(configToDump)}\n\`\`\``.split(/\r?\n/);

            lines.splice(lineStart, lineEnd - lineStart + 1, ...newBlockContent);

            const newFileContent = lines.join('\n');
            await this.app.vault.modify(file, newFileContent);
        }
    }

}