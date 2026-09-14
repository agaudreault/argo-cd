import * as ReactDOM from 'react-dom';
import * as React from 'react';

import {Filters, FiltersProps} from '../../../applications/components/application-details/application-resource-filter';
import {useSidebarTarget} from '../../../sidebar/sidebar';

// ApplicationDetailsFilters renders the shared resource filter panel into the
// application sidebar portal. Shared by the Application and ApplicationSet views.
export const ApplicationDetailsFilters = (props: FiltersProps) => {
    const sidebarTarget = useSidebarTarget();
    return ReactDOM.createPortal(<Filters {...props} />, sidebarTarget?.current);
};
