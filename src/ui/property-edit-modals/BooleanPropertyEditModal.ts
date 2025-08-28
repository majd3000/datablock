import { App, Setting, TFile, ToggleComponent } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export class BooleanPropertyEditModal extends BasePropertyEditModal {
    private value: boolean | null = null;
    private toggleComponent: ToggleComponent;

    constructor(
        app: App,
        propertyName: string,
        propertyType: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void
    ) {
        super(app, propertyName, propertyType, currentValue, file, onSubmit);
    }

    onOpen() {
        this.value = this.parseBoolean(this.currentValue);
        super.onOpen();
    }

    private parseBoolean(value: any): boolean | null {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') {
                return true;
            }
            if (value.toLowerCase() === 'false') {
                return false;
            }
        }
        return null;
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        
        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Set the boolean value for ${this.propertyName}`)
            .addToggle((toggle: ToggleComponent) => {
                this.toggleComponent = toggle;
                toggle
                    .setValue(this.value === true)
                    .onChange((value: boolean) => {
                        this.value = value;
                    });
            });

    }

    protected handleSave() {
        this.onSubmit({ 
            success: true, 
            value: this.value 
        });
        this.close();
    }

    protected validate(): boolean {
        return true; // Boolean values are always valid
    }
}