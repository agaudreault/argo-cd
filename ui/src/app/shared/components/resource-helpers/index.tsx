import {models} from 'argo-ui';
import * as React from 'react';
import * as moment from 'moment';
import {fromEvent, Observable, Observer, Subscription} from 'rxjs';
import {debounceTime} from 'rxjs/operators';

import * as appModels from '../../models';
import {isValidManagedByURL} from '../../utils';
import {ComparisonStatusIcon, HealthStatusIcon, isApp, SpinningIcon} from '../app-utils';
import {getApplicationParentRef, getAppSetHealthStatus, isAppNode, isAppSetNode} from '../../applications/utils';

// Kind-agnostic resource presentation/util helpers shared by the Application and
// ApplicationSet detail views. These intentionally avoid any app-specific action
// logic (delete/sync/menus) so that shared/components/resource/* can depend on them
// without pulling in the applications module.

// Re-export shared icon/type-guard helpers so resource components have a single import site.
export {ComparisonStatusIcon, HealthStatusIcon, isApp, getApplicationParentRef, getAppSetHealthStatus, isAppNode, isAppSetNode};

export interface NodeId {
    kind: string;
    namespace: string;
    name: string;
    group: string;
    createdAt?: models.Time;
}

export function nodeKey(node: NodeId) {
    return [node.group, node.kind, node.namespace, node.name].join('/');
}

// Convert ResourceStatus to ResourceNode for orphaned resources
export function resourceStatusToResourceNode(res: appModels.ResourceStatus): appModels.ResourceNode {
    return {
        kind: res.kind,
        name: res.name,
        namespace: res.namespace,
        group: res.group,
        version: res.version,
        uid: `${res.group}/${res.kind}/${res.namespace}/${res.name}`,
        resourceVersion: '',
        createdAt: res.createdAt,
        parentRefs: [],
        info: []
    };
}

export function createdOrNodeKey(node: NodeId) {
    return node?.createdAt || nodeKey(node);
}

export function isSameNode(first: NodeId, second: NodeId) {
    return nodeKey(first) === nodeKey(second);
}

/**
 * Builds the class list for the Application (and ApplicationSet) details container.
 *
 * The per-application class is a styling hook that lets operators target a specific
 * application's page from custom CSS (see docs/operator-manual/custom-styles.md, added in #13279).
 * It is prefixed with `user-app-` so that an application whose name matches a built-in component
 * class cannot collide with that component's styles. For example, an application named `login`
 * previously rendered the class `application-details login`, which pulled in the login page's
 * `.login` styles and broke the page (issue #24220).
 */
export function getApplicationDetailsContainerClass(appName: string): string {
    return `application-details user-app-${appName}`;
}

export const PodHealthIcon = ({state}: {state: appModels.HealthStatus}) => {
    let icon = 'fa-question-circle';

    switch (state.status) {
        case appModels.HealthStatuses.Healthy:
            icon = 'fa-check';
            break;
        case appModels.HealthStatuses.Suspended:
            icon = 'fa-check';
            break;
        case appModels.HealthStatuses.Degraded:
            icon = 'fa-times';
            break;
        case appModels.HealthStatuses.Progressing:
            icon = 'fa fa-circle-notch fa-spin';
            break;
    }
    let title: string = state.status;
    if (state.message) {
        title = `${state.status}: ${state.message}`;
    }
    return icon.includes('fa-spin') ? (
        <SpinningIcon color={'white'} qeId='utils-health-status-title' />
    ) : (
        <i qe-id='utils-health-status-title' title={title} className={'fa ' + icon} />
    );
};

function isPodInitializedConditionTrue(status: any): boolean {
    if (!status?.conditions) {
        return false;
    }

    for (const condition of status.conditions) {
        if (condition.type !== 'Initialized') {
            continue;
        }
        return condition.status === 'True';
    }

    return false;
}

// isPodPhaseTerminal returns true if the pod's phase is terminal.
function isPodPhaseTerminal(phase: appModels.PodPhase): boolean {
    return phase === appModels.PodPhase.PodFailed || phase === appModels.PodPhase.PodSucceeded;
}

