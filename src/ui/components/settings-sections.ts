import { Setting, DropdownComponent, TextComponent, ToggleComponent, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import { DataBlockConfig, FilterOperator, PillConfig, ButtonConfig, Filter, FilterConjunction, SortConfig, MenuOption } from '../../types';
import { DataBlockConfigModal } from '../DataBlockConfigModal';
import { stringToFunction, functionToCodeBlock, functionBodyToString } from '../../utils/javascript-helper';
import { createTestButton } from './field-config';
import { JSTextarea } from '../codemirror';

export function buildConfigPillManager(modal: DataBlockConfigModal, container: HTMLElement): void {
    const pillList = container.createDiv({ cls: 'datablock-config-pill-list' });
    
    const renderPills = () => {
        pillList.innerHTML = '';
        (modal.config.pills || []).forEach((pill, index) => {
            const pillItem = pillList.createDiv({ cls: 'datablock-pill-item' });
            
            const pillPreview = pillItem.createDiv({ cls: 'datablock-pill-preview' });
            pillPreview.createSpan({
                cls: 'pill-sample',
                text: typeof pill.text === 'function'
                    ? 'Custom JS'
                    : (pill.text.startsWith('property:') ? pill.text.substring(9) : pill.text)
            });

            const pillActions = pillItem.createDiv({ cls: 'datablock-pill-actions' });
            
            new ButtonComponent(pillActions)
                .setIcon('arrow-down')
                .setTooltip('Move down')
                .setDisabled(index === modal.config.pills!.length - 1)
                .onClick(() => {
                    if (index < modal.config.pills!.length - 1) {
                        const [pill] = modal.config.pills!.splice(index, 1);
                        modal.config.pills!.splice(index + 1, 0, pill);
                        renderPills();
                        modal.updatePreview();
                    }
                });

            new ButtonComponent(pillActions)
                .setIcon('arrow-up')
                .setTooltip('Move up')
                .setDisabled(index === 0)
                .onClick(() => {
                    if (index > 0) {
                        const [pill] = modal.config.pills!.splice(index, 1);
                        modal.config.pills!.splice(index - 1, 0, pill);
                        renderPills();
                        modal.updatePreview();
                    }
                });

            const editBtn = new ButtonComponent(pillActions)
                .setIcon('pencil')
                .setTooltip('Edit pill')
                .onClick(() => modal.editPill(index, renderPills));

            const deleteBtn = new ButtonComponent(pillActions)
                .setIcon('trash')
                .setTooltip('Delete pill')
                .onClick(() => {
                    modal.config.pills?.splice(index, 1);
                    renderPills();
                    modal.updatePreview();
                });

        });
    };

    renderPills();

    const addPillBtn = new ButtonComponent(container)
        .setButtonText('Add Pill')
        .setIcon('plus')
        .onClick(() => modal.showAddPillDialog(renderPills));
}

export function buildConfigButtonManager(modal: DataBlockConfigModal, container: HTMLElement): void {
    const buttonList = container.createDiv({ cls: 'datablock-config-button-list' });
    
    const renderButtons = () => {
        buttonList.innerHTML = '';
        (modal.config.buttons || []).forEach((button, index) => {
            const buttonItem = buttonList.createDiv({ cls: 'datablock-button-item' });
            
            const buttonPreview = buttonItem.createDiv({ cls: 'datablock-button-preview' });
            buttonPreview.createEl('button', {
                cls: 'datablock-sample-button',
                text: button.checkboxMode ? 'checkbox' : (typeof button.text === 'string' ? button.text : 'Dynamic Text')
            });

            const buttonActions = buttonItem.createDiv({ cls: 'datablock-button-actions' });
            
            new ButtonComponent(buttonActions)
                .setIcon('arrow-down')
                .setTooltip('Move down')
                .setDisabled(index === modal.config.buttons!.length - 1)
                .onClick(() => {
                    if (index < modal.config.buttons!.length - 1) {
                        const [button] = modal.config.buttons!.splice(index, 1);
                        modal.config.buttons!.splice(index + 1, 0, button);
                        renderButtons();
                        modal.updatePreview();
                    }
                });

            new ButtonComponent(buttonActions)
                .setIcon('arrow-up')
                .setTooltip('Move up')
                .setDisabled(index === 0)
                .onClick(() => {
                    if (index > 0) {
                        const [button] = modal.config.buttons!.splice(index, 1);
                        modal.config.buttons!.splice(index - 1, 0, button);
                        renderButtons();
                        modal.updatePreview();
                    }
                });

            const editBtn = new ButtonComponent(buttonActions)
                .setIcon('pencil')
                .setTooltip('Edit button')
                .onClick(() => modal.editButton(index, renderButtons));

            const deleteBtn = new ButtonComponent(buttonActions)
                .setIcon('trash')
                .setTooltip('Delete button')
                .onClick(() => {
                    modal.config.buttons?.splice(index, 1);
                    renderButtons();
                    modal.updatePreview();
                });
        });
    };

    renderButtons();

    const addButtonBtn = new ButtonComponent(container)
        .setButtonText('Add Button')
        .setIcon('plus')
        .onClick(() => modal.showAddButtonDialog(renderButtons));
}

export function buildConfigSortingSettings(modal: DataBlockConfigModal, container: HTMLElement): void {
    const sortCard = container.createDiv({ cls: 'datablock-card' });
    sortCard.createEl('h4', { text: 'Sorting Options' });

    const sortSetting = new Setting(sortCard).setName('Sort By');

    // Create a new Setting for the property dropdown which will be shown/hidden
    const propertyKeySetting = new Setting(sortCard)
        .setName('Property Key')
        .setDesc('Select the property to sort by.');
    propertyKeySetting.settingEl.style.display = 'none'; // Initially hidden

    const propertyKeyDropdown = new DropdownComponent(propertyKeySetting.controlEl);

    sortSetting.addDropdown(dropdown => {
        modal.populateDropdown(propertyKeyDropdown, modal.detectedFields, undefined, modal.detectedFields[0] || '');

        const updateSortOptions = () => {
            const currentVal = dropdown.getValue();
            dropdown.selectEl.innerHTML = '';
            if (modal.currentDataSource === 'custom') {
                dropdown.addOption('property', 'Property Value');
                dropdown.setValue('property');
            } else {
                dropdown.addOption('name', 'File Name');
                dropdown.addOption('mtime', 'Modified Time');
                dropdown.addOption('ctime', 'Created Time');
                dropdown.addOption('property', 'Property Value');
                if (!['file.name', 'file.mtime', 'file.ctime', 'property'].includes(currentVal)) {
                    dropdown.setValue('file.name');
                } else {
                    dropdown.setValue(currentVal);
                }
            }
        };

        const setInitialValue = () => {
            const sortConfig = Array.isArray(modal.config.sort) ? modal.config.sort[0] : modal.config.sort;
            const sort = sortConfig as SortConfig;
            let valueToSet: string = modal.currentDataSource === 'custom' ? 'property' : 'name';
            let propertyKey: string | undefined;
            let order: 'asc' | 'desc' = 'asc';

            if (sort && sort.by) {
                const prop = sort.by;
                order = sort.order || 'asc';

                if (prop.startsWith('property:')) {
                    valueToSet = 'property';
                    propertyKey = prop.substring('property:'.length);
                } else if (modal.currentDataSource === 'notes' && ['name', 'mtime', 'ctime'].includes(prop)) {
                    valueToSet = prop;
                } else {
                    valueToSet = 'property';
                    propertyKey = prop;
                }
            } else {
                // Default sort when nothing is configured
                valueToSet = modal.currentDataSource === 'notes' ? 'name' : 'property';
                if (valueToSet === 'property') {
                    propertyKey = modal.detectedFields.length > 0 ? modal.detectedFields[0] : 'name';
                }
                order = 'asc';
            }
            
            dropdown.setValue(valueToSet);
            (sortSetting.components[1] as DropdownComponent).setValue(order);
            
            if (valueToSet === 'property') {
                propertyKeySetting.settingEl.style.display = ''; // Show
                if (propertyKey) {
                    propertyKeyDropdown.setValue(propertyKey);
                }
            } else {
                propertyKeySetting.settingEl.style.display = 'none'; // Hide
            }
        };

        const updateSortConfig = () => {
            const sortByValue = dropdown.getValue();
            const orderValue = (sortSetting.components[1] as DropdownComponent).getValue() as 'asc' | 'desc';
            let finalSortBy: string;

            if (sortByValue === 'property') {
                const propertyKey = propertyKeyDropdown.getValue();
                // Add the 'property:' prefix for user-defined properties
                finalSortBy = `property:${propertyKey}`;
            } else {
                // Use the direct value for built-in properties like 'name', 'mtime'
                finalSortBy = sortByValue;
            }
            
            modal.config.sort = { by: finalSortBy, order: orderValue };
            modal.updatePreview();
        };

        propertyKeyDropdown.onChange(updateSortConfig);
        dropdown.onChange(value => {
            if (value === 'property') {
                propertyKeySetting.settingEl.style.display = '';
            } else {
                propertyKeySetting.settingEl.style.display = 'none';
            }
            updateSortConfig();
        });
        
        updateSortOptions();
        
        sortSetting.addDropdown(orderDropdown => orderDropdown
            .addOption('asc', '↑ Ascending')
            .addOption('desc', '↓ Descending')
            .onChange(updateSortConfig)
        );
        
        setInitialValue();
        
        const originalPopulate = modal.populateDropdown;
        modal.populateDropdown = (dd, fields, selected, def, placeholder) => {
            originalPopulate.call(modal, dd, fields, selected, def, placeholder);
            if (dd === propertyKeyDropdown) {
                updateSortOptions();
                setInitialValue();
            }
        };
    });
}
function buildSimpleFilterManager(modal: DataBlockConfigModal, container: HTMLElement): void {
    const renderFilters = () => {
        container.innerHTML = '';

        (modal.config.filters || []).forEach((filter, index) => {
            if (index > 0) {
                const conjunctionContainer = container.createDiv({ cls: 'datablock-filter-conjunction' });
                new DropdownComponent(conjunctionContainer)
                    .addOption('and', 'AND')
                    .addOption('or', 'OR')
                    .setValue(filter.conjunction || 'and')
                    .onChange((value: 'and' | 'or') => {
                        filter.conjunction = value;
                        modal.updatePreview();
                    });
            }
            
            const filterItem = container.createDiv({ cls: 'datablock-filter-item' });
            const controlsContainer = filterItem.createDiv({ cls: 'datablock-filter-item-controls' });

            new DropdownComponent(controlsContainer)
                .addOption('property', 'Property Value')
                .addOption('custom', 'Custom JavaScript')
                .setValue(filter.type)
                .onChange((type: 'property' | 'custom') => {
                    filter.type = type;
                    delete filter.field;
                    delete filter.operator;
                    delete filter.value;
                    delete filter.func;
                    if (type === 'custom') {
                        filter.func = 'return true;';
                    }
                    renderFilters();
                    modal.updatePreview();
                });

            if (filter.type === 'property') {
                new DropdownComponent(controlsContainer)
                    .then(dd => modal.populateDropdown(dd, modal.detectedFields, filter.field, undefined, '--- Select ---'))
                    .onChange(value => { filter.field = value; modal.updatePreview(); });

                const opDropdown = new DropdownComponent(controlsContainer)
                    .addOption('is', 'is')
                    .addOption('is-not', 'is not')
                    .addOption('contains', 'contains')
                    .addOption('does-not-contain', 'does not contain')
                    .addOption('is-empty', 'is empty')
                    .addOption('is-not-empty', 'is not empty')
                    .setValue(filter.operator || 'is')
                    .onChange(value => {
                       filter.operator = value as FilterOperator;
                       if (value === 'is-empty' || value === 'is-not-empty') {
                           delete filter.value;
                       } else if (filter.value === undefined) {
                           filter.value = '';
                       }
                       renderFilters();
                       modal.updatePreview();
                   });

                if (filter.operator !== 'is-empty' && filter.operator !== 'is-not-empty') {
                    new TextComponent(controlsContainer)
                        .setPlaceholder('Enter value...')
                        .setValue(filter.value || '')
                        .onChange(value => { filter.value = value; modal.updatePreview(); });
                }
            } else if (filter.type === 'custom') {
                const customJsRow = filterItem.createDiv({ cls: 'datablock-filter-row datablock-custom-js-row' });
                const editorContainer = customJsRow.createDiv({ cls: 'editor-container' });
                const editor = new JSTextarea(editorContainer, {
                    initialValue: typeof filter.func === 'function' ? functionBodyToString(filter.func) : filter.func || '',
                    onChange: (value) => {
                        filter.func = value;
                        modal.updatePreview();
                    }
                });
            }

            new ButtonComponent(controlsContainer)
                .setIcon('trash')
                .setTooltip('Remove filter')
                .onClick(() => {
                    modal.config.filters?.splice(index, 1);
                    if (index > 0 && index === modal.config.filters?.length) {
                        delete (modal.config.filters as any)[index-1].conjunction;
                    }
                    renderFilters();
                    modal.updatePreview();
                });
        });

        const addBtnContainer = container.createDiv({ cls: 'datablock-add-filter-btn-container' });
        new ButtonComponent(addBtnContainer)
            .setIcon('plus')
            .setTooltip('Add New Filter')
            .onClick(() => {
                if (!modal.config.filters) modal.config.filters = [];
                const newFilter: Filter = { type: 'property', field: modal.detectedFields[0] || '', operator: 'is', value: '' };
                if (modal.config.filters.length > 0) {
                    newFilter.conjunction = 'and';
                }
                modal.config.filters.push(newFilter);
                renderFilters();
                modal.updatePreview();
            });
    }

    renderFilters();
}

export function buildConfigFilterSection(modal: DataBlockConfigModal, container: HTMLElement): void {
    const filtersContainer = container.createDiv({ cls: 'datablock-config-filters' });
    buildSimpleFilterManager(modal, filtersContainer);
}

export function buildPaginationSettings(modal: DataBlockConfigModal, container: HTMLElement): void {
    const existing = container.querySelector('.datablock-pagination-settings');
    if (existing) existing.remove();

    if (modal.config.pagination) {
        const paginationContainer = container.createDiv({ cls: 'datablock-pagination-settings' });
        new Setting(paginationContainer)
            .setName('Page Size')
            .setDesc('Number of items per page')
            .addText(text => text
                .setPlaceholder('12')
                .setValue(modal.config.limit?.toString() ?? '12')
                .onChange(value => {
                    const num = parseInt(value, 10);
                    modal.config.limit = isNaN(num) ? 12 : num;
                    modal.updatePreview();
                }));
        
        new Setting(paginationContainer)
            .setName('Pagination Style')
            .setDesc('Choose between buttons or numeric display')
            .addDropdown(dd => dd
                .addOption('buttons', 'Previous/Next Buttons')
                .addOption('numeric', 'Numeric Page Links')
                .setValue((modal.config as any).paginationType || 'buttons')
                .onChange(value => {
                    (modal.config as any).paginationType = value;
                    modal.updatePreview();
                }));
    }
}

export function buildPerformanceSettings(modal: DataBlockConfigModal, container: HTMLElement): void {
    const performanceCard = container.createDiv({ cls: 'datablock-card' });
    performanceCard.createEl('h4', { text: 'Performance & Limits' });

    new Setting(performanceCard)
        .setName('Max Items')
        .setDesc('Maximum number of items to fetch from the source.')
        .addText(text => text
            .setPlaceholder('1000')
            .setValue(modal.config.maxItems?.toString() ?? '')
            .onChange(value => {
                const num = parseInt(value, 10);
                modal.config.maxItems = isNaN(num) ? undefined : num;
                modal.updatePreview();
            }));
    
    new Setting(performanceCard)
        .setName('Enable Search')
        .setDesc('Add a search box to filter results')
        .addToggle(toggle => toggle
            .setValue(modal.config.search ?? false)
            .onChange(value => {
                modal.config.search = value;
                modal.updatePreview();
            }));

    new Setting(performanceCard)
        .setName('Enable Pagination')
        .setDesc('Split results across multiple pages')
        .addToggle(toggle => toggle
            .setValue(modal.config.pagination ?? false)
            .onChange(value => {
                modal.config.pagination = value;
                if (value && modal.config.limit === undefined) {
                    modal.config.limit = 12;
                }
                buildPaginationSettings(modal, performanceCard);
                modal.updatePreview();
            }));
    
    buildPaginationSettings(modal, performanceCard);
}

export function buildStylingSettings(modal: DataBlockConfigModal, container: HTMLElement): void {
    new Setting(container)
        .setName('Custom CSS Class')
        .setDesc('Add custom CSS class for styling.')
        .addText(text => text
            .setValue((modal.config as any).class || '')
            .setPlaceholder('my-custom-class')
            .onChange(value => {
                (modal.config as any).class = value;
                modal.updatePreview();
            }));

    new Setting(container)
        .setName('Inline Buttons')
        .setDesc('Combine pills and buttons into a single inline element.')
        .addToggle(toggle => toggle
            .setValue(modal.config.inlineButtons ?? false)
            .onChange(value => {
                modal.config.inlineButtons = value;
                modal.updatePreview();
            }));

    if (modal.currentDataSource === 'notes') {
        new Setting(container)
            .setName('Open Note in New Tab')
            .setDesc('Enable to open notes in a new tab by default.')
            .addToggle(toggle => toggle
                .setValue(modal.config.newTab ?? false)
                .onChange(value => {
                    modal.config.newTab = value;
                    modal.updatePreview();
                }));
    }
}

export function buildCustomGroupManager(modal: DataBlockConfigModal, container: HTMLElement): void {
    container.empty();

    new Setting(container)
        .setName('Group Property')
        .setDesc('The property key to use for custom grouping.')
        .addText(text => text
            .setValue(modal.config.customGroups?.property || 'status')
            .onChange(value => {
                if (!modal.config.customGroups) {
                    modal.config.customGroups = { property: 'status', groups: [] };
                }
                modal.config.customGroups.property = value;
                modal.updatePreview();
            }));

    new Setting(container)
        .setName('Groups')
        .setDesc('A list of group names, in order.')
        .addTextArea(ta => {
            ta.setValue(modal.config.customGroups?.groups.join('\n') || '')
              .setPlaceholder('To Do\nIn Progress\nDone')
              .onChange(value => {
                if (!modal.config.customGroups) {
                    modal.config.customGroups = { property: 'status', groups: [] };
                }
                modal.config.customGroups.groups = value.split('\n');
                modal.updatePreview();
              });
            ta.inputEl.style.width = '100%';
            ta.inputEl.style.height = '100px';
        });
}

export function buildActionInputs(
    modal: any,
    container: HTMLElement,
    config: Partial<PillConfig | ButtonConfig>,
    onConfigChange: (newConfig: Partial<PillConfig | ButtonConfig>) => void,
    detectedFields: string[] | undefined,
    dataSource: 'notes' | 'custom',
    textSection?: HTMLElement,
    setCustomActionField?: (editor: JSTextarea) => void
): void {
    const isPill = modal.constructor.name === 'EditPillModal' || modal.constructor.name === 'AddPillModal';

    const getActionType = (action: any) => {
        if (Array.isArray((config as ButtonConfig).menuOptions)) return 'menu';
        if (typeof action === 'function') return 'js';
        if (action === 'item.path') return 'item.path';
        if (action === 'edit-property') return 'edit-property';
        if (typeof action === 'string') return 'path';
        return isPill ? 'edit-property' : 'item.path';
    };

    let currentActionType = getActionType(config.action);

    if (dataSource === 'custom' && currentActionType !== 'js') {
        const newConfig: Partial<ButtonConfig> = {
            action: undefined,
            property: undefined,
            propertyType: undefined,
            options: undefined,
            checkboxMode: undefined,
            text: 'New Button'
        };

        onConfigChange(newConfig);

        if (textSection) {
            textSection.style.display = '';
        }

        config.action = '' as any;
        currentActionType = 'js';
    }

    new Setting(container)
        .setName('Action Type')
        .addDropdown(dropdown => {
            if (dataSource === 'notes') {
                if (isPill) {
                    dropdown.addOption('edit-property', "Edit Property");
                    dropdown.addOption('item.path', "Open item's path");
                } else {
                    dropdown.addOption('item.path', "Open item's path");
                    dropdown.addOption('edit-property', "Edit Property");
                    dropdown.addOption('menu', 'Display Menu Options');
                }
            }

            dropdown.addOption('js', 'Execute JavaScript');

            if (dataSource === 'custom') {
                dropdown.setValue('js');
                dropdown.setDisabled(true);
            } else {
                dropdown.setValue(currentActionType);
            }

            dropdown.onChange((type) => {
                const newConfig: Partial<ButtonConfig> = {};

                if (type === 'item.path') {
                    newConfig.action = 'item.path';
                    newConfig.menuOptions = undefined;
                } else if (type === 'js') {
                    newConfig.action = '';
                    newConfig.menuOptions = undefined;
                } else if (type === 'edit-property') {
                    newConfig.action = 'edit-property';
                    newConfig.propertyType = 'Text';
                    newConfig.menuOptions = undefined;
                } else if (type === 'menu') {
                    newConfig.action = undefined;
                    newConfig.menuOptions = [
                        { name: '{{icon:pencil-line}} Rename', action: 'const name = await api.inputPrompt("Rename", "New name:", item.basename);\nif (name?.trim()) {\n  const newName = `${item.parent.path}/${name}.md`;\n  await app.fileManager.renameFile(item, newName);\n}' },
                        { name: '{{icon:trash-2}} Delete', action: 'const confirmed = await api.confirmPrompt("Confirm Deletion", `Are you sure you want to delete "${item.basename}"?`);\nif (confirmed) {\n  await app.vault.trash(item, true);\n}' }                        
                    ];
                } else {
                    newConfig.action = '';
                    newConfig.menuOptions = undefined;
                }

                if (type !== 'edit-property') {
                    newConfig.property = undefined;
                    newConfig.propertyType = undefined;
                    newConfig.options = undefined;
                    newConfig.checkboxMode = undefined;
                    if (textSection) {
                        textSection.style.display = '';
                    }
                } else if (textSection) {
                    textSection.style.display = '';
                }

                onConfigChange(newConfig);
                const updatedConfigForUI = { ...config, ...newConfig };
                handleActionTypeChange(type, updatedConfigForUI);
                if (isPill) {
                    modal.updatePropertyToEditVisibility();
                }
            });
        });

    const actionValueContainer = container.createDiv({ cls: 'action-value-container' });

    const handleActionTypeChange = (type: string, currentConfig: Partial<PillConfig | ButtonConfig>) => {
        actionValueContainer.innerHTML = '';
        actionValueContainer.style.display = 'block';

        if (type === 'edit-property') {
            const propertyNameContainer = actionValueContainer.createDiv({ cls: 'property-name-container pill-property-to-edit-container' });
            new Setting(propertyNameContainer)
                .setName('Property to Edit')
                .setDesc('The name of the property to edit.')
                .addDropdown(dropdown => {
                    if (detectedFields && detectedFields.length > 0) {
                        detectedFields.forEach(field => dropdown.addOption(field, field));
                        dropdown.setValue((config as PillConfig | ButtonConfig).property || detectedFields[0]);
                        onConfigChange({ property: dropdown.getValue() });
                    } else {
                        dropdown.addOption('', 'No properties found');
                        dropdown.setDisabled(true);
                    }
                    dropdown.onChange(value => {
                        onConfigChange({ property: value });
                    });
                });

            const propertyTypeSetting = new Setting(actionValueContainer)
                .setName('Property Type')
                .setDesc('Select the type of property to edit.');

            const handlePropertyTypeChange = (propertyType: string, configForUI: Partial<PillConfig | ButtonConfig>) => {
                const optionsContainer = actionValueContainer.querySelector('.options-container') as HTMLElement;
                const checkboxModeContainer = actionValueContainer.querySelector('.checkbox-mode-container') as HTMLElement;
                if(optionsContainer) optionsContainer.innerHTML = '';
                if(checkboxModeContainer) checkboxModeContainer.innerHTML = '';

                if (propertyType === 'Select' && optionsContainer) {
                    new Setting(optionsContainer)
                        .setName('Options')
                        .setDesc('Enter one option per line.')
                        .addTextArea(textarea => {
                            textarea
                                .setPlaceholder('Option 1\nOption 2\nOption 3')
                                .setValue((configForUI as PillConfig | ButtonConfig).options?.join('\n') || '')
                                .onChange(value => {
                                    onConfigChange({ options: value.split('\n') });
                                });
                        });
                }

                if (propertyType === 'Boolean' && textSection && checkboxModeContainer) {
                    new Setting(checkboxModeContainer)
                        .setName('Checkbox Mode')
                        .setDesc('Use checkbox input instead of text display')
                        .addToggle(toggle => {
                            toggle
                                .setValue((configForUI as ButtonConfig).checkboxMode || false)
                                .onChange(value => {
                                    onConfigChange({ checkboxMode: value, text: value ? '' : 'New Button' });
                                    if (textSection) {
                                        textSection.style.display = value ? 'none' : '';
                                    }
                                });
                        });
                }

                if (propertyType === 'Boolean' && (configForUI as ButtonConfig).checkboxMode && textSection) {
                    textSection.style.display = 'none';
                } else if (textSection) {
                    textSection.style.display = '';
                }
            };

            const propertyTypeDropdown = new DropdownComponent(propertyTypeSetting.controlEl)
                .addOption('Text', 'Text')
                .addOption('Long Text', 'Long Text')
                .addOption('Select', 'Select')
                .addOption('Number', 'Number')
                .addOption('Date', 'Date')
                .addOption('Boolean', 'Boolean')
                .setValue((currentConfig as PillConfig | ButtonConfig).propertyType || 'Text')
                .onChange(value => {
                    const newConfig: Partial<ButtonConfig> = { propertyType: value as any };
                    if (value !== 'Boolean') {
                        newConfig.checkboxMode = undefined;
                    }
                    onConfigChange(newConfig);
                    const updatedConfig = { ...config, ...newConfig };
                    handlePropertyTypeChange(value, updatedConfig);
                });

            actionValueContainer.createDiv({ cls: 'options-container' });
            actionValueContainer.createDiv({ cls: 'checkbox-mode-container' });

            handlePropertyTypeChange(propertyTypeDropdown.getValue(), currentConfig);

        } else if (type === 'item.path') {
            // No additional inputs needed for this type
            actionValueContainer.style.display = 'none';
        } else if (type === 'js') {
            const setting = new Setting(actionValueContainer)
                .setName('JavaScript Code')
                .setDesc('Action to perform when clicked');

            const editorContainer = setting.controlEl.createDiv({ cls: 'editor-container', attr: { style: 'width: 100%;' } });
            let editor: JSTextarea;
            const ta = new TextAreaComponent(editorContainer);
            ta.inputEl.style.display = 'none';

            editor = new JSTextarea(editorContainer, {
                initialValue: functionToCodeBlock(currentConfig.action),
                onChange: (value) => {
                    onConfigChange({ action: value as any });
                },
                placeholder: 'console.log("Clicked:", item);'
            });
            if (setCustomActionField) {
                setCustomActionField(editor);
            }
            const mainModal = (modal as any).getFreshData ? modal : (modal as any).modal;
            createTestButton(setting.controlEl, ta, true, mainModal, () => editor.getValue());
        } else if (type === 'menu') {
            buildMenuOptionsManager(actionValueContainer, currentConfig as ButtonConfig, onConfigChange);
        } else {
            actionValueContainer.style.display = 'none';
        }
    };

    handleActionTypeChange(currentActionType, config);
    const dropdownEl = (container.querySelector('.dropdown') as HTMLSelectElement);
    if(dropdownEl) dropdownEl.value = currentActionType;
}

function buildMenuOptionsManager(
    container: HTMLElement,
    config: ButtonConfig,
    onConfigChange: (newConfig: Partial<ButtonConfig>) => void
): void {
    container.empty();
    const menuList = container.createDiv({ cls: 'datablock-config-menu-list' });

    const renderMenuOptions = () => {
        menuList.innerHTML = '';
        (config.menuOptions || []).forEach((option, index) => {
            const menuItem = menuList.createDiv({ cls: 'datablock-menu-item' });

            const setting = new Setting(menuItem)
                .addText(text => text
                    .setPlaceholder('Option Name')
                    .setValue(option.name)
                    .onChange(value => {
                        config.menuOptions![index].name = value;
                        onConfigChange({ menuOptions: config.menuOptions });
                    }))
                .then(text => {
                    const editorContainer = text.controlEl.createDiv({ cls: 'editor-container' });
                    new JSTextarea(editorContainer, {
                        initialValue: functionToCodeBlock(option.action),
                        onChange: (value) => {
                            const menuOptions = config.menuOptions || [];
                            menuOptions[index].action = value;
                            onConfigChange({ menuOptions: menuOptions });
                        },
                        placeholder: 'console.log(`Action for ${item.name}`);'
                    });
                })
            const actionButtonsContainer = setting.controlEl.createDiv({ cls: 'datablock-menu-item-actions' });
            
            new ButtonComponent(actionButtonsContainer)
                .setIcon('arrow-up')
                .setTooltip('Move up')
                .setDisabled(index === 0)
                .onClick(() => {
                    if (index > 0) {
                        const [option] = config.menuOptions!.splice(index, 1);
                        config.menuOptions!.splice(index - 1, 0, option);
                        onConfigChange({ menuOptions: config.menuOptions });
                        renderMenuOptions();
                    }
                });

            new ButtonComponent(actionButtonsContainer)
                .setIcon('arrow-down')
                .setTooltip('Move down')
                .setDisabled(index === (config.menuOptions || []).length - 1)
                .onClick(() => {
                    if (index < (config.menuOptions || []).length - 1) {
                        const [option] = config.menuOptions!.splice(index, 1);
                        config.menuOptions!.splice(index + 1, 0, option);
                        onConfigChange({ menuOptions: config.menuOptions });
                        renderMenuOptions();
                    }
                });

            new ButtonComponent(actionButtonsContainer)
                .setIcon('trash')
                .setTooltip('Delete option')
                .onClick(() => {
                    config.menuOptions?.splice(index, 1);
                    onConfigChange({ menuOptions: config.menuOptions });
                    renderMenuOptions();
                });
            
            setting.nameEl.setText(`Option ${index + 1}`);
        });
    };

    renderMenuOptions();

    new Setting(container)
        .addButton(button => button
            .setButtonText('+ Add Menu Option')
            .setCta()
            .onClick(() => {
                if (!config.menuOptions) {
                    config.menuOptions = [];
                }
                config.menuOptions.push({ name: '', action: '' });
                onConfigChange({ menuOptions: config.menuOptions });
                renderMenuOptions();
            }));
}