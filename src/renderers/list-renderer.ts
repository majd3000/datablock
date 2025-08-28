import { App } from 'obsidian';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { DataBlockConfig } from 'src/types';
import { BaseRenderer } from 'src/renderers/base-renderer';

export class ListRenderer extends BaseRenderer {
    async render(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig, el: HTMLElement, pages: any, renderer: any, allItems: any[]) {
        if ((config as any).class) {
            el.addClass((config as any).class);
        }

        if (!pages || pages.length === 0) {
            el.createEl("div", { text: "No items found.", cls: "empty-notice" });
            return;
        }

        for (let item of pages) {
            if (!item) {
                console.warn("Skipping rendering of a null or undefined item in the data array.");
                continue;
            }

            const itemEl = el.createEl("div", { cls: "item" });
            const mainContent = itemEl.createEl("div", { cls: "item-main-content" });
            this.renderTitle(app, jsExecutor, config, item, mainContent, allItems);
            this.renderItemDescription(app, jsExecutor, config, item, mainContent, allItems);

            const itemMetadata = itemEl.createEl("div", { cls: "item-metadata" });
            this.renderPillsAndButtons(app, jsExecutor, config, item, itemMetadata, allItems);
        }
    }
}