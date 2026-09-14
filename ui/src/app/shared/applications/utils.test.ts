import {Application, ApplicationSet} from '../models';
import {getApplicationParentRef, getAppSetConditionCategory, getAppSetHealthStatus, isApp, isAppNode, isAppSetNode} from './utils';

describe('shared/applications/utils', () => {
    it('isApp discriminates Application from ApplicationSet', () => {
        expect(isApp({kind: 'Application', metadata: {name: 'a'}, spec: {}} as Application)).toBe(true);
        expect(isApp({kind: 'ApplicationSet', metadata: {name: 'a'}, spec: {}} as ApplicationSet)).toBe(false);
    });

    it('isAppNode / isAppSetNode match the argoproj.io node kinds', () => {
        expect(isAppNode({kind: 'Application', group: 'argoproj.io'} as any)).toBe(true);
        expect(isAppSetNode({kind: 'ApplicationSet', group: 'argoproj.io'} as any)).toBe(true);
        expect(isAppNode({kind: 'Application', group: 'other'} as any)).toBe(false);
    });

    it('getAppSetHealthStatus maps conditions to a health status', () => {
        expect(getAppSetHealthStatus({metadata: {name: 'x'}, spec: {}, status: {conditions: []}} as ApplicationSet)).toBe('Unknown');
        expect(
            getAppSetHealthStatus({
                metadata: {name: 'x'},
                spec: {},
                status: {conditions: [{type: 'ErrorOccurred', status: 'True'} as any]}
            } as ApplicationSet)
        ).toBe('Degraded');
    });

    it('getAppSetConditionCategory classifies condition severity', () => {
        expect(getAppSetConditionCategory({type: 'ErrorOccurred', status: 'True'} as any)).toBe('error');
        expect(getAppSetConditionCategory({type: 'InvalidRolloutConfig', status: 'True'} as any)).toBe('warning');
        expect(getAppSetConditionCategory({type: 'ResourcesUpToDate', status: 'True'} as any)).toBe('info');
    });

    it('getApplicationParentRef prefers ApplicationSet owner over app-of-apps tracking', () => {
        const app = {
            metadata: {
                name: 'child',
                namespace: 'argocd',
                ownerReferences: [{kind: 'ApplicationSet', name: 'my-appset'}],
                annotations: {'argocd.argoproj.io/tracking-id': 'parent:argoproj.io/Application:argocd/child'}
            }
        } as unknown as Application;
        expect(getApplicationParentRef(app)).toEqual({name: 'my-appset', namespace: 'argocd', kind: 'ApplicationSet'});
    });
});