export function getPodStateReason(pod: appModels.State): {message: string; reason: string; netContainerStatuses: any[]} {
    if (!pod.status) {
        return {reason: 'Unknown', message: '', netContainerStatuses: []};
    }

    const podPhase = pod.status.phase;
    let reason = podPhase;
    let message = '';
    if (pod.status.reason) {
        reason = pod.status.reason;
    }

    let netContainerStatuses = pod.status.initContainerStatuses || [];
    netContainerStatuses = netContainerStatuses.concat(pod.status.containerStatuses || []);

    for (const condition of pod.status.conditions || []) {
        if (condition.type === 'PodScheduled' && condition.reason === 'SchedulingGated') {
            reason = 'SchedulingGated';
        }
    }

    const initContainers: Record<string, any> = {};

    for (const container of pod.spec.initContainers ?? []) {
        initContainers[container.name] = container;
    }

    let initializing = false;
    const initContainerStatuses = pod.status.initContainerStatuses || [];
    for (let i = 0; i < initContainerStatuses.length; i++) {
        const container = initContainerStatuses[i];
        if (container.state.terminated && container.state.terminated.exitCode === 0) {
            continue;
        }

        if (container.started && initContainers[container.name].restartPolicy === 'Always') {
            continue;
        }

        if (container.state.terminated) {
            if (container.state.terminated.reason) {
                reason = `Init:ExitCode:${container.state.terminated.exitCode}`;
            } else {
                reason = `Init:${container.state.terminated.reason}`;
                message = container.state.terminated.message;
            }
        } else if (container.state.waiting && container.state.waiting.reason && container.state.waiting.reason !== 'PodInitializing') {
            reason = `Init:${container.state.waiting.reason}`;
            message = `Init:${container.state.waiting.message}`;
        } else {
            reason = `Init:${i}/${(pod.spec.initContainers || []).length}`;
        }
        initializing = true;
        break;
    }

    if (!initializing || isPodInitializedConditionTrue(pod.status)) {
        let hasRunning = false;
        for (const container of pod.status.containerStatuses || []) {
            if (container.state.waiting && container.state.waiting.reason) {
                reason = container.state.waiting.reason;
                message = container.state.waiting.message;
            } else if (container.state.terminated && container.state.terminated.reason) {
                reason = container.state.terminated.reason;
                message = container.state.terminated.message;
            } else if (container.state.terminated && !container.state.terminated.reason) {
                if (container.state.terminated.signal !== 0) {
                    reason = `Signal:${container.state.terminated.signal}`;
                    message = '';
                } else {
                    reason = `ExitCode:${container.state.terminated.exitCode}`;
                    message = '';
                }
            } else if (container.ready && container.state.running) {
                hasRunning = true;
            }
        }

        // change pod status back to 'Running' if there is at least one container still reporting as 'Running' status
        if (reason === 'Completed' && hasRunning) {
            reason = 'Running';
            message = '';
        }
    }

    if ((pod as any).metadata.deletionTimestamp && pod.status.reason === 'NodeLost') {
        reason = 'Unknown';
        message = '';
    } else if ((pod as any).metadata.deletionTimestamp && !isPodPhaseTerminal(podPhase)) {
        reason = 'Terminating';
        message = '';
    }

    return {reason, message, netContainerStatuses};
}

export const getPodReadinessGatesState = (pod: appModels.State): {nonExistingConditions: string[]; notPassedConditions: string[]} => {
    // if pod does not have readiness gates then return empty status
    if (!pod.spec?.readinessGates?.length) {
        return {
            nonExistingConditions: [],
            notPassedConditions: []
        };
    }

    const existingConditions = new Map<string, boolean>();
    const podConditions = new Map<string, boolean>();

    const podStatusConditions = pod.status?.conditions || [];

    for (const condition of podStatusConditions) {
        existingConditions.set(condition.type, true);
        // priority order of conditions
        // e.g. if there are multiple conditions set with same name then the one which comes first is evaluated
        if (podConditions.has(condition.type)) {
            continue;
        }

        if (condition.status === 'False') {
            podConditions.set(condition.type, false);
        } else if (condition.status === 'True') {
            podConditions.set(condition.type, true);
        }
    }

    const nonExistingConditions: string[] = [];
    const failedConditions: string[] = [];

    const readinessGates: appModels.ReadinessGate[] = pod.spec?.readinessGates || [];

    for (const readinessGate of readinessGates) {
        if (!existingConditions.has(readinessGate.conditionType)) {
            nonExistingConditions.push(readinessGate.conditionType);
        } else if (podConditions.get(readinessGate.conditionType) === false) {
            failedConditions.push(readinessGate.conditionType);
        }
    }

    return {
        nonExistingConditions,
        notPassedConditions: failedConditions
    };
};

