import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type ParsedSession, parseTibiaSession } from "@/lib/tibia-parser";

export const Route = createFileRoute("/loot-split")({
	component: RouteComponent,
});

function RouteComponent() {
	const [sessionText, setSessionText] = useState("");
	const [parsedSession, setParsedSession] = useState<ParsedSession | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	const handleParse = () => {
		setError(null);
		if (!sessionText.trim()) {
			setError("Please enter session data");
			return;
		}

		const result = parseTibiaSession(sessionText);
		if (result === null) {
			setError("Failed to parse session data. Please check the format.");
			setParsedSession(null);
		} else {
			setParsedSession(result);
		}
	};

	const formatNumber = (num: number): string => {
		return num.toLocaleString("en-US");
	};

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">Loot Split Calculator</h1>

			<div className="space-y-6">
				{/* Input Section */}
				<div className="space-y-4">
					<Label htmlFor="session-input">Session Data</Label>
					<textarea
						id="session-input"
						value={sessionText}
						onChange={(e) => setSessionText(e.target.value)}
						placeholder="Paste your Tibia session data here..."
						className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] font-mono"
					/>
					<Button onClick={handleParse} className="w-full sm:w-auto">
						Parse Session
					</Button>
					{error && (
						<div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-3">
							{error}
						</div>
					)}
				</div>

				{/* Results Section */}
				{parsedSession && (
					<div className="space-y-6">
						{/* Session Summary */}
						<div className="border rounded-lg p-6 bg-card">
							<h2 className="text-2xl font-semibold mb-4">Session Summary</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
								{parsedSession.duration && (
									<div>
										<div className="text-sm text-muted-foreground">
											Duration
										</div>
										<div className="text-lg font-semibold">
											{parsedSession.duration}
										</div>
									</div>
								)}
								{parsedSession.lootType && (
									<div>
										<div className="text-sm text-muted-foreground">
											Loot Type
										</div>
										<div className="text-lg font-semibold">
											{parsedSession.lootType}
										</div>
									</div>
								)}
								<div>
									<div className="text-sm text-muted-foreground">
										Total Profit
									</div>
									<div className="text-lg font-semibold text-green-600 dark:text-green-400">
										{formatNumber(parsedSession.totalProfit)} gp
									</div>
								</div>
								<div>
									<div className="text-sm text-muted-foreground">
										Total Waste
									</div>
									<div className="text-lg font-semibold text-red-600 dark:text-red-400">
										{formatNumber(parsedSession.totalWaste)} gp
									</div>
								</div>
								<div>
									<div className="text-sm text-muted-foreground">
										Profit per Player
									</div>
									<div className="text-lg font-semibold">
										{formatNumber(parsedSession.profitPerPlayer)} gp
									</div>
								</div>
								<div>
									<div className="text-sm text-muted-foreground">
										Waste per Player
									</div>
									<div className="text-lg font-semibold">
										{formatNumber(parsedSession.wastePerPlayer)} gp
									</div>
								</div>
								{parsedSession.totalLoot && (
									<div>
										<div className="text-sm text-muted-foreground">
											Total Loot
										</div>
										<div className="text-lg font-semibold">
											{formatNumber(parsedSession.totalLoot)} gp
										</div>
									</div>
								)}
								{parsedSession.totalSupplies && (
									<div>
										<div className="text-sm text-muted-foreground">
											Total Supplies
										</div>
										<div className="text-lg font-semibold">
											{formatNumber(parsedSession.totalSupplies)} gp
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Players Table */}
						<div className="border rounded-lg p-6 bg-card">
							<h2 className="text-2xl font-semibold mb-4">Players</h2>
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b">
											<th className="text-left p-2">Player</th>
											<th className="text-right p-2">Loot</th>
											<th className="text-right p-2">Supplies</th>
											<th className="text-right p-2">Balance</th>
											{parsedSession.players.some((p) => p.damage) && (
												<th className="text-right p-2">Damage</th>
											)}
											{parsedSession.players.some((p) => p.healing) && (
												<th className="text-right p-2">Healing</th>
											)}
										</tr>
									</thead>
									<tbody>
										{parsedSession.players.map((player) => (
											<tr
												key={player.name}
												className="border-b hover:bg-accent/50"
											>
												<td className="p-2">
													{player.name}
													{player.isLeader && (
														<span className="ml-2 text-xs text-muted-foreground">
															(Leader)
														</span>
													)}
												</td>
												<td className="text-right p-2">
													{formatNumber(player.loot)} gp
												</td>
												<td className="text-right p-2 text-red-600 dark:text-red-400">
													{formatNumber(player.supplies)} gp
												</td>
												<td
													className={`text-right p-2 font-semibold ${
														player.balance >= 0
															? "text-green-600 dark:text-green-400"
															: "text-red-600 dark:text-red-400"
													}`}
												>
													{formatNumber(player.balance)} gp
												</td>
												{parsedSession.players.some((p) => p.damage) && (
													<td className="text-right p-2">
														{player.damage ? formatNumber(player.damage) : "-"}
													</td>
												)}
												{parsedSession.players.some((p) => p.healing) && (
													<td className="text-right p-2">
														{player.healing
															? formatNumber(player.healing)
															: "-"}
													</td>
												)}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Transfers Section */}
						{parsedSession.transfers.length > 0 && (
							<div className="border rounded-lg p-6 bg-card">
								<h2 className="text-2xl font-semibold mb-4">
									Transfers Required
								</h2>
								<p className="text-sm text-muted-foreground mb-4">
									To evenly distribute the profit, the following transfers are
									needed:
								</p>
								<div className="space-y-2">
									{parsedSession.transfers.map((transfer) => (
										<div
											key={`${transfer.from}-${transfer.to}-${transfer.amount}`}
											className="flex items-center justify-between p-3 bg-accent/50 rounded-md"
										>
											<div className="flex items-center gap-2">
												<span className="font-semibold">{transfer.from}</span>
												<span className="text-muted-foreground">→</span>
												<span className="font-semibold">{transfer.to}</span>
											</div>
											<span className="font-semibold text-lg">
												{formatNumber(transfer.amount)} gp
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
