import { TextAreaComponent, Setting } from 'obsidian';
import { App, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';

export class LongTextPropertyEditModal extends BasePropertyEditModal {
    private textAreaComponent: TextAreaComponent;
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
        // Resize modal for long text
        this.modalEl.addClass('modal-large');
    }

    protected createContent() {
        const content = this.contentEl.createDiv('modal-content');
        const counterEl = createDiv({ cls: 'character-counter' });

        new Setting(content)
            .setName(this.propertyName)
            .setDesc(`Edit the long text value for ${this.currentValue || 'none'}`)
            .addTextArea((textArea: TextAreaComponent) => {
                this.textAreaComponent = textArea;
                textArea
                    .setPlaceholder('Enter long text value...')
                    .setValue(this.value)
                    .onChange((value: string) => {
                        this.value = value;
                        counterEl.setText(`${value.length} characters`);
                    });
                
                // Configure textarea
                textArea.inputEl.rows = 8;
                textArea.inputEl.style.resize = 'vertical';
                textArea.inputEl.style.minHeight = '120px';
                
                // Handle Ctrl+Enter for save
                textArea.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        this.handleSave();
                    }
                });
            });

        // Add character counter and set initial value
        content.appendChild(counterEl);
        counterEl.setText(`${this.value.length} characters`);
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
        return true; // Long text can be empty
    }
}