export interface Player {
	name: string;
	loot: number;
	supplies: number;
	balance: number;
	damage?: number;
	healing?: number;
	isLeader?: boolean;
}

export interface ParsedSession {
	players: Player[];
	totalProfit: number;
	totalWaste: number;
	profitPerPlayer: number;
	wastePerPlayer: number;
	transfers: Transfer[];
	duration?: string;
	lootType?: string;
	totalLoot?: number;
	totalSupplies?: number;
}

export function parseTibiaSession(sessionString: string): ParsedSession | null {
	console.log("[PARSER] Starting parse...");

	// Split into lines and preserve original for tab detection
	const rawLines = sessionString.split("\n");
	const lines = rawLines.map((line) => line.trim());

	// Parse metadata
	const durationMatch = sessionString.match(/Session:\s*([^\s]+)/);
	const duration = durationMatch?.[1]?.trim() ?? "";

	const lootTypeMatch = sessionString.match(/Loot Type:\s*([^\s]+)/);
	const lootType = lootTypeMatch?.[1]?.trim() ?? "";

	const totalLootMatch = sessionString.match(/Loot: ([\d,]+)/);
	const totalLoot = totalLootMatch?.[1] ? parseNumber(totalLootMatch[1]) : 0;

	const totalSuppliesMatch = sessionString.match(/Supplies: ([\d,]+)/);
	const totalSupplies = totalSuppliesMatch?.[1]
		? parseNumber(totalSuppliesMatch[1])
		: 0;

	const players: Player[] = [];
	let currentPlayer: Partial<Player> | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const rawLine = rawLines[i] || "";

		if (!line) continue;

		// Skip header lines
		if (
			line.startsWith("Session data:") ||
			line.startsWith("Session:") ||
			line.startsWith("Loot Type:") ||
			(line.startsWith("Loot:") &&
				!rawLine.startsWith("\t") &&
				!rawLine.startsWith("  ")) ||
			(line.startsWith("Supplies:") &&
				!rawLine.startsWith("\t") &&
				!rawLine.startsWith("  ")) ||
			(line.startsWith("Balance:") &&
				!rawLine.startsWith("\t") &&
				!rawLine.startsWith("  "))
		) {
			continue;
		}

		// Check if this is a tab-indented stat line
		const isTabIndented = rawLine.startsWith("\t") || rawLine.startsWith("  ");
		if (isTabIndented && currentPlayer) {
			// Parse stat
			const trimmedStat = line.trim();
			const statMatch = trimmedStat.match(
				/^(Loot|Supplies|Balance|Damage|Healing):\s*(.+)$/,
			);
			if (statMatch) {
				const statType = statMatch[1];
				const value = parseNumber(statMatch[2]?.trim() || "");

				if (statType === "Loot") {
					currentPlayer.loot = value;
				} else if (statType === "Supplies") {
					currentPlayer.supplies = value;
				} else if (statType === "Balance") {
					currentPlayer.balance = value;
				} else if (statType === "Damage") {
					currentPlayer.damage = value;
				} else if (statType === "Healing") {
					currentPlayer.healing = value;
				}
			}
			continue;
		}

		// Skip standalone "Leader"
		if (line.trim() === "Leader" || line.trim() === "leader") {
			continue;
		}

		// Check if this is a player name (entire line, no colons, not a keyword)
		const isPlayerName =
			!line.startsWith("Session") &&
			!line.startsWith("Loot") &&
			!line.startsWith("Supplies") &&
			!line.startsWith("Balance") &&
			!line.startsWith("Damage") &&
			!line.startsWith("Healing") &&
			!line.startsWith("From") &&
			!line.includes(":") &&
			line.length > 0;

		if (isPlayerName) {
			// Save previous player if exists
			if (currentPlayer?.name) {
				const isLeader = currentPlayer.name.includes("(Leader)");
				players.push({
					name: currentPlayer.name.replace(/\s*\(Leader\)\s*$/, "").trim(),
					loot: currentPlayer.loot || 0,
					supplies: currentPlayer.supplies || 0,
					balance: currentPlayer.balance || 0,
					damage: currentPlayer.damage,
					healing: currentPlayer.healing,
					isLeader,
				});
			}

			// Start new player
			currentPlayer = {
				name: line.trim(),
			};
		}
	}

	// Save last player
	if (currentPlayer?.name) {
		const isLeader = currentPlayer.name.includes("(Leader)");
		players.push({
			name: currentPlayer.name.replace(/\s*\(Leader\)\s*$/, "").trim(),
			loot: currentPlayer.loot || 0,
			supplies: currentPlayer.supplies || 0,
			balance: currentPlayer.balance || 0,
			damage: currentPlayer.damage,
			healing: currentPlayer.healing,
			isLeader,
		});
	}

	if (players.length === 0) {
		return null;
	}

	// Calculate totals
	const totalProfit = players.reduce((sum, p) => sum + p.balance, 0);
	const totalWaste = players.reduce((sum, p) => sum + p.supplies, 0);

	const exactProfitPerPlayer = totalProfit / players.length;
	const roundedProfitPerPlayer = Math.round(exactProfitPerPlayer);
	const totalRounded = roundedProfitPerPlayer * players.length;
	const remainder = totalProfit - totalRounded;

	const profitPerPlayer = roundedProfitPerPlayer;
	const wastePerPlayer = Math.round(totalWaste / players.length);

	const transfers = calculateTransfers(
		players,
		exactProfitPerPlayer,
		remainder,
	);

	return {
		players,
		totalProfit,
		totalWaste,
		profitPerPlayer,
		wastePerPlayer,
		transfers,
		duration,
		lootType,
		totalLoot,
		totalSupplies,
	};
}

