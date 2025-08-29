import { setIcon } from 'obsidian';
import { App, TFile } from 'obsidian';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { DataBlockConfig } from 'src/types';
import { BaseRenderer } from 'src/renderers/base-renderer';

export class BoardRenderer extends BaseRenderer {
    render(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig, el: HTMLElement, groupedPages: Record<string, any[]>, renderer: any, allItems: any[]) {
        if (!groupedPages || Object.keys(groupedPages).length === 0) {
            el.createEl("div", { text: "No items found.", cls: "empty-notice" });
            return;
        }

        const boardEl = el.createDiv({ cls: 'board-view' });

        const customGroups = (config as any).customGroups;
        const hasCustomGroups = customGroups && customGroups.groups;
        
        let groupOrder: string[];
        if (hasCustomGroups) {
            groupOrder = ['Uncategorized', ...customGroups.groups];
        } else {
            const otherGroups = Object.keys(groupedPages).filter(g => g !== 'Uncategorized').sort();
            groupOrder = ['Uncategorized', ...otherGroups];
        }

        for (const group of groupOrder) {
            const items = groupedPages[group];
            if (!items) continue; // Skip groups that are not in the current paginated set

            if (group === 'Uncategorized' && items.length === 0) {
                continue;
            }

            const columnEl = boardEl.createDiv({ cls: 'board-column' });

            columnEl.addEventListener('dragover', (event) => event.preventDefault());
            columnEl.addEventListener('dragenter', (event) => {
                event.preventDefault();
                boardEl.querySelectorAll('.board-column').forEach(col => col.classList.remove('drag-over'));
                columnEl.classList.add('drag-over');
            });
            columnEl.addEventListener('drop', async (event) => {
                columnEl.classList.remove('drag-over');
                event.preventDefault();
                const itemPath = event.dataTransfer?.getData('text/plain');
                if (!itemPath) return;

                const newStatus = group;
                const groupByProperty = customGroups ? customGroups.property : (config.groupByProperty || 'status');

                if (config.data) {
                    try {
                        const asyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        const func = new asyncFunction("app", config.data as string);
                        let customData = await func(app);

                        const itemIndex = customData.findIndex((d: any) => d.path === itemPath || d.name === itemPath);
                        
                        if (itemIndex > -1) {
                            customData[itemIndex][groupByProperty] = newStatus === 'Uncategorized' ? null : newStatus;
                            
                            const newConfig = { data: `const data = ${JSON.stringify(customData, null, 2)};\n\nreturn data;` };
                            
                            renderer.updateDataBlock(newConfig);
                        }
                    } catch (e) {
                        console.error("❌ [ERROR] Error updating custom data", e);
                    }
                } else {
                    const file = app.vault.getAbstractFileByPath(itemPath);
                    if (!(file instanceof TFile)) return;
                    
                    try {
                        await app.fileManager.processFrontMatter(file, (property) => {
                            property[groupByProperty] = newStatus === 'Uncategorized' ? null : newStatus;
                        });
                    } catch (error) {
                        console.error("Error updating property:", error);
                    }
                }
            });

            const columnHeader = columnEl.createDiv({ cls: 'board-column-header' });
            const collapseIcon = columnHeader.createSpan({ cls: 'board-column-collapse-icon' });
            setIcon(collapseIcon, "chevron-down");
            
            columnHeader.createEl('h3', { text: group, cls: 'board-column-title' });
            columnHeader.createSpan({ cls: 'board-column-item-count', text: `(${items.length})` });
            
            const columnContent = columnEl.createDiv({ cls: 'board-column-content' });
            collapseIcon.addEventListener('click', () => {
                const isCollapsed = columnEl.classList.toggle('collapsed');
                collapseIcon.toggleClass('is-collapsed', isCollapsed);
            });

            for (const item of items) {
                let itemEl = columnContent.createEl("div", { cls: "item", attr: { draggable: "true" } });
                
                itemEl.addEventListener('dragstart', (event) => {
                    if (event.dataTransfer) {
                        event.dataTransfer.setData('text/plain', item.path || item.name);
                    }
                    document.body.classList.add('is-dragging');
                });

                itemEl.addEventListener('dragend', () => {
                    document.body.classList.remove('is-dragging');
                    boardEl.querySelectorAll('.board-column.drag-over').forEach(col => col.classList.remove('drag-over'));
                });

                this.renderTitle(app, jsExecutor, config, item, itemEl, allItems);
                const linkEl = itemEl.querySelector('a.item-title') as HTMLAnchorElement;
                if (linkEl) linkEl.draggable = false;

                this.renderItemDescription(app, jsExecutor, config, item, itemEl, allItems);
                this.renderPillsAndButtons(app, jsExecutor, config, item, itemEl, allItems);
            }
        }
    }
}