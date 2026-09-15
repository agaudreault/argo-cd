import {Checkbox} from 'argo-ui/v2';
import * as React from 'react';

export const FavoriteFilter = (props: {value: boolean; onChange: (showFavorites: boolean) => void}) => {
    const onChange = (val: boolean) => {
        props.onChange(val);
    };
    return (
        <div
            className={`filter filter__item ${props.value ? 'filter__item--selected' : ''}`}
            style={{margin: '0.5em 0', marginTop: '0.5em'}}
            onClick={() => onChange(!props.value)}>
            <Checkbox
                value={!!props.value}
                onChange={onChange}
                style={{
                    marginRight: '8px'
                }}
            />
            <div style={{marginRight: '5px', textAlign: 'center', width: '25px'}}>
                <i style={{color: '#FFCE25'}} className='fas fa-star' />
            </div>
            <div className='filter__item__label'>Favorites Only</div>
        </div>
    );
};
