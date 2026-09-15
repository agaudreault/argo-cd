import {AbstractApplication} from '../../models';

/**
 * Key under which an application is stored in the favorites list. Favorites are namespace-qualified so
 * that applications sharing a name across namespaces (apps-in-any-namespace) can be favorited separately.
 **/
export function favoriteKey(app: AbstractApplication): string {
    return app.metadata.namespace + '/' + app.metadata.name;
}

/**
 * Returns true if the application is in the favorites list. Entries without a namespace are matched on
 * name alone, so favorites stored before the list became namespace-qualified keep working.
 **/
export function isFavorite(favorites: string[], app: AbstractApplication): boolean {
    return (favorites || []).some(favorite => favorite === favoriteKey(app) || favorite === app.metadata.name);
}

/**
 * Returns a new favorites list with the application added or removed.
 **/
export function toggleFavorite(favorites: string[], app: AbstractApplication): string[] {
    const list = favorites || [];
    if (isFavorite(list, app)) {
        return list.filter(favorite => favorite !== favoriteKey(app) && favorite !== app.metadata.name);
    }
    return [...list, favoriteKey(app)];
}
