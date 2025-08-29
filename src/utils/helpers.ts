import { App, TFile, MarkdownRenderer, TAbstractFile, Menu, setIcon } from 'obsidian';
import { PageData, DataBlockConfig } from 'src/types';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { PropertyEditModalFactory } from 'src/ui/property-edit-modals/PropertyEditModalFactory';
import { SelectPropertySuggestModal } from 'src/ui/property-edit-modals/SelectPropertySuggestModal';
import { stringToFunction, resolvePossiblePromise } from './javascript-helper';


function getFinalIconName(iconName: string): string {
    return iconName.startsWith('lucide-') ? iconName : `lucide-${iconName}`;
}

export function extractIconAndText(content: string): { icon: string | null, text: string } {
    if (typeof content !== 'string') {
        return { icon: null, text: String(content ?? '') };
    }
    const iconRegex = /{{\s*icon\s*:\s*([^}]+)\s*}}/;
    const match = content.match(iconRegex);
    if (match) {
        const iconName = match[1].trim();
        const text = content.replace(match[0], '').trim();
        return { icon: getFinalIconName(iconName), text: text };
    }
    return { icon: null, text: content };
}

export function getNestedValue(obj: any, pathStr: string) {
    if (!pathStr || typeof pathStr !== 'string') return null;
    if (obj && typeof obj === 'object' && obj.hasOwnProperty(pathStr)) return obj[pathStr];
    let parts = pathStr.split(".");
    let current = obj;
    for (let part of parts) {
        if (null == current || (typeof current !== 'object' && typeof current !== 'function')) return null;
        if (Array.isArray(current) && /^\d+$/.test(part)) {
            let index = parseInt(part, 10);
            current = index >= 0 && index < current.length ? current[index] : null;
        } else try {
            current = Reflect.get(current, part);
        } catch (err) {
            console.warn(`Error accessing part '${part}' of path '${pathStr}': ${err}`);
            return null;
        }
    }
    return current;
};



