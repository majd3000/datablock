import { EditorView, keymap, lineNumbers, highlightActiveLine, placeholder } from "@codemirror/view";
import { EditorState, Extension, Compartment } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion, CompletionContext, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { history, undo, redo, toggleComment } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, foldGutter } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { setIcon } from "obsidian";

export class JSTextarea {
  private view: EditorView;
  private container: HTMLElement;
  private onChangeCallback?: (value: string) => void;
  private isDarkTheme: boolean = false;
  private isExpanded: boolean = false;
  private originalParent: HTMLElement | null = null;
  private originalStyles: { [key: string]: string } = {};
  private isInModal: boolean = false;
  private measureTimeout: number | null = null;
  private isTransitioning: boolean = false;
  private expandedWrapper: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private syntaxHighlightingCompartment: Compartment;
  private themeObserver: MutationObserver;

  private preventCollapseHandler: (e: MouseEvent) => void;

  constructor(
    container: HTMLElement,
    options: {
      initialValue?: string;
      onChange?: (value: string) => void;
      readOnly?: boolean;
      placeholder?: string;
    } = {}
  ) {
    this.container = container;
    this.onChangeCallback = options.onChange;
    this.isInModal = !!container.closest('.modal');
    this.preventCollapseHandler = this.preventCollapse.bind(this);
    this.syntaxHighlightingCompartment = new Compartment();
    this.initializeEditor(options);
    this.setupThemeObserver();
  }

  private initializeEditor(options: any): void {
    const extensions: Extension[] = [
      this.createBasicSetup(options),
      this.syntaxHighlightingCompartment.of(this.createJavaScriptWithHighlighting()),
      this.createFixedHistory(),
      this.createTextDirectionFix(),
      this.createObsidianTheme(),
      this.createObsidianAutocompletion(),
      this.createExpandKeymap(),
      this.createOptimizedChangeListener(),
      
      ...(options.readOnly ? [EditorState.readOnly.of(true)] : [])
    ];

    const state = EditorState.create({
      doc: options.initialValue || "",
      extensions
    });

    this.view = new EditorView({
      state,
      parent: this.container
    });

    this.applyPostInitFixes();
  }

  private createOptimizedChangeListener(): Extension {
    return EditorView.updateListener.of((update) => {
      // Only process actual document changes, not layout/focus changes
      if (update.docChanged && this.onChangeCallback && !this.isTransitioning) {
        this.onChangeCallback(update.state.doc.toString());
      }
      
      // Don't trigger re-renders for focus/layout changes during transitions
      if (this.isTransitioning) {
        return;
      }
    });
  }

  private createBasicSetup(options: { placeholder?: string }): Extension {
    return [
      lineNumbers(),
      highlightActiveLine(),
      foldGutter({
        markerDOM: (open) => {
          const icon = document.createElement('span');
          icon.className = 'custom-fold-marker';
          icon.textContent = open ? '−' : '+';
          return icon;
        }
      }),
      closeBrackets(),
      ...(options.placeholder ? [placeholder(options.placeholder)] : [])
      // Don't include default keymap here to avoid conflicts
    ];
  }

