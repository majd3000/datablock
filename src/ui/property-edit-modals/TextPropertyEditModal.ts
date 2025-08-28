import { TextComponent, Setting, Notice } from 'obsidian';
import { App, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export class TextPropertyEditModal extends BasePropertyEditModal {
    private textComponent: TextComponent;
    private value: string = '';

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
        this.value = this.currentValue?.toString() || '';
        super.onOpen();
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        
        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Edit the text value for ${this.currentValue || 'none'}`)
            .addText((text: TextComponent) => {
                this.textComponent = text;
                text
                    .setPlaceholder('Enter text value...')
                    .setValue(this.value)
                    .onChange((value: string) => {
                        this.value = value;
                    });
                
                // Handle Enter key
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSave();
                    }
                });
            });
    }

    protected handleSave() {
        if (this.validate()) {
            this.onSubmit({ 
                success: true, 
                value: this.value.trim() 
            });
            this.close();
        }
    }

    protected validate(): boolean {
        if (!this.value.trim()) {
            new Notice('Text value cannot be empty');
            this.textComponent.inputEl.focus();
            return false;
        }
        return true;
    }
}