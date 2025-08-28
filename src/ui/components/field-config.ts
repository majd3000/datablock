import { Setting, DropdownComponent, TextComponent, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import { DataBlockConfig } from '../../types';
import { DataBlockConfigModal } from '../DataBlockConfigModal';
import { stringToFunction, functionToCodeBlock } from '../../utils/javascript-helper';
import { JSTextarea } from '../codemirror';

export function createTestButton(
    container: HTMLElement,
    jsTextarea: TextAreaComponent,
    isAction: boolean,
    modal: DataBlockConfigModal,
    getValue?: () => string
): ButtonComponent {
    const testBtn = new ButtonComponent(container)
        .setIcon('square-chevron-right')
        .setTooltip('Execute the code against the first item from the current data source')
        .onClick(async () => {
            const jsCode = getValue ? getValue() : jsTextarea.getValue();
            const func = stringToFunction(jsCode, false);

            if (!func) {
                new Notice('Could not create a function from the provided code.');
                return;
            }

            try {
                const allItems = await modal.getFreshData();
                
                if (!allItems || allItems.length === 0) {
                    new Notice("No items found for the current configuration to test against.");
                    return;
                }

                const testItem = allItems[0];
                const result = await modal.jsExecutor.executeFunction(func, testItem, allItems);

                if (!isAction) {
                    const resultString = typeof result === 'object' ? JSON.stringify(result, null, 2) : result;
                    new Notice(`Test successful on item: ${testItem.name || 'Untitled'}\nResult: ${resultString}`);
                } else {
                    new Notice(`Test successful! Action executed with item: ${testItem.name || 'Untitled'}`);
                }

            } catch (e: any) {
                new Notice(`Test failed: ${e.message}. See console for details.`);
                console.error("DataBlock Test Execution Error:", e);
            }
        });

    testBtn.buttonEl.appendText('Test');
    testBtn.buttonEl.addClass('datablock-test-button');
    return testBtn;
}

function buildAdvancedFieldSelector(
    modal: DataBlockConfigModal,
    container: HTMLElement,
    configKey: keyof DataBlockConfig, 
    defaultValue: string,
    isAction: boolean = false
): void {
    const selectorContainer = container.createDiv({ cls: 'advanced-field-selector' });
    
    const typeDropdown = new DropdownComponent(selectorContainer);

    if (isAction) {
        if (modal.currentDataSource !== 'custom') {
            typeDropdown.addOption('item.path', "Open item's path");
        }
    } else {
        if (modal.currentDataSource !== 'custom') {
            typeDropdown.addOption('item.name', 'Item Name');
        }
        typeDropdown.addOption('property', 'Property Value');
    }
    typeDropdown.addOption('custom', isAction ? 'Execute JavaScript' : 'Custom JavaScript');

    const fileContainer = selectorContainer.createDiv({ cls: 'file-path-container', attr: { style: 'display: none;' } });
    const frontmatterContainer = selectorContainer.createDiv({ cls: 'property-key-container', attr: { style: 'display: none;' } });
    const customContainer = selectorContainer.createDiv({ cls: 'custom-js-container', attr: { style: 'display: none;' } });

    const filePathInput = new TextComponent(fileContainer).setPlaceholder('Enter note path, e.g. Folder/Note.md');

    const frontmatterKeyDropdown = new DropdownComponent(frontmatterContainer).addOption('', '--- Select ---');
    modal.populateDropdown(frontmatterKeyDropdown, modal.detectedFields, undefined, undefined, '--- Select ---');

    let editor: JSTextarea;
    const editorContainer = customContainer.createDiv({ cls: 'editor-container', attr: { style: 'width: 100%;' } });
    const customTextarea = new TextAreaComponent(editorContainer).setPlaceholder(isAction ? 'console.log("Clicked:", item);' : "return item.name;");
    customTextarea.inputEl.style.display = 'none';

    editor = new JSTextarea(editorContainer, {
        initialValue: '',
        onChange: (value) => {
            updateConfig();
        },
        placeholder: isAction ? 'console.log("Clicked:", item);' : "return item.name;"
    });

    const updateConfig = () => {
        const selectedType = typeDropdown.getValue();
        
        let configObject = (modal.config as any)[configKey];
        if (typeof configObject !== 'object' || configObject === null) {
            configObject = { text: 'item.name' };
            (modal.config as any)[configKey] = configObject;
        }

        let newConfigValue: any;
        switch (selectedType) {
            case 'item.path': newConfigValue = 'item.path'; break;
            case 'item.name': newConfigValue = 'item.name'; break;
            case 'property':
                const propValue = frontmatterKeyDropdown.getValue();
                newConfigValue = propValue ? `property:${propValue}` : undefined;
                break;
            case 'custom':
                const jsCode = editor.getValue();
                newConfigValue = stringToFunction(jsCode, true) || (jsCode.trim() ? jsCode : undefined);
                break;
        }
        
        if (isAction) {
            configObject.action = newConfigValue;
        } else {
            configObject.text = newConfigValue;
        }
        modal.updatePreview();
    };

    const toggleContainers = (type: string) => {
        fileContainer.style.display = 'none';
        frontmatterContainer.style.display = type === 'property' ? 'block' : 'none';
        customContainer.style.display = type === 'custom' ? 'block' : 'none';
        updateConfig();
    };

    const justToggleContainers = (type: string) => {
        fileContainer.style.display = 'none';
        frontmatterContainer.style.display = type === 'property' ? 'block' : 'none';
        customContainer.style.display = type === 'custom' ? 'block' : 'none';
    };

    createTestButton(customContainer, customTextarea, isAction, modal, () => editor.getValue());
    typeDropdown.onChange(toggleContainers);
    filePathInput.onChange(updateConfig);
    frontmatterKeyDropdown.onChange(updateConfig);
    
    const configObject = (modal.config as any)[configKey];
    const currentValue = isAction ? configObject?.action : configObject?.text;

    if (typeof currentValue === 'function' || (typeof currentValue === 'string' && currentValue.trim().startsWith('function'))) {
        typeDropdown.setValue('custom');
        editor.setValue(functionToCodeBlock(currentValue));
    } else if (typeof currentValue === 'string') {
        if (currentValue.startsWith('property:')) {
            typeDropdown.setValue('property');
            const propertyToSet = currentValue.substring('property:'.length);
            if (modal.detectedFields.includes(propertyToSet)) {
                frontmatterKeyDropdown.setValue(propertyToSet);
            }
        } else if (currentValue === 'item.path' && isAction) {
            typeDropdown.setValue('item.path');
        } else if (currentValue === 'item.name' && !isAction) {
            typeDropdown.setValue('item.name');
        } else if (isAction) {
            // Handle other isAction string cases if necessary
        } else {
             typeDropdown.setValue(modal.currentDataSource === 'custom' ? 'property' : 'item.name');
        }
    } else {
        let defaultType: string;
        if (modal.currentDataSource === 'custom') {
            defaultType = 'property';
        } else { // notes source
            if (isAction) {
                defaultType = 'item.path';
            } else { // not an action
                if (configKey === 'description') {
                    defaultType = 'property';
                } else {
                    defaultType = 'item.name';
                }
            }
        }
        typeDropdown.setValue(defaultType);
    }
    
    justToggleContainers(typeDropdown.getValue());
}

export function buildFieldConfiguration(modal: DataBlockConfigModal, container: HTMLElement): void {
    const titleContainer = container.createDiv();
    const descriptionContainer = container.createDiv();

    const buildTitle = () => {
        titleContainer.empty();
        buildAdvancedFieldWithAction(modal, titleContainer, {
            fieldLabel: 'Title Field',
            fieldDesc: 'The main title for each item',
            fieldKey: 'title',
            actionLabel: 'Title Click Action',
            actionDesc: 'Action to perform when the title is clicked',
            actionKey: 'title',
            defaultField: 'item.name',
            defaultAction: 'item.path'
        });
    };

    const buildDescription = () => {
        descriptionContainer.empty();
        buildAdvancedFieldWithAction(modal, descriptionContainer, {
            fieldLabel: 'Description Field',
            fieldDesc: 'Additional text to display for each item',
            fieldKey: 'description',
            actionLabel: 'Description Click Action',
            actionDesc: 'Action to perform when the description is clicked',
            actionKey: 'description',
            defaultField: '',
            defaultAction: null
        });
    };
    
    buildTitle();
    buildDescription();
    
    const originalRerender = modal.rerenderAllTabs;
    modal.rerenderAllTabs = async () => {
        await originalRerender.call(modal);
        buildTitle();
        buildDescription();
    };
}

export function buildAdvancedFieldWithAction(
    modal: DataBlockConfigModal,
    container: HTMLElement,
    config: {
        fieldLabel: string,
        fieldDesc: string,
        fieldKey: keyof DataBlockConfig,
        actionLabel: string,
        actionDesc: string,
        actionKey: keyof DataBlockConfig;
        defaultField: string;
        defaultAction: string | null;
    }
): void {
    const fieldSetting = new Setting(container)
        .setName(config.fieldLabel)
        .setDesc(config.fieldDesc);
    buildAdvancedFieldSelector(modal, fieldSetting.controlEl, config.fieldKey, config.defaultField, false);

    const actionContainer = container.createDiv({ cls: 'action-configuration' });
    const actionSetting = new Setting(actionContainer)
        .setName('Click Action')
        .setDesc('Add an action when this element is clicked.');

    const actionFieldsContainer = actionContainer.createDiv({ cls: 'action-fields' });

    const renderActionUI = () => {
        actionSetting.controlEl.empty();
        actionFieldsContainer.empty();

        const configObject = (modal.config as any)[config.fieldKey];
        const hasAction = configObject && configObject.action !== undefined;

        actionSetting.addExtraButton(button => {
            button
                .setIcon(hasAction ? 'trash' : 'plus')
                .setTooltip(hasAction ? 'Remove action' : 'Add action')
                .onClick(() => {
                    const currentConfig = (modal.config as any)[config.fieldKey];
                    if (currentConfig.action !== undefined) {
                        delete currentConfig.action;
                    } else {
                        currentConfig.action = config.defaultAction || 'item.path';
                    }
                    modal.updatePreview();
                    renderActionUI();
                });
        });

        if (hasAction) {
            actionFieldsContainer.style.display = 'block';
            buildAdvancedFieldSelector(modal, actionFieldsContainer, config.fieldKey, config.defaultAction || 'item.path', true);
        } else {
            actionFieldsContainer.style.display = 'none';
        }
    };

    renderActionUI();
}