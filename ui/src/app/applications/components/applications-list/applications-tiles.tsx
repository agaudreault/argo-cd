import {DataLoader} from 'argo-ui';
import * as React from 'react';
import {Key, KeybindingContext, NumKey, NumKeyToNumber, NumPadKey, useNav} from 'argo-ui/v2';
import {Consumer, Context} from '../../../shared/context';
import * as models from '../../../shared/models';
import * as AppUtils from '../utils';
import {services} from '../../../shared/services';
import {useItemsPerContainer} from '../../../shared/applications/list/use-items-per-container';
import {ApplicationTile} from './application-tile';

import './applications-tiles.scss';

export interface ApplicationTilesProps {
    applications: models.Application[];
    syncApplication: (appName: string, appNamespace: string) => any;
    refreshApplication: (appName: string, appNamespace: string) => any;
    deleteApplication: (appName: string, appNamespace: string) => any;
}

export const ApplicationTiles = ({applications, syncApplication, refreshApplication, deleteApplication}: ApplicationTilesProps) => {
    const [selectedApp, navApp, reset] = useNav(applications.length);

    const ctxh = React.useContext(Context);
    const firstTileRef = React.useRef<HTMLDivElement>(null);
    const appContainerRef = React.useRef(null);
    const appsPerRow = useItemsPerContainer(firstTileRef, appContainerRef);

    const {registerKeybinding} = React.useContext(KeybindingContext);

    registerKeybinding({keys: Key.RIGHT, action: () => navApp(1)});
    registerKeybinding({keys: Key.LEFT, action: () => navApp(-1)});
    registerKeybinding({keys: Key.DOWN, action: () => navApp(appsPerRow)});
    registerKeybinding({keys: Key.UP, action: () => navApp(-1 * appsPerRow)});

    registerKeybinding({
        keys: Key.ENTER,
        action: () => {
            if (selectedApp > -1) {
                ctxh.navigation.goto(`/${AppUtils.getAppUrl(applications[selectedApp])}`);
                return true;
            }
            return false;
        }
    });

    registerKeybinding({
        keys: Key.ESCAPE,
        action: () => {
            if (selectedApp > -1) {
                reset();
                return true;
            }
            return false;
        }
    });

    registerKeybinding({
        keys: Object.values(NumKey) as NumKey[],
        action: n => {
            reset();
            return navApp(NumKeyToNumber(n));
        }
    });
    registerKeybinding({
        keys: Object.values(NumPadKey) as NumPadKey[],
        action: n => {
            reset();
            return navApp(NumKeyToNumber(n));
        }
    });

    return (
        <Consumer>
            {ctx => (
                <DataLoader load={() => services.viewPreferences.getPreferences()}>
                    {pref => (
                        <div className='applications-tiles argo-table-list argo-table-list--clickable' ref={appContainerRef}>
                            {applications.map((app, i) => (
                                <ApplicationTile
                                    key={AppUtils.appInstanceName(app)}
                                    app={app}
                                    selected={selectedApp === i}
                                    pref={pref}
                                    ctx={ctx}
                                    tileRef={i === 0 ? firstTileRef : undefined}
                                    syncApplication={syncApplication}
                                    refreshApplication={refreshApplication}
                                    deleteApplication={deleteApplication}
                                />
                            ))}
                        </div>
                    )}
                </DataLoader>
            )}
        </Consumer>
    );
};
