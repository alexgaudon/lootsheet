import { Link, useLocation } from "@tanstack/react-router";
import { DiscordButton } from "@/components/auth/discord-button";
import { UserAvatar } from "@/components/auth/user-avatar";
import { useAuth } from "@/lib/pb";
import type { CollectionResponses } from "@/lib/pocketbase-types";
import { cn, formatDiscordName } from "@/lib/utils";

export type NavLink = {
	label: string;
	to: string;
	requiresAuth?: boolean;
};

export const NAV_LINKS: NavLink[] = [
	{
		label: "Loot Split",
		to: "/loot-split",
	},
	{ label: "Groups", to: "/groups", requiresAuth: true },
];

function getDisplayName(record: CollectionResponses["users"] | null): string {
	if (!record) return "";

	// Prefer name field if available, but clean discriminator
	if (record.name) return formatDiscordName(record.name);

	// Clean username by removing Discord discriminator (e.g., "amgau#0" -> "amgau")
	if (record.username) {
		return formatDiscordName(record.username);
	}

	// Fall back to default
	return "User";
}

export function Header() {
	const authState = useAuth();
	const isSignedIn = authState.isAuthenticated;
	const location = useLocation();

	const userRecord =
		isSignedIn && authState.record?.collectionName === "users"
			? (authState.record as CollectionResponses["users"])
			: null;

	const displayName = getDisplayName(userRecord);

	// Filter nav links based on auth requirements
	const visibleNavLinks = NAV_LINKS.filter(
		(link) => !link.requiresAuth || isSignedIn,
	);

	return (
		<header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="flex h-16 items-center px-4 justify-between w-full">
				<div className="flex items-center gap-8">
					<Link to="/" className="text-xl font-semibold">
						Loot Sheet
					</Link>
					{visibleNavLinks.length > 0 && (
						<nav className="flex items-center gap-6">
							{visibleNavLinks.map((link) => {
								const isActive = location.pathname === link.to;
								return (
									<Link
										key={link.to}
										to={link.to}
										className={cn(
											"text-sm font-medium transition-colors hover:text-foreground",
											isActive ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{link.label}
									</Link>
								);
							})}
						</nav>
					)}
				</div>
				<div className="flex items-center gap-4">
					{isSignedIn && (
						<div className="flex items-center gap-3">
							<span className="text-sm text-muted-foreground">
								Welcome back,{" "}
								<span className="font-medium text-foreground">
									{displayName}
								</span>
							</span>
							<UserAvatar />
						</div>
					)}
					<DiscordButton />
				</div>
			</div>
		</header>
	);
}
