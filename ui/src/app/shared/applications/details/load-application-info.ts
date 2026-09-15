import {BehaviorSubject, combineLatest, from, merge, Observable} from 'rxjs';
import {filter, map, mergeMap, repeat, retry} from 'rxjs/operators';

import * as appModels from '../../../shared/models';
import {services} from '../../../shared/services';
import {handlePageVisibility} from '../../components/resource-helpers';

// loadApplicationInfo streams the resource (Application or ApplicationSet) and its
// resource tree. The kind is a plain data argument to the services API, not a
// behavioural switch: the streaming logic is identical for both kinds.
export const loadApplicationInfo = (
    name: string,
    appNamespace: string,
    objectListKind: string,
    appChanged: BehaviorSubject<appModels.AbstractApplication>,
    onAppDeleted: () => void
): Observable<{application: appModels.AbstractApplication; tree: appModels.AbstractApplicationTree}> => {
    return from(services.applications.get(name, appNamespace, objectListKind))
        .pipe(
            mergeMap(app => {
                const fallbackTree = {
                    nodes:
                        app.status?.resources?.map((res: appModels.ResourceStatus) => ({
                            ...res,
                            parentRefs: [] as appModels.ResourceRef[],
                            info: [] as appModels.InfoItem[],
                            resourceVersion: '',
                            uid: ''
                        })) || [],
                    orphanedNodes: [] as appModels.ResourceNode[],
                    hosts: [] as appModels.Node[]
                } as appModels.ApplicationTree;
                return combineLatest(
                    merge(
                        from([app]),
                        appChanged.pipe(filter(item => !!item)),
                        handlePageVisibility(() =>
                            services.applications
                                .watch(objectListKind, {name, appNamespace})
                                .pipe(
                                    map(watchEvent => {
                                        if (watchEvent.type === 'DELETED') {
                                            onAppDeleted();
                                        }
                                        return watchEvent.application;
                                    })
                                )
                                .pipe(repeat())
                                .pipe(retry({delay: 500}))
                        )
                    ),
                    merge(
                        from([fallbackTree]),
                        services.applications.resourceTree(name, appNamespace, objectListKind).catch(() => fallbackTree),
                        handlePageVisibility(() =>
                            services.applications
                                .watchResourceTree(name, appNamespace, objectListKind)
                                .pipe(repeat())
                                .pipe(retry({delay: 500}))
                        )
                    )
                );
            })
        )
        .pipe(filter(([application, tree]) => !!application && !!tree))
        .pipe(map(([application, tree]) => ({application, tree})));
};
