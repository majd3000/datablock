import { App, Modal, Setting, TextAreaComponent, Notice, ToggleComponent } from 'obsidian';
import { DataBlockConfigModal } from './DataBlockConfigModal';
import { PillConfig } from '../types';
import { buildActionInputs } from './components/settings-sections';
import { createTestButton } from './components/field-config';
import { stringToFunction, functionToCodeBlock, functionBodyToString } from '../utils/javascript-helper';
import { JSTextarea } from './codemirror';

export class AddPillModal extends Modal {
    private detectedFields: string[];
    private onSubmit: (pill: PillConfig) => void;
    private pillConfig: Partial<PillConfig> = {};
    private actionToggle: ToggleComponent;
    private dataSource: 'notes' | 'custom';
    private modal: DataBlockConfigModal;
    private customTextField: JSTextarea;
    private customActionField: JSTextarea;

    constructor(
        app: App,
        detectedFields: string[],
        dataSource: 'notes' | 'custom',
        onSubmit: (pill: PillConfig) => void,
        modal: DataBlockConfigModal,
    ) {
        super(app);
        this.detectedFields = detectedFields;
        this.dataSource = dataSource;
        this.onSubmit = onSubmit;
        this.modal = modal;
    }

    onOpen(): void {
        this.contentEl.empty();
        this.titleEl.setText('Add New Pill');
        this.contentEl.addClass('datablock-add-item-modal');

        // Initialize with a default field
        this.pillConfig = {
            text: '',
        };

        // Field Configuration Section
        const fieldSection = this.contentEl.createDiv({ cls: 'pill-field-section' });
        
        new Setting(fieldSection)
            .setName('Content Type')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('property', 'Property Value')
                    .addOption('text', 'Text Template')
                    .addOption('custom', 'Custom JavaScript')
                    .setValue(this.getFieldType())
                    .onChange(this.handleFieldTypeChange.bind(this));
            });

        const fieldValueContainer = fieldSection.createDiv({ cls: 'field-value-container' });
        this.buildFieldValueInputs(fieldValueContainer);

        // Action Configuration Section (Optional)
        const actionSection = this.contentEl.createDiv({ cls: 'pill-action-section' });
        
        new Setting(actionSection)
            .setName('Add Click Action')
            .addToggle(toggle => {
                this.actionToggle = toggle;
                toggle
                    .setValue(!!this.pillConfig.action)
                    .onChange(enabled => {
                        const actionContainer = actionSection.querySelector('.action-container') as HTMLElement;
                        if (actionContainer) actionContainer.style.display = enabled ? 'block' : 'none';
                        
                        this.updatePropertyToEditVisibility();
                    });
            });

        const actionContainer = actionSection.createDiv({ cls: 'action-container' });
        actionContainer.style.display = this.pillConfig.action ? 'block' : 'none';
        this.buildActionInputs(actionContainer);

        // Footer
        new Setting(this.contentEl)
            .addButton(btn =>
                btn.setButtonText('Cancel')
                   .onClick(() => this.close())
            )
            .addButton(btn =>
                btn.setButtonText('Add Pill')
                   .setCta()
                   .onClick(this.handleSubmit.bind(this))
            );
    }

    private buildFieldValueInputs(container: HTMLElement): void {
        const fieldType = this.getFieldType();

        // Property dropdown
        const propertyContainer = container.createDiv({ cls: 'property-input' });
        propertyContainer.style.display = fieldType === 'property' ? 'block' : 'none';
        new Setting(propertyContainer)
            .setName('Select Property')
            .addDropdown(dropdown => {
                if (this.detectedFields.length === 0) {
                    dropdown.addOption('', 'No properties found');
                    dropdown.setDisabled(true);
                } else {
                    dropdown.addOption('', '--- Select ---');
                    this.detectedFields.forEach(field => dropdown.addOption(field, field));
                    if (fieldType === 'property') {
                        dropdown.setValue(this.pillConfig.text as string);
                    }
                }
            });

        // Text input
        const textContainer = container.createDiv({ cls: 'text-input' });
        textContainer.style.display = fieldType === 'text' ? 'block' : 'none';
        new Setting(textContainer)
            .setName('Pill Text')
            .addText(text => {
                text.setPlaceholder('{{icon:iconName}} {{property:fieldName}}')
                if (fieldType === 'text') {
                    text.setValue(this.pillConfig.text as string);
                }
            });

        // Custom JS textarea
        const customContainer = container.createDiv({ cls: 'custom-input' });
        customContainer.style.display = fieldType === 'custom' ? 'block' : 'none';
        
        const setting = new Setting(customContainer)
            .setName('JavaScript Expression')
            .setDesc('Return the value to display.');
        
        const editorContainer = setting.controlEl.createDiv({ cls: 'editor-container', attr: { style: 'width: 100%;' } });
        let editor: JSTextarea;
        const ta = new TextAreaComponent(editorContainer);
        ta.inputEl.style.display = 'none';

        this.customTextField = new JSTextarea(editorContainer, {
            initialValue: fieldType === 'custom' ? functionToCodeBlock(this.pillConfig.text) : '',
            onChange: (value) => {
                // This will now be handled by handleSubmit
            },
            placeholder: 'return item.name;'
        });
        createTestButton(setting.controlEl, ta, false, this.modal, () => editor.getValue());
    }

    private buildActionInputs(container: HTMLElement): void {
        buildActionInputs(
            this,
            container,
            this.pillConfig,
            (newConfig) => {
                this.pillConfig = { ...this.pillConfig, ...newConfig };
            },
            this.detectedFields,
            this.dataSource,
            undefined,
            (editor) => { this.customActionField = editor; }
        );
    }

    private handleFieldTypeChange(type: string): void {
        const container = this.contentEl.querySelector('.field-value-container') as HTMLElement;
        const property = container.querySelector('.property-input') as HTMLElement;
        const text = container.querySelector('.text-input') as HTMLElement;
        const custom = container.querySelector('.custom-input') as HTMLElement;

        property.style.display = type === 'property' ? 'block' : 'none';
        text.style.display = type === 'text' ? 'block' : 'none';
        custom.style.display = type === 'custom' ? 'block' : 'none';

        this.updatePropertyToEditVisibility();

        if (type === 'custom') {
            this.pillConfig.text = 'item => item.name';
        } else {
            this.pillConfig.text = '';
        }
    }

    private getFieldType(): 'property' | 'text' | 'custom' {
        const text = this.pillConfig.text;
        if (typeof text === 'function') return 'custom';
        if (typeof text === 'string' && text.startsWith('property:')) return 'property';
        // Only return 'text' if the string is not empty
        if (typeof text === 'string' && text) return 'text';
        // Default to property for new pills (empty text)
        return 'property';
    }

    private getCurrentFieldType(): 'property' | 'text' | 'custom' {
        const fieldTypeDropdown = this.contentEl.querySelector('.pill-field-section select') as HTMLSelectElement;
        if (fieldTypeDropdown) {
            return fieldTypeDropdown.value as 'property' | 'text' | 'custom';
        }
        return this.getFieldType();
    }

    private handleSubmit(): void {
        const newPillConfig: Partial<PillConfig> = {};

        // --- FIELD CONFIGURATION ---
        const fieldTypeDropdown = this.contentEl.querySelector('.pill-field-section select') as HTMLSelectElement;
        const fieldType = fieldTypeDropdown.value;

        if (fieldType === 'property') {
            const fieldValue = (this.contentEl.querySelector('.property-input select') as HTMLSelectElement)?.value;
            if (!fieldValue) {
                new Notice('Please select a property.');
                return;
            }
            newPillConfig.text = `property:${fieldValue}`;
        } else if (fieldType === 'text') {
            const textValue = (this.contentEl.querySelector('.text-input input') as HTMLInputElement)?.value;
            if (!textValue) {
                new Notice('Please enter text for the pill.');
                return;
            }
            newPillConfig.text = textValue;
        } else if (fieldType === 'custom') {
            const jsCode = this.customTextField.getValue();
            if (!jsCode || jsCode.trim() === '') {
                new Notice('Custom JavaScript for pill field cannot be empty.');
                return;
            }
            newPillConfig.text = stringToFunction(jsCode) as any;
        }

        // --- ACTION CONFIGURATION ---
        const actionEnabled = this.actionToggle.getValue();
        if (actionEnabled) {
            const actionTypeDropdown = this.contentEl.querySelector('.action-container .setting-item:first-child select') as HTMLSelectElement;
            const actionType = actionTypeDropdown.value;

            if (actionType === 'item.path') {
                newPillConfig.action = 'item.path';
            } else if (actionType === 'edit-property') {
                newPillConfig.action = 'edit-property';
                if (this.dataSource !== 'custom') {
                    newPillConfig.propertyType = this.pillConfig.propertyType || 'Text';
                }
                if (typeof newPillConfig.text === 'function') {
                    newPillConfig.property = this.pillConfig.property;
                }
                if (newPillConfig.propertyType === 'Select') {
                    newPillConfig.options = this.pillConfig.options;
                }
            } else if (actionType === 'js') {
                const jsCode = this.customActionField.getValue();
                if (!jsCode || jsCode.trim() === '') {
                    new Notice('Custom JavaScript for action cannot be empty.');
                    return;
                }
                newPillConfig.action = stringToFunction(jsCode) as any;
            }
        }

        this.onSubmit(newPillConfig as PillConfig);
        this.close();
    }

    public updatePropertyToEditVisibility(): void {
        const fieldType = this.getCurrentFieldType();
        const actionTypeDropdown = this.contentEl.querySelector('.action-container .setting-item:first-child select') as HTMLSelectElement;
        const actionType = actionTypeDropdown ? actionTypeDropdown.value : 'edit-property';
        const propertyToEditContainer = this.contentEl.querySelector('.pill-property-to-edit-container') as HTMLElement;

        if (propertyToEditContainer) {
            const isActionEnabled = this.actionToggle.getValue();
            const show = isActionEnabled && fieldType === 'custom' && actionType === 'edit-property';
            propertyToEditContainer.style.display = show ? 'block' : 'none';
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}