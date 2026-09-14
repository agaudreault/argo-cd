import * as React from 'react';

import {Timestamp} from '../../../shared/components';
import * as models from '../../../shared/models';
import {getAppSetConditionCategory} from '../../../shared/applications/utils';

import './applicationset-conditions.scss';

interface ApplicationSetConditionsProps {
    conditions: models.ApplicationSetCondition[];
    title?: string;
}

export const ApplicationSetConditions = ({conditions, title = 'ApplicationSet conditions'}: ApplicationSetConditionsProps) => {
    return (
        <div className='application-conditions'>
            <h4>{title}</h4>
            {(conditions.length === 0 && <p>ApplicationSet is healthy</p>) || (
                <div className='argo-table-list'>
                    {conditions.map((condition, index) => (
                        <div
                            className={`argo-table-list__row application-conditions__condition application-conditions__condition--${getAppSetConditionCategory(condition)}`}
                            key={index}>
                            <div className='row'>
                                <div className='columns small-2'>
                                    {condition.type}
                                    {condition.status && <span className='application-conditions__status'> ({condition.status})</span>}
                                </div>
                                <div className='columns small-7' style={{whiteSpace: 'normal', lineHeight: 'normal'}}>
                                    {condition.message}
                                </div>
                                <div className='columns small-3'>
                                    <Timestamp date={condition.lastTransitionTime} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
