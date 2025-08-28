import { Setting } from 'obsidian';
import { DataBlockConfigModal } from './DataBlockConfigModal';
import { buildAdvancedFieldWithAction } from './components/field-config';
import { 
    buildConfigPillManager, 
    buildConfigButtonManager, 
    buildConfigSortingSettings, 
    buildConfigFilterSection, 
    buildPerformanceSettings, 
    buildStylingSettings, 
    buildCustomGroupManager 
} from './components/settings-sections';

export function buildFieldConfiguration(modal: DataBlockConfigModal, container: HTMLElement): void {
    const titleCard = container.createDiv({ cls: 'config-field-card' });
    
    const buildTitleFields = () => {
        titleCard.empty();
        if (modal.config.title === undefined) {
            modal.config.title = { text: 'item.name' };
        }
        buildAdvancedFieldWithAction(modal, titleCard, {
            fieldLabel: 'Title Display',
            fieldDesc: 'The field to use for the item\'s title.',
            fieldKey: 'title',
            actionLabel: 'Title Click Action',
            actionDesc: 'What happens when title is clicked',
            actionKey: 'title',
            defaultField: 'name',
            defaultAction: 'path'
        });
    };

    container.createEl('hr', { cls: 'datablock-section-divider' });

    const descCard = container.createDiv({ cls: 'config-field-card' });
    
    new Setting(descCard)
        .setName('Enable Description')
        .addToggle(toggle => {
            toggle
                .setValue(modal.config.description !== undefined)
                .onChange(enabled => {
                    if (enabled) {
                        if (modal.currentDataSource === 'notes') {
                            modal.config.description = { text: 'item.name' };
                        } else {
                            modal.config.description = { text: '' };
                        }
                        buildDescriptionFields();
                    } else {
                        modal.config.description = undefined;
                        clearDescriptionFields();
                    }
                    modal.updatePreview();
                });
        });

    const descFieldsContainer = descCard.createDiv({ cls: 'description-fields' });
    
    function buildDescriptionFields(): void {
        descFieldsContainer.empty();
        buildAdvancedFieldWithAction(modal, descFieldsContainer, {
            fieldLabel: 'Description Display',
            fieldDesc: 'The field for the item\'s secondary text.',
            fieldKey: 'description',
            actionLabel: 'Description Click Action',
            actionDesc: 'What happens when description is clicked',
            actionKey: 'description',
            defaultField: 'name',
            defaultAction: 'path'
        });
    }
    
    function clearDescriptionFields(): void {
        descFieldsContainer.empty();
    }

    buildTitleFields();

    if (modal.config.description !== undefined) {
        buildDescriptionFields();
    }
}

export { 
    buildConfigPillManager, 
    buildConfigButtonManager, 
    buildConfigSortingSettings, 
    buildConfigFilterSection, 
    buildPerformanceSettings, 
    buildStylingSettings, 
    buildCustomGroupManager 
};