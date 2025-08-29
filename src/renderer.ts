import { App, Notice } from 'obsidian';
import { JavaScriptExecutor } from 'src/javascript-executor';
import { DataBlockConfig } from 'src/types';
import { GalleryRenderer } from 'src/renderers/gallery-renderer';
import { ListRenderer } from 'src/renderers/list-renderer';
import { BoardRenderer } from 'src/renderers/board-renderer';
import { getNestedValue, renderPaginationControls, universalSorter } from 'src/utils/helpers';

export function buildFilterFunction(filters: any[] | undefined, jsExecutor: JavaScriptExecutor): (page: any) => Promise<boolean> {
    if (!filters || filters.length === 0) {
        return async () => true;
    }

    return async (page: any): Promise<boolean> => {
        if (filters.length === 0) return true;

        let finalResult = true;

        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            let currentResult: boolean;

            if (filter.type === 'custom' && typeof filter.func === 'function') {
                currentResult = !!await jsExecutor.executeFunction(filter.func, page);
            } else {
                const fieldValue = getNestedValue(page, filter.field);
                let filterValue = filter.value;

                if (typeof fieldValue === 'boolean' && typeof filterValue === 'string') {
                    if (filterValue.toLowerCase() === 'true') {
                        filterValue = true;
                    } else if (filterValue.toLowerCase() === 'false') {
                        filterValue = false;
                    }
                }

                switch (filter.operator) {
                    case 'is':
                        currentResult = fieldValue == filterValue;
                        break;
                    case 'is-not':
                        currentResult = fieldValue != filterValue;
                        break;
                    case 'contains':
                        currentResult = fieldValue?.toString().includes(filterValue);
                        break;
                    case 'does-not-contain':
                        currentResult = !fieldValue?.toString().includes(filterValue);
                        break;
                    case 'is-empty':
                        currentResult = fieldValue === null || fieldValue === undefined || fieldValue === '';
                        break;
                    case 'is-not-empty':
                        currentResult = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
                        break;
                    default:
                        currentResult = true;
                }
            }

            if (i === 0) {
                finalResult = currentResult;
            } else {
                const conjunction = filter.conjunction || 'and';
                if (conjunction === 'and') {
                    finalResult = finalResult && currentResult;
                } else {
                    finalResult = finalResult || currentResult;
                }
            }
        }
        return finalResult;
    };
}

