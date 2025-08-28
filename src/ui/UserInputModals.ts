import { App, Modal, Setting, ButtonComponent, TextComponent } from 'obsidian';

export class ConfirmModal extends Modal {
    private onConfirm: () => void;
    private onCancel: () => void;

    constructor(app: App, private header: string, private text: string = "") {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('datablock-confirm-modal');
        contentEl.addClass('datablock-edit');

        this.titleEl.setText(this.header);
        contentEl.createEl("p", { text: this.text });

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

        new ButtonComponent(buttonContainer)
            .setButtonText("Yes")
            .setCta()
            .onClick(() => {
                this.onConfirm();
                this.close();
            });

        new ButtonComponent(buttonContainer)
            .setButtonText("No")
            .onClick(() => {
                this.onCancel();
                this.close();
            });
    }

    public static show(app: App, header: string, text?: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmModal(app, header, text);
            modal.onConfirm = () => resolve(true);
            modal.onCancel = () => resolve(false);
            modal.open();
        });
    }
}

export class InputPromptModal extends Modal {
    private onSubmit: (value: string | null) => void;
    private textComponent: TextComponent;
    private value: string;

    constructor(app: App, private header: string, private placeholder: string = "", private initialValue: string = "") {
        super(app);
        this.value = this.initialValue;
    }

    onOpen() {
        const { contentEl } = this;
        this.titleEl.setText(this.header);
        contentEl.addClass('datablock-input-prompt');
        contentEl.addClass('datablock-edit');

        new Setting(contentEl)
            .addText((text: TextComponent) => {
                this.textComponent = text;
                text
                    .setPlaceholder(this.placeholder)
                    .setValue(this.initialValue)
                    .onChange((value) => {
                        this.value = value;
                    });
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSave();
                    }
                });
            });

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        new ButtonComponent(buttonContainer)
            .setButtonText("Save")
            .setCta()
            .onClick(() => this.handleSave());
        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => this.handleCancel());
    }

    private handleSave() {
        this.onSubmit(this.value);
        this.close();
    }
    
    private handleCancel() {
        this.onSubmit(null);
        this.close();
    }

    public static show(app: App, header: string, placeholder?: string, value?: string): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new InputPromptModal(app, header, placeholder, value);
            modal.onSubmit = (result) => resolve(result);
            modal.open();
        });
    }
}