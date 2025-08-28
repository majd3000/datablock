import { App, TFile } from 'obsidian';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { DataBlockConfig } from 'src/types';
import { BaseRenderer } from 'src/renderers/base-renderer';
import { resolveValue} from 'src/utils/helpers';

export class GalleryRenderer extends BaseRenderer {
    render(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig, el: HTMLElement, pages: any, renderer: any, allItems: any[]) {
        if ((config as any).class) {
            el.addClass((config as any).class);
        }
        
        config.columns ??= 3;
        el.addClass(`gallery-cols-${config.columns}`);

        if (!pages || pages.length === 0) {
            el.createEl("div", {
                text: "No items found.",
                cls: "empty-notice"
            });
            return;
        }

        for (const item of pages) {
            let itemEl = el.createEl("div", { cls: "item" });
            if ((config as any).coverProperty) {
                const coverPathValue = resolveValue(jsExecutor, item, (config as any).coverProperty, "coverProperty", true, allItems);
                const coverContainer = itemEl.createEl("div", { cls: "cover-container" });
                let resolvedSrc = null;

                let pathString = null;

                if (coverPathValue) {
                    if (typeof coverPathValue === 'string') {
                        pathString = coverPathValue;
                    } else if (typeof coverPathValue === 'object' && coverPathValue.path) {
                        pathString = coverPathValue.path;
                    }
                }

                if (pathString) {
                    const rawPath = String(pathString);
                    const currentPath = item?.path || "";

                    if (/^(https?:\/\/|data:image\/)/i.test(rawPath)) {
                        resolvedSrc = rawPath;
                    } else {
                        let linkPath = rawPath;
                        const wikilinkMatch = rawPath.match(/^\[\[([^|\]]+)(?:\|[^\]]+)?\]\]$/);
                        if (wikilinkMatch) {
                            linkPath = wikilinkMatch[1];
                        }

                        const contextPath = item?.path || currentPath;
                        const file = app.metadataCache.getFirstLinkpathDest(linkPath, contextPath);
                        
                        if (file && file.path && (app.vault as any).fileMap[file.path]) {
                            try {
                                resolvedSrc = app.vault.getResourcePath(file);
                            } catch (m: any) {
                                console.error(`Error getting resource path for ${linkPath} (resolved to ${file.path}): ${m.message}`);
                            }
                        } else {
                            const abstractFile = app.vault.getAbstractFileByPath(linkPath);
                            if (abstractFile instanceof TFile) {
                                try {
                                    resolvedSrc = app.vault.getResourcePath(abstractFile);
                                } catch (y: any) {
                                    console.error(`Error getting resource path for direct path ${linkPath}: ${y.message}`);
                                }
                            } else {
                                console.warn(`Could not resolve cover image path: '${linkPath}' from context '${contextPath}'.`);
                            }
                        }
                    }
                }

                if (resolvedSrc) {
                    const encodedSrc = resolvedSrc.replace(/'/g, "%27").replace(/"/g, "%22").replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/ /g, "%20");
                    coverContainer.createEl("div", { cls: "cover-image", attr: { style: `background-image: url('${encodedSrc}');` } });
                } else {
                    coverContainer.createEl("div", { cls: "cover-image cover-placeholder", text: "Invalid Cover" });
                }
            }

            let infoContainer = itemEl.createEl("div", { cls: "item-info-container" });
            this.renderTitle(app, jsExecutor, config, item, infoContainer, allItems);
            this.renderItemDescription(app, jsExecutor, config, item, infoContainer, allItems);
            this.renderPillsAndButtons(app, jsExecutor, config, item, infoContainer, allItems);
        }
    }
}