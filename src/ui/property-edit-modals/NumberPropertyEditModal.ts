import { App, Notice, Setting, TextComponent, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export class NumberPropertyEditModal extends BasePropertyEditModal {
    private textComponent: TextComponent;
    private value: number | null = null;
    private allowDecimals: boolean = true;
    private min?: number;
    private max?: number;

    constructor(
        app: App,
        propertyName: string,
        propertyType: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void,
        options?: { allowDecimals?: boolean; min?: number; max?: number }
    ) {
        super(app, propertyName, propertyType, currentValue, file, onSubmit);
        this.allowDecimals = options?.allowDecimals ?? true;
        this.min = options?.min;
        this.max = options?.max;
    }

    onOpen() {
        this.value = this.currentValue ?? null;
        super.onOpen();
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        
        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Edit the number value for ${this.currentValue || 'none'}`)
            .addText((text: TextComponent) => {
                this.textComponent = text;
                text
                    .setPlaceholder('Enter number...')
                    .setValue(this.value?.toString() || '')
                    .onChange((value: string) => {
                        this.parseAndSetValue(value);
                    });
                
                // Configure input for numbers
                text.inputEl.type = 'number';
                if (this.min !== undefined) text.inputEl.min = this.min.toString();
                if (this.max !== undefined) text.inputEl.max = this.max.toString();
                if (!this.allowDecimals) text.inputEl.step = '1';
                
                // Handle Enter key
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleSave();
                    }
                });
            });

        // Add range info if min/max specified
        if (this.min !== undefined || this.max !== undefined) {
            const rangeInfo = content.createDiv('range-info');
            let rangeText = 'Valid range: ';
            if (this.min !== undefined && this.max !== undefined) {
                rangeText += `${this.min} to ${this.max}`;
            } else if (this.min !== undefined) {
                rangeText += `minimum ${this.min}`;
            } else {
                rangeText += `maximum ${this.max}`;
            }
            rangeInfo.setText(rangeText);
        }
    }

    private parseAndSetValue(value: string) {
        if (value.trim() === '') {
            this.value = null;
            return;
        }
        
        const parsed = this.allowDecimals ? parseFloat(value) : parseInt(value, 10);
        this.value = isNaN(parsed) ? null : parsed;
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
        if (this.value === null) {
            new Notice('Please enter a valid number');
            this.textComponent.inputEl.focus();
            return false;
        }
        
        if (this.min !== undefined && this.value < this.min) {
            new Notice(`Value must be at least ${this.min}`);
            this.textComponent.inputEl.focus();
            return false;
        }
        
        if (this.max !== undefined && this.value > this.max) {
            new Notice(`Value must be at most ${this.max}`);
            this.textComponent.inputEl.focus();
            return false;
        }
        
        return true;
    }
}