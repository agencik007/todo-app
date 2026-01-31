// @ts-check

// Allows us to bring in the recommended core rules from eslint itself
const eslint = require("@eslint/js");

// Allows us to use the typed utility for our config, and to bring in the recommended rules for TypeScript projects from typescript-eslint
const tseslint = require("typescript-eslint");

// Allows us to bring in the recommended rules for Angular projects from angular-eslint
const angular = require("angular-eslint");

// Allows us to bring in the config that disables ESLint rules that might conflict with Prettier
const eslintConfigPrettier = require("eslint-config-prettier");

// Export our config array, which is composed together thanks to the typed utility function from typescript-eslint
module.exports = tseslint.config(
    {
        ignores: [
            // Ignoruj konkretyne foldery
            "**/node_modules/**",
            "**/dist/**",
            "**/coverage/**",

            // Ignoruj konkretyne pliki
            "**/*.spec.ts",
            "**/*.test.ts",

            // Ignoruj konkretne ścieżki
            "src/libs/generated-api/**",

            // Ignoruj pliki konfiguracyjne
            "eslint.config.js",
            "karma.conf.js",

            // Ignoruj pliki tymczasowe
            "**/tmp/**",
            "**/temp/**",

            // Ignoruj pliki buildów
            "**/build/**",

            // Ignoruj pliki środowiskowe
            "**/*.environment.ts",

            // Ignoruj konkretne rozszerzenia
            "**/*.json",
            "**/*.md",
            "**/.yarn",
            "**/.yarnrc",

            // angular-cache
            "**/.angular",
        ],
    },
    {
        // Everything in this config object targets our TypeScript files (Components, Directives, Pipes etc)
        files: ["**/*.ts"],
        extends: [
            // Apply the recommended core rules
            eslint.configs.recommended,
            // Apply the recommended TypeScript rules
            ...tseslint.configs.recommended,
            // Optionally apply stylistic rules from typescript-eslint that improve code consistency
            ...tseslint.configs.stylistic,
            // Apply the recommended Angular rules
            ...angular.configs.tsRecommended,
            // Add Prettier config last to disable conflicting rules
            eslintConfigPrettier,
        ],
        // Set the custom processor which will allow us to have our inline Component templates extracted
        // and treated as if they are HTML files (and therefore have the .html config below applied to them)
        processor: angular.processInlineTemplates,
        // Override specific rules for TypeScript files (these will take priority over the extended configs above)
        rules: {
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/consistent-type-definitions": "off",
            "@typescript-eslint/consistent-indexed-object-style": "off",
            "@angular-eslint/prefer-inject": ["off"],
        },
    },
    {
        // Everything in this config object targets our HTML files (external templates,
        // and inline templates as long as we have the `processor` set on our TypeScript config above)
        files: ["**/*.html"],
        extends: [
            // Apply the recommended Angular template rules
            ...angular.configs.templateRecommended,
            // Apply the Angular template rules which focus on accessibility of our apps
            ...angular.configs.templateAccessibility,
            // Add Prettier config last to disable conflicting rules
            eslintConfigPrettier,
        ],
        rules: {},
    },
);