  private createJavaScriptWithHighlighting(): Extension {
    this.isDarkTheme = document.body.classList.contains('theme-dark');

    const darkThemeColors = {
      keyword: "#569cd6",
      string: "#ce9178",
      comment: "#6a9955",
      number: "#b5cea8",
      function: "#dcdcaa",
      variable: "#9cdcfe",
      operator: "#d4d4d4",
      bracket: "#ffd700",
      boolean: "#569cd6",
      null: "#569cd6",
      regexp: "#d16969"
    };

    const lightThemeColors = {
      keyword: "#0000ff",
      string: "#a31515",
      comment: "#008000",
      number: "#09885a",
      function: "#795e26",
      variable: "#001080",
      operator: "#000000",
      bracket: "#0431fa",
      boolean: "#0000ff",
      null: "#0000ff",
      regexp: "#811f3f"
    };

    const colors = this.isDarkTheme ? darkThemeColors : lightThemeColors;

    const jsHighlightStyle = HighlightStyle.define([
      // Keywords
      { tag: t.keyword, color: colors.keyword, fontWeight: "bold" },
      // Strings
      { tag: t.string, color: colors.string },
      // Comments
      { tag: t.comment, color: colors.comment, fontStyle: "italic" },
      // Numbers
      { tag: t.number, color: colors.number },
      // Function names
      { tag: [t.function(t.variableName), t.function(t.propertyName)], color: colors.function },
      // Variables
      { tag: t.variableName, color: colors.variable },
      // Property names
      { tag: t.propertyName, color: colors.variable },
      // Operators
      { tag: t.operator, color: colors.operator },
      // Brackets
      { tag: t.bracket, color: colors.bracket },
      // Boolean values
      { tag: t.bool, color: colors.boolean, fontWeight: "bold" },
      // null, undefined
      { tag: t.null, color: colors.null, fontWeight: "bold" },
      // Regular expressions
      { tag: t.regexp, color: colors.regexp }
    ]);

    return [
      javascript({ jsx: false, typescript: false }),
      syntaxHighlighting(jsHighlightStyle),
    ];
  }

  private createFixedHistory(): Extension {
    return [
      history({
        minDepth: 100,
        newGroupDelay: 500
      }),
      
      // High priority keymap for undo/redo
      keymap.of([
        ...closeBracketsKeymap,
        {
          key: "Mod-z",
          run: undo,
          preventDefault: true
        },
        { 
          key: "Mod-y", 
          run: redo,
          preventDefault: true
        },
        { 
          key: "Mod-Shift-z", 
          run: redo,
          preventDefault: true
        }
      ])
    ];
  }

  private createTextDirectionFix(): Extension {
    return [
      EditorView.theme({
        "&": {
          direction: "ltr !important"
        },
        
        ".cm-editor": {
          direction: "ltr !important"
        },
        
        ".cm-content": {
          direction: "ltr !important",
          textAlign: "left !important",
          minWidth: "325px",
        },
        
        ".cm-line": {
          direction: "ltr !important",
          textAlign: "left !important",
          unicodeBidi: "bidi-override !important"
        },
        
        ".cm-cursor": {
          direction: "ltr !important"
        }
      }),
      
      EditorView.contentAttributes.of(() => ({
        dir: "ltr",
        style: "direction: ltr !important; text-align: left !important;"
      }))
    ];
  }