export function isYoungerThanXMinutes(pod: any, x: number): boolean {
    const createdAt = moment(pod.createdAt, 'YYYY-MM-DDTHH:mm:ssZ');
    const xMinutesAgo = moment().subtract(x, 'minutes');
    return createdAt.isAfter(xMinutesAgo);
}

export const BASE_COLORS = [
    '#0DADEA', // blue
    '#DE7EAE', // pink
    '#FF9500', // orange
    '#4B0082', // purple
    '#F5d905', // yellow
    '#964B00' // brown
];

export const selectPostfix = (arr: string[], singular: string, plural: string) => (arr.length > 1 ? plural : singular);

export const userMsgsList: {[key: string]: string} = {
    groupNodes: `Since the number of pods has surpassed the threshold pod count of 15, you will now be switched to the group node view.
                 If you prefer the tree view, you can simply click on the Group Nodes toolbar button to deselect the current view.`
};

/**
 * Automatically stops and restarts the given observable when page visibility changes.
 */
export function handlePageVisibility<T>(src: () => Observable<T>): Observable<T> {
    return new Observable<T>((observer: Observer<T>) => {
        let subscription: Subscription;
        const ensureUnsubscribed = () => {
            if (subscription) {
                subscription.unsubscribe();
                subscription = null;
            }
        };
        const start = () => {
            ensureUnsubscribed();
            subscription = src().subscribe(
                (item: T) => observer.next(item),
                err => observer.error(err),
                () => observer.complete()
            );
        };

        if (!document.hidden) {
            start();
        }

        const visibilityChangeSubscription = fromEvent(document, 'visibilitychange')
            // wait until user stop clicking back and forth to avoid restarting observable too often
            .pipe(debounceTime(500))
            .subscribe(() => {
                if (document.hidden && subscription) {
                    ensureUnsubscribed();
                } else if (!document.hidden && !subscription) {
                    start();
                }
            });

        return () => {
            visibilityChangeSubscription.unsubscribe();
            ensureUnsubscribed();
        };
    });
}

export function getAppUrl(app: appModels.AbstractApplication): string {
    const basePath = isApp(app) ? 'applications' : 'applicationsets';
    if (typeof app.metadata.namespace === 'undefined') {
        return `${basePath}/${app.metadata.name}`;
    }
    return `${basePath}/${app.metadata.namespace}/${app.metadata.name}`;
}

export function formatCreationTimestamp(creationTimestamp: string) {
    const createdAt = moment.utc(creationTimestamp).local().format('MM/DD/YYYY HH:mm:ss');
    const fromNow = moment.utc(creationTimestamp).local().fromNow();
    return (
        <span>
            {createdAt}
            <i style={{padding: '2px'}} /> ({fromNow})
        </span>
    );
}

export function getUsrMsgKeyToDisplay(appName: string, msgKey: string, usrMessages: appModels.UserMessages[]) {
    const usrMsg = usrMessages?.find((msg: appModels.UserMessages) => msg.appName === appName && msg.msgKey === msgKey);
    if (usrMsg !== undefined) {
        return {...usrMsg, display: true};
    } else {
        return {appName, msgKey, display: false, duration: 1} as appModels.UserMessages;
    }
}

/**
 * Gets the managed-by-url annotation from an application if it exists
 * @param app The application object
 * @returns The managed-by-url value or null if not present
 */
export function getManagedByURL(app: any): string | null {
    return app?.metadata?.annotations?.['argocd.argoproj.io/managed-by-url'] || null;
}

/**
 * Gets the managed-by-url from a resource node's info field
 * @param node The resource node object
 * @returns The managed-by-url value or null if not present
 */