export function createSmartLink(
    app: App,
    jsExecutor: JavaScriptExecutor,
    text: string,
    action: any,
    parentEl: HTMLElement,
    config: DataBlockConfig,
    classesStr = "",
    item: any = null,
    allItems: any[] = [],
    buttonConfig: any = null,
    isMenuAction: boolean = false
) {
    if (!text && !action && !buttonConfig?.checkboxMode) return;

    let classesArr = classesStr ? classesStr.split(" ").filter(c => c) : [];

    // If there's no action, just render the text
    if (!action) {
        const spanEl = parentEl.createEl("span", { cls: classesArr.join(" ").trim() });
        renderTextWithIcons(spanEl, text);
        return;
    }

    // If the action is a function, it's a JS action
    if (typeof action === "function") {
        if (!classesArr.includes("clickable")) classesArr.push("clickable");
        const anchorEl = parentEl.createEl("a", {
            cls: classesArr.join(" ").trim(),
            attr: { style: "cursor: pointer;" }
        });

        renderTextWithIcons(anchorEl, text);

        anchorEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            jsExecutor.executeFunction(action, item, allItems, event, isMenuAction);
        });
        return;
    }

    if (action === 'edit-property') {
        const finalButtonConfig = buttonConfig || (config.buttons || []).find(b => {
             return resolveValue(jsExecutor, item, b.text, "buttonText") === text;
        });

        if (!finalButtonConfig || !finalButtonConfig.property) {
            console.error("Could not determine property name for button action.", finalButtonConfig);
            return;
        }

        const propertyName = finalButtonConfig.property;

        if (finalButtonConfig.checkboxMode) {
            const checkbox = parentEl.createEl('input', {
                type: 'checkbox',
                cls: 'datablock-checkbox-mode'
            });
            const currentValue = getNestedValue(item, propertyName);
            checkbox.checked = currentValue === true || currentValue === 'true';

            checkbox.addEventListener('change', async (e) => {
                const newValue = (e.target as HTMLInputElement).checked;
                const fileToUpdate = item.path ? app.vault.getAbstractFileByPath(item.path) : null;
                if (fileToUpdate && fileToUpdate instanceof TFile) {
                    await app.fileManager.processFrontMatter(fileToUpdate, (frontmatter) => {
                        frontmatter[propertyName] = newValue;
                    });
                } else {
                    console.error('DataBlock: Could not find a valid file to update for path:', item.path);
                }
            });
            return;
        }
        
        const buttonEl = parentEl.createEl("button", {
            cls: classesArr.join(" ").trim()
        });
        renderTextWithIcons(buttonEl, text);
        buttonEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const propertyType = buttonConfig.propertyType || 'Text';
            const currentValue = getNestedValue(item, propertyName);

            const onSubmit = async (result: any) => {
                if (result.success && !result.cancelled) {
                    const fileToUpdate = item.path ? app.vault.getAbstractFileByPath(item.path) : null;
                    if (fileToUpdate && fileToUpdate instanceof TFile) {
                        await app.fileManager.processFrontMatter(fileToUpdate, (frontmatter) => {
                            frontmatter[propertyName] = result.value;
                        });
                    } else {
                        console.error('DataBlock: Could not find a valid file to update for path:', item.path);
                    }
                }
            };
            
            if (propertyType.toLowerCase() === 'select') {
                new SelectPropertySuggestModal(
                    app,
                    propertyName,
                    currentValue,
                    item.file,
                    onSubmit,
                    buttonConfig.options || []
                ).open();
            } else {
                const modal = PropertyEditModalFactory.createModal(
                    app,
                    propertyType,
                    propertyName,
                    currentValue,
                    item.file,
                    onSubmit,
                    { selectOptions: buttonConfig.options }
                );
                modal.open();
            }
        });
        return;
    }

    let targetStr = String(action);
    let currentFilePath = item?.path || "";
    
    // External Link
    if (/^(https?:\/\/|mailto:)/i.test(targetStr) && !targetStr.startsWith("data:")) {
        if (!classesArr.includes("external-link")) classesArr.push("external-link");
        let linkEl = parentEl.createEl("a", {
            href: targetStr,
            cls: classesArr.join(" ").trim(),
            attr: { target: "_blank", rel: "noopener noreferrer" }
        });
        renderTextWithIcons(linkEl, text);
    }
    // Data URL or similar, render as text
    else if (targetStr.startsWith("data:")) {
        let spanEl = parentEl.createEl("span", { cls: classesArr.join(" ").trim() });
        renderTextWithIcons(spanEl, text);
    }
    // Internal Link
    else {
        if (!classesArr.includes("internal-link")) classesArr.push("internal-link");
        let internalLinkEl = parentEl.createEl("a", {
            href: targetStr,
            cls: classesArr.join(" ").trim(),
            attr: { "data-href": targetStr, style: "cursor: pointer;" }
        });
        renderTextWithIcons(internalLinkEl, text);
        internalLinkEl.addEventListener("click", (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            const shouldOpenNewTab = (config as any).newTab === true;
            app.workspace.openLinkText(targetStr, currentFilePath, shouldOpenNewTab);
        });
    }
};

export function resolveValue(
    jsExecutor: JavaScriptExecutor,
    item: any,
    configValue: any,
    valueName: string = "value",
    execute: boolean = true,
    allItems: any[] = []
) {
    if (configValue === null || configValue === undefined) {
        return configValue;
    }

    if (typeof configValue === 'string' && (configValue.trim().startsWith('function') || configValue.trim().includes('=>'))) {
        const func = stringToFunction(configValue);
        if (func) {
            configValue = func;
        }
    }

    if (typeof configValue === 'function') {
        if (!execute) {
            return configValue;
        }
        try {
            return jsExecutor.executeFunction(configValue, item, allItems);
        } catch (err) {
            console.error(`Error executing function for ${valueName}:`, err);
            return undefined;
        }
    }
    
    if (typeof configValue === 'string') {
        // Handle special case for item.path
        
        if (configValue.startsWith('property:')) {
            const property = configValue.substring('property:'.length);
            return getNestedValue(item, property);
        }
        
        if (configValue === 'item.name' || configValue === 'name') {
            return getNestedValue(item, 'basename');
        } else if (configValue.startsWith('item.')) {
            return getNestedValue(item, configValue.substring('item.'.length));
        }
        
        const nestedValue = getNestedValue(item, configValue);
        if (nestedValue !== null && nestedValue !== undefined) {
            return nestedValue;
        }

        return configValue;
    }

    return configValue;
};
export function getShortDomain(url: string) {
    try {
        if (!url || typeof url !== 'string') return "";
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
        return "";
    }
};

