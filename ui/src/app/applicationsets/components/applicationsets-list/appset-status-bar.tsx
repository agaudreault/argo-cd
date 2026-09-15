import * as React from 'react';
import {COLORS, StatusBar, StatusBarReading} from '../../../shared/components';
import * as models from '../../../shared/models';
import {getAppSetHealthStatus} from '../../../shared/applications/utils';

function getAppSetReadings(appSets: models.ApplicationSet[]): StatusBarReading[] {
    return [
        {
            name: 'Healthy',
            value: appSets.filter(appSet => getAppSetHealthStatus(appSet) === 'Healthy').length,
            color: COLORS.health.healthy
        },
        {
            name: 'Progressing',
            value: appSets.filter(appSet => getAppSetHealthStatus(appSet) === 'Progressing').length,
            color: COLORS.health.progressing
        },
        {
            name: 'Degraded',
            value: appSets.filter(appSet => getAppSetHealthStatus(appSet) === 'Degraded').length,
            color: COLORS.health.degraded
        },
        {
            name: 'Unknown',
            value: appSets.filter(appSet => getAppSetHealthStatus(appSet) === 'Unknown').length,
            color: COLORS.health.unknown
        }
    ];
}

export interface AppSetsStatusBarProps {
    appSets: models.ApplicationSet[];
}

export const AppSetsStatusBar = ({appSets}: AppSetsStatusBarProps) => {
    if (!appSets || appSets.length === 0) {
        return null;
    }
    return <StatusBar readings={getAppSetReadings(appSets)} />;
};
