import { App, Modal, Setting, DropdownComponent, TextComponent, ToggleComponent, TextAreaComponent, TFolder, TFile, Notice, ButtonComponent, setIcon } from 'obsidian';
import { DataBlockConfig, PillConfig, ButtonConfig } from '../types';
import * as yaml from 'js-yaml';
import { functionToString, deepCloneWithFunctions } from '../utils/javascript-helper';
import { fetchDatablockItems } from '../renderer';
import { JavaScriptExecutor } from '../javascript-executor';
import {
    buildConfigButtonManager,
    buildConfigFilterSection,
    buildConfigPillManager,
    buildConfigSortingSettings,
    buildFieldConfiguration,
    buildPerformanceSettings,
    buildStylingSettings,
    buildCustomGroupManager
} from './DataBlockConfigModal.logic';
import { AddPillModal } from './AddPillModal';
import { AddButtonModal } from './AddButtonModal';
import { EditPillModal } from './EditPillModal';
import { EditButtonModal } from './EditButtonModal';
import { FolderSuggestModal } from './NoteSuggestModal';
import { JSTextarea } from './codemirror';

export class DataBlockConfigModal extends Modal {
    public config: Partial<DataBlockConfig>  = {};
    private onSubmit: (config: string) => void;
    public detectedFields: string[] = [];
    private initialConfig: Partial<DataBlockConfig>;
    private previewContainer: HTMLElement | null = null;
    private notesCount: number = 0;
    private currentStep: number = 1;
    private totalSteps: number = 4;
    public currentDataSource: 'notes' | 'custom';
    private isEditing: boolean;
    public jsExecutor: JavaScriptExecutor;

    constructor(
        app: App,
        config: Partial<DataBlockConfig>,
        onSubmit: (config: string) => void,
        jsExecutor: JavaScriptExecutor,
        public isDefaultConfig: boolean = false,
        isEditing: boolean = false
    ) {
        super(app);
        this.initialConfig = config;
        this.onSubmit = onSubmit;
        this.isEditing = isEditing;
        this.jsExecutor = jsExecutor;
    }

    async onOpen(isReset = false): Promise<void> {
        if (!isReset) {
            this.config = deepCloneWithFunctions(this.initialConfig);
        }

        this.config.view = this.config.view ?? 'list';
        this.currentDataSource = this.config.data ? 'custom' : 'notes';
        this.config.folder = this.config.folder ?? '';
        if (this.currentDataSource === 'custom' && !this.config.data) {
            this.config.data = `const data = [
 {"name": "Task 1", "status": "To Do"},
 {"name": "Task 2", "status": "To Do"},
 {"name": "Task 3", "status": "In Progress"}
];
return data;`;
        }
        if (typeof this.config.title === 'string') {
            this.config.title = { text: this.config.title };
        } else if (this.config.title === undefined) {
            this.config.title = { text: 'item.name' };
        }

        if (this.currentDataSource === 'notes' && !this.isEditing && !(this.config.title as any).action) {
            (this.config.title as any).action = 'item.path';
        }
        this.config.description = this.config.description ?? undefined;
        this.config.pagination = this.config.pagination ?? false;
        this.config.limit = this.config.limit ?? 12;
        this.config.newTab = this.config.newTab ?? false;
        this.config.columns = this.config.columns ?? 3;
        this.config.maxItems = this.config.maxItems ?? 1000;
        this.config.customGroups = this.config.customGroups ?? { property: 'status', groups: ['To Do', 'In Progress', 'Done'] };
        this.config.inlineButtons = this.config.inlineButtons ?? false;

        if (!this.config.filters) {
            this.config.filters = [];
        }
        
        this.contentEl.empty();
        this.titleEl.setText(this.isDefaultConfig ? 'Change Default Configuration' : (this.isEditing ? 'Update Datablock' : 'Create New Datablock'));
        this.contentEl.addClass('datablock-config-modal');
        
        await this.updateDetectedFields();

        this.buildConfigUI();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private buildConfigUI(): void {
        const { contentEl } = this;
        const tabsContainer = contentEl.createDiv({ cls: 'datablock-tabs-container' });
        this.buildTabNavigation(tabsContainer);
        const contentContainer = contentEl.createDiv({ cls: 'datablock-content-container' });
        this.buildTabContent(contentContainer);
        this.buildPreviewPanel(contentEl);
        this.buildFooter(contentEl);
    }

    private buildTabNavigation(container: HTMLElement): void {
        const tabNav = container.createDiv({ cls: 'datablock-tab-nav' });
        const tabs = [
            { id: 'source', label: 'Data Source', icon: 'folder-open' },
            { id: 'display', label: 'Display', icon: 'layout-template' },
            { id: 'filters', label: 'Filters & Sort', icon: 'filter' },
            { id: 'advanced', label: 'More Settings', icon: 'settings' },
            { id: 'donate', label: 'Support Us', icon: 'heart' }
        ];
        const mainTabsContainer = tabNav.createDiv({ cls: 'datablock-main-tabs' });
        tabs.forEach((tab, index) => {
            const parent = tab.id === 'donate' ? tabNav : mainTabsContainer;
            const tabClasses = ['datablock-tab'];
            if (index === 0) tabClasses.push('active');
            if (tab.id === 'donate') tabClasses.push('datablock-tab-donate');
            const tabEl = parent.createDiv({ cls: tabClasses.join(' '), attr: { 'data-tab': tab.id } });
            const iconEl = tabEl.createSpan({ cls: 'datablock-tab-icon' });
            setIcon(iconEl, tab.icon);
            if (tab.id !== 'donate') {
                tabEl.createSpan({ cls: 'datablock-tab-label', text: tab.label });
            }
            tabEl.addEventListener('click', () => { this.switchTab(tab.id); });
        });
    }

    public async getFreshData(): Promise<any[]> {
        // This function will be smarter in the future, for now, it's a simple fetch
         const jsExecutor = new JavaScriptExecutor(this.app, (this.app as any).datablock.api);
        return fetchDatablockItems(this.app, jsExecutor, this.config as DataBlockConfig);
    }

    private buildTabContent(container: HTMLElement): void {
        const tabConfigs = [
            { id: 'source', builder: this.buildSourceTab },
            { id: 'display', builder: this.buildDisplayTab },
            { id: 'filters', builder: this.buildFiltersTab },
            { id: 'advanced', builder: this.buildAdvancedTab },
            { id: 'donate', builder: this.buildDonateTab }
        ];

        tabConfigs.forEach((tabConfig, index) => {
            const tabContent = container.createDiv({
                cls: `datablock-tab-content${index === 0 ? ' active' : ''}`,
                attr: { 'data-tab-content': tabConfig.id }
            });
            tabConfig.builder.call(this, tabContent);
        });
    }

    private buildSourceTab(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'datablock-section' });
        const header = section.createDiv({ cls: 'datablock-section-header' });
        header.createEl('h3', { text: 'Data Source Configuration' });
        header.createEl('p', { text: 'Configure where your data comes from and basic display settings.', cls: 'datablock-section-description' });