export function resolveLook(
    jsExecutor: JavaScriptExecutor,
    item: PageData,
    look: any,
    defaultText: string = '',
    allItems: any[] = []
): { text: string; action?: any } {
    if (!look) {
        return { text: defaultText };
    }

    let text: string;
    let action: any;

    if (typeof look === 'string' || typeof look === 'function') {
        text = resolveAndProcessTemplate(jsExecutor, item, look, 'text', true, allItems) || defaultText;
        action = undefined;
    } else {
        text = resolveAndProcessTemplate(jsExecutor, item, look.text, 'text', true, allItems) || defaultText;
        action = resolveValue(jsExecutor, item, look.action, 'action', false, allItems);
    }

    return { text, action };
}

export function renderDescription(app: App, jsExecutor: JavaScriptExecutor, item: any, config: DataBlockConfig, container: HTMLElement, allItems: any[]) {
    if (!config.description) return;

    const { text, action } = resolveLook(jsExecutor, item, config.description, '', allItems);
    
    if (!text) return;

    const descContainer = container.createEl("div", { cls: "item-description-container" });
    createSmartLink(app, jsExecutor, text, action, descContainer, config, "item-description", item, allItems);
};

export function addButtonIfNeeded(app: App, jsExecutor: JavaScriptExecutor, item: any, config: DataBlockConfig, container: HTMLElement, allItems: any[]) {
    const buttons = config.buttons;
    if (!buttons || !Array.isArray(buttons)) return;

    for (const buttonConfig of buttons) {
        const text = resolveAndProcessTemplate(jsExecutor, item, buttonConfig.text, "buttonText", true, allItems);
        const action = resolveValue(jsExecutor, item, buttonConfig.action, "buttonAction", false, allItems);

        if (buttonConfig.menuOptions && buttonConfig.menuOptions.length > 0) {
            const button = container.createEl('button');
            renderTextWithIcons(button, text || '...');
            button.addClass('action-button');
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const menu = new Menu();
                (menu as any).dom.addClass('datablock');
                buttonConfig.menuOptions?.forEach(option => {
                    menu.addItem(menuItem => {
                        const { icon, text } = extractIconAndText(option.name);
                        if (icon) {
                            menuItem.setIcon(icon);
                        }
                        menuItem.setTitle(text).onClick(() => {
                            const func = stringToFunction(option.action);
                            if (func) {
                                jsExecutor.executeFunction(func, item, allItems, event, true);
                            }
                        });
                    });
                });
                menu.showAtMouseEvent(event);
});
        } else if (buttonConfig.checkboxMode || (text !== null && text !== undefined)) {
            let btnClasses = "action-button";
            createSmartLink(app, jsExecutor, text, action, container, config, btnClasses, item, allItems, buttonConfig, true);
        }
    }
};

