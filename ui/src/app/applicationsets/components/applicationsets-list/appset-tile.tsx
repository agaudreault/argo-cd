import {Tooltip} from 'argo-ui';
import * as React from 'react';
import {ContextApis, AuthSettingsCtx} from '../../../shared/context';
import * as models from '../../../shared/models';
import {appInstanceName, appQualifiedName, HealthStatusIcon} from '../../../shared/components/app-utils';
import {formatCreationTimestamp, getAppListLink} from '../../../shared/components/resource-helpers';
import {isFavorite, toggleFavorite} from '../../../shared/components/filters';
import {getAppSetHealthStatus} from '../../../shared/applications/utils';
import {services} from '../../../shared/services';
import {ViewPreferences} from '../../../shared/services';

export interface AppSetTileProps {
    appSet: models.ApplicationSet;
    selected: boolean;
    pref: ViewPreferences;
    ctx: ContextApis;
    tileRef?: React.RefObject<HTMLDivElement>;
}

export const AppSetTile = ({appSet, selected, pref, ctx, tileRef}: AppSetTileProps) => {
    const useAuthSettingsCtx = React.useContext(AuthSettingsCtx);
    const favList = pref.appList.favoritesAppList || [];
    const isFav = isFavorite(favList, appSet);

    const healthStatus = getAppSetHealthStatus(appSet);

    // AppSet pages don't support the Application details `view` param, so the link is view-less.
    const appSetLink = getAppListLink(ctx, appSet);

    const handleFavoriteToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        services.viewPreferences.updatePreferences({appList: {...pref.appList, favoritesAppList: toggleFavorite(favList, appSet)}});
    };

    return (
        <div
            ref={tileRef}
            className={`argo-table-list__row applications-list__entry applications-list__entry--health-${healthStatus} ${selected ? 'applications-tiles__selected' : ''}`}>
            <a
                className='row applications-tiles__wrapper'
                href={appSetLink.href}
                onClick={appSetLink.onClick}
                draggable={false}
                aria-label={appQualifiedName(appSet, useAuthSettingsCtx?.appsInAnyNamespaceEnabled)}>
                <div className={`columns small-12 applications-list__info qe-applications-list-${appInstanceName(appSet)} applications-tiles__item`}>
                    {/* Header row with icon, title, and action buttons */}
                    <div className='row'>
                        <div className='columns small-11 applications-tiles__title-col'>
                            <i className='icon argo-icon-applicationset' />
                            <Tooltip content={appInstanceName(appSet)}>
                                <span className='applications-list__title'>{appQualifiedName(appSet, useAuthSettingsCtx?.appsInAnyNamespaceEnabled)}</span>
                            </Tooltip>
                        </div>
                        {/* Empty placeholder — the actual buttons live outside the anchor as an
                            absolutely-positioned sibling, so we don't nest interactive content in <a>. */}
                        <div className='columns small-1' aria-hidden='true' />
                    </div>

                    <div className='applications-tiles__fields'>
                        {/* Labels row */}
                        <div className='row applications-tiles__field-row'>
                            <div className='columns applications-tiles__field-label' title='Labels:'>
                                Labels:
                            </div>
                            <div className='columns applications-tiles__field-value'>
                                <Tooltip
                                    zIndex={4}
                                    content={
                                        <div>
                                            {Object.keys(appSet.metadata.labels || {})
                                                .map(label => ({label, value: appSet.metadata.labels[label]}))
                                                .map(item => (
                                                    <div key={item.label}>
                                                        {item.label}={item.value}
                                                    </div>
                                                ))}
                                        </div>
                                    }>
                                    <span>
                                        {Object.keys(appSet.metadata.labels || {})
                                            .map(label => `${label}=${appSet.metadata.labels[label]}`)
                                            .join(', ')}
                                    </span>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Status row */}
                        <div className='row applications-tiles__field-row'>
                            <div className='columns applications-tiles__field-label' title='Status:'>
                                Status:
                            </div>
                            <div className='columns applications-tiles__field-value' qe-id='applications-tiles-health-status'>
                                <HealthStatusIcon state={{status: healthStatus, message: ''}} /> {healthStatus}
                            </div>
                        </div>

                        {/* Applications count row */}
                        <div className='row applications-tiles__field-row'>
                            <div className='columns applications-tiles__field-label' title='Applications:'>
                                Applications:
                            </div>
                            <div className='columns applications-tiles__field-value'>{appSet.status?.resourcesCount ?? appSet.status?.resources?.length ?? 0}</div>
                        </div>

                        {/* Created At row */}
                        <div className='row applications-tiles__field-row'>
                            <div className='columns applications-tiles__field-label' title='Age:'>
                                Created At:
                            </div>
                            <div className='columns applications-tiles__field-value'>{formatCreationTimestamp(appSet.metadata.creationTimestamp)}</div>
                        </div>
                    </div>
                </div>
            </a>

            {/* Header buttons — sibling of the anchor (not nested) so the markup stays valid. */}
            <div className='applications-tiles__header-buttons applications-list__external-link'>
                <button title={isFav ? 'Remove Favorite' : 'Add Favorite'} className='large-text-height' onClick={handleFavoriteToggle}>
                    <i
                        className={isFav ? 'fas fa-star fa-lg' : 'far fa-star fa-lg'}
                        style={{
                            cursor: 'pointer',
                            margin: '-1px 0px 0px 0px',
                            color: isFav ? '#FFCE25' : '#8fa4b1'
                        }}
                    />
                </button>
            </div>
        </div>
    );
};
