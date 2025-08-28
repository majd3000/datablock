import { App, FuzzySuggestModal, TFile } from 'obsidian';
import { PropertyEditResult } from './BasePropertyEditModal';

interface SelectOption {
    value: string;
    label: string;
}

export class SelectPropertySuggestModal extends FuzzySuggestModal<SelectOption> {
    constructor(
        app: App,
        private propertyName: string,
        private currentValue: any,
        private file: TFile,
        private onSubmit: (result: PropertyEditResult) => void,
        private options: string[]
    ) {
        super(app);
        this.setPlaceholder(`Select a value for ${this.propertyName}...`);
    }

    getItems(): SelectOption[] {
        return this.options.map(opt => ({ value: opt, label: opt }));
    }

    getItemText(item: SelectOption): string {
        return item.label;
    }

    onChooseItem(item: SelectOption, evt: MouseEvent | KeyboardEvent): void {
        this.onSubmit({
            success: true,
            value: item.value
        });
    }
}