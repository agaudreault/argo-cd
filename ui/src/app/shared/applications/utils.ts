// Shared Application/ApplicationSet helpers. These are re-exported from a single
// place so both the applications and applicationsets modules depend on the same
// implementation instead of branching on kind at every call site.
import * as appModels from '../models';

export {isApp, getRootPathByApp, appQualifiedName, appInstanceName} from '../components/app-utils';

export function getAppSetConditionCategory(condition: appModels.ApplicationSetCondition): 'error' | 'warning' | 'info' {
    const status = condition.status?.toLowerCase();
    const type = condition.type;

    // ErrorOccurred with status True = error
    if (type === 'ErrorOccurred' && status === 'true') {
        return 'error';
    }
    // ParametersGenerated or ResourcesUpToDate with status False = error (indicates failure)
    if ((type === 'ParametersGenerated' || type === 'ResourcesUpToDate') && status === 'false') {
        return 'error';
    }
    // InvalidRolloutConfig with status True = warning
    if (type === 'InvalidRolloutConfig' && status === 'true') {
        return 'warning';
    }
    // Otherwise it's informational
    return 'info';
}

export function isAppNode(node: appModels.ResourceNode) {
    return node.kind === 'Application' && node.group === 'argoproj.io';
}

export function isAppSetNode(node: appModels.ResourceNode) {
    return node.kind === 'ApplicationSet' && node.group === 'argoproj.io';
}

export function getApplicationSetOwnerRef(application: appModels.Application) {
    return application.metadata.ownerReferences?.find(ref => ref.kind === 'ApplicationSet');
}

// Annotation set by the parent Application on resources it manages (resource tracking).
// Format: <parentAppName>:<group>/<kind>:<namespace>/<name>
export const AnnotationKeyAppInstance = 'argocd.argoproj.io/tracking-id';
// Default label used for resource tracking when the tracking method is `label`.
export const DefaultAppInstanceLabelKey = 'app.kubernetes.io/instance';
// TrackingMethodLabel is the only tracking method that identifies managed
// resources with the instance label instead of the tracking-id annotation.
export const TrackingMethodLabel = 'label';

// getAppOfAppsParentRef resolves the parent Application that manages this
// Application via the app-of-apps pattern. The source of truth is determined
// by the tracking method: the instance label is only consulted when the tracking
// method is `label`; otherwise the tracking-id annotation is used.
// When the parent lives in a non-default namespace its instance name is encoded
// as `<namespace>_<name>`, so the namespace is returned when present (and left
// undefined otherwise, so the caller can fall back to a default).
// Returns null when no parent can be determined or the parent refers to itself.
export function getAppOfAppsParentRef(application: appModels.AbstractApplication, appLabelKey?: string, trackingMethod?: string): {name: string; namespace?: string} | null {
    const metadata = application.metadata || ({} as appModels.AbstractApplication['metadata']);

    let instanceName = '';
    if (trackingMethod === TrackingMethodLabel) {
        const labelKey = appLabelKey || DefaultAppInstanceLabelKey;
        instanceName = metadata.labels?.[labelKey] || '';
    } else {
        // The instance name is the segment before the first colon of the tracking id.
        instanceName = metadata.annotations?.[AnnotationKeyAppInstance]?.split(':')[0] || '';
    }

    // The instance name is either `<name>` or, for apps in a non-default namespace, `<namespace>_<name>`.
    const underscoreIndex = instanceName.indexOf('_');
    const parentNamespace = underscoreIndex >= 0 ? instanceName.substring(0, underscoreIndex) : undefined;
    const parentName = underscoreIndex >= 0 ? instanceName.substring(underscoreIndex + 1) : instanceName;

    // Ignore missing or self-referential tracking metadata.
    if (!parentName || (parentName === metadata.name && (parentNamespace ?? metadata.namespace) === metadata.namespace)) {
        return null;
    }
    return {name: parentName, namespace: parentNamespace};
}

// getApplicationParentRef returns a unified reference to the Application's parent,
// which may be an ApplicationSet (via ownerReferences) or a parent Application
// (via the app-of-apps pattern). ApplicationSet ownership takes precedence.
export function getApplicationParentRef(
    application: appModels.AbstractApplication,
    appLabelKey?: string,
    trackingMethod?: string
): {name: string; namespace?: string; kind: 'ApplicationSet' | 'Application'} | null {
    // Only Applications carry an ApplicationSet owner reference; for an ApplicationSet this is always empty.
    // An ApplicationSet always lives in the same namespace as the Applications it generates.
    const appSetRef = getApplicationSetOwnerRef(application as appModels.Application);
    if (appSetRef) {
        return {name: appSetRef.name, namespace: application.metadata.namespace, kind: 'ApplicationSet'};
    }
    const appOfAppsRef = getAppOfAppsParentRef(application, appLabelKey, trackingMethod);
    if (appOfAppsRef) {
        // A bare instance name has no encoded namespace: leave it undefined so the parent resolves to the
        // control-plane namespace (namespace-less URL) rather than guessing the child's namespace.
        return {name: appOfAppsRef.name, namespace: appOfAppsRef.namespace, kind: 'Application'};
    }
    return null;
}

export function getAppSetHealthStatus(appSet: appModels.ApplicationSet): appModels.HealthStatusCode {
    const conditions = appSet.status?.conditions;
    if (!conditions || conditions.length === 0) {
        return 'Unknown';
    }

    // Check for errors first (indicates degraded state)
    const errorCondition = conditions.find(c => c.type === 'ErrorOccurred' && c.status === 'True');
    if (errorCondition) {
        return 'Degraded';
    }

    // Check if rollout is progressing
    const progressingCondition = conditions.find(c => c.type === 'RolloutProgressing' && c.status === 'True');
    if (progressingCondition) {
        return 'Progressing';
    }

    // Check if resources are up to date (healthy state)
    const upToDateCondition = conditions.find(c => c.type === 'ResourcesUpToDate' && c.status === 'True');
    if (upToDateCondition) {
        return 'Healthy';
    }

    return 'Unknown';
}

export function formatApplicationSetProgressiveSyncStep(step: string | undefined): string {
    if (step === '-1') {
        return 'Step: unmatched label';
    }
    return `Step: ${step ?? ''}`;
}
