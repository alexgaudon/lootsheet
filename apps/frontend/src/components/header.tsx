import { Link, useLocation } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { DiscordButton } from "@/components/auth/discord-button";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
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
	{
		label: "Blessing Calculator",
		to: "/bless-calculator",
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
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
		<header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
			<div className="flex h-16 items-center px-4 justify-between w-full max-w-7xl mx-auto">
				<div className="flex items-center gap-4 md:gap-8">
					<Link
						to="/"
						className="text-xl font-semibold"
						onClick={() => setIsMobileMenuOpen(false)}
					>
						Loot Sheet
					</Link>
					{/* Desktop Navigation */}
					{visibleNavLinks.length > 0 && (
						<nav className="hidden md:flex items-center gap-6">
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
				<div className="flex items-center gap-2 sm:gap-4">
					{/* Desktop User Info */}
					{isSignedIn && (
						<div className="hidden lg:flex items-center gap-3">
							<span className="text-sm text-muted-foreground">
								Welcome back,{" "}
								<span className="font-medium text-foreground">
									{displayName}
								</span>
							</span>
							<UserAvatar />
						</div>
					)}
					{/* Mobile/Tablet: Show avatar only */}
					{isSignedIn && (
						<div className="lg:hidden">
							<UserAvatar />
						</div>
					)}
					<DiscordButton />
					{/* Mobile Menu Button */}
					{visibleNavLinks.length > 0 && (
						<Button
							variant="ghost"
							size="icon"
							className="md:hidden"
							onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
							aria-label="Toggle menu"
							aria-expanded={isMobileMenuOpen}
						>
							{isMobileMenuOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</Button>
					)}
				</div>
			</div>

			{/* Mobile Menu */}
			{isMobileMenuOpen && visibleNavLinks.length > 0 && (
				<div className="md:hidden border-t bg-background animate-in slide-in-from-top duration-200">
					<nav className="flex flex-col px-4 py-3 space-y-1">
						{visibleNavLinks.map((link) => {
							const isActive = location.pathname === link.to;
							return (
								<Link
									key={link.to}
									to={link.to}
									onClick={() => setIsMobileMenuOpen(false)}
									className={cn(
										"px-3 py-2 text-sm font-medium transition-colors rounded-md",
										isActive
											? "text-foreground bg-accent"
											: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
									)}
								>
									{link.label}
								</Link>
							);
						})}
						{isSignedIn && (
							<div className="px-3 py-2 mt-2 pt-3 border-t">
								<div className="text-sm text-muted-foreground">
									Welcome back,{" "}
									<span className="font-medium text-foreground">
										{displayName}
									</span>
								</div>
							</div>
						)}
					</nav>
				</div>
			)}
		</header>
	);
}
