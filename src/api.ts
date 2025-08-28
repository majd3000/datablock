import { App, MarkdownPostProcessorContext } from 'obsidian';
import { ConfirmModal, InputPromptModal } from './ui/UserInputModals';
import DataBlockPlugin from './main';

export class DatablockApi {
    constructor(private app: App, private plugin: DataBlockPlugin) {}

    public async confirmPrompt(header: string, text?: string): Promise<boolean> {
        return ConfirmModal.show(this.app, header, text);
    }

    public async inputPrompt(header: string, placeholder?: string, value?: string): Promise<string | null> {
        return InputPromptModal.show(this.app, header, placeholder, value);
    }

    public renderDataBlock(el: HTMLElement, sourcePath: string) {
        const codeBlocks = el.querySelectorAll('pre > code.language-datablock');
        codeBlocks.forEach((codeBlock) => {
            const source = codeBlock.textContent;
            const pre = codeBlock.parentElement;
            if (source) {
                this.plugin.processDataBlock(source, pre as HTMLElement, { sourcePath } as MarkdownPostProcessorContext);
            }
        });
    }
}