export function formatDateValue(jsExecutor: JavaScriptExecutor, dateVal: any, formatStr: string) {
    if (!dateVal) return String(dateVal || "");
    const moment = jsExecutor.moment;
    if (!moment) return String(dateVal);

    if (dateVal && dateVal.isLuxonDateTime) return dateVal.toFormat(formatStr);

    const tryParse = (val: any, fmt: string, targetFmt: string) => {
        try {
            let dt = moment.fromFormat(val, fmt);
            if (dt.isValid) return dt.toFormat(targetFmt);
        } catch {}
        return null;
    };

    if (typeof dateVal === "string") {
        try {
            let isoDt = moment(dateVal);
            if (isoDt.isValid) return isoDt.format(formatStr);
        } catch {}
        if (formatStr !== "yyyy-MM-dd" && formatStr !== "MMM d, yyyy") {
           let specificFormat = tryParse(dateVal, formatStr, formatStr);
           if (specificFormat) return specificFormat;
        }
        for (let commonFmt of ["yyyy-MM-dd", "MMM d, yyyy", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss"]) {
            if (commonFmt !== formatStr) {
                let parsed = tryParse(dateVal, commonFmt, formatStr);
                if (parsed) return parsed;
            }
        }
    }
    if (typeof dateVal === "number") {
        try {
            let millisDt = moment(dateVal);
            if (millisDt.isValid) return millisDt.format(formatStr);
        } catch {}
    }
    if (dateVal instanceof Date) {
        try {
            let jsDateDt = moment(dateVal);
            if (jsDateDt.isValid) return jsDateDt.format(formatStr);
        } catch {}
    }
    return String(dateVal);
};


export async function createPillsContainer(app: App, jsExecutor: JavaScriptExecutor, item: any, config: DataBlockConfig, parentEl: HTMLElement, pillClass = "pill", allItems: any[]) {
    const settings = (app as any).plugins.plugins.datablock.settings;
    if (!config.pills || !Array.isArray(config.pills) || config.pills.length === 0) {
        return null;
    }

    let pillsDiv = parentEl.createEl("div", { cls: "pills-container" });
    let hasPills = false;
    if (config.view !== "list") {
        setTimeout(() => {
            if (pillsDiv.scrollWidth > pillsDiv.clientWidth) {
                pillsDiv.classList.add("has-overflow");
            }
        }, 0);
    }

    for (const pillConfig of config.pills) {
        const action = resolveValue(jsExecutor, item, pillConfig.action, "pillAction", false, allItems);
        let text = resolveAndProcessTemplate(jsExecutor, item, pillConfig.text, "pillText", true, allItems);

        if ((text === null || text === undefined) && action !== 'edit-property') {
            if (settings.showUndefinedPills) {
                let pillSpan = pillsDiv.createEl("span", { cls: `${pillClass} undefined-pill` });
                renderTextWithIcons(pillSpan, typeof pillConfig.text === 'string' ? pillConfig.text.replace(/^property:/, '') : 'undefined');
                hasPills = true;
            }
            continue;
        }

        const pills = Array.isArray(text) ? (text.length > 0 ? text : [null]) : [text];

        for (let pillValue of pills) {
             if ((pillValue === null || pillValue === undefined) && action !== 'edit-property') {
                 if (settings.showUndefinedPills) {
                    let pillSpan = pillsDiv.createEl("span", { cls: `${pillClass} undefined-pill` });
                    renderTextWithIcons(pillSpan, typeof pillConfig.text === 'string' ? pillConfig.text.replace(/^property:/, '') : 'undefined');
                    hasPills = true;
                 }
                 continue;
            }
            
            let displayText = pillValue;

            if (typeof pillValue === 'object' && pillValue !== null && !(pillValue instanceof Promise)) {
                if (pillValue.path) {
                    displayText = pillValue.path;
                }
            }
            
            if (!(displayText instanceof Promise) && String(displayText).trim() === "" && String(pillValue) !== "false") {
                continue;
            }
            
            hasPills = true;

            if (action === 'edit-property') {
                const pillSpan = pillsDiv.createEl("span", { cls: `${pillClass} actionable` });
                if(pillValue === null || pillValue === undefined){
                    renderTextWithIcons(pillSpan, typeof pillConfig.text === 'string' ? pillConfig.text.replace(/^property:/, '') : 'undefined');
                    pillSpan.classList.add('undefined-pill');
                } else {
                    renderTextWithIcons(pillSpan, displayText);
                }
                pillSpan.onclick = () => {
                    let propertyName: string | undefined;
                    if (typeof pillConfig.text === 'function') {
                        propertyName = pillConfig.property;
                    } else if (typeof pillConfig.text === 'string') {
                        const propertyMatch = pillConfig.text.match(/{{\s*property\s*:\s*([^}]+)\s*}}/);
                        if (propertyMatch && propertyMatch[1]) {
                            propertyName = propertyMatch[1].trim();
                        } else {
                            propertyName = pillConfig.text.replace(/^(property:)/, '');
                        }
                    }

                    if (!propertyName) {
                        console.error("Could not determine property name for pill action.", pillConfig);
                        return;
                    }

                    const propertyType = (pillConfig as any).propertyType || 'Text';

                    const onSubmit = async (result: any) => {
                        if (result.success && !result.cancelled) {
                            const fileToUpdate = item.path ? app.vault.getAbstractFileByPath(item.path) : null;
                            if (fileToUpdate && fileToUpdate instanceof TFile) {
                                await app.fileManager.processFrontMatter(fileToUpdate, (frontmatter) => {
                                    if (propertyName) {
                                        const currentValue = frontmatter[propertyName];
                                        if (Array.isArray(currentValue)) {
                                            const index = currentValue.indexOf(pillValue);
                                            if (index > -1) {
                                                currentValue[index] = result.value;
                                            } else {
                                                currentValue.push(result.value);
                                            }
                                            frontmatter[propertyName] = [...new Set(currentValue)];
                                        } else {
                                            frontmatter[propertyName] = result.value;
                                        }
                                    }
                                });
                            } else {
                                console.error('DataBlock: Could not find a valid file to update for path:', item.path);
                            }
                        }
                    };

                    const actualPropertyValue = getNestedValue(item, propertyName);

                    if (propertyType.toLowerCase() === 'select') {
                        new SelectPropertySuggestModal(
                            app,
                            propertyName,
                            actualPropertyValue,
                            item.file,
                            onSubmit,
                            (pillConfig as any).options || []
                        ).open();
                    } else {
                        const modal = PropertyEditModalFactory.createModal(
                            app,
                            propertyType,
                            propertyName,
                            actualPropertyValue,
                            item.file,
                            onSubmit,
                            { selectOptions: (pillConfig as any).options }
                        );
                        modal.open();
                    }
                };
            }
            else if (action) {
                 createSmartLink(app, jsExecutor, displayText, action, pillsDiv, config, pillClass, item, allItems);
            } else {
                let pillSpan = pillsDiv.createEl("span", { cls: pillClass });
                renderTextWithIcons(pillSpan, pillValue);
            }
        }
    }

    if (!hasPills) {
        pillsDiv.remove();
        return null;
    }
    return pillsDiv;
};

