import type { ParsedSession } from "@/lib/tibia-parser";
import { formatNumber } from "@/lib/utils";

interface SessionSummaryProps {
	session: ParsedSession;
}

export function SessionSummary({ session }: SessionSummaryProps) {
	return (
		<div className="border rounded-lg p-6 bg-card">
			<h2 className="text-2xl font-semibold mb-4">Session Summary</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{session.duration && (
					<div>
						<div className="text-sm text-muted-foreground">Duration</div>
						<div className="text-lg font-semibold">{session.duration}</div>
					</div>
				)}
				{session.lootType && (
					<div>
						<div className="text-sm text-muted-foreground">Loot Type</div>
						<div className="text-lg font-semibold">{session.lootType}</div>
					</div>
				)}
				<div>
					<div className="text-sm text-muted-foreground">Total Profit</div>
					<div className="text-lg font-semibold text-green-600 dark:text-green-400">
						{formatNumber(session.totalProfit)} gp
					</div>
				</div>
				<div>
					<div className="text-sm text-muted-foreground">Total Waste</div>
					<div className="text-lg font-semibold text-red-600 dark:text-red-400">
						{formatNumber(session.totalWaste)} gp
					</div>
				</div>
				<div>
					<div className="text-sm text-muted-foreground">Profit per Player</div>
					<div className="text-lg font-semibold">
						{formatNumber(session.profitPerPlayer)} gp
					</div>
				</div>
				<div>
					<div className="text-sm text-muted-foreground">Waste per Player</div>
					<div className="text-lg font-semibold">
						{formatNumber(session.wastePerPlayer)} gp
					</div>
				</div>
				{session.totalLoot && (
					<div>
						<div className="text-sm text-muted-foreground">Total Loot</div>
						<div className="text-lg font-semibold">
							{formatNumber(session.totalLoot)} gp
						</div>
					</div>
				)}
				{session.totalSupplies && (
					<div>
						<div className="text-sm text-muted-foreground">Total Supplies</div>
						<div className="text-lg font-semibold">
							{formatNumber(session.totalSupplies)} gp
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
