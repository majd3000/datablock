import { DataBlockConfig } from "src/types";

export function convertLegacyConfig(config: any): DataBlockConfig {
    const newConfig = { ...config };

    // This function is no longer needed as the new config is now the default

    if (newConfig.buttons) {
        newConfig.buttons = newConfig.buttons.map((button: any) => {
            if (button.text) {
                const newButton: any = {
                    text: button.text,
                    action: button.action,
                    inline: button.inline
                };

                // For backwards compatibility
                if (button.path) {
                    newButton.action = button.path;
                }
                return newButton;
            }
            return button;
        });
    }

    return newConfig;
}