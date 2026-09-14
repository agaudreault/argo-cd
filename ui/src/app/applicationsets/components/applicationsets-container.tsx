import * as React from 'react';
import {Route, RouteComponentProps, Switch} from 'react-router';
import {ApplicationSetDetails} from './applicationset-details/applicationset-details';
import {ApplicationSetsList} from './applicationsets-list/application-sets-list';

export const ApplicationSetsContainer = (props: RouteComponentProps<any>) => {
    return (
        <Switch>
            <Route exact={true} path={`${props.match.path}`} render={() => <ApplicationSetsList {...(props as any)} />} />
            <Route exact={true} path={`${props.match.path}/:name`} render={routeProps => <ApplicationSetDetails {...(routeProps as any)} />} />
            <Route exact={true} path={`${props.match.path}/:appnamespace/:name`} render={routeProps => <ApplicationSetDetails {...(routeProps as any)} />} />
        </Switch>
    );
};
