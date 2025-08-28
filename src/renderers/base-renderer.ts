import { App } from 'obsidian';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { DataBlockConfig } from 'src/types';
import { resolveLook, createSmartLink, renderDescription, createPillsContainer, addButtonIfNeeded } from 'src/utils/helpers';

export abstract class BaseRenderer {
    abstract render(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig, el: HTMLElement, pages: any, renderer: any, allItems: any[]): void;

    protected renderTitle(
        app: App,
        jsExecutor: JavaScriptExecutor,
        config: DataBlockConfig,
        item: any,
        container: HTMLElement,
        allItems: any[]
    ) {
        const defaultTitle = item.basename || item.name || 'Untitled';
        const { text: titleText, action: titleAction } = resolveLook(jsExecutor, item, config.title, defaultTitle, allItems);
        createSmartLink(app, jsExecutor, titleText, titleAction, container, config, "item-title", item, allItems);
    }

    protected renderItemDescription(
        app: App,
        jsExecutor: JavaScriptExecutor,
        config: DataBlockConfig,
        item: any,
        container: HTMLElement,
        allItems: any[]
    ) {
        renderDescription(app, jsExecutor, item, config, container, allItems);
    }
    
    protected renderPillsAndButtons(
        app: App,
        jsExecutor: JavaScriptExecutor,
        config: DataBlockConfig,
        item: any,
        container: HTMLElement,
        allItems: any[]
    ) {
        const hasButtons = (config as any).buttons && (config as any).buttons.length > 0;

        if (hasButtons && (config as any).inlineButtons) {
            const pillsButtonsWrapper = container.createEl("div", { cls: "pills-buttons-wrapper" });
            createPillsContainer(app, jsExecutor, item, config, pillsButtonsWrapper, "pill", allItems);
            const buttonsContainer = pillsButtonsWrapper.createDiv({ cls: "buttons-container" });
            addButtonIfNeeded(app, jsExecutor, item, config, buttonsContainer, allItems);
        } else {
            createPillsContainer(app, jsExecutor, item, config, container, "pill", allItems);
            if (hasButtons) {
                const buttonsContainer = container.createDiv({ cls: "buttons-container" });
                addButtonIfNeeded(app, jsExecutor, item, config, buttonsContainer, allItems);
            }
        }
    }
}