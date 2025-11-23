import { Link, useLocation } from "@tanstack/react-router";
import { cn, formatDiscordName } from "@/lib/utils";
import type { NavLink } from "./header";

interface MobileMenuProps {
	isOpen: boolean;
	onClose: () => void;
	links: NavLink[];
	isSignedIn: boolean;
	displayName: string;
}

export function MobileMenu({
	isOpen,
	onClose,
	links,
	isSignedIn,
	displayName,
}: MobileMenuProps) {
	const location = useLocation();

	if (!isOpen) return null;

	return (
		<div className="md:hidden border-t bg-background animate-in slide-in-from-top duration-200">
			<nav className="flex flex-col px-4 py-3 space-y-1">
				{links.map((link) => {
					const isActive = location.pathname === link.to;
					return (
						<Link
							key={link.to}
							to={link.to}
							onClick={onClose}
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
								{formatDiscordName(displayName)}
							</span>
						</div>
					</div>
				)}
			</nav>
		</div>
	);
}