export async function fetchDatablockItems(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig): Promise<any[]> {
    let items: any[] = [];
    
    if (Array.isArray(config.data)) {
        items = config.data;
    } else if (typeof config.data === 'string') {
        try {
            let func;
            if (typeof config.data === 'function') {
                func = config.data;
            } else {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                let body = config.data.trim();

                // Check if the body is already an async function expression
                if (!body.startsWith('async')) {
                    body = `async () => { ${body} }`;
                }
                
                // The function will be executed with the correct `this` and `fetch` in scope
                const funcString = `return (${body})();`;
                func = new AsyncFunction('app', funcString);
            }

            const customData = await jsExecutor.executeFunction(func, null);

            if (Array.isArray(customData)) {
                items = customData;
            } else {
                new Notice("DataBlock Error: Custom data script must return an array.");
                console.error("DataBlock Error: Custom data script did not return an array.", customData);
                items = [];
            }
        } catch (e) {
            new Notice("DataBlock Error: Failed to execute custom data script. See console for details.");
            console.error("DataBlock Custom Data Error:", e);
            items = [];
        }
    } else {
        const baseFilter = new Function('item', `return (${config.filter || 'item => true'})(item)`) as (page: any) => boolean;
        const notionFilter = buildFilterFunction(config.filters, jsExecutor);

        const combinedFilter = async (p: any) => {
            try {
                const notionFilterResult = await notionFilter(p);
                return baseFilter(p) && notionFilterResult;
            } catch (e) {
                console.error("DataBlock Filter Error:", e);
                return false;
            }
        };

        let allFiles = app.vault.getMarkdownFiles();

        if (config.folder && config.folder !== '/') {
            allFiles = allFiles.filter(p => p.path.startsWith(config.folder as string));
        }

        items = allFiles.map(p => {
            const metadata = app.metadataCache.getFileCache(p);
            const augmentedFile = Object.create(Object.getPrototypeOf(p));
            Object.assign(augmentedFile, p, metadata?.frontmatter);
            return augmentedFile;
        });

        const filterResults = await Promise.all(items.map(combinedFilter));
        items = items.filter((_, index) => filterResults[index]);
    }

    if ((config as any).maxItems > 0 && items) {
        items = items.slice(0, (config as any).maxItems);
    }
    
    return items;
}
function groupPages(pages: any[], config: DataBlockConfig): Record<string, any[]> {
    const customGroups = (config as any).customGroups;
    const hasCustomGroups = customGroups && customGroups.groups;
    const groupBy = hasCustomGroups ? customGroups.property : (config.groupByProperty || 'status');
    let groupedPages: Record<string, any[]> = {};

    const getGroupValues = (page: any) => {
        const value = getNestedValue(page, groupBy);
        if (value === null || value === undefined) return ['Uncategorized'];
        return Array.isArray(value) ? value : [value];
    };

    // Initialize groups
    if (hasCustomGroups) {
        customGroups.groups.forEach((groupName: string) => {
            groupedPages[groupName] = [];
        });
    } else {
        const allPossibleValues = new Set(pages.flatMap(getGroupValues));
        allPossibleValues.forEach((value: any) => {
            if (value && value !== 'Uncategorized' && !groupedPages[value]) {
                groupedPages[value] = [];
            }
        });
    }
    groupedPages['Uncategorized'] = [];

    // Distribute pages into groups
    pages.forEach((page: any) => {
        const groupValues = getGroupValues(page);
        let wasGrouped = false;
        for (const value of groupValues) {
            if (groupedPages.hasOwnProperty(value)) {
                groupedPages[value].push(page);
                wasGrouped = true;
            }
        }
        if (!wasGrouped) {
            groupedPages['Uncategorized'].push(page);
        }
    });

    return groupedPages;
}

