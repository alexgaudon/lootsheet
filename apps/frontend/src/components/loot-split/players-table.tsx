import { Button } from "@/components/ui/button";
import type { Player } from "@/lib/tibia-parser";
import { formatNumber } from "@/lib/utils";

interface PlayersTableProps {
	players: Player[];
	extraWaste: Record<string, number>;
	onAddExtraWaste: (playerName: string) => void;
}

export function PlayersTable({
	players,
	extraWaste,
	onAddExtraWaste,
}: PlayersTableProps) {
	const hasDamage = players.some((p) => p.damage);
	const hasHealing = players.some((p) => p.healing);

	return (
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
							<th className="text-center p-2">Actions</th>
							{hasDamage && <th className="text-right p-2">Damage</th>}
							{hasHealing && <th className="text-right p-2">Healing</th>}
						</tr>
					</thead>
					<tbody>
						{players.map((player) => {
							const additionalWaste = extraWaste[player.name] || 0;

							return (
								<tr key={player.name} className="border-b hover:bg-accent/50">
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
										<div>{formatNumber(player.supplies)} gp</div>
										{additionalWaste > 0 && (
											<div className="text-xs text-muted-foreground">
												+{formatNumber(additionalWaste)} extra
											</div>
										)}
									</td>
									<td className="text-right p-2">
										<div
											className={`font-semibold ${
												player.balance >= 0
													? "text-green-600 dark:text-green-400"
													: "text-red-600 dark:text-red-400"
											}`}
										>
											{formatNumber(player.balance)} gp
										</div>
									</td>
									<td className="text-center p-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => onAddExtraWaste(player.name)}
										>
											Add Extra Waste
										</Button>
									</td>
									{hasDamage && (
										<td className="text-right p-2">
											{player.damage ? formatNumber(player.damage) : "-"}
										</td>
									)}
									{hasHealing && (
										<td className="text-right p-2">
											{player.healing ? formatNumber(player.healing) : "-"}
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
