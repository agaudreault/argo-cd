import * as React from 'react';
import {Filter} from '../filter/filter';

export const LabelsFilter = React.memo(
    (props: {apps: Array<{metadata: {labels?: {[key: string]: string}}}>; pref: {labelsFilter: string[]}; onChange: (labelsFilter: string[]) => void}) => {
        const labelOptions = React.useMemo(() => {
            const labels = new Map<string, Set<string>>();
            props.apps
                .filter(app => app.metadata && app.metadata.labels)
                .forEach(app =>
                    Object.keys(app.metadata.labels).forEach(label => {
                        let values = labels.get(label);
                        if (!values) {
                            values = new Set<string>();
                            labels.set(label, values);
                        }
                        values.add(app.metadata.labels[label]);
                    })
                );
            const suggestions: string[] = [];
            labels.forEach((values, label) => {
                suggestions.push(label);
                values.forEach(val => suggestions.push(`${label}=${val}`));
            });
            return suggestions.map(s => ({label: s}));
        }, [props.apps]);

        return <Filter label='LABELS' selected={props.pref.labelsFilter} setSelected={s => props.onChange(s)} field={true} options={labelOptions} />;
    }
);
