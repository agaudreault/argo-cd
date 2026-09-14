declare let SYSTEM_INFO: {version: string};
// suppress TS7016: Could not find a declaration file for module
declare module 'react-diff-view';
declare module 'unidiff';
// Style side-effect imports are handled by webpack loaders at build time; declare
// them so the TypeScript language server does not report TS2882 for scss/css imports.
declare module '*.scss';
declare module '*.css';