  private createObsidianTheme(): Extension {
    const baseColors = {
      bg: "var(--background-primary)",           // Main background
      fg: "var(--text-normal)",                  // Main text color
      bgAlt: "var(--background-secondary)",      // Alternative background (gutters, etc.)
      border: "var(--color-base-30)",           // Borders (kept as you requested)
      hover: "var(--color-base-20)",            // Hover states (kept as you requested)
      accent: "var(--interactive-accent)",       // Accent color (kept as you requested)
      selection: "var(--text-selection)",       // Text selection background
      textMuted: "var(--text-muted)",           // Muted text (gutters)
      tooltipBg: "var(--background-tooltip)",   // Tooltip background
      modalBg: "var(--modal-background)",       // Modal background
      borderModifier: "var(--background-modifier-border)" // Modal borders
    };

    return EditorView.theme({
      "&": {
        fontSize: "var(--font-ui-medium)",
        fontFamily: "var(--font-monospace)",
        lineHeight: "var(--line-height-normal)",
        color: baseColors.fg,
        backgroundColor: baseColors.bg,
        border: `1px solid ${baseColors.border}`,
        borderRadius: "var(--radius-s)",
        willChange: "transform, width, height",
        transition: "none" // Disable CSS transitions to prevent re-renders
      },

      "&.cm-focused": {
        outline: "none",
        borderColor: "var(--interactive-hover)"
      },

      ".cm-content": {
        padding: "var(--size-4-4)",
        minHeight: "fit-content",
        color: baseColors.fg,
        caretColor: baseColors.fg,
        backgroundColor: baseColors.bg,
        willChange: "auto"
      },

      ".cm-gutters": {
        backgroundColor: baseColors.bgAlt,
        borderRight: `1px solid ${baseColors.border}`,
        color: baseColors.textMuted
      },

      "&.cm-focused .cm-activeLine": {
        backgroundColor: baseColors.hover
      },

      ".cm-activeLine": {
        backgroundColor: "unset"
      },
      
      ".cm-selectionBackground": {
        backgroundColor: baseColors.selection + " !important"
      },

      ".cm-cursor": {
        borderLeftColor: baseColors.fg,
        borderLeftWidth: "2px"
      },

      ".cm-tooltip": {
        backgroundColor: `${baseColors.tooltipBg} !important`,
        border: `1px solid ${baseColors.borderModifier} !important`,
        borderRadius: "var(--radius-m) !important",
        boxShadow: "var(--shadow-l) !important",
        color: `${baseColors.fg} !important`
      },

      ".cm-tooltip-autocomplete": {
        backgroundColor: `${baseColors.tooltipBg} !important`,
        "& > ul": {
          backgroundColor: `${baseColors.tooltipBg} !important`,
          maxHeight: "300px",
          overflowY: "auto",
          margin: "0",
          padding: "var(--size-2-2)"
        }
      },

      ".cm-completions .cm-completions-option": {
        padding: "var(--size-2-3) var(--size-4-2) !important",
        borderRadius: "var(--radius-s) !important",
        margin: "var(--size-2-1) 0 !important",
        color: `${baseColors.fg} !important`,
        backgroundColor: "transparent !important",
        fontSize: "var(--font-ui-small) !important"
      },

      ".cm-completions .cm-completions-option:hover": {
        backgroundColor: "var(--background-modifier-hover) !important",
        color: `${baseColors.fg} !important`
      },

      ".cm-completions .cm-completions-option[aria-selected]": {
        backgroundColor: `${baseColors.accent} !important`,
        color: "var(--text-on-accent) !important"
      },

      ".cm-completions .cm-completions-option .cm-completions-detail": {
        marginLeft: "auto",
        fontSize: "var(--font-ui-smaller) !important",
        opacity: "0.7",
        fontStyle: "italic",
        color: "inherit !important"
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--background-modifier-border)",
        border: "1px solid var(--border-color)",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-s)",
        margin: "0 var(--size-2-1)",
        padding: "0 var(--size-2-1)",
        cursor: "pointer"
      },
      ".cm-scroller": {
        "&::-webkit-scrollbar": {
          width: "var(--scrollbar-size)",
          height: "var(--scrollbar-size)"
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "var(--scrollbar-bg)"
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "var(--scrollbar-thumb-bg)",
          borderRadius: "var(--scrollbar-thumb-radius)"
        }
      },
      ".cm-expand-button": {
        position: "absolute",
        top: "var(--size-2-2)",
        right: "var(--size-2-2)",
        width: "28px !important",
        height: "28px !important",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "var(--radius-s)",
        backgroundColor: "unset",
        color: "var(--text-muted)",
        opacity: "0.4",
        cursor: "pointer",
        zIndex: this.isInModal ? "1001" : "999", // Higher z-index for modals
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.2s ease, transform 0.2s ease", // Only animate safe properties
        boxShadow: "var(--shadow-s)",
        padding: "0 !important"
      },
  
      ".cm-expand-button:hover": {
        opacity: "1",
        backgroundColor: "var(--background-modifier-hover)",
        color: "var(--text-normal)",
        transform: "scale(1.05)"
      },
  

        // No-op
      });
  }

  private createObsidianAutocompletion(): Extension {
    return autocompletion({
      override: [this.createJSCompletions.bind(this)],
      activateOnTyping: true,
      maxRenderedOptions: 10,
      defaultKeymap: true,
      closeOnBlur: true,
      // Use Obsidian tooltip class
      tooltipClass: () => "cm-tooltip-obsidian"
    });
  }

  private createJSCompletions(context: CompletionContext) {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const completions = [
      // Console methods
      { label: "console.log", type: "method", detail: "Log to console", boost: 99},
      { label: "console.error", type: "method", detail: "Log error"},
      { label: "console.warn", type: "method", detail: "Log warning"},
      
      // Common JavaScript
      { label: "function", type: "keyword", detail: "Function declaration" },
      { label: "const", type: "keyword", detail: "Constant variable" },
      { label: "let", type: "keyword", detail: "Block-scoped variable" },
      { label: "var", type: "keyword", detail: "Variable declaration" },
      { label: "if", type: "keyword", detail: "Conditional statement" },
      { label: "else", type: "keyword", detail: "Alternative condition" },
      { label: "for", type: "keyword", detail: "Loop statement" },
      { label: "while", type: "keyword", detail: "While loop" },
      { label: "return", type: "keyword", detail: "Return statement" },
      
      // Common methods
      { label: "setTimeout", type: "function", detail: "Delayed execution" },
      { label: "setInterval", type: "function", detail: "Repeated execution" },
      { label: "JSON.parse", type: "method", detail: "Parse JSON string" },
      { label: "JSON.stringify", type: "method", detail: "Convert to JSON" },
      
      // Array methods
      { label: "Array.from", type: "method", detail: "Create array" },
      { label: "push", type: "method", detail: "Add to array end" },
      { label: "pop", type: "method", detail: "Remove from array end" },
      { label: "map", type: "method", detail: "Transform array" },
      { label: "filter", type: "method", detail: "Filter array" },
      { label: "forEach", type: "method", detail: "Iterate array" }
    ];

    return {
      from: word.from,
      options: completions,
      validFor: /^\w*$/
    };
  }

  private applyPostInitFixes(): void {
    // Apply custom CSS class for additional styling
    this.view.dom.classList.add('fixed-js-textarea');
    this.view.dom.classList.add('obsidian-codemirror');
    
    // Make sure editor container has relative positioning
    this.view.dom.classList.add('cm-relative');

    // Add expand button
    const expandButton = this.createExpandButton();
    this.view.dom.appendChild(expandButton);

    // Ensure direction is set properly
    this.view.dom.classList.add('cm-ltr');
    this.view.contentDOM.classList.add('cm-ltr', 'cm-text-align-left');
  }

  private setupThemeObserver(): void {
    this.themeObserver = new MutationObserver(() => {
      this.updateSyntaxHighlighting();
    });

    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  private updateSyntaxHighlighting(): void {
    const isNowDark = document.body.classList.contains('theme-dark');
    if (isNowDark !== this.isDarkTheme) {
      this.isDarkTheme = isNowDark;
      this.view.dispatch({
        effects: this.syntaxHighlightingCompartment.reconfigure(this.createJavaScriptWithHighlighting())
      });
    }
  }

  // Public API methods
  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(value: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: value
      }
    });
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    // Clean up timeout
    if (this.measureTimeout) {
      clearTimeout(this.measureTimeout);
    }
    
    // Handle expanded state cleanup
    if (this.isExpanded) {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
        document.body.classList.remove('cm-no-scroll');
        this.view.dom.classList.remove('cm-expanded');
        
        // Remove escape hint if present
        const escapeHint = this.view.dom.querySelector('.cm-escape-hint');
        if (escapeHint) escapeHint.remove();
        
        if (this.expandedWrapper) {
          if (this.originalParent) {
            this.originalParent.appendChild(this.view.dom);
          }
          this.expandedWrapper.remove();
          this.expandedWrapper = null;
        } else if (this.originalParent) {
          this.originalParent.appendChild(this.view.dom);
        }
    }
    
    this.themeObserver.disconnect();
    this.view.destroy();
  }

  // Test methods for debugging
  testUndo(): boolean {
    return undo(this.view);
  }

  testRedo(): boolean {
    return redo(this.view);
  }

  private createExpandButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'cm-expand-button';
    button.setAttribute('aria-label', 'Expand editor');
    setIcon(button, "maximize");
    
    // Prevent event bubbling to editor
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleExpanded();
    });
    
    return button;
  }

  private saveOriginalStyles(): void {
    const style = this.view.dom.style;
    this.originalStyles = {
      position: style.position,
      top: style.top,
      left: style.left,
      width: style.width,
      height: style.height,
      zIndex: style.zIndex
    };
  }

  private restoreOriginalStyles(): void {
    const style = this.view.dom.style;
    Object.keys(this.originalStyles).forEach(prop => {
      (style as any)[prop] = this.originalStyles[prop] || '';
    });
  }

  private toggleExpanded(): void {
    const button = this.view.dom.querySelector('.cm-expand-button') as HTMLElement;
    this.isTransitioning = true;
  
    const appendTarget = this.isInModal ? this.container.closest('.modal') : document.body;
  
    if (!this.isExpanded) {
      // Expand
      this.originalParent = this.view.dom.parentElement;
      this.saveOriginalStyles();
  
      requestAnimationFrame(() => {
        // Create and add the overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'cm-editor-overlay';
        this.overlay.addEventListener('click', () => this.toggleExpanded());
        
        // Create and add the editor wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'cm-editor-expanded-wrapper';
        wrapper.appendChild(this.view.dom);
        
        if (appendTarget) {
            appendTarget.appendChild(this.overlay);
            appendTarget.appendChild(wrapper);
        } else {
            document.body.appendChild(this.overlay);
            document.body.appendChild(wrapper);
        }

        this.expandedWrapper = wrapper;
        
        // Trigger animations
        setTimeout(() => {
            if(this.overlay) this.overlay.classList.add('visible');
            wrapper.classList.add('visible');
        }, 10);
  
        // Add click listener to wrapper for minimizing
        this.expandedWrapper.addEventListener('click', (e) => {
            if (e.target === this.expandedWrapper) {
                this.toggleExpanded();
            }
        });

        this.view.contentDOM.addEventListener('mousedown', this.preventCollapseHandler, true);
        setIcon(button, "minimize");
        button.setAttribute('aria-label', 'Minimize editor');
        document.body.classList.add('cm-no-scroll');
  
        requestAnimationFrame(() => {
          this.isTransitioning = false;
          this.debouncedRequestMeasure();
          this.view.focus();
        });
      });
    } else {
      // Minimize
      requestAnimationFrame(() => {
        this.view.contentDOM.removeEventListener('mousedown', this.preventCollapseHandler, true);
  
        if (this.expandedWrapper) {
          if (this.originalParent) {
            this.originalParent.appendChild(this.view.dom);
          }
          this.expandedWrapper.remove();
          this.expandedWrapper = null;
        } else if (this.originalParent) {
          // Fallback if wrapper wasn't created
          this.originalParent.appendChild(this.view.dom);
        }
  
        // Remove the overlay
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
  
        this.restoreOriginalStyles();
        setIcon(button, "maximize");
        button.setAttribute('aria-label', 'Expand editor');
        document.body.classList.remove('cm-no-scroll');
  
        requestAnimationFrame(() => {
          this.isTransitioning = false;
          this.debouncedRequestMeasure();
        });
      });
    }
  
    this.isExpanded = !this.isExpanded;
  }

  private preventCollapse(e: MouseEvent): void {
    // We stop the event from bubbling up to prevent the collapse.
    e.stopPropagation();
    

  }

  private debouncedRequestMeasure(): void {
    if (this.measureTimeout) {
      clearTimeout(this.measureTimeout);
    }
    
    this.measureTimeout = window.setTimeout(() => {
      if (!this.isTransitioning) {
        this.view.requestMeasure();
      }
    }, 100); // Debounce to 100ms
  }

  private createExpandKeymap(): Extension {
    return keymap.of([
      {
        key: "Escape",
        preventDefault: true,
        stopPropagation: true,
        run: () => {
          if (this.isExpanded) {
            this.toggleExpanded();
            return true;
          }
          return false;
        }
      },
      {
        key: "F11",
        preventDefault: true,
        run: () => {
          this.toggleExpanded();
          return true;
        }
      },
      {
        key: "Mod-/",
        preventDefault: true,
        run: toggleComment
      }
    ]);
  }
}