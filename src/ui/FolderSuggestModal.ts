import { App, FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
    private onSelect: (path: string) => void;

    constructor(app: App, onSelect: (path: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.setPlaceholder("Select a folder...");
    }

    getItems(): TFolder[] {
        return this.app.vault.getAllFolders();
    }

    getItemText(item: TFolder): string {
        return item.path;
    }

    onChooseItem(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item.path);
    }
}