import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer } from "@/components/ui/page-container";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	return (
		<PageContainer className="min-h-screen flex flex-col items-center justify-center">
			<h1 className="text-4xl font-extrabold mb-4 text-center text-foreground drop-shadow-md">
				Tibia Group Tools
			</h1>
			<p className="mb-10 text-lg text-muted-foreground max-w-xl text-center">
				Essential utilities for Tibia group hunts and financial splits. Paste
				your session logs, analyze profits, and manage team loot with ease.
			</p>
			<div className="flex flex-col sm:flex-row gap-6">
				<Link
					to="/loot-split"
					className="inline-block rounded-xl px-8 py-4 text-lg font-semibold text-primary-foreground bg-primary hover:opacity-90 shadow transition-opacity"
				>
					🪙 Loot Split Calculator
				</Link>
				{/* Add more tools here as the app grows */}
				<Link
					to="/bless-calculator"
					className="inline-block rounded-xl px-8 py-4 text-lg font-semibold text-primary-foreground bg-primary hover:opacity-90 shadow transition-opacity"
				>
					🙏 Blessing Calculator
				</Link>
			</div>

			<footer className="mt-16 text-xs text-muted-foreground text-center opacity-80">
				&copy; {new Date().getFullYear()} LootSheet &mdash; Not affiliated with
				CipSoft or Tibia.com
			</footer>
		</PageContainer>
	);
}
