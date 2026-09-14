import * as React from 'react';
import {FC} from 'react';
import {RouteComponentProps} from 'react-router';
import {AbstractApplicationDetails} from '../../../applications/components/application-details/application-details';

// ApplicationSetDetails is the ApplicationSet-kind entry point: a thin wrapper
// that pins the shared details shell to the 'applicationset' kind.
export const ApplicationSetDetails: FC<RouteComponentProps<{appnamespace: string; name: string}>> = props => (
    <AbstractApplicationDetails {...props} objectListKind='applicationset' />
);
