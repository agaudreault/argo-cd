import * as React from 'react';

import {ApplicationSet, HealthStatusCode} from '../../../shared/models';
import {AppSetsListPreferences} from '../../../shared/services';
import {Filter, FiltersGroup} from '../../../shared/components/filter/filter';
import {createMetadataSelector, FavoriteFilter, LabelsFilter, isFavorite} from '../../../shared/components/filters';
import {HealthStatusIcon} from '../../../shared/components/app-utils';
import {getAppSetHealthStatus} from '../../../shared/applications/utils';

export interface ApplicationSetFilterResult {
    health: boolean;
    favourite: boolean;
    labels: boolean;
}

export interface ApplicationSetFilteredApp extends ApplicationSet {
    filterResult: ApplicationSetFilterResult;
}

// Props for ApplicationSet filters
export interface AppSetFilterProps {
    apps: ApplicationSetFilteredApp[];
    pref: AppSetsListPreferences;
    onChange: (newPrefs: AppSetsListPreferences) => void;
    children?: React.ReactNode;
    collapsed?: boolean;
}

export function getAppSetFilterResults(appSets: ApplicationSet[], pref: AppSetsListPreferences): ApplicationSetFilteredApp[] {
    const labelSelector = createMetadataSelector(pref.labelsFilter || []);

    return appSets.map(appSet => ({
        ...appSet,
        filterResult: {
            health: pref.healthFilter.length === 0 || pref.healthFilter.includes(getAppSetHealthStatus(appSet)),
            favourite: !pref.showFavorites || isFavorite(pref.favoritesAppList, appSet),
            labels: pref.labelsFilter.length === 0 || labelSelector(appSet.metadata.labels)
        }
    }));
}

const getAppSetCounts = (apps: ApplicationSetFilteredApp[], filterType: keyof ApplicationSetFilterResult, filter: (app: ApplicationSet) => string, init?: string[]) => {
    const map = new Map<string, number>();
    if (init) {
        init.forEach(key => map.set(key, 0));
    }
    // filter out all apps that does not match other filters and ignore this filter result
    apps.filter(app => filter(app) && Object.keys(app.filterResult).every((key: keyof ApplicationSetFilterResult) => key === filterType || app.filterResult[key])).forEach(app =>
        map.set(filter(app), (map.get(filter(app)) || 0) + 1)
    );
    return map;
};

const getAppSetOptions = (
    apps: ApplicationSetFilteredApp[],
    filterType: keyof ApplicationSetFilterResult,
    filter: (app: ApplicationSet) => string,
    keys: string[],
    getIcon?: (k: string) => React.ReactNode
) => {
    const counts = getAppSetCounts(apps, filterType, filter, keys);
    return keys.map(k => {
        return {
            label: k,
            icon: getIcon && getIcon(k),
            count: counts.get(k)
        };
    });
};

const AppSetHealthFilter = (props: AppSetFilterProps) => (
    <Filter
        label='HEALTH STATUS'
        selected={props.pref.healthFilter}
        setSelected={s => props.onChange({...props.pref, healthFilter: s})}
        options={getAppSetOptions(
            props.apps,
            'health',
            app => getAppSetHealthStatus(app),
            ['Healthy', 'Progressing', 'Degraded', 'Unknown'],
            s => (
                <HealthStatusIcon state={{status: s as HealthStatusCode, message: ''}} noSpin={true} />
            )
        )}
    />
);

export const AppSetsFilter = (props: AppSetFilterProps) => {
    const appliedFilter = [...(props.pref.healthFilter || []), ...(props.pref.labelsFilter || []), ...(props.pref.showFavorites ? ['favorites'] : [])];

    const onClearFilter = () => {
        const newPref: AppSetsListPreferences = {...props.pref};
        AppSetsListPreferences.clearFilters(newPref);
        props.onChange(newPref);
    };

    return (
        <FiltersGroup title='ApplicationSet filters' content={props.children} appliedFilter={appliedFilter} onClearFilter={onClearFilter} collapsed={props.collapsed}>
            <FavoriteFilter value={!!props.pref.showFavorites} onChange={val => props.onChange({...props.pref, showFavorites: val})} />
            <AppSetHealthFilter {...props} />
            <LabelsFilter apps={props.apps} pref={props.pref} onChange={labelsFilter => props.onChange({...props.pref, labelsFilter})} />
        </FiltersGroup>
    );
};
