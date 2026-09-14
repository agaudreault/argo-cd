import * as React from 'react';
import {Route, RouteComponentProps, Switch} from 'react-router';
import {ApplicationDetails} from '../../applications/components/application-details/application-details';
import {ApplicationSetsList} from './applicationsets-list/application-sets-list';

export const ApplicationSetsContainer = (props: RouteComponentProps<any>) => {
    return (
        <Switch>
            <Route exact={true} path={`${props.match.path}`} render={() => <ApplicationSetsList {...(props as any)} />} />
            <Route exact={true} path={`${props.match.path}/:name`} render={routeProps => <ApplicationDetails objectListKind='applicationset' {...(routeProps as any)} />} />
            <Route
                exact={true}
                path={`${props.match.path}/:appnamespace/:name`}
                render={routeProps => <ApplicationDetails objectListKind='applicationset' {...(routeProps as any)} />}
            />
        </Switch>
    );
};
