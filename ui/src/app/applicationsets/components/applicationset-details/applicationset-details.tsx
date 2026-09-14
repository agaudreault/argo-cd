import {NotificationType, SlidingPanel} from 'argo-ui';
import * as React from 'react';
import {FC, useCallback, useContext, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {map} from 'rxjs/operators';

import {DataLoader, EmptyState, ObservableQuery, Page, Paginate} from '../../../shared/components';
import {AppContext, AuthSettingsCtx, Context} from '../../../shared/context';
import * as appModels from '../../../shared/models';
import {AppDetailsPreferences, AppsDetailsViewKey, AppsDetailsViewType, services} from '../../../shared/services';

import {ApplicationResourceTree, type ResourceTreeNode} from '../../../applications/components/application-resource-tree/application-resource-tree';
import {ApplicationResourceList, ApplicationResourceParentRef} from '../../../applications/components/application-details/application-resource-list';
import {ApplicationsDetailsAppDropdown} from '../../../applications/components/application-details/application-details-app-dropdown';
import {getEffectiveResourceFilter} from '../../../applications/components/application-details/application-resource-filter';
import {
    APPLICATION_DETAILS_SORT_KEY,
    ApplicationResourceSortKey,
    compareApplicationResource,
    GROUPED_NODES_DETAILS_SORT_KEY
} from '../../../applications/components/application-details/application-resource-sort';
import {ResourceDetails} from '../../../applications/components/resource-details/resource-details';
import * as AppUtils from '../../../applications/components/utils';
import {getApplicationDetailsContainerClass} from '../../../applications/components/utils';
import {useListSort} from '../../../shared/hooks/use-list-sort';
import {ApplicationDetailsFilters, filterTreeNode, getTreeFilter, loadApplicationInfo, NodeInfo, ResourceTreeToolbar, SelectNode} from '../../../shared/applications/details';

import {ApplicationSetConditions} from '../applicationset-conditions/applicationset-conditions';
import {ApplicationSetStatusPanel} from '../applicationset-status-panel/appset-status-panel';
import {AppSetResourceDetails} from '../resource-details/appset-resource-details';

interface ApplicationSetDetailsState {
    page: number;
    groupedResourceIds: string[];
    slidingPanelPage: number;
    truncateNameOnRight: boolean;
    showFullNodeName: boolean;
    collapsedNodes: string[];
}

const OBJECT_LIST_KIND = 'applicationset';

// ApplicationSetDetails is the ApplicationSet-kind details view. It composes the
// shared details building blocks (data loading, resource tree, filters, toolbar,
// sliding panels) rather than branching a shared shell on the object kind.
export const ApplicationSetDetails: FC<RouteComponentProps<{appnamespace: string; name: string}>> = props => {
    const appContext = useContext(Context);
    const authSettings = useContext(AuthSettingsCtx);
    const appLabelKey = authSettings?.appLabelKey;
    const trackingMethod = authSettings?.trackingMethod;
    const [appChanged] = useState(() => new BehaviorSubject<appModels.AbstractApplication>(null));

    const [state, setState] = useState<ApplicationSetDetailsState>(() => ({
        page: 0,
        groupedResourceIds: [],
        slidingPanelPage: 0,
        truncateNameOnRight: false,
        showFullNodeName: false,
        collapsedNodes: []
    }));

    const resourceSort = useListSort<ApplicationResourceSortKey>('createdAt', false);
    const groupedResourceSort = useListSort<ApplicationResourceSortKey>('createdAt', false);
    const sortResources = (resources: appModels.ResourceStatus[], sort: ReturnType<typeof useListSort<ApplicationResourceSortKey>>) =>
        [...resources].sort((a, b) => sort.dir * compareApplicationResource(a, b, sort.sortKey));

    const getAppNamespace = useCallback(() => props.match.params.appnamespace || '', [props.match.params.appnamespace]);

    const search = new URLSearchParams(props.history.location.search);
    const showConditions = search.get('conditions') === 'true';
    const selectedNodeKey = NodeInfo(search.get('node')).key;
    const highlightNodeKey = NodeInfo(search.get('highlight')).key;

    const selectNode = useCallback((fullName: string, containerIndex = 0, tab: string = null) => SelectNode(fullName, containerIndex, tab, appContext), [appContext]);

    const setConditionsStatusVisible = useCallback((isVisible: boolean) => appContext.navigation.goto('.', {conditions: isVisible}, {replace: true}), [appContext]);

    const setNodeExpansion = useCallback((node: string, isExpanded: boolean) => {
        setState(prevState => {
            const index = prevState.collapsedNodes.indexOf(node);
            const updatedNodes = [...prevState.collapsedNodes];
            if (isExpanded && index >= 0) {
                updatedNodes.splice(index, 1);
            } else if (!isExpanded && index < 0) {
                updatedNodes.push(node);
            }
            return {...prevState, collapsedNodes: updatedNodes};
        });
    }, []);

    const getNodeExpansion = useCallback((node: string): boolean => state.collapsedNodes.indexOf(node) < 0, [state.collapsedNodes]);

    const closeGroupedNodesPanel = useCallback(() => setState(prevState => ({...prevState, groupedResourceIds: [], slidingPanelPage: 0})), []);

    const onAppDeleted = useCallback(() => {
        appContext.notifications.show({type: NotificationType.Success, content: `ApplicationSet '${props.match.params.name}' was deleted`});
        appContext.navigation.goto('/applicationsets');
    }, [appContext, props.match.params.name]);

    const loadAppInfo = useCallback(
        (name: string, appNamespace: string) => loadApplicationInfo(name, appNamespace, OBJECT_LIST_KIND, appChanged, onAppDeleted),
        [onAppDeleted, appChanged]
    );

    const updateApp = useCallback(
        async (app: appModels.Application, query: {validate?: boolean}) => {
            const latestApp = await services.applications.get(app.metadata.name, app.metadata.namespace, OBJECT_LIST_KIND);
            latestApp.metadata.labels = app.metadata.labels;
            latestApp.metadata.annotations = app.metadata.annotations;
            latestApp.spec = app.spec;
            const updatedApp = await services.applications.update(latestApp, query);
            appChanged.next(updatedApp);
        },
        [appChanged]
    );

    const getPageTitle = (view: string) => {
        const {Tree, List} = AppsDetailsViewKey;
        switch (view) {
            case Tree:
                return 'ApplicationSet Details Tree';
            case List:
                return 'ApplicationSet Details List';
        }
        return '';
    };

    return (
        <ObservableQuery>
            {q => (
                <DataLoader
                    errorRenderer={error => <Page title='ApplicationSet Details'>{error}</Page>}
                    loadingRenderer={() => <Page title='ApplicationSet Details'>Loading...</Page>}
                    input={props.match.params.name}
                    load={name =>
                        combineLatest([loadAppInfo(name, getAppNamespace()), services.viewPreferences.getPreferences(), q]).pipe(
                            map(items => {
                                const pref = items[1].appDetails;
                                const params = items[2];
                                if (params.get('resource') != null) {
                                    pref.resourceFilter = params
                                        .get('resource')
                                        .split(',')
                                        .filter(item => !!item);
                                }
                                if (params.get('view') != null) {
                                    pref.view = params.get('view') as AppsDetailsViewType;
                                }
                                return {...items[0], pref};
                            })
                        )
                    }>
                    {({application, tree, pref}: {application: appModels.ApplicationSet; tree: appModels.ApplicationTree; pref: AppDetailsPreferences}) => {
                        tree.nodes = tree.nodes || [];
                        const {Tree, List} = AppsDetailsViewKey;
                        const effectiveResourceFilter = getEffectiveResourceFilter(false, pref.resourceFilter);
                        const treeFilter = getTreeFilter(effectiveResourceFilter);
                        const setFilter = (items: string[]) => {
                            appContext.navigation.goto('.', {resource: items.join(',')}, {replace: true});
                            services.viewPreferences.updatePreferences({appDetails: {...pref, resourceFilter: items}});
                        };
                        const clearFilter = () => setFilter([]);
                        const refreshing = application.metadata.annotations && application.metadata.annotations[appModels.AnnotationRefreshKey];

                        const appSetFullName = AppUtils.nodeKey({
                            group: 'argoproj.io',
                            kind: application.kind,
                            name: application.metadata.name,
                            namespace: application.metadata.namespace
                        });
                        const appNodesByName = new Map<string, appModels.AbstractApplication | appModels.ResourceNode>();
                        appNodesByName.set(appSetFullName, application);
                        tree.nodes.forEach(node => appNodesByName.set(AppUtils.nodeKey(node), node));

                        const selectedItem = (selectedNodeKey && appNodesByName.get(selectedNodeKey)) || null;
                        const isAppSelected = selectedItem === application;
                        const selectedNode = !isAppSelected && (selectedItem as appModels.ResourceNode);
                        const conditions = application.status?.conditions || [];
                        const showToolTip = pref?.userHelpTipMsgs.find(usrMsg => usrMsg.appName === application.metadata.name);

                        const allResources: any[] = tree.nodes.map(node => ({...node, orphaned: false}));
                        const filteredRes = allResources.filter(res => {
                            const resNode: ResourceTreeNode = {...res, root: null, info: null, parentRefs: [], resourceVersion: '', uid: ''};
                            resNode.root = resNode;
                            return filterTreeNode(resNode, treeFilter);
                        });
                        const groupedResources = state.groupedResourceIds?.length
                            ? allResources.filter(res => state.groupedResourceIds.includes(res.uid) || state.groupedResourceIds.includes(AppUtils.nodeKey(res)))
                            : [];
                        const openGroupNodeDetails = (groupedNodeIds: string[]) =>
                            setState(prevState => ({...prevState, groupedResourceIds: groupedNodeIds || [], slidingPanelPage: 0}));

                        const setZoom = (s: number) => {
                            let targetZoom = pref.zoom + s;
                            if (targetZoom <= 0.05) {
                                targetZoom = 0.1;
                            } else if (targetZoom > 2.0) {
                                targetZoom = 2.0;
                            }
                            services.viewPreferences.updatePreferences({appDetails: {...pref, zoom: targetZoom}});
                        };
                        const setShowCompactNodes = (showCompactView: boolean) => services.viewPreferences.updatePreferences({appDetails: {...pref, groupNodes: showCompactView}});
                        const updateHelpTipState = (usrHelpTip: appModels.UserMessages) => {
                            const existingIndex = pref.userHelpTipMsgs.findIndex(msg => msg.appName === usrHelpTip.appName && msg.msgKey === usrHelpTip.msgKey);
                            if (existingIndex !== -1) {
                                pref.userHelpTipMsgs[existingIndex] = usrHelpTip;
                            } else {
                                (pref.userHelpTipMsgs || []).push(usrHelpTip);
                            }
                        };
                        const toggleCompactView = () => {
                            pref.userHelpTipMsgs = pref.userHelpTipMsgs.map(usrMsg =>
                                usrMsg.appName === application.metadata.name && usrMsg.msgKey === 'groupNodes' ? {...usrMsg, display: true} : usrMsg
                            );
                            services.viewPreferences.updatePreferences({appDetails: {...pref, groupNodes: !pref.groupNodes}});
                        };
                        const toggleNodeName = () => setState(prevState => ({...prevState, showFullNodeName: !prevState.showFullNodeName}));
                        const toggleNameDirection = () => setState(prevState => ({...prevState, truncateNameOnRight: !prevState.truncateNameOnRight}));
                        const expandAll = () => setState(prevState => ({...prevState, collapsedNodes: []}));
                        const collapseAll = () => {
                            const collapsedNodesList = state.collapsedNodes.slice();
                            tree.nodes.forEach(node => {
                                if (!((node.parentRefs || []).length === 0)) {
                                    node.parentRefs.forEach(parent => {
                                        if (collapsedNodesList.indexOf(parent.uid) < 0) {
                                            collapsedNodesList.push(parent.uid);
                                        }
                                    });
                                }
                            });
                            collapsedNodesList.push(application.kind + '-' + application.metadata.namespace + '-' + application.metadata.name);
                            setState(prevState => ({...prevState, collapsedNodes: collapsedNodesList}));
                        };

                        const resourceTreeProps = {
                            nodeFilter: (node: ResourceTreeNode) => filterTreeNode(node, treeFilter),
                            selectedNodeFullName: highlightNodeKey,
                            showCompactNodes: pref.groupNodes,
                            userMsgs: pref.userHelpTipMsgs,
                            tree,
                            onClearFilter: clearFilter,
                            onGroupdNodeClick: (nodeIds: string[]) => openGroupNodeDetails(nodeIds),
                            zoom: pref.zoom,
                            appContext: {...appContext, apis: appContext} as unknown as AppContext,
                            nameDirection: state.truncateNameOnRight,
                            nameWrap: state.showFullNodeName,
                            updateUsrHelpTipMsgs: updateHelpTipState,
                            setShowCompactNodes,
                            setNodeExpansion,
                            getNodeExpansion,
                            onNodeClick: (fullName: string) => selectNode(fullName),
                            app: application,
                            showOrphanedResources: false,
                            showAppParent: pref.showAppParent,
                            appLabelKey,
                            trackingMethod,
                            useNetworkingHierarchy: false,
                            podGroupCount: 0
                        };

                        return (
                            <div className={getApplicationDetailsContainerClass(props.match.params.name)}>
                                <Page
                                    title={props.match.params.name + ' - ' + getPageTitle(pref.view)}
                                    useTitleOnly={true}
                                    topBarTitle={getPageTitle(pref.view)}
                                    toolbar={{
                                        breadcrumbs: [
                                            {title: 'ApplicationSets', path: '/applicationsets'},
                                            {title: <ApplicationsDetailsAppDropdown appName={props.match.params.name} objectListKind={OBJECT_LIST_KIND} />}
                                        ],
                                        actionMenu: {
                                            items: [
                                                {title: 'AppSet Details', iconClassName: 'fa fa-info-circle', action: () => selectNode(appSetFullName)},
                                                {title: 'Preview Apps', iconClassName: 'fa fa-eye', action: () => selectNode(appSetFullName, 0, 'preview')}
                                            ]
                                        },
                                        tools: (
                                            <React.Fragment key='appset-list-tools'>
                                                <div className='application-details__view-type'>
                                                    <i
                                                        className={pref.view === Tree ? 'fa fa-sitemap selected' : 'fa fa-sitemap'}
                                                        title='Tree'
                                                        onClick={() => {
                                                            appContext.navigation.goto('.', {view: Tree});
                                                            services.viewPreferences.updatePreferences({appDetails: {...pref, view: Tree}});
                                                        }}
                                                    />
                                                    <i
                                                        className={pref.view === List ? 'fa fa-th-list selected' : 'fa fa-th-list'}
                                                        title='List'
                                                        onClick={() => {
                                                            appContext.navigation.goto('.', {view: List});
                                                            services.viewPreferences.updatePreferences({appDetails: {...pref, view: List}});
                                                        }}
                                                    />
                                                </div>
                                            </React.Fragment>
                                        )
                                    }}>
                                    <div className='application-details__wrapper'>
                                        <div className='application-details__status-panel'>
                                            <ApplicationSetStatusPanel appSet={application} showConditions={() => setConditionsStatusVisible(true)} />
                                        </div>
                                        <div className='application-details__tree'>
                                            {refreshing && <p className='application-details__refreshing-label'>Refreshing</p>}
                                            {(pref.view === 'tree' && (
                                                <>
                                                    <DataLoader load={() => services.viewPreferences.getPreferences()}>
                                                        {viewPref => (
                                                            <ApplicationDetailsFilters
                                                                pref={pref}
                                                                tree={tree}
                                                                onSetFilter={setFilter}
                                                                onClearFilter={clearFilter}
                                                                collapsed={viewPref.hideSidebar}
                                                                resourceNodes={allResources}
                                                                hideKindFilter={true}
                                                            />
                                                        )}
                                                    </DataLoader>
                                                    <ResourceTreeToolbar
                                                        pref={pref}
                                                        application={application}
                                                        appLabelKey={appLabelKey}
                                                        trackingMethod={trackingMethod}
                                                        truncateNameOnRight={state.truncateNameOnRight}
                                                        showFullNodeName={state.showFullNodeName}
                                                        showToolTip={showToolTip}
                                                        onToggleNameDirection={toggleNameDirection}
                                                        onToggleNodeName={toggleNodeName}
                                                        onToggleCompactView={toggleCompactView}
                                                        onExpandAll={expandAll}
                                                        onCollapseAll={collapseAll}
                                                        onSetZoom={setZoom}
                                                        onToggleAppParent={() =>
                                                            services.viewPreferences.updatePreferences({appDetails: {...pref, showAppParent: !pref.showAppParent}})
                                                        }
                                                    />
                                                    <ApplicationResourceTree {...resourceTreeProps} />
                                                </>
                                            )) || (
                                                <div>
                                                    <DataLoader load={() => services.viewPreferences.getPreferences()}>
                                                        {viewPref => (
                                                            <ApplicationDetailsFilters
                                                                pref={pref}
                                                                tree={tree}
                                                                onSetFilter={setFilter}
                                                                onClearFilter={clearFilter}
                                                                collapsed={viewPref.hideSidebar}
                                                                resourceNodes={allResources}
                                                                hideKindFilter={true}
                                                            />
                                                        )}
                                                    </DataLoader>
                                                    {(filteredRes.length > 0 && (
                                                        <Paginate
                                                            key={highlightNodeKey || 'applicationset-resources'}
                                                            page={state.page}
                                                            data={sortResources(filteredRes, resourceSort)}
                                                            onPageChange={page => setState(prevState => ({...prevState, page}))}
                                                            preferencesKey={APPLICATION_DETAILS_SORT_KEY}
                                                            focusItemKey={highlightNodeKey || undefined}
                                                            getItemKey={res => AppUtils.nodeKey(res)}>
                                                            {data => (
                                                                <ApplicationResourceList
                                                                    pref={pref}
                                                                    onNodeClick={(fullName: string) => selectNode(fullName)}
                                                                    selectedNodeFullName={highlightNodeKey || undefined}
                                                                    sortKey={resourceSort.sortKey}
                                                                    requestSort={resourceSort.requestSort}
                                                                    sortIcon={resourceSort.sortIcon}
                                                                    resources={data}
                                                                    tree={tree}
                                                                />
                                                            )}
                                                        </Paginate>
                                                    )) || (
                                                        <EmptyState icon='fa fa-search'>
                                                            <h4>No resources found</h4>
                                                            <h5>Try to change filter criteria</h5>
                                                        </EmptyState>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <SlidingPanel isShown={groupedResources.length > 0} onClose={() => closeGroupedNodesPanel()}>
                                        <div className='application-details__sliding-panel-pagination-wrap'>
                                            {pref.view === 'tree' && <ApplicationResourceParentRef resources={groupedResources} tree={tree} />}
                                            <Paginate
                                                key={highlightNodeKey || 'grouped-resources'}
                                                page={state.slidingPanelPage}
                                                data={sortResources(groupedResources, groupedResourceSort)}
                                                onPageChange={page => setState(prevState => ({...prevState, slidingPanelPage: page}))}
                                                preferencesKey={GROUPED_NODES_DETAILS_SORT_KEY}
                                                focusItemKey={highlightNodeKey || undefined}
                                                getItemKey={res => AppUtils.nodeKey(res)}>
                                                {data => (
                                                    <ApplicationResourceList
                                                        pref={pref}
                                                        onNodeClick={fullName => selectNode(fullName)}
                                                        selectedNodeFullName={highlightNodeKey || undefined}
                                                        sortKey={groupedResourceSort.sortKey}
                                                        requestSort={groupedResourceSort.requestSort}
                                                        sortIcon={groupedResourceSort.sortIcon}
                                                        resources={data}
                                                        tree={tree}
                                                    />
                                                )}
                                            </Paginate>
                                        </div>
                                    </SlidingPanel>
                                    <SlidingPanel isShown={selectedNode != null || isAppSelected} onClose={() => selectNode('')}>
                                        {isAppSelected && <AppSetResourceDetails appSet={application} />}
                                        {!isAppSelected && selectedNode && (
                                            <ResourceDetails
                                                tree={tree}
                                                application={application as unknown as appModels.Application}
                                                isAppSelected={isAppSelected}
                                                updateApp={(app: appModels.Application, query: {validate?: boolean}) => updateApp(app, query)}
                                                selectedNode={selectedNode}
                                                appCxt={{...appContext, apis: appContext} as unknown as AppContext}
                                                appChanged={appChanged}
                                                readOnlyGeneratedApplication={true}
                                            />
                                        )}
                                    </SlidingPanel>
                                    <SlidingPanel isShown={showConditions && !!conditions} onClose={() => setConditionsStatusVisible(false)}>
                                        {conditions && <ApplicationSetConditions conditions={conditions as appModels.ApplicationSetCondition[]} />}
                                    </SlidingPanel>
                                </Page>
                            </div>
                        );
                    }}
                </DataLoader>
            )}
        </ObservableQuery>
    );
};
