import { App, Modal, Setting, Notice, TextAreaComponent } from 'obsidian';
import { ButtonConfig } from '../types';
import { DataBlockConfigModal } from './DataBlockConfigModal';
import { createTestButton } from './components/field-config';
import { buildActionInputs } from './components/settings-sections';

import { stringToFunction, functionToCodeBlock, functionBodyToString } from '../utils/javascript-helper';
import { JSTextarea } from './codemirror';

export class AddButtonModal extends Modal {
    private onSubmit: (button: ButtonConfig) => void;
    private buttonConfig: Partial<ButtonConfig> = {};
    private dataSource: 'notes' | 'custom';
    private detectedFields: string[];
    private modal: DataBlockConfigModal;
    private customTextField: JSTextarea;
    private customActionField: JSTextarea;

    constructor(
        app: App,
        dataSource: 'notes' | 'custom',
        detectedFields: string[],
        onSubmit: (button: ButtonConfig) => void,
        modal: DataBlockConfigModal
    ) {
        super(app);
        this.dataSource = dataSource;
        this.detectedFields = detectedFields;
        this.onSubmit = onSubmit;
        this.modal = modal;
    }

    onOpen(): void {
        this.contentEl.empty();
        this.titleEl.setText('Add New Button');
        this.contentEl.addClass('datablock-add-item-modal');

        // Initialize with default values
        this.buttonConfig = {
            text: 'New Button',
            action: this.dataSource === 'custom' ? '' : 'item.path'
        };

        // Button Text Section
        const textSection = this.contentEl.createDiv({ cls: 'button-text-section' });
        
        new Setting(textSection)
            .setName('Content Type')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('text', 'Text Template')
                    .addOption('property', 'Property Value')
                    .addOption('dynamic', 'Custom JavaScript')
                    .setValue(this.getTextType())
                    .onChange(this.handleTextTypeChange.bind(this));
            });

        const textValueContainer = textSection.createDiv({ cls: 'text-value-container' });
        this.buildTextInputs(textValueContainer);

        // Action Section
        // Action Section
        const actionSection = this.contentEl.createDiv({ cls: 'button-action-section' });
        const actionContainer = actionSection.createDiv({ cls: 'action-container' });
        this.buildActionInputs(actionContainer);

        // Footer
        new Setting(this.contentEl)
            .addButton(btn =>
                btn.setButtonText('Cancel')
                   .onClick(() => this.close())
            )
            .addButton(btn =>
                btn.setButtonText('Add Button')
                   .setCta()
                   .onClick(this.handleSubmit.bind(this))
            );
    }

    private getTextType(): 'text' | 'property' | 'dynamic' {
        if (typeof this.buttonConfig.text === 'function') return 'dynamic';
        if (typeof this.buttonConfig.text === 'string' && this.buttonConfig.text.startsWith('property:')) return 'property';
        return 'text';
    }

    private buildTextInputs(container: HTMLElement): void {
        container.innerHTML = ''; // Clear previous inputs
        const type = this.getTextType();

        // Static text input
        if (type === 'text') {
            const staticContainer = container.createDiv({ cls: 'static-text-input' });
            new Setting(staticContainer)
                .setName('Button Text')
                .addText(text => {
                    text
                        .setValue(this.buttonConfig.text as string || 'New Button')
                        .onChange(value => {
                            this.buttonConfig.text = value;
                        });
                });
        }

        // Property-based text input
        if (type === 'property') {
            const propertyContainer = container.createDiv({ cls: 'property-text-input' });
            new Setting(propertyContainer)
                .setName('Select Property')
                .addDropdown(dropdown => {
                    if (this.detectedFields && this.detectedFields.length > 0) {
                        this.detectedFields.forEach(field => dropdown.addOption(field, field));
                        const currentProp = typeof this.buttonConfig.text === 'string' ? this.buttonConfig.text.replace('property:', '') : this.detectedFields[0];
                        dropdown.setValue(currentProp);
                        this.buttonConfig.text = `property:${currentProp}`;
                    } else {
                        dropdown.addOption('', 'No properties found');
                        dropdown.setDisabled(true);
                    }
                    dropdown.onChange(value => {
                        this.buttonConfig.text = `property:${value}`;
                    });
                });
        }

        // Dynamic JS textarea
        if (type === 'dynamic') {
            const dynamicContainer = container.createDiv({ cls: 'custom-input' });
            const setting = new Setting(dynamicContainer)
                .setName('JavaScript Expression')
                .setDesc('Return the button text.');
            
            const editorContainer = setting.controlEl.createDiv({ cls: 'editor-container', attr: { style: 'width: 100%;' } });
            let editor: JSTextarea;
            const ta = new TextAreaComponent(editorContainer);
            ta.inputEl.style.display = 'none';

            this.customTextField = new JSTextarea(editorContainer, {
                initialValue: functionToCodeBlock(this.buttonConfig.text),
                onChange: (value) => {
                    this.buttonConfig.text = stringToFunction(value) as any;
                },
                placeholder: 'return `Action for ${item.name}`'
            });
            createTestButton(setting.controlEl, ta, false, this.modal, () => editor.getValue());
        }
    }

    private buildActionInputs(container: HTMLElement): void {
       container.innerHTML = '';
       buildActionInputs(
            this,
            container,
            this.buttonConfig,
            (newConfig) => {
                this.buttonConfig = { ...this.buttonConfig, ...(newConfig as any) };
            },
            this.detectedFields,
            this.dataSource,
            this.contentEl.querySelector('.button-text-section') as HTMLElement,
            (editor) => { this.customActionField = editor; }
        );
   }

    private handleTextTypeChange(type: 'text' | 'property' | 'dynamic'): void {
        switch (type) {
            case 'text':
                this.buttonConfig.text = 'New Button';
                break;
            case 'property':
                this.buttonConfig.text = `property:${this.detectedFields[0] || ''}`;
                break;
            case 'dynamic':
                this.buttonConfig.text = () => '';
                break;
        }
        const container = this.contentEl.querySelector('.text-value-container') as HTMLElement;
        this.buildTextInputs(container);
    }


    private handleSubmit(): void {
        const actionType = (this.contentEl.querySelector('.action-container .setting-item:first-child select') as HTMLSelectElement)?.value;
        if (actionType === 'js') {
            const jsCode = this.customActionField.getValue();
            if (!jsCode || jsCode.trim() === '') {
                new Notice('Custom JavaScript for action cannot be empty.');
                return;
            }
            const actionFunction = stringToFunction(jsCode);
            if (!actionFunction) {
                new Notice('Invalid JavaScript code.');
                return;
            }
            this.buttonConfig.action = actionFunction as any;
        }

        if (this.getTextType() === 'dynamic') {
            const jsCode = this.customTextField.getValue();
            if (!jsCode || jsCode.trim() === '') {
                new Notice('Custom JavaScript for text cannot be empty.');
                return;
            }
        } else if (!this.buttonConfig.text && !this.buttonConfig.checkboxMode) {
            new Notice('Button text cannot be empty.');
            return;
        }

        if (this.dataSource === 'notes' && !this.buttonConfig.action) {
            // No default action
        }

        if (typeof this.buttonConfig.action === 'string' && this.buttonConfig.action.trim() === '') {
            new Notice('Action cannot be empty.');
            return;
        }
        
        this.onSubmit(this.buttonConfig as ButtonConfig);
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}