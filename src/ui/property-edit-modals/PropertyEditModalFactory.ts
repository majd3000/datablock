import { App, TFile } from 'obsidian';
import { BasePropertyEditModal, PropertyEditResult } from './BasePropertyEditModal';
import { TextPropertyEditModal } from './TextPropertyEditModal';
import { LongTextPropertyEditModal } from './LongTextPropertyEditModal';
import { SelectPropertyEditModal } from './SelectPropertyEditModal';
import { NumberPropertyEditModal } from './NumberPropertyEditModal';
import { DatePropertyEditModal } from './DatePropertyEditModal';
import { BooleanPropertyEditModal } from './BooleanPropertyEditModal';

export class PropertyEditModalFactory {
    static createModal(
        app: App,
        type: string,
        propertyName: string,
        currentValue: any,
        file: TFile,
        onSubmit: (result: PropertyEditResult) => void,
        options?: any
    ): BasePropertyEditModal {
        
        switch (type.toLowerCase()) {
            case 'text':
                return new TextPropertyEditModal(app, propertyName, 'text', currentValue, file, onSubmit);
            
            case 'longtext':
            case 'long text':
                return new LongTextPropertyEditModal(app, propertyName, 'long-text', currentValue, file, onSubmit);
            
            case 'select':
                return new SelectPropertyEditModal(app, propertyName, 'select', currentValue, file, onSubmit, options?.selectOptions || []);
            
            case 'number':
                return new NumberPropertyEditModal(app, propertyName, 'number', currentValue, file, onSubmit, options?.numberOptions);
            
            case 'date':
                return new DatePropertyEditModal(app, propertyName, 'date', currentValue, file, onSubmit, options?.includeTime);
            
            case 'boolean':
                return new BooleanPropertyEditModal(app, propertyName, 'boolean', currentValue, file, onSubmit);
            
            default:
                throw new Error(`Unknown property type: ${type}`);
        }
    }
}