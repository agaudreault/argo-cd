import {Tooltip} from 'argo-ui';
import classNames from 'classnames';
import * as React from 'react';

import * as appModels from '../../../shared/models';
import * as models from '../../../shared/models';
import {AppDetailsPreferences} from '../../../shared/services';
import * as AppUtils from '../../../applications/components/utils';

export interface ResourceTreeToolbarProps {
    pref: AppDetailsPreferences;
    application: appModels.AbstractApplication;
    appLabelKey: string;
    trackingMethod: string;
    truncateNameOnRight: boolean;
    showFullNodeName: boolean;
    showToolTip?: models.UserMessages;
    onToggleNameDirection: () => void;
    onToggleNodeName: () => void;
    onToggleCompactView: () => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onSetZoom: (delta: number) => void;
    onToggleAppParent: () => void;
}

// ResourceTreeToolbar renders the graph options panel (name direction/wrap,
// group nodes, show parent, expand/collapse, zoom) shown above the resource
// tree. It is kind-agnostic and shared by the Application and ApplicationSet views.
export const ResourceTreeToolbar = (props: ResourceTreeToolbarProps) => {
    const {pref, application, appLabelKey, trackingMethod, truncateNameOnRight, showFullNodeName, showToolTip} = props;
    const zoomNum = (pref.zoom * 100).toFixed(0);
    return (
        <div className='graph-options-panel'>
            <a
                className={`group-nodes-button`}
                onClick={() => props.onToggleNameDirection()}
                title={truncateNameOnRight ? 'Truncate resource name right' : 'Truncate resource name left'}>
                <i
                    className={classNames({
                        'fa fa-align-right': truncateNameOnRight,
                        'fa fa-align-left': !truncateNameOnRight
                    })}
                />
            </a>
            <a className={`group-nodes-button`} onClick={() => props.onToggleNodeName()} title={showFullNodeName ? 'Show wrapped resource name' : 'Show full resource name'}>
                <i
                    className={classNames({
                        'fa fa-expand': showFullNodeName,
                        'fa fa-compress': !showFullNodeName
                    })}
                />
            </a>
            {(pref.view === 'tree' || pref.view === 'network') && (
                <Tooltip
                    content={AppUtils.userMsgsList[showToolTip?.msgKey] || 'Group Nodes'}
                    visible={pref.groupNodes && showToolTip !== undefined && !showToolTip?.display}
                    duration={showToolTip?.duration}
                    zIndex={1}>
                    <a
                        className={`group-nodes-button group-nodes-button${!pref.groupNodes ? '' : '-on'}`}
                        title={pref.view === 'tree' ? 'Group Nodes' : 'Collapse Pods'}
                        onClick={() => props.onToggleCompactView()}>
                        <i className={classNames('fa fa-object-group fa-fw')} />
                    </a>
                </Tooltip>
            )}
            {!!AppUtils.getApplicationParentRef(application, appLabelKey, trackingMethod) && (
                <a
                    className={`group-nodes-button group-nodes-button${pref.showAppParent ? '-on' : ''}`}
                    title="Show application's parent node"
                    onClick={() => props.onToggleAppParent()}>
                    <i className='fa fa-sitemap fa-fw' />
                </a>
            )}
            <span className={`separator`} />
            <a className={`group-nodes-button`} onClick={() => props.onExpandAll()} title='Expand all child nodes of all parent nodes'>
                <i className='fa fa-plus fa-fw' />
            </a>
            <a className={`group-nodes-button`} onClick={() => props.onCollapseAll()} title='Collapse all child nodes of all parent nodes'>
                <i className='fa fa-minus fa-fw' />
            </a>
            <span className={`separator`} />
            <span>
                <a className={`group-nodes-button`} onClick={() => props.onSetZoom(0.1)} title='Zoom in'>
                    <i className='fa fa-search-plus fa-fw' />
                </a>
                <a className={`group-nodes-button`} onClick={() => props.onSetZoom(-0.1)} title='Zoom out'>
                    <i className='fa fa-search-minus fa-fw' />
                </a>
                <div className={`zoom-value`}>{zoomNum}%</div>
            </span>
        </div>
    );
};
