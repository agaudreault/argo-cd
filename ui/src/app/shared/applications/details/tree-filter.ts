import {ContextApis} from '../../../shared/context';
import {ResourceTreeNode} from '../../../applications/components/application-resource-tree/application-resource-tree';

// Shared node/URL and tree-filtering helpers used by both the Application and
// ApplicationSet detail views. These are pure functions (no kind branching) so
// each view can compose them without duplicating the logic.

export interface FilterInput {
    name: string[];
    kind: string[];
    health: string[];
    sync: string[];
    namespace: string[];
}

export const NodeInfo = (node?: string): {key: string; container: number} => {
    const nodeContainer = {key: '', container: 0};
    if (node) {
        const parts = node.split('/');
        nodeContainer.key = parts.slice(0, 4).join('/');
        nodeContainer.container = parseInt(parts[4] || '0', 10);
    }
    return nodeContainer;
};

export const SelectNode = (fullName: string, containerIndex = 0, tab: string = null, appContext: ContextApis) => {
    const node = fullName ? `${fullName}/${containerIndex}` : null;
    // Clear the deep-link highlight only when the highlighted node itself is selected.
    // Selecting any other node keeps the highlight so the deep-linked resource stays marked.
    const highlightKey = NodeInfo(new URLSearchParams(window.location.search).get('highlight')).key;
    const clearHighlight = Boolean(fullName) && highlightKey === fullName;
    appContext.navigation.goto('.', clearHighlight ? {node, tab, highlight: null} : {node, tab}, {replace: true});
};

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nodeNameMatchesWildcardFilters = (nodeName: string, filterInputNames: string[]): boolean => {
    const regularExpression = new RegExp(
        filterInputNames
            // Escape any regex input to ensure only * can be used
            .map(pattern => '^' + escapeRegex(pattern) + '$')
            // Replace any escaped * with proper regex
            .map(pattern => pattern.replace(/\\\*/g, '.*'))
            // Join all filterInputs to a single regular expression
            .join('|'),
        'gi'
    );
    return regularExpression.test(nodeName);
};

export const getTreeFilter = (filterInput: string[]): FilterInput => {
    const name = new Array<string>();
    const kind = new Array<string>();
    const health = new Array<string>();
    const sync = new Array<string>();
    const namespace = new Array<string>();
    for (const item of filterInput || []) {
        const [type, val] = item.split(':');
        switch (type) {
            case 'name':
                name.push(val);
                break;
            case 'kind':
                kind.push(val);
                break;
            case 'health':
                health.push(val);
                break;
            case 'sync':
                sync.push(val);
                break;
            case 'namespace':
                namespace.push(val);
                break;
        }
    }
    return {kind, health, sync, namespace, name};
};

export const filterTreeNode = (node: ResourceTreeNode, filterInput: FilterInput): boolean => {
    const syncStatuses = filterInput.sync.map(item => (item === 'OutOfSync' ? ['OutOfSync', 'Unknown'] : [item])).reduce((first, second) => first.concat(second), []);

    const root = node.root || ({} as ResourceTreeNode);
    const hook = root && root.hook;
    return (
        (filterInput.name.length === 0 || nodeNameMatchesWildcardFilters(node.name, filterInput.name)) &&
        (filterInput.kind.length === 0 || filterInput.kind.indexOf(node.kind) > -1) &&
        // include if node's root sync matches filter
        (syncStatuses.length === 0 || hook || (root.status && syncStatuses.indexOf(root.status) > -1)) &&
        // include if node or node's root health matches filter
        (filterInput.health.length === 0 ||
            hook ||
            (root.health && filterInput.health.indexOf(root.health.status) > -1) ||
            (node.health && filterInput.health.indexOf(node.health.status) > -1)) &&
        (filterInput.namespace.length === 0 || filterInput.namespace.includes(node.namespace))
    );
};
