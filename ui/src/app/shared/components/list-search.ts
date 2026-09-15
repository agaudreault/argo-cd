// Builds a predicate that matches an item's name/namespace against a list search box: plain
// substring by default, or a regular expression when the user enables the `.*` toggle. An invalid
// regex returns a never-match so the empty state surfaces the broken pattern to the user. This is a
// generic, kind-agnostic helper shared by the applications, applicationsets, and resources lists.
export function createMatcher(search: string, useRegex: boolean): (name: string, namespace: string) => boolean {
    if (search === '') {
        return () => true;
    }
    if (useRegex) {
        let re: RegExp;
        try {
            re = new RegExp(search);
        } catch {
            return () => false;
        }
        return (name, namespace) => re.test(name || '') || re.test(namespace || '');
    }
    return (name, namespace) => (name || '').includes(search) || (namespace || '').includes(search);
}