// empty
export function renderPaginationControls(app: App, jsExecutor: JavaScriptExecutor, currentPage: number, totalPages: number, config: any, container: HTMLElement, renderPageCallback: (page: number) => void) {
    if (totalPages <= 1) {
        const existingControls = container.querySelector('.pagination-controls');
        if (existingControls) existingControls.remove();
        return;
    }

    let controlsDiv = container.querySelector('.pagination-controls') as HTMLElement;
    if (!controlsDiv) {
        controlsDiv = container.createEl('div', { cls: 'pagination-controls' });
    } else {
        controlsDiv.empty();
    }

    const numericPagination = config.paginationType === 'numeric';

    if (numericPagination) {
        const maxVisible = config.maxNumericButtons || 7;
        const sideButtons = Math.floor((maxVisible - 3) / 2);
        
        let startPage = Math.max(2, currentPage - sideButtons);
        let endPage = Math.min(totalPages - 1, currentPage + sideButtons);

        const firstBtn = controlsDiv.createEl('button', { text: '1', cls: 'pagination-btn' });
        firstBtn.disabled = (1 === currentPage);
        firstBtn.onclick = () => renderPageCallback(1);

        if (startPage > 2) {
            controlsDiv.createEl('span', { text: '...', cls: 'pagination-ellipsis' });
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === 1 || i === totalPages) continue;
            const pageBtn = controlsDiv.createEl('button', {
                text: i.toString(),
                cls: i === currentPage ? 'pagination-btn pagination-current' : 'pagination-btn'
            });
            pageBtn.disabled = (i === currentPage);
            pageBtn.onclick = () => renderPageCallback(i);
        }
        
        
        if (endPage < totalPages - 1) {
            controlsDiv.createEl('span', { text: '...', cls: 'pagination-ellipsis' });
        }

        if (totalPages > 1) {
            const lastBtn = controlsDiv.createEl('button', { text: totalPages.toString(), cls: 'pagination-btn' });
            lastBtn.disabled = (totalPages === currentPage);
            lastBtn.onclick = () => renderPageCallback(totalPages);
        }

    } else {
        controlsDiv.createEl('span', { text: `Page ${currentPage} of ${totalPages}`, cls: 'pagination-info' });
        const prevButton = controlsDiv.createEl('button', { text: '← Previous', cls: 'pagination-btn' });
        prevButton.disabled = (currentPage <= 1);
        prevButton.onclick = () => { if (currentPage > 1) renderPageCallback(currentPage - 1); };
        const nextButton = controlsDiv.createEl('button', { text: 'Next →', cls: 'pagination-btn' });
        nextButton.disabled = (currentPage >= totalPages);
        nextButton.onclick = () => { if (currentPage < totalPages) renderPageCallback(currentPage + 1); };
    }
}

