import {
    Modal,
    App,
    ButtonComponent,
    TFile
} from 'obsidian';

export interface PropertyEditResult {
    success: boolean;
    value: any;
    cancelled?: boolean;
}

export abstract class BasePropertyEditModal extends Modal {
    protected propertyName: string;
    protected propertyType: string;
    protected currentValue: any;
    protected file: TFile;
    protected onSubmit: (result: PropertyEditResult) => void;
    contentEl: HTMLElement;

    constructor(
        app: App,
        propertyName: string,
        propertyType: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void
    ) {
super(app);
        this.propertyName = propertyName;
        this.propertyType = propertyType;
        this.currentValue = currentValue;
        this.file = file;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('property-edit-modal');
        contentEl.addClass('datablock-edit');
        contentEl.addClass(this.propertyType.toLowerCase().replace(' ', '-'));
        
        this.createContent();
        this.createFooter();
        
        // Focus first input element
        setTimeout(() => {
            const firstInput = contentEl.querySelector('input, textarea, select') as HTMLElement;
            firstInput?.focus();
        }, 100);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    protected abstract createContent(): void;

    protected createFooter() {
        const footer = this.contentEl.createDiv('modal-footer');
        
        new ButtonComponent(footer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.onSubmit({ success: false, cancelled: true, value: null });
                this.close();
            });

        new ButtonComponent(footer)
            .setButtonText('Save Changes')
            .setCta()
            .onClick(() => this.handleSave());
    }

    protected abstract handleSave(): void;
    protected abstract validate(): boolean;
}