export function getManagedByURLFromNode(node: any): string | null {
    if (!node?.info) {
        return null;
    }

    const managedByURLInfo = node.info.find((info: any) => info.name === 'managed-by-url');
    return managedByURLInfo?.value || null;
}

/**
 * Gets the correct URL for an application link from a resource node, considering managed-by-url annotation
 * @param node The resource node representing an application
 * @param baseHref The current instance's base href
 * @returns The URL to use for the application link
 */
export function getApplicationLinkURLFromNode(node: any, baseHref: string): {url: string; isExternal: boolean} {
    const managedByURL = getManagedByURLFromNode(node);

    let url, isExternal;
    if (managedByURL) {
        // Validate the managed-by URL using the same validation as external links
        if (!isValidManagedByURL(managedByURL)) {
            // If URL is invalid, fall back to local URL for security
            console.warn(`Invalid managed-by URL for application ${node.name}: ${managedByURL}`);
            url = baseHref + 'applications/' + node.namespace + '/' + node.name;
            isExternal = false;
        } else {
            url = managedByURL + '/applications/' + node.namespace + '/' + node.name;
            isExternal = true;
        }
    } else {
        url = baseHref + 'applications/' + node.namespace + '/' + node.name;
        isExternal = false;
    }
    return {url, isExternal};
}

export function formatResourceInfo(name: string, value: string): {displayValue: string; tooltipValue: string} {
    const numValue = parseInt(value, 10);

    const formatCPUValue = (milliCpu: number): string => {
        return milliCpu >= 1000 ? `${(milliCpu / 1000).toFixed(1)}` : `${milliCpu}m`;
    };

    const formatMemoryValue = (milliBytes: number): string => {
        const mib = Math.round(milliBytes / (1024 * 1024 * 1000));
        return `${mib}Mi`;
    };

    const formatCPUTooltip = (milliCpu: number): string => {
        const displayValue = milliCpu >= 1000 ? `${(milliCpu / 1000).toFixed(1)} cores` : `${milliCpu}m`;
        return `CPU Request: ${displayValue}`;
    };

    const formatMemoryTooltip = (milliBytes: number): string => {
        const mib = Math.round(milliBytes / (1024 * 1024 * 1000));
        return `Memory Request: ${mib}Mi`;
    };

    if (name === 'cpu') {
        return {
            displayValue: formatCPUValue(numValue),
            tooltipValue: formatCPUTooltip(numValue)
        };
    } else if (name === 'memory') {
        return {
            displayValue: formatMemoryValue(numValue),
            tooltipValue: formatMemoryTooltip(numValue)
        };
    }

    return {
        displayValue: value,
        tooltipValue: `${name}: ${value}`
    };
}

export function getHydratorSyncSourceRepoURL(sourceHydrator?: appModels.SourceHydrator): string {
    return sourceHydrator?.syncSource?.repoURL || sourceHydrator?.drySource?.repoURL || '';
}

export function getAppHydratorSyncSource(sourceHydrator?: appModels.SourceHydrator): appModels.ApplicationSource {
    return {
        repoURL: getHydratorSyncSourceRepoURL(sourceHydrator),
        targetRevision: sourceHydrator?.syncSource?.targetBranch || '',
        path: sourceHydrator?.syncSource?.path || ''
    };
}

export function getAppSpecDefaultSource(spec: appModels.ApplicationSpec) {
    if (spec.sourceHydrator) {
        return getAppHydratorSyncSource(spec.sourceHydrator);
    }
    return spec.sources && spec.sources.length > 0 ? spec.sources[0] : spec.source;
}

// getAppDefaultSource gets the first app source from `sources` or, if that list is missing or empty, the `source`
// field.
export function getAppDefaultSource(app?: appModels.Application) {
    if (!app) {
        return null;
    }
    return getAppSpecDefaultSource(app.spec);
}

export function getAppOverridesCount(app: appModels.AbstractApplication) {
    // ApplicationSets don't have overrides
    if (!isApp(app)) {
        return 0;
    }
    const source = getAppDefaultSource(app);
    if (source?.kustomize?.images) {
        return source.kustomize.images.length;
    }
    if (source?.helm?.parameters) {
        return source.helm.parameters.length;
    }
    return 0;
}
