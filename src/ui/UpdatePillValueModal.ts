import { App, Modal, Setting, DropdownComponent, TextComponent } from 'obsidian';

interface FieldConfig {
    name: string;
    type: "Input" | "Select" | "Multi" | "Cycle" | "Boolean" | "Number" | "File" | "MultiFile" | "Media" | "MultiMedia" | "Date" | "Lookup" | "Formula" | "Canvas" | "CanvasGroup" | "CanvasGroupLink" | "YAML" | "JSON" | "Object" | "ObjectList";
    options?: Record<string, string>;
    [key: string]: any;
}

export class UpdatePillValueModal extends Modal {
    private field: FieldConfig;
    private onSubmit: (value: string) => void;

    constructor(app: App, field: FieldConfig, onSubmit: (value: string) => void) {
        super(app);
        this.field = field;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(`Set value for "${this.field.name}"`);

        let newValue = '';

        const setting = new Setting(contentEl).setName('New value');

        if ((this.field.type === 'Select' || this.field.type === 'Cycle') && this.field.options) {
            setting.addDropdown((dropdown: DropdownComponent) => {
                dropdown.addOption('', '-- Select a value --');
                if (this.field.options) {
                    if (this.field.options.sourceType === 'ValuesList' && this.field.options.valuesList) {
                        for (const [key, value] of Object.entries(this.field.options.valuesList)) {
                             dropdown.addOption(value, value);
                        }
                    } else if (this.field.options) {
                        for (const [key, value] of Object.entries(this.field.options)) {
                            if(typeof value === 'string') {
                                dropdown.addOption(value, value);
                            }
                        }
                    }
                }
                dropdown.onChange(value => {
                    newValue = value;
                });
            });
        } else {
            setting.addText((text: TextComponent) => {
                text.setPlaceholder('Enter new value...');
                text.onChange((value: string) => {
                    newValue = value;
                });
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleSubmit(newValue);
                    }
                });
            });
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Update')
                .setCta()
                .onClick(() => this.handleSubmit(newValue)));
    }

    private handleSubmit(value: string): void {
        if (value) {
            this.onSubmit(value);
            this.close();
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}