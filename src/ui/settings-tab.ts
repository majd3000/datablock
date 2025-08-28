import { App, PluginSettingTab, Setting } from 'obsidian';
import { IDataBlockPlugin } from 'src/plugin-interface';
import { DataBlockConfig } from 'src/types';
import { DataBlockConfigModal } from './DataBlockConfigModal';
import * as yaml from 'js-yaml';

export class DataBlockSettingTab extends PluginSettingTab {
    plugin: IDataBlockPlugin;

    constructor(app: App, plugin: IDataBlockPlugin) {
        super(app, plugin as any);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Change Default Configuration')
            .setDesc('Set the default configuration for datablocks.')
            .addButton(button => button
                .setButtonText("Configure")
                .onClick(() => {
                    new DataBlockConfigModal(
                        this.app,
                        this.plugin.settings.defaultDataBlockConfig as Partial<DataBlockConfig>,
                        (config) => {
                            this.plugin.settings.defaultDataBlockConfig = yaml.load(config) as any;
                            this.plugin.saveSettings();
                        },
                        this.plugin.jsExecutor,
                        true
                    ).open();
                }));

        new Setting(containerEl)
            .setName('Apply defaults for missing keys')
            .setDesc('When enabled, the default configuration will be applied to any datablock missing a corresponding key in its YAML.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.applyDefaults)
                .onChange(async (value) => {
                    this.plugin.settings.applyDefaults = value;
                    await this.plugin.saveSettings();
                }));
        
        containerEl.createEl('h2', { text: 'DataBlock Settings' });


        new Setting(containerEl)
            .setName('Show undefined pills')
            .setDesc('If enabled, pills with undefined or null values will be displayed with "Undefined" text.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showUndefinedPills)
                .onChange(async (value) => {
                    this.plugin.settings.showUndefinedPills = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Show edit button on code blocks')
            .setDesc('Display a pen icon to edit the datablock directly from the code block.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showEditButtonOnCodeblock)
                .onChange(async (value) => {
                    this.plugin.settings.showEditButtonOnCodeblock = value;
                    await this.plugin.saveSettings();
                }));
        
    }
}