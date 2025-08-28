import { TFile } from 'obsidian';

export interface DataBlockConfig {
  view: 'gallery' | 'list' | 'board';
  data?: string | Function | any[];
  groupByProperty?: string;
  folder?: string;
  fileclass?: string;
  columns?: number;
  search?: boolean;
  limit?: number;
  maxItems?: number;
  pagination?: boolean;
  pills?: PillConfig[];
  buttons?: ButtonConfig[];
  title?: any;
  description?: any;
  coverProperty?: string | CoverFunction;
  sort?: SortSpecifier | SortSpecifier[] | SortFunction;
  filters?: Filter[];
  filter?: string | ((item: any) => boolean);
  class?: string;
  customGroups?: CustomGroups;
  inlineButtons?: boolean;
  newTab?: boolean;
}

export type SortOrder = 'asc' | 'desc';
export type SortType = 'string' | 'number' | 'date' | 'boolean';

export interface SortConfig {
  property?: string;
  by?: string;
  order?: SortOrder;
  type?: SortType;
}

export type SortSpecifier = string | SortConfig;

export interface CustomGroups {
  property: string;
  groups: string[];
}

export interface PillConfig {
  text: string | PillFunction;
  action?: string | ((item: any) => void);
  property?: string;
  propertyType?: 'Text' | 'Long Text' | 'Select' | 'Number' | 'Date' | 'Boolean';
  options?: string[];
}

export type PillFunction = (item: any) => string | null;
export type TitleFunction = (item: any) => string;
export type DescriptionFunction = (item: any) => string | null;
export type CoverFunction = (item: any) => string | null;
export type TitlePathFunction = (item: any) => string;
export type SortFunction = (a: any, b: any) => number;
export type ButtonClickHandler = (event: Event) => void;
export type ButtonPathFunction = (item: any) => string | ButtonClickHandler;

export interface PageData {
  file: TFile;
  [key: string]: any; // item properties
}

export interface MenuOption {
  name: string;
  action: string | Function;
}

export interface ButtonConfig {
  text?: string | ((item: any) => string);
  action?: string | ButtonPathFunction;
  menuOptions?: MenuOption[];
  inlineButtons?: boolean;
  property?: string;
  propertyType?: 'Text' | 'Long Text' | 'Select' | 'Number' | 'Date' | 'Boolean';
  options?: string[];
  checkboxMode?: boolean;
}

export type FilterOperator =
  | 'is' | 'is-not'
  | 'contains' | 'does-not-contain'
  | 'is-empty' | 'is-not-empty';

export type FilterConjunction = 'and' | 'or';

export interface Filter {
  type: 'property' | 'custom';
  // For 'property'
  field?: string;
  operator?: FilterOperator;
  value?: any;
  // For 'custom'
  func?: string; // The raw JS function body
  // For combining filters
  conjunction?: FilterConjunction;
}