export function universalSorter(a: any, b: any, sortBy: any, getNestedValue: (obj: any, path: string) => any): number {
    if (typeof sortBy === 'function') {
        return sortBy(a, b);
    }

    const sortConfigs: any[] = Array.isArray(sortBy) ? sortBy : [sortBy];

    for (const config of sortConfigs) {
        let property: string;
        let order: 'asc' | 'desc' = 'asc';
        let type: 'string' | 'number' | 'date' | 'boolean' = 'string';

        if (typeof config === 'string') {
            const parts = config.split(' ');
            property = parts[0];
            if (parts[1] && ['asc', 'desc'].includes(parts[1].toLowerCase())) {
                order = parts[1].toLowerCase() as 'asc' | 'desc';
            }
        } else if (typeof config === 'object' && config !== null) {
            property = config.by;
            order = config.order || 'asc';
            type = config.type || 'string';
        } else {
            continue; // Skip invalid config
        }

        let accessPath = property.startsWith('property:') ? property.substring('property:'.length) : property;

        if (property === 'name') {
            accessPath = 'basename';
        } else if (accessPath === 'mtime' || accessPath === 'ctime') {
            type = 'date';
            accessPath = `stat.${accessPath}`;
        }
        
        const valA = getNestedValue(a, accessPath);
        const valB = getNestedValue(b, accessPath);

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        let comparison = 0;

        switch (type) {
            case 'number':
                comparison = Number(valA) - Number(valB);
                break;
            case 'date':
                comparison = new Date(valA).getTime() - new Date(valB).getTime();
                break;
            case 'boolean':
                comparison = (valA === valB) ? 0 : (valA ? -1 : 1);
                break;
            case 'string':
            default:
                comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                break;
        }

        if (comparison !== 0) {
            return order === 'asc' ? comparison : -comparison;
        }
    }

    return 0;
}

export function renderTextWithIcons(container: HTMLElement, content: any) {
    const render = (resolvedContent: any) => {
        container.empty(); // Clear previous content (like "[object Promise]")
        
        if (typeof resolvedContent !== 'string') {
            container.textContent = String(resolvedContent ?? '');
            return;
        }
        
        const { icon, text } = extractIconAndText(resolvedContent);

        if (icon) {
            const wrapper = container.createSpan({cls: "datablock-icon-and-text-wrapper"});
            const iconEl = wrapper.createSpan({ cls: 'datablock-icon' });
            setIcon(iconEl, icon);
            
            if (text) {
                wrapper.createSpan({ cls: 'datablock-text', text: text });
            }
        } else if (text) {
            container.createSpan({ text: text });
        }
    };
    
    // Initially render with whatever we have. If it's a promise, it will show its string form.
    render(content);

    // Then, try to resolve it as a promise and re-render if it succeeds.
    resolvePossiblePromise(content).then(resolvedValue => {
        // Only re-render if the value is actually different. This avoids
        // unnecessary DOM manipulation for non-promise values.
        if (resolvedValue !== content) {
            render(resolvedValue);
        }
    });
}

export function processTemplate(template: string, item: any): any {
    if (typeof template !== 'string' || !template.includes("{{")) {
        return template;
    }

    const regexSource = "{{\\s*property\\s*:\\s*(.*?)\\s*}}";
    const placeholderRegex = new RegExp(regexSource, "g");
    const singlePlaceholderRegex = new RegExp(`^${regexSource}$`);
    
    const match = template.match(singlePlaceholderRegex);
    
    if (match) {
        const propertyName = match[1].trim();
        return getNestedValue(item, propertyName);
    }

    return template.replace(placeholderRegex, (fullMatch, propertyName) => {
        const value = getNestedValue(item, propertyName.trim());
        if (value === null || value === undefined) {
            return "";
        }
        return String(value);
    });
}

export function resolveAndProcessTemplate(
    jsExecutor: JavaScriptExecutor,
    item: any,
    configValue: any,
    valueName: string = "value",
    execute: boolean = true,
    allItems: any[] = []
) {
    const resolved = resolveValue(jsExecutor, item, configValue, valueName, execute, allItems);

    const process = (value: any) => {
        if (typeof value === 'string') {
            return processTemplate(value, item);
        }
        return value;
    };

    if (resolved && typeof resolved.then === 'function') {
        return resolved.then(process);
    }
    
    return process(resolved);
}