function parseNumber(str: string): number {
	return parseInt(str.replace(/,/g, ""), 10) || 0;
}

export interface Transfer {
	from: string;
	to: string;
	amount: number;
}

export function calculateTransfers(
	players: Player[],
	exactProfitPerPlayer: number,
	remainder: number,
): Transfer[] {
	if (players.length === 0) return [];

	const roundedTarget = Math.round(exactProfitPerPlayer);
	const remainderAbs = Math.abs(remainder);
	const playersToAdjust = remainderAbs;

	const adjustments = players.map((p, index) => {
		let targetBalance = roundedTarget;
		if (remainder > 0 && index < playersToAdjust) {
			targetBalance = roundedTarget + 1;
		} else if (remainder < 0 && index < playersToAdjust) {
			targetBalance = roundedTarget - 1;
		}

		return {
			name: p.name,
			currentBalance: p.balance,
			targetBalance,
			difference: p.balance - targetBalance,
		};
	});

	const givers = adjustments
		.filter((a) => a.difference > 0)
		.sort((a, b) => b.difference - a.difference);
	const receivers = adjustments
		.filter((a) => a.difference < 0)
		.sort((a, b) => a.difference - b.difference);

	const transfers: Transfer[] = [];

	let giverIndex = 0;
	let receiverIndex = 0;

	while (giverIndex < givers.length && receiverIndex < receivers.length) {
		const giver = givers[giverIndex];
		const receiver = receivers[receiverIndex];

		if (!giver || !receiver) break;

		const excessAmount = giver.difference;
		const deficitAmount = Math.abs(receiver.difference);
		const transferAmount = Math.min(excessAmount, deficitAmount);

		transfers.push({
			from: giver.name,
			to: receiver.name,
			amount: transferAmount,
		});

		giver.difference -= transferAmount;
		receiver.difference += transferAmount;

		if (giver.difference < 0.01) {
			giverIndex++;
		}
		if (Math.abs(receiver.difference) < 0.01) {
			receiverIndex++;
		}
	}

	return transfers;
}