export async function renderDataBlock(app: App, jsExecutor: JavaScriptExecutor, config: DataBlockConfig, el: HTMLElement, renderer: any) {

    const viewWrapper = el.createEl("div", { cls: "obsidian-view-wrapper" });

    let topControlsContainer: HTMLElement | null = null;
    let searchInputContainer: HTMLElement | null = null;

    if ((config as any).search) {
        topControlsContainer = viewWrapper.createEl("div", { cls: "obsidian-view-controls-container" });
        if (topControlsContainer) {
            searchInputContainer = topControlsContainer.createEl("div", { cls: "obsidian-view-search-filter" });
        }
    }

    let viewContentContainer = viewWrapper.createEl("div");
    let paginationControlsHost = viewWrapper.createEl("div", { cls: "obsidian-view-pagination-container" });

    let allFetchedAndInitiallyFilteredPages: any[] | null = null;
    let currentSearchTerm = "";
    let activeAdvancedFilterStates: { [key: number]: any } = {};
    let currentPage = 1;

    const getItemTitleForSearch = (item: any) => {
        if (typeof (config as any).titleText === 'function') {
            try { return String((config as any).titleText(item) || item.name || ""); }
            catch { return String(item.name || ""); }
        }
        return String(getNestedValue(item, (config as any).titleText) || item.name || "");
    };

    const updateView = async () => {
        if (allFetchedAndInitiallyFilteredPages === null) {
            allFetchedAndInitiallyFilteredPages = await fetchDatablockItems(app, jsExecutor, config);
        }

// console.log("All rendered items:", allFetchedAndInitiallyFilteredPages);
        let pagesToProcess = allFetchedAndInitiallyFilteredPages ? [...allFetchedAndInitiallyFilteredPages] : [];

        if (currentSearchTerm) {
            const searchTermLower = currentSearchTerm.toLowerCase();
            pagesToProcess = pagesToProcess.filter(page => getItemTitleForSearch(page).toLowerCase().includes(searchTermLower));
        }

        
        if (config.sort) {
            pagesToProcess.sort((a, b) => universalSorter(a, b, config.sort, getNestedValue));
        } else {
            // Apply a default sort by name if no sort is specified
            pagesToProcess.sort((a, b) => universalSorter(a, b, { by: 'name', order: 'asc' }, getNestedValue));
        }

        let itemsForCurrentPage: any;
        let totalPages = 1;

        if (config.view === 'board') {
            const groupedPages = groupPages(pagesToProcess, config);

            const limit = (config as any).limit > 0 ? (config as any).limit : undefined;
            const maxItems = (config as any).maxItems > 0 ? (config as any).maxItems : undefined;

            if (limit) {
                let maxGroupLength = 0;
                for (const group in groupedPages) {
                    if (groupedPages[group].length > maxGroupLength) {
                        maxGroupLength = groupedPages[group].length;
                    }
                }
                totalPages = Math.ceil(maxGroupLength / limit);
            } else {
                totalPages = 1;
            }

            currentPage = Math.max(1, Math.min(currentPage, totalPages));
            const startIndex = limit ? (currentPage - 1) * limit : 0;
            
            const paginatedGroups: Record<string, any[]> = {};
            for (const group in groupedPages) {
                const groupPages = groupedPages[group];
                let limitedPages = maxItems ? groupPages.slice(0, maxItems) : groupPages;
                paginatedGroups[group] = limit ? limitedPages.slice(startIndex, startIndex + limit) : limitedPages;
            }
            itemsForCurrentPage = paginatedGroups;
        } else {
            if ((config as any).pagination && (config as any).limit > 0) {
                totalPages = Math.ceil(pagesToProcess.length / (config as any).limit) || 1;
                currentPage = Math.max(1, Math.min(currentPage, totalPages));
                const startIndex = (currentPage - 1) * (config as any).limit;
                itemsForCurrentPage = pagesToProcess.slice(startIndex, startIndex + (config as any).limit);
            } else {
                itemsForCurrentPage = pagesToProcess.slice(0, (config as any).limit > 0 ? (config as any).limit : pagesToProcess.length);
            }
        }

        viewContentContainer.empty();
        viewContentContainer.className = "";
        viewContentContainer.classList.add("obsidian-view", `${config.view}-view`);
        if (config.view !== "list" && config.columns) {
            viewContentContainer.classList.add(`${config.view}-cols-${config.columns}`);
        }
        if ((config as any).class) {
            (config as any).class.split(" ").forEach((cls: string) => cls && viewContentContainer.classList.add(cls.trim()));
        }

        if (itemsForCurrentPage.length === 0) {
            viewContentContainer.createEl("div", {
                text: !allFetchedAndInitiallyFilteredPages || allFetchedAndInitiallyFilteredPages.length === 0 ? "No items found." : "No items match the current filters/search.",
                cls: "empty-notice"
            });
        } else {
            switch (config.view) {
                case "gallery":
                    new GalleryRenderer().render(app, jsExecutor, config, viewContentContainer, itemsForCurrentPage, renderer, allFetchedAndInitiallyFilteredPages);
                    break;
                case "list":
                    await new ListRenderer().render(app, jsExecutor, config, viewContentContainer, itemsForCurrentPage, renderer, allFetchedAndInitiallyFilteredPages);
                    break;
                case "board":
                    new BoardRenderer().render(app, jsExecutor, config, viewContentContainer, itemsForCurrentPage as Record<string, any[]>, renderer, allFetchedAndInitiallyFilteredPages);
                    break;
                default:
                    viewContentContainer.createEl("div", { text: `Invalid view type: ${config.view}`, cls: "empty-notice error-notice" });
            }
        }

        paginationControlsHost.empty();
        if ((config as any).pagination && totalPages > 1 && (config as any).limit > 0) {
            renderPaginationControls(app, jsExecutor, currentPage, totalPages, config, paginationControlsHost, (newPage: number) => {
                currentPage = newPage;
                updateView();
            });
        }
    };


    if ((config as any).search && searchInputContainer) {
        const searchEl = searchInputContainer.createEl("input", { type: "search", placeholder: "Search...", cls: "obsidian-view-search-input" });
        searchEl.addEventListener("input", () => {
            currentSearchTerm = searchEl.value;
            currentPage = 1;
            updateView();
        });
         searchEl.addEventListener("search", () => {
            currentSearchTerm = searchEl.value;
            currentPage = 1;
            updateView();
        });
    }

    await updateView();
}