        const sourceCard = section.createDiv({ cls: 'datablock-card' });
        sourceCard.createEl('h4', { text: 'Data Source' });

        this.buildDataSourceSelector(sourceCard);

        const viewCard = section.createDiv({ cls: 'datablock-card' });
        viewCard.createEl('h4', { text: 'View Type' });
        this.buildViewTypeSelector(viewCard);
        viewCard.createDiv({ cls: 'view-specific-settings-container' });
        this.updateViewOptions();
    }

    private buildDisplayTab(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'datablock-section' });
        const header = section.createDiv({ cls: 'datablock-section-header' });
        header.createEl('h3', { text: 'Display Configuration' });
        header.createEl('p', { text: 'Configure how your data is displayed and what information to show.', cls: 'datablock-section-description' });

        const fieldsCard = section.createDiv({ cls: 'datablock-card' });
        fieldsCard.createEl('h4', { text: 'Content Fields' });
        buildFieldConfiguration(this, fieldsCard);

        const pillsCard = section.createDiv({ cls: 'datablock-card' });
        pillsCard.createEl('h4', { text: 'Pills & Metadata' });
        buildConfigPillManager(this, pillsCard);

        const buttonsCard = section.createDiv({ cls: 'datablock-card' });
        buttonsCard.createEl('h4', { text: 'Action Buttons' });
        buildConfigButtonManager(this, buttonsCard);
    }

    private buildFiltersTab(container: HTMLElement): void {
        if (!container) return;
        const section = container.createDiv({ cls: 'datablock-section' });
        const header = section.createDiv({ cls: 'datablock-section-header' });
        header.createEl('h3', { text: 'Filtering & Sorting' });
        header.createEl('p', { text: 'Control which items are shown and how they are ordered.', cls: 'datablock-section-description' });

        const filtersCard = section.createDiv({ cls: 'datablock-card' });
        filtersCard.createEl('h4', { text: 'Filters' });
        buildConfigFilterSection(this, filtersCard);
        buildConfigSortingSettings(this, section);
    }

    private buildAdvancedTab(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'datablock-section' });
        const header = section.createDiv({ cls: 'datablock-section-header' });
        header.createEl('h3', { text: 'More Settings' });
        header.createEl('p', { text: 'Fine-tune performance, pagination, and styling options.', cls: 'datablock-section-description' });
        buildPerformanceSettings(this, section);
        const styleCard = section.createDiv({ cls: 'datablock-card' });
        styleCard.createEl('h4', { text: 'Display & Behavior' });
        buildStylingSettings(this, styleCard);
    }

    private buildDonateTab(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'datablock-section' });
        const header = section.createDiv({ cls: 'datablock-section-header' });
        header.createEl('h3', { text: 'Support the Plugin' });
        header.createEl('p', { text: 'If you find this helpful, your support helps me keep adding features and fixing bugs.', cls: 'datablock-section-description' });

        const supportCard = section.createDiv({ cls: 'datablock-card' });
        supportCard.createEl('h4', { text: 'Donation Options' });

        this.createClickableSetting(supportCard, {
            name: 'Ko-fi',
            url: 'https://ko-fi.com/majd3000',
            buttonText: 'Buy me a coffee',
            icon: 'coffee',
            isCta: true
        });

        this.createClickableSetting(supportCard, {
            name: 'PayPal',
            url: 'https://paypal.me/majdjobah',
            buttonText: 'Donate with PayPal',
            icon: 'credit-card'
        });

        
        const sourceCodeCard = section.createDiv({ cls: 'datablock-card datablock-source-code-card' });
        sourceCodeCard.createEl('h4', { text: 'Contribute & Collaborate' });
        
        const repoUrl = 'https://github.com/majd3000/datablock';
        const sourceCodeSetting = new Setting(sourceCodeCard)
            .setName('GitHub Repository')
            .setDesc(`Report issues, suggest features, or contribute to the project.`);
        
        const linkEl = sourceCodeSetting.descEl.createEl('a', {
            text: repoUrl,
            href: repoUrl
        });
        linkEl.setAttr('target', '_blank');
        linkEl.addClass('no-decoration', 'text-muted');

        sourceCodeSetting.descEl.empty();
        sourceCodeSetting.descEl.appendChild(linkEl);

        sourceCodeSetting.addButton(button => button
            .setButtonText('Visit GitHub')
            .setIcon('github')
            .onClick(() => window.open(repoUrl, '_blank')));
    }

    private createClickableSetting(container: HTMLElement, options: { name: string, url: string, buttonText: string, icon: string, isCta?: boolean }): void {
        const setting = new Setting(container);
        setting.infoEl.createEl('div', { text: options.name, cls: 'setting-item-name' });
        
        const descEl = setting.infoEl.createEl('div', { cls: 'setting-item-description' });
        const linkEl = descEl.createEl('a', { text: options.url, href: options.url });
        linkEl.setAttr('target', '_blank');
        linkEl.addClass('no-decoration', 'text-muted');

        setting.addButton(button => {
            button
                .setButtonText(options.buttonText)
                .setIcon(options.icon)
                .onClick(() => window.open(options.url, '_blank'));
            
            if (options.isCta) {
                button.setCta();
            }
        });
    }
    
    private buildViewTypeSelector(container: HTMLElement): void {
        const viewOptions = container.createDiv({ cls: 'datablock-view-options' });
        const views = [
            { value: 'list', label: 'List View', icon: 'list', description: 'Row-structured list layout' },
            { value: 'gallery', label: 'Gallery View', icon: 'gallery-horizontal', description: 'Image-focused gallery layout' },
            { value: 'board', label: 'Board View', icon: 'trello', description: 'Kanban-style column layout' }
        ];
        views.forEach(view => {
            const option = viewOptions.createDiv({ cls: `datablock-view-option ${this.config.view === view.value ? 'selected' : ''}`, attr: { 'data-view': view.value } });
            const iconEl = option.createSpan({ cls: 'datablock-view-icon' });
            setIcon(iconEl, view.icon);
            const content = option.createDiv({ cls: 'datablock-view-content' });
            content.createEl('strong', { text: view.label });
            content.createEl('p', { text: view.description });
            option.addEventListener('click', () => {
                this.config.view = view.value as 'list' | 'gallery' | 'board';
                this.updateViewOptions();
                this.updatePreview();
                this.rerenderAllTabs();
            });
        });
    }

    public buildViewSpecificSettings(container: HTMLElement): void {
        container.empty();
        if (this.config.view === 'gallery' || this.config.view === 'board') {
            container.createEl('hr');
        }
        if (this.config.view === 'gallery') {
            new Setting(container).setName('Cover Image Property').setDesc('Property to use for cover images')
                .addDropdown(dd => {
                    this.populateDropdown(dd, this.detectedFields, typeof this.config.coverProperty === 'string' ? this.config.coverProperty : undefined, undefined, '--- No Cover ---');
                    dd.onChange(value => {
                        this.config.coverProperty = value ? value : undefined;
                        this.updatePreview();
                    });
                });
        }
        if (this.config.view === 'board') {
            new Setting(container).setName('Group By').setDesc('Choose how to group your board columns.')
                .addDropdown(dd => {
                    dd.addOption('property', 'Property').addOption('custom', 'Custom Groups')
                      .setValue(this.config.customGroups ? 'custom' : 'property')
                      .onChange(value => {
                          if (value === 'custom') {
                              this.config.customGroups = { property: 'status', groups: ['To Do', 'In Progress', 'Done'] };
                              delete this.config.groupByProperty;
                          } else {
                              delete this.config.customGroups;
                              if (this.detectedFields.length > 0) {
                                this.config.groupByProperty = this.detectedFields[0];
                              } else {
                                delete this.config.groupByProperty;
                              }
                          }
                          this.buildViewSpecificSettings(container);
                          this.updatePreview();
                      });
                });
     const settingItem = container.createDiv({ cls: "setting-item" });
      const groupingControlsContainer = settingItem.createDiv({ cls: 'grouping-controls' });
      this.buildGroupingControls(groupingControlsContainer);
    }
  if (this.config.view === 'gallery') {
            new Setting(container).setName('Columns').setDesc('Number of columns to display')
                .addSlider(slider => slider.setLimits(1, 6, 1).setValue(this.config.columns ?? 3).setDynamicTooltip()
                    .onChange(value => { this.config.columns = value; this.updatePreview(); }));
        }
    }


    private buildGroupingControls(container: HTMLElement): void {
        container.empty();
        if (this.config.customGroups) {
            buildCustomGroupManager(this, container);
        } else {
            new Setting(container).setName('Group By Property').setDesc('The frontmatter property to group the board by')
                .addDropdown(dd => {
                    this.populateDropdown(dd, this.detectedFields, this.config.groupByProperty, undefined, '--- Select ---');
                    dd.onChange(value => { this.config.groupByProperty = value; this.updatePreview(); });
                });
        }
    }

    private setDataSource(newSource: 'notes' | 'custom') {
        if (this.currentDataSource === newSource) return;

        this.currentDataSource = newSource;
        
        // Reset sort configuration to a sensible default for the new source type.
        this.config.sort = { by: 'name', order: 'asc' };


        if (newSource === 'custom') {
            delete this.config.folder;
            if (!this.config.data) {
                this.config.data = `const data = [
 {"name": "Task 1", "status": "To Do"},
 {"name": "Task 2", "status": "To Do"},
 {"name": "Task 3", "status": "In Progress"}
];
return data;`;
            }
        } else {
            delete this.config.data;
            this.config.folder = this.config.folder ?? '';
            if (!this.config.title) {
                this.config.title = { text: 'item.name', action: 'item.path' };
            }
        }
        
        this.buildDataSourceInputs(this.contentEl.querySelector('.datablock-card') as HTMLElement);
        this.rerenderAllTabs();
    }

    private buildDataSourceSelector(container: HTMLElement): void {
        new Setting(container)
            .setName('Source Type')
            .setDesc('Select the source of your data')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('notes', 'Notes Folder')
                    .addOption('custom', 'Custom')
                    .setValue(this.currentDataSource)
                    .onChange(value => {
                        this.setDataSource(value as 'notes' | 'custom');
                    });
            });
        
        this.buildDataSourceInputs(container);
    }

    private buildDataSourceInputs(container: HTMLElement): void {
        const existingInputs = container.querySelector('.source-inputs');
        if (existingInputs) existingInputs.remove();

        const inputsContainer = container.createDiv({ cls: 'source-inputs' });

        if (this.currentDataSource === 'notes') {
            const setting = new Setting(inputsContainer)
                .setName('Source Folder')
                .setDesc('Path to the folder containing your notes');
            
            const text = new TextComponent(setting.controlEl)
                .setPlaceholder('e.g., Projects/Active, Daily Notes, etc.')
                .setValue(this.config.folder ?? '');
                
            new FolderSuggestModal(this.app, text.inputEl);
            
            text.onChange(async (value) => {
                this.config.folder = value;
                await this.updateDetectedFields();
                this.rerenderAllTabs();
                this.updatePreview();
                this.showFieldsSummary(container);
            });

            text.inputEl.addEventListener('focus', () => this.showFieldsSummary(container));
            text.inputEl.addEventListener('blur', () => this.showFieldsSummary(container, true));

            this.showFieldsSummary(container, true);

        } else if (this.currentDataSource === 'custom') {
            const setting = new Setting(inputsContainer)
                .setName('Custom Data Script')
                .setDesc('Write JavaScript that returns an array of objects. Each object must have at least a "name" property for display purposes.');

            const taContainer = setting.controlEl.createDiv({ cls: 'editor-container' });
            const editor = new JSTextarea(taContainer, {
                initialValue: this.config.data as string || '',
                onChange: (value) => {
                    this.config.data = value;
                },
                placeholder: `const data = [
  {"name": "Task 1", "status": "To Do"},
  {"name": "Task 2", "status": "To Do"},
  {"name": "Task 3", "status": "In Progress"}
];
return data;`
            });

            const button = new ButtonComponent(setting.controlEl)
                .setIcon('save')
                .onClick(async () => {
                    await this.rerenderAllTabs();
                    this.updatePreview();
                })
                .setTooltip('Save Changes');
            button.buttonEl.addClass('datablock-test-button');
            button.buttonEl.createSpan({ text: 'Save Changes' });
             const summary = container.querySelector('.datablock-fields-summary');
             if(summary) summary.remove()
        }
    }


    private rerenderDisplayTab(): void {
        const displayTab = this.contentEl.querySelector('[data-tab-content="display"]');
        if (displayTab) {
            displayTab.empty();
            this.buildDisplayTab(displayTab as HTMLElement);
        }
    }

    private buildPreviewPanel(container: HTMLElement): void {
        const previewSection = container.createDiv({ cls: 'datablock-preview-section' });
        const previewHeader = previewSection.createDiv({ cls: 'datablock-preview-header' });
        previewHeader.createEl('h3', { text: 'Live Preview' });
        new ButtonComponent(previewHeader).setIcon('eye').setTooltip('Toggle preview').onClick(() => this.togglePreview());
        this.previewContainer = previewSection.createDiv({ cls: 'datablock-preview-container collapsed' });
        this.updatePreview();
    }

    private buildFooter(container: HTMLElement): void {
        const existingFooter = container.querySelector('.datablock-footer');
        if (existingFooter) existingFooter.remove();
        const footer = container.createDiv({ cls: 'datablock-footer' });
        const leftActions = footer.createDiv({ cls: 'datablock-footer-left' });
        const rightActions = footer.createDiv({ cls: 'datablock-footer-right' });

        new ButtonComponent(leftActions).setButtonText('Reset').setIcon('rotate-ccw').onClick(() => this.resetConfiguration());

        new ButtonComponent(leftActions)
            .setIcon('copy')
            .setTooltip('Copy YAML to clipboard')
            .onClick(() => {
                const yamlConfig = this.buildConfiguration();
                const finalOutput = `\`\`\`datablock\n${yamlConfig}\n\`\`\``;
                navigator.clipboard.writeText(finalOutput);
                new Notice('DataBlock code copied to clipboard.');
            });

        if (this.isDefaultConfig) {
            new ButtonComponent(rightActions)
                .setButtonText('Save Changes')
                .setCta()
                .onClick(() => this.validateAndSubmit());
        } else {
            new ButtonComponent(leftActions)
                .setTooltip('Insert DataBlock')
                .setIcon('download')
                .onClick(() => this.validateAndSubmit());

            if (this.currentStep > 1) {
                new ButtonComponent(rightActions).setButtonText('Back').onClick(() => { this.currentStep--; this.switchTab(this.getTabIdForStep(this.currentStep)); });
            }
            if (this.currentStep < this.totalSteps) {
                new ButtonComponent(rightActions).setButtonText('Next').setCta().onClick(() => { this.currentStep++; this.switchTab(this.getTabIdForStep(this.currentStep)); });
            }
            if (this.currentStep === this.totalSteps) {
                new ButtonComponent(rightActions).setButtonText('Insert DataBlock').setCta().setIcon('check').onClick(() => this.validateAndSubmit());
            }
        }
    }

    public switchTab(tabId: string): void {
        if (tabId === 'donate') {
            this.contentEl.querySelectorAll('.datablock-tab').forEach(tab => tab.removeClass('active'));
            this.contentEl.querySelector(`[data-tab="donate"]`)?.addClass('active');
            this.contentEl.querySelectorAll('.datablock-tab-content').forEach(content => content.removeClass('active'));
            this.contentEl.querySelector(`[data-tab-content="donate"]`)?.addClass('active');
            this.buildFooter(this.contentEl);
            return;
        }
        this.contentEl.querySelectorAll('.datablock-tab').forEach(tab => { tab.removeClass('active'); });
        this.contentEl.querySelector(`[data-tab="${tabId}"]`)?.addClass('active');
        this.contentEl.querySelectorAll('.datablock-tab-content').forEach(content => { content.removeClass('active'); });
        this.contentEl.querySelector(`[data-tab-content="${tabId}"]`)?.addClass('active');
        this.currentStep = this.getStepForTabId(tabId);
        this.buildFooter(this.contentEl);
        this.updateProgress();
    }

    public updateViewOptions(): void {
        this.contentEl.querySelectorAll('.datablock-view-option').forEach(option => { option.removeClass('selected'); });
        this.contentEl.querySelector(`[data-view="${this.config.view}"]`)?.addClass('selected');
        const sourceTab = this.contentEl.querySelector('[data-tab-content="source"]');
        if (sourceTab) {
            const viewCard = sourceTab.querySelector('.datablock-card:last-child');
            if (viewCard) {
                const settingsContainer = viewCard.querySelector('.view-specific-settings-container');
                if (settingsContainer) {
                    this.buildViewSpecificSettings(settingsContainer as HTMLElement);
                }
            }
        }
    }

    public updatePreview(): void {
        if (!this.previewContainer) return;
        this.previewContainer.empty();
        const previewCode = this.previewContainer.createEl('pre');
        previewCode.createEl('code', { text: this.buildConfiguration() });
    }

    private togglePreview(): void {
        this.previewContainer?.toggleClass('collapsed', !this.previewContainer.hasClass('collapsed'));
    }

    public showFieldsSummary(container: HTMLElement, initiallyHidden: boolean = false): void {
        const existing = container.querySelector('.datablock-fields-summary');
        if (existing) existing.remove();

        if (this.currentDataSource === 'notes' && this.config.folder) {
            const summary = container.createDiv({ cls: 'datablock-fields-summary' });
            if (initiallyHidden) {
                summary.toggleClass('hidden', true);
            }
            const fieldsSummary = this.detectedFields.length > 0 ? `${this.detectedFields.length} properties` : 'No properties detected';
            summary.createEl('small', { text: `${this.notesCount} Pages | ${fieldsSummary}` });

            const inputEl = container.querySelector('.source-inputs input');
            if (inputEl) {
                inputEl.addEventListener('focus', () => {
                    summary.toggleClass('hidden', false);
                });
                inputEl.addEventListener('blur', () => {
                    summary.toggleClass('hidden', true);
                });
            }
        }
    }

    public showAddPillDialog(onUpdate: () => void): void {
        new AddPillModal(this.app, this.detectedFields, this.currentDataSource, (newPill: PillConfig) => {
            if (!this.config.pills) this.config.pills = [];
            this.config.pills.push(newPill);
            onUpdate();
            this.updatePreview();
        }, this).open();
    }

    public showAddButtonDialog(onUpdate: () => void): void {
        new AddButtonModal(this.app, this.currentDataSource, this.detectedFields, (newButton: ButtonConfig) => {
            if (!this.config.buttons) this.config.buttons = [];
            this.config.buttons.push(newButton);
            onUpdate();
            this.updatePreview();
        }, this).open();
    }

    public editPill(index: number, onUpdate: () => void): void {
        const pill = this.config.pills![index];
        new EditPillModal(this.app, pill, this.detectedFields, this.currentDataSource, (updatedPill: PillConfig) => {
            this.config.pills![index] = updatedPill;
            onUpdate();
            this.updatePreview();
        }, this).open();
    }

    public editButton(index: number, onUpdate: () => void): void {
        const button = this.config.buttons![index];
        new EditButtonModal(this.app, button, this.currentDataSource, this.detectedFields, (updatedButton: ButtonConfig) => {
            this.config.buttons![index] = updatedButton;
            onUpdate();
            this.updatePreview();
        }, this).open();
    }

    private resetConfiguration(): void {
        this.currentDataSource = 'notes';
        this.config = {
            view: 'list',
            title: {
                text: 'item.name',
                action: 'item.path'
            }
        };
        this.onOpen(true);
    }

    private importConfiguration(): void { /* ... */ }
    private exportConfiguration(): void { /* ... */ }

    private buildConfiguration(): string {
        const defaults: Partial<DataBlockConfig> = {
            columns: 3,
            search: false,
            pagination: false,
            limit: 12,
            maxItems: 1000,
            inlineButtons: false,
            newTab: false,
        };
        
        const configCopy = deepCloneWithFunctions(this.config);

        function convertFunctionsToStrings(obj: any) {
            if (!obj) return;
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    if (typeof obj[key] === 'function') {
                        obj[key] = functionToString(obj[key]);
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        convertFunctionsToStrings(obj[key]);
                    }
                }
            }
        }
        convertFunctionsToStrings(configCopy);

        const modernConfig: any = { ...configCopy };

        if (modernConfig.pills) {
            modernConfig.pills = modernConfig.pills.map((pill: PillConfig) => pill);
        }

        if (modernConfig.buttons) {
            modernConfig.buttons = modernConfig.buttons.map((button: ButtonConfig) => {
                const { text, action, checkboxMode, menuOptions, ...rest } = button;
                const newButton: any = { text, action, ...rest };

                if (checkboxMode) {
                    delete newButton.text;
                    newButton.checkboxMode = true;
                }

                if (menuOptions) {
                    newButton.menuOptions = menuOptions;
                }

                // Re-order keys for consistent output
                const orderedButton: any = {
                    text: newButton.text,
                    action: newButton.action,
                    menuOptions: newButton.menuOptions,
                    ...rest
                };
                if (newButton.checkboxMode) {
                    orderedButton.checkboxMode = true;
                }
                
                // Final cleanup of undefined keys
                Object.keys(orderedButton).forEach(key => {
                    if (orderedButton[key] === undefined) {
                        delete orderedButton[key];
                    }
                });

                return orderedButton;
            });
        }

        if (Array.isArray(modernConfig.sort) && modernConfig.sort.length === 1) {
            modernConfig.sort = modernConfig.sort[0];
        }
           
        const sanitizedFilters = modernConfig.filters?.map((filter: any) => {
            if (filter.operator === 'is-empty' || filter.operator === 'is-not-empty') {
                const { value, ...rest } = filter;
                return rest;
            }
            return filter;
        });

        if (sanitizedFilters) {
            modernConfig.filters = sanitizedFilters;
        }

        const cleanConfig: Partial<DataBlockConfig> = {};
        for (const key in modernConfig) {
            const configKey = key as keyof DataBlockConfig;
            const value = modernConfig[configKey];
            const defaultValue = defaults[configKey];
 
            if (value !== undefined && value !== null && value !== '') {
                if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
                    (cleanConfig as any)[configKey] = value;
                }
            }
        }

        if (this.currentDataSource === 'custom' && cleanConfig.sort && (cleanConfig.sort as any).by === 'name' && (cleanConfig.sort as any).order === 'asc') {
            delete cleanConfig.sort;
        } else if (this.currentDataSource === 'notes' && cleanConfig.sort && (cleanConfig.sort as any).by === 'name' && (cleanConfig.sort as any).order === 'asc') {
            delete cleanConfig.sort;
        }



        if (cleanConfig.title && Object.keys(cleanConfig.title).length === 0) {
            delete cleanConfig.title;
        }
        
        const configToDump: any = cleanConfig;


        if (!configToDump.pagination) {
            delete configToDump.pagination;
            delete configToDump.limit;
        }

        if (configToDump.filters && configToDump.filters.length === 0) delete configToDump.filters;
        if (configToDump.pills && configToDump.pills.length === 0) delete configToDump.pills;
        if (configToDump.buttons && configToDump.buttons.length === 0) delete configToDump.buttons;
        if (configToDump.description && (!configToDump.description.text || configToDump.description.text.trim() === '')) {
            delete configToDump.description;
        }
        if (configToDump.description === undefined) {
            delete configToDump.descriptionAction;
        }
        
        if (configToDump.view === 'gallery') {
            delete configToDump.groupByProperty;
            delete configToDump.customGroups;
        } else if (configToDump.view === 'board') {
            delete configToDump.columns;
            delete configToDump.coverProperty;
            if (configToDump.groupByProperty) {
                delete configToDump.customGroups;
            } else if (configToDump.customGroups) {
                delete configToDump.groupByProperty;
            }
        } else if (configToDump.view === 'list') {
            delete configToDump.columns;
            delete configToDump.coverProperty;
            delete configToDump.groupByProperty;
            delete configToDump.customGroups;
        }

        const keyOrder = [ 'view', 'folder', 'data', 'title', 'description', 'pills', 'buttons', 'filters', 'sort', 'limit', 'pagination', 'columns', 'coverProperty', 'search', 'class', 'inlineButtons', 'newTab', 'groupByProperty', 'customGroups' ];
        const orderedConfig: Partial<DataBlockConfig> = {};
        keyOrder.forEach(key => {
            if (configToDump.hasOwnProperty(key)) {
                (orderedConfig as any)[key] = configToDump[key];
                delete configToDump[key];
            }
        });

        for (const key in configToDump) {
            (orderedConfig as any)[key] = configToDump[key];
        }
        
        return yaml.dump(orderedConfig, { skipInvalid: true, sortKeys: false, lineWidth: -1 }).trim();
    }

    private validateAndSubmit(): void {
        if (!this.isDefaultConfig && this.currentDataSource === 'notes' && (!this.config.folder || !this.app.vault.getAbstractFileByPath(this.config.folder))) {
            new Notice('Invalid source folder. Please select a valid folder.');
            return;
        }
        if (this.config.view === 'board' && !this.config.customGroups && !this.config.groupByProperty && this.detectedFields.length > 0) {
            new Notice('Group By Property is required for board view with property grouping.');
            return;
        }
        const finalConfig = this.buildConfiguration();
        this.onSubmit(finalConfig);
        this.close();
    }

    public async updateDetectedFields(): Promise<void> {
        this.detectedFields = [];
        this.notesCount = 0;

        if (this.currentDataSource === 'notes') {
            const folderPath = this.config.folder;
            if (folderPath) {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (folder && folder instanceof TFolder) {
                    const files = this.getFilesFromFolder(folder);
                    this.notesCount = files.length;
                    const fieldSet = new Set<string>();
                    for (const file of files) {
                        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                        if (frontmatter) {
                            Object.keys(frontmatter).forEach(key => fieldSet.add(key));
                        }
                    }
                    this.detectedFields = Array.from(fieldSet);
                }
            }
        } else if (this.currentDataSource === 'custom') {
            const result = await this.getFreshData();
            if (Array.isArray(result)) {
                this.notesCount = result.length;
                if (result.length > 0) {
                    const fieldSet = new Set<string>();
                    result.forEach(item => {
                        if (typeof item === 'object' && item !== null) {
                            Object.keys(item).forEach(key => fieldSet.add(key));
                        }
                    });
                    this.detectedFields = Array.from(fieldSet);
                }
            }
        }
    }

    private getFilesFromFolder(folder: TFolder): TFile[] {
        const files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                files.push(...this.getFilesFromFolder(child));
            } else if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            }
        }
        return files;
    }
    public populateDropdown(dropdown: DropdownComponent, fields: string[], selectedValue?: string, defaultValue?: string, placeholder?: string): void {
        dropdown.selectEl.empty();
        if (fields.length === 0) {
            dropdown.addOption('', 'No properties found');
            dropdown.setValue('');
            dropdown.selectEl.selectedIndex = 0;
            dropdown.setDisabled(true);
            return;
        }

        if (placeholder) {
            dropdown.addOption('', placeholder);
        }
        fields.forEach(field => { dropdown.addOption(field, field); });
        dropdown.setDisabled(false);
        if (selectedValue && fields.includes(selectedValue)) { dropdown.setValue(selectedValue); return; }
        if (defaultValue && fields.includes(defaultValue)) { dropdown.setValue(defaultValue); return; }
        dropdown.setValue('');
    }

    
    private getTabIdForStep(step: number): string {
        const tabs = ['source', 'display', 'filters', 'advanced'];
        return tabs[step - 1];
    }

    private getStepForTabId(tabId: string): number {
        if (tabId === 'donate') return this.currentStep;
        const tabs = ['source', 'display', 'filters', 'advanced'];
        const step = tabs.indexOf(tabId) + 1;
        return step > 0 ? step : this.currentStep;
    }

    private updateProgress(): void {
        const progressFill = this.contentEl.querySelector('.datablock-progress-fill') as HTMLElement;
        if (progressFill) {
            progressFill.setAttr('style', `width: ${(this.currentStep / this.totalSteps) * 100}%`);
        }
        const progressText = this.contentEl.querySelector('.datablock-progress-text');
        if (progressText) {
            progressText.setText(`Step ${this.currentStep} of ${this.totalSteps}`);
        }
    }

    public async rerenderAllTabs(): Promise<void> {
        await this.updateDetectedFields();
        this.setContextualDefaults();
        this.rerenderDisplayTab();
        const filtersTab = this.contentEl.querySelector('[data-tab-content="filters"]');
        if (filtersTab) {
            filtersTab.empty();
            this.buildFiltersTab(filtersTab as HTMLElement);
        }
        const advancedTab = this.contentEl.querySelector('[data-tab-content="advanced"]');
        if (advancedTab) {
            advancedTab.empty();
            this.buildAdvancedTab(advancedTab as HTMLElement);
        }
        if ((this.config as any).cssClass) {
            (this.config as any).class = (this.config as any).cssClass;
            delete (this.config as any).cssClass;
        }
        this.updateViewOptions();
        this.updatePreview();
    }

    private setContextualDefaults(): void {
        const handleField = (field: 'title' | 'description') => {
            const config = this.config[field];
            if (!config) return;

            const isCustom = this.currentDataSource === 'custom';
            const defaultText = isCustom ? 'property:name' : 'item.name';
            const defaultAction = isCustom ? undefined : 'item.path';

            // Case 1: JS function text is preserved
            if (typeof config.text === 'function') {
                if (isCustom) delete config.action; // Remove action if switching to custom
                return;
            }

            // Case 2: JS function action is preserved
            if (typeof config.action === 'function') {
                // translate text part
                if (config.text === (isCustom ? 'item.name' : 'property:name')) {
                    config.text = defaultText;
                }
                return;
            }

            // Case 3: Standard text translation
            if (typeof config.text === 'string') {
                if (config.text.startsWith('property:')) {
                    const prop = config.text.substring('property:'.length);
                    if (this.detectedFields.includes(prop)) {
                        if (!isCustom) config.action = defaultAction;
                    } else {
                        config.text = defaultText;
                        config.action = defaultAction;
                    }
                } else if (config.text === 'item.name') {
                    if (isCustom) {
                        config.text = 'property:name';
                        delete config.action;
                    }
                }
            } else {
                 this.config[field] = { text: defaultText, action: defaultAction };
            }
        };

        handleField('title');
        handleField('description');

        // Handle sortBy separately
        const isCustom = this.currentDataSource === 'custom';
        // Always apply a default sort value if one doesn't exist.
        if (!this.config.sort) {
            this.config.sort = { by: 'name', order: 'asc' };
        }

        if (typeof this.config.sort === 'string') {
            if (isCustom && this.config.sort === 'item.name') {
                this.config.sort = 'name';
            } else if (!isCustom && this.config.sort === 'name') {
                this.config.sort = 'item.name';
            } else if (this.config.sort.startsWith('property:')) {
                const prop = this.config.sort.substring('property:'.length);
                if (!this.detectedFields.includes(prop)) {
                    this.config.sort = isCustom ? 'name' : 'item.name';
                }
            }
        }
    }
}