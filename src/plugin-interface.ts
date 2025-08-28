import { DataBlockSettings } from 'src/settings';
import { JavaScriptExecutor } from 'src/javascript-executor';

export interface IDataBlockPlugin {
    settings: DataBlockSettings;
    saveSettings(): Promise<void>;
    jsExecutor: JavaScriptExecutor;
}