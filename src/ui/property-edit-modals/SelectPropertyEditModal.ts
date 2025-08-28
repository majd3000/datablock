import { App, DropdownComponent, Notice, Setting, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export interface SelectOption {
    value: string;
    label: string;
}

export class SelectPropertyEditModal extends BasePropertyEditModal {
    private dropdownComponent: DropdownComponent;
    private value: string = '';
    private options: SelectOption[] = [];

    constructor(
        app: App,
        propertyName: string,
        propertyType: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void,
        options: string[]
    ) {
        super(app, propertyName, propertyType, currentValue, file, onSubmit);
        this.options = options.map(opt => ({ value: opt, label: opt }));
    }

    onOpen() {
        this.value = this.currentValue || '';
        super.onOpen();
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        
        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Select a value for ${this.currentValue || 'none'}`)
            .addDropdown((dropdown: DropdownComponent) => {
                this.dropdownComponent = dropdown;
                
                // Add empty option
                dropdown.addOption('', 'Choose an option...');

                // If the current value is not in the options, add it
                if (this.currentValue && !this.options.some(opt => opt.value === this.currentValue)) {
                    this.options.unshift({ value: this.currentValue, label: this.currentValue });
                }
                
                // Add provided options
                this.options.forEach(option => {
                    dropdown.addOption(option.value, option.label);
                });
                
                dropdown
                    .setValue(this.value)
                    .onChange((value: string) => {
                        this.value = value;
                    });
            });

    }

    protected handleSave() {
        if (this.validate()) {
            this.onSubmit({ 
                success: true, 
                value: this.value 
            });
            this.close();
        }
    }

    protected validate(): boolean {
        if (!this.value) {
            new Notice('Please select or enter a value');
            this.dropdownComponent.selectEl.focus();
            return false;
        }
        return true;
    }
}