import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/components/header";
import { type AuthState, getCurrentAuthState } from "@/lib/pb";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

interface MyRouterContext {
	queryClient: QueryClient;
	authState: AuthState;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: () => {
		return {
			authState: getCurrentAuthState(),
		};
	},
	component: () => (
		<>
			<Header />
			<Outlet />
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					TanStackQueryDevtools,
				]}
			/>
		</>
	),
});
