import { App, ButtonComponent, Notice, Setting, TextComponent, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export class DatePropertyEditModal extends BasePropertyEditModal {
    private textComponent: TextComponent;
    private value: string = '';
    private includeTime: boolean = false;

    constructor(
        app: App,
        propertyName: string,
        propertyType: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void,
        includeTime: boolean = false
    ) {
        super(app, propertyName, propertyType, currentValue, file, onSubmit);
        this.includeTime = includeTime;
    }

    onOpen() {
        this.value = this.formatDateValue(this.currentValue);
        super.onOpen();
    }

    private formatDateValue(value: any): string {
        if (!value) return '';
        
        try {
            // Handle Luxon DateTime objects from Dataview
            if (value.isLuxonDateTime) {
                value = value.toJSDate();
            }

            const date = new Date(value);
            if (isNaN(date.getTime())) return '';
            
            if (this.includeTime) {
                return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
            } else {
                return date.toISOString().slice(0, 10); // YYYY-MM-DD
            }
        } catch {
            return '';
        }
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        
        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Edit the date value for ${this.currentValue || 'none'}`)
            .addText((text: TextComponent) => {
                this.textComponent = text;
                text
                    .setValue(this.value)
                    .onChange((value: string) => {
                        this.value = value;
                    });
                
                // Configure input type
                text.inputEl.type = this.includeTime ? 'datetime-local' : 'date';
                
                // Handle Enter key
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleSave();
                    }
                });
            });

        // Add quick date buttons
        const quickDates = content.createDiv('quick-dates');
        
        new ButtonComponent(quickDates)
            .setButtonText('Today')
            .onClick(() => {
                const today = new Date();
                this.value = this.formatDateValue(today);
                this.textComponent.setValue(this.value);
            });

        new ButtonComponent(quickDates)
            .setButtonText('Clear')
            .onClick(() => {
                this.value = '';
                this.textComponent.setValue('');
            });
    }

    protected handleSave() {
        if (this.validate()) {
            const dateValue = this.value
                ? this.includeTime
                    ? new Date(this.value).toISOString()
                    : this.value
                : null;

            this.onSubmit({
                success: true,
                value: dateValue
            });
            this.close();
        }
    }

    protected validate(): boolean {
        if (this.value && isNaN(new Date(this.value).getTime())) {
            new Notice('Please enter a valid date');
            this.textComponent.inputEl.focus();
            return false;
        }
        return true;
    }
}