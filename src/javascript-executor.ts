import { App } from 'obsidian';
import { DatablockApi } from './api';
import { corsBypassingFetch } from './utils/cors-fetch';

export class JavaScriptExecutor {
    constructor(public app: App, private api: DatablockApi) {}

    public moment = (window as any).moment;

    async executeFunction(
        func: Function,
        item: any,
        allItems: any[] = [],
        event?: Event,
        isMenuAction: boolean = false
    ): Promise<any> {
        const originalFetch = window.fetch;
        (window as any).fetch = corsBypassingFetch;
        const settings = (this.app as any).plugins.plugins.datablock.settings;

        try {
            let result = await func(item, allItems, this.api, this.app, this.moment, event);
            if (result === undefined || result === null) {
                if (settings.showUndefinedPills) {
                    return 'undefined';
                }
                return null;
            }
            return result;
        } catch (error) {
            // Gracefully handle common typos of 'undefined'
            if (error instanceof ReferenceError && (error.message.includes('undifined') || error.message.includes('undefiend'))) {
                 if (settings.showUndefinedPills) {
                    return 'undefined';
                }
                return null;
            }

            console.error('DataBlock JS execution error:', error);
            if (settings.showUndefinedPills) {
                return 'undefined';
            }
            return null;
        } finally {
            window.fetch = originalFetch;
        }
    }
}