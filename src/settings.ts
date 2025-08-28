export interface DataBlockSettings {
    viewType: "gallery" | "list" | "board";
    folder: string;
    data: any;
    filter: string;
    limit: number;
    maxItems: number;
    columns: number;
    pillFields: string[];
    coverProperty: string;
    buttonPath: string;
    buttonText: string;
    inlineButtons: boolean;
    sortBy: any;
    dateFormat: string;
    title: any;
    description: any;
    class: string;
    dateFields: string[];
    dateFormats: string[];
    newTab: boolean;
    search: boolean;
    filters: any[];
    pagination: boolean;
    paginationNumeric: boolean;
    paginationType: 'numeric' | 'buttons';
    showUndefinedPills: boolean;
    groupByProperty?: string;
    customGroups?: {
      property: string;
      groups: string[];
    };
    showEditButtonOnCodeblock: boolean;
    defaultDataBlockConfig: Partial<BlockSettings>;
    applyDefaults: boolean;
  }
  
  export const DEFAULT_SETTINGS: DataBlockSettings = {
      viewType: "gallery",
    folder: "",
    data: null,
    filter: "page => true",
    limit: 10,
    maxItems: 1000,
    columns: 3,
    pillFields: [],
    coverProperty: "cover",
    buttonPath: "",
    buttonText: "",
    inlineButtons: false,
    sortBy: 'name',
    dateFormat: "yyyy-MM-dd",
    title: { text: "item.name", action: "item.path" },
    description: null,
    class: "",
    dateFields: [],
    dateFormats: [],
    newTab: false,
    search: false,
    filters: [],
    pagination: false,
    paginationNumeric: false,
    paginationType: 'buttons',
    showUndefinedPills: true,
    groupByProperty: "status",
    customGroups: {
        property: "status",
        groups: [
            "To Do",
            "In Progress",
            "Done"
        ]
    },
    showEditButtonOnCodeblock: true,
    defaultDataBlockConfig: {},
    applyDefaults: false,
};

export interface BlockSettings extends Partial<DataBlockSettings> {
    columnAliases?: ColumnAlias[];
    imageProperty?: string;
}

export interface ColumnAlias {
    original: string;
    alias: string;
    expression: string;
}