import { App, FuzzySuggestModal } from 'obsidian';

interface DataSourceOption {
    id: 'folder' | 'custom';
    name: string;
}

const DATA_SOURCE_OPTIONS: DataSourceOption[] = [
    { id: 'folder', name: 'Folder' },
    { id: 'custom', name: 'Custom JavaScript' },
];

export class DataSourceSuggestModal extends FuzzySuggestModal<DataSourceOption> {
    private onSelect: (id: 'folder' | 'custom') => void;

    constructor(app: App, onSelect: (id: 'folder' | 'custom') => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder("Select a data source...");
    }

    getItems(): DataSourceOption[] {
        return DATA_SOURCE_OPTIONS;
    }

    getItemText(item: DataSourceOption): string {
        return item.name;
    }

    onChooseItem(item: DataSourceOption, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item.id);
    }
}