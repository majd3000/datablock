import { App, Modal, Setting, ToggleComponent, Notice, TextAreaComponent } from 'obsidian';
import { PillConfig } from '../types';
import { DataBlockConfigModal } from './DataBlockConfigModal';
import { buildActionInputs } from './components/settings-sections';
import { createTestButton } from './components/field-config';
import { stringToFunction, functionToCodeBlock, functionBodyToString } from '../utils/javascript-helper';
import { JSTextarea } from './codemirror';

export class EditPillModal extends Modal {
    private pillConfig: PillConfig;
    private detectedFields: string[];
    private onSubmit: (pill: PillConfig) => void;
    private actionToggle: ToggleComponent;
    private dataSource: 'notes' | 'custom';
    private modal: DataBlockConfigModal;
    private customTextField: JSTextarea;
    private customActionField: JSTextarea;

    constructor(
        app: App,
        pillConfig: PillConfig,
        detectedFields: string[],
        dataSource: 'notes' | 'custom',
        onSubmit: (pill: PillConfig) => void,
        modal: DataBlockConfigModal,
    ) {
        super(app);
        this.pillConfig = { ...pillConfig };
        this.detectedFields = detectedFields;
        this.dataSource = dataSource;
        this.onSubmit = onSubmit;
        this.modal = modal;
    }

    onOpen(): void {
        this.contentEl.empty();
        this.titleEl.setText('Edit Pill');
        this.contentEl.addClass('datablock-add-item-modal');
    
        const fieldType = this.getCurrentFieldType();
    
        const fieldSection = this.contentEl.createDiv({ cls: 'pill-field-section' });
        new Setting(fieldSection)
            .setName('Content Type')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('property', 'Property Value')
                    .addOption('text', 'Text Template')
                    .addOption('custom', 'Custom JavaScript')
                    .setValue(fieldType)
                    .onChange(this.handleFieldTypeChange.bind(this));
            });
    
        const fieldValueContainer = fieldSection.createDiv({ cls: 'field-value-container' });
        this.buildFieldValueInputs(fieldValueContainer, fieldType);
    
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
        this.updatePropertyToEditVisibility();

        // Footer
        new Setting(this.contentEl)
            .addButton(btn => 
                btn.setButtonText('Cancel')
                   .onClick(() => this.close())
            )
            .addButton(btn => 
                btn.setButtonText('Save Changes')
                   .setCta()
                   .onClick(this.handleSubmit.bind(this))
            );
    }

    private buildFieldValueInputs(container: HTMLElement, fieldType: string): void {
        const currentFieldValue = typeof this.pillConfig.text === 'string'
            ? (this.pillConfig.text as string).replace(/^(property:)/, '')
            : '';

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
                    if (fieldType === 'property' && currentFieldValue && !this.detectedFields.includes(currentFieldValue)) {
                        this.detectedFields.unshift(currentFieldValue);
                    }
                    this.detectedFields.forEach(field => dropdown.addOption(field, field));
                    dropdown.setValue(currentFieldValue);
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
            .setDesc('Return the value to display (e.g., item => item.status)');
        
        const editorContainer = setting.controlEl.createDiv({ cls: 'editor-container', attr: { style: 'width: 100%;' } });
        let editor: JSTextarea;
        const ta = new TextAreaComponent(editorContainer);
        ta.inputEl.style.display = 'none';

        this.customTextField = new JSTextarea(editorContainer, {
            initialValue: fieldType === 'custom' ? functionToCodeBlock(this.pillConfig.text) : "",
            onChange: (value) => {
                // This will now be handled by handleSubmit
            },
            placeholder: 'return item.name;'
        });
        createTestButton(setting.controlEl, ta, false, this.modal, () => editor.getValue());
    }

    private buildActionInputs(container: HTMLElement): void {
        container.innerHTML = '';
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
        container.innerHTML = ''; // Clear existing inputs
        
        // When switching, clear the previous value to avoid carrying it over
        if (type === 'custom') {
            this.pillConfig.text = () => '';
        } else {
            this.pillConfig.text = '';
        }
        
        this.buildFieldValueInputs(container, type); // Rebuild with the new type and cleared value
        this.updatePropertyToEditVisibility();
    }


    private handleSubmit(): void {
        const newPillConfig: Partial<PillConfig> = {};

        // --- FIELD CONFIGURATION ---
        const fieldTypeDropdown = this.contentEl.querySelector('.pill-field-section select') as HTMLSelectElement;
        const fieldType = fieldTypeDropdown.value;

        if (fieldType === 'property') {
            const fieldValue = (this.contentEl.querySelector('.property-input select') as HTMLSelectElement)?.value;
            if (!fieldValue) {
                new Notice('Please select a property for the pill display.');
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
            newPillConfig.action = actionType;

            if (actionType === 'edit-property') {
                const propertyTypeDropdown = this.contentEl.querySelector('.action-value-container .setting-item:nth-child(2) select') as HTMLSelectElement;
if (this.dataSource !== 'custom') {
                    newPillConfig.propertyType = propertyTypeDropdown.value as any;
                }
                
                if (fieldType === 'custom') {
                    const propertyDropdown = this.contentEl.querySelector('.pill-property-to-edit-container select') as HTMLSelectElement;
                    if (propertyDropdown) {
                        newPillConfig.property = propertyDropdown.value;
                    }
                }


                if (newPillConfig.propertyType === 'Select') {
                    const optionsTextarea = this.contentEl.querySelector('.options-container textarea') as HTMLTextAreaElement;
                    newPillConfig.options = optionsTextarea.value.split('\n');
                }
            } else if (actionType === 'path') {
                const filePathInput = this.contentEl.querySelector('.action-value-container input') as HTMLInputElement;
                newPillConfig.action = filePathInput.value;
            } else if (actionType === 'js') {
                const jsCode = this.customActionField.getValue();
                if (!jsCode || jsCode.trim() === '') {
                    new Notice('Custom JavaScript for action cannot be empty.');
                    return;
                }
                newPillConfig.action = stringToFunction(jsCode) as any;
            }
        } else {
            newPillConfig.action = undefined;
            newPillConfig.property = undefined;
            newPillConfig.propertyType = undefined;
            newPillConfig.options = undefined;
        }

        this.onSubmit(newPillConfig as PillConfig);
        this.close();
    }

    private getCurrentFieldType(): 'property' | 'text' | 'custom' {
        // Prioritize reading from the UI if it exists
        const fieldTypeDropdown = this.contentEl.querySelector('.pill-field-section select') as HTMLSelectElement;
        if (fieldTypeDropdown) {
            return fieldTypeDropdown.value as 'property' | 'text' | 'custom';
        }

        // Fallback to the initial config
        const text = this.pillConfig.text;
        if (typeof text === 'function') return 'custom';
        if (typeof text === 'string' && text.startsWith('property:')) return 'property';
        if (typeof text === 'string') return 'text';
        return 'property';
    }

    public updatePropertyToEditVisibility(): void {
        const fieldType = this.getCurrentFieldType();
        const actionTypeDropdown = this.contentEl.querySelector('.action-container .setting-item:first-child select') as HTMLSelectElement;
        const actionType = actionTypeDropdown ? actionTypeDropdown.value : this.pillConfig.action;
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