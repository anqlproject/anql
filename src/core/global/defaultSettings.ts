export const APP_PATH = {
    DATABASE_FILE: "anql.db",
    ASSETS_DIR: "assets",
    CONFIG_FILE: "config.json",
    LOG_DIR: "logs",
}

export const DATABASE_PATH = {
    TRASH_PATH: "trash/",
    HOME_PATH: "home/"
}

export const DEFAULT_SETTINGS = {
    appearance: {
        theme: 'system',
        language: 'en'
    },
    editor: {
        codeThemeDark: 'dark-plus',
        codeThemeLight: 'light-plus',
        useBrackets: true,
        spellCheck: false,
        autoCorrect: false,
        autoCapitalize: false,
        autoComplete: false
    },
    sidebar: {
        variant: 'inset',
        collapsible: true
    },
    homePage: {
        viewMode: 'grid',
        sortBy: {
            field: 'created_at',
            direction: 'desc'
        }
    },
    leftPanel: {
        width: '16rem',
        open: true
    },
    privacy: {
        enableErrorLogging: true
    }
}

export const DEFAULT_HOME_VIEW = {
    viewMode: 'grid',
    sortBy: 'created_at'
};