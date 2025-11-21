import PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import type { CollectionResponses, TypedPocketBase } from "./pocketbase-types";

type AuthRecord =
	| CollectionResponses["_superusers"]
	| CollectionResponses["users"]
	| null;

export type AuthState = {
	isAuthenticated: boolean;
	token: string | null;
	record: AuthRecord;
};
type AuthListener = (authState: AuthState) => void;

const subscribers = new Set<AuthListener>();

export function subscribeToAuthChanges(listener: AuthListener) {
	subscribers.add(listener);
	return () => subscribers.delete(listener);
}

function notifyAuthChange(token: string | null, record: AuthRecord) {
	for (const listener of subscribers) {
		listener({ token, record, isAuthenticated: token !== "" });
	}
}

const pb = new PocketBase(
	import.meta.env.VITE_PB_URL || window.location.origin,
) as TypedPocketBase;

// Ensure we notify with *current* auth state once immediately on subscription
pb.authStore.onChange((token, record) => {
	// `record` here is a PocketBase RecordModel, which may not match our AuthRecord union type,
	// so we must coerce/cast it to our internal AuthRecord type for use in our listeners.
	notifyAuthChange(token, record as AuthRecord);
});

// Optionally, also notify existing state right away for late subscribers (fixes initial state missing)
setTimeout(() => {
	notifyAuthChange(pb.authStore.token, pb.authStore.record as AuthRecord);
}, 0);

/**
 * Returns the current authentication state without subscribing to changes.
 *
 * @returns The current AuthState with token and record.
 */
export function getCurrentAuthState(): AuthState {
	return {
		isAuthenticated: pb.authStore.token !== "",
		token: pb.authStore.token,
		record: pb.authStore.record as AuthRecord,
	};
}

/**
 * React hook to access the current authentication state.
 * Returns the current auth state and automatically updates when auth changes.
 *
 * @returns The current authentication state with token and record
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const auth = useAuth();
 *
 *   if (!auth.record) {
 *     return <div>Not logged in</div>;
 *   }
 *
 *   return <div>Welcome, {auth.record.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthState {
	const [authState, setAuthState] = useState<AuthState>(getCurrentAuthState);

	useEffect(() => {
		const unsubscribe = subscribeToAuthChanges((newAuthState) => {
			setAuthState(newAuthState);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	return authState;
}

export default pb;
