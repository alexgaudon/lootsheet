import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import pb, { useAuth } from "@/lib/pb";
import type { CollectionResponses } from "@/lib/pocketbase-types";
import {
	type ParsedSession,
	parseTibiaSession,
	calculateBlessingCost,
	calculateTransfers,
	type Player,
} from "@/lib/tibia-parser";

interface LootSplitImporterProps {
	/** Optional group ID to auto-save transfers to */
	groupId?: string;
	/** Optional group name for display */
	groupName?: string;
	/** Callback when transfers are successfully saved */
	onSaveSuccess?: (count: number) => void;
	/** Callback when save button is clicked (for group selection) - provides current transfers */
	onSaveRequest?: (transfers: ParsedSession["transfers"]) => void;
	/** Callback when transfers change */
	onTransfersChange?: (transfers: ParsedSession["transfers"]) => void;
	/** Whether to show the save button (default: true) */
	showSaveButton?: boolean;
	/** Whether to auto-save when transfers are calculated (default: false) */
	autoSave?: boolean;
}

export function LootSplitImporter({
	groupId,
	groupName,
	onSaveSuccess,
	onSaveRequest,
	onTransfersChange,
	showSaveButton = true,
	autoSave = false,
}: LootSplitImporterProps) {
	const auth = useAuth();
	const [sessionText, setSessionText] = useState("");
	const [parsedSession, setParsedSession] = useState<ParsedSession | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [copiedTransfer, setCopiedTransfer] = useState<string | null>(null);
	// Track extra waste per player: player name -> extra waste amount
	const [extraWaste, setExtraWaste] = useState<Record<string, number>>({});
	// Track which player's modal is open
	const [openWasteModal, setOpenWasteModal] = useState<string | null>(null);
	// Track temporary input value in modal
	const [tempWasteInput, setTempWasteInput] = useState<string>("");
	// Track if we've auto-saved for the current session (to prevent duplicate saves)
	const hasAutoSavedRef = useRef<string | null>(null);

	// Save transfers to group mutation
	const saveTransfersMutation = useMutation({
		mutationFn: async ({
			groupId: targetGroupId,
			transfers,
		}: {
			groupId: string;
			transfers: ParsedSession["transfers"];
		}) => {
			if (!auth.record?.id) {
				throw new Error("Missing authentication");
			}

			// Create all transfers sequentially to avoid overwhelming the server
			// and to handle errors better
			// Use requestKey: null to disable auto-cancellation for each request
			// See: https://github.com/pocketbase/js-sdk#auto-cancellation
			const createdTransfers = [];
			for (const transfer of transfers) {
				try {
					const created = await pb
						.collection("transfers")
						.create<CollectionResponses["transfers"]>(
							{
								group: targetGroupId,
								from: transfer.from,
								to: transfer.to,
								amount: transfer.amount,
								status: "pending",
							},
							{ requestKey: null }, // Disable auto-cancellation for this request
						);
					createdTransfers.push(created);
				} catch (err) {
					// If one fails, log but continue with others
					console.error("Failed to create transfer:", err);
					// Re-throw non-cancellation errors
					if (err instanceof Error && !err.message.includes("autocancelled")) {
						throw err;
					}
				}
			}

			return createdTransfers.length;
		},
		onSuccess: (count) => {
			setError(null);
			if (onSaveSuccess) {
				onSaveSuccess(count);
			}
		},
		onError: (error) => {
			// Ignore auto-cancellation errors as they're usually harmless
			if (
				error instanceof Error &&
				error.message.includes("autocancelled")
			) {
				// Check if transfers were actually created by refetching
				// For now, just show a warning
				console.warn("Request was auto-cancelled, but transfers may have been saved");
				return;
			}
			setError(
				error instanceof Error
					? error.message
					: "Failed to save transfers. Please try again.",
			);
		},
	});

	const handleParse = () => {
		setError(null);
		hasAutoSavedRef.current = null; // Reset auto-save tracking
		if (!sessionText.trim()) {
			setError("Please enter session data");
			return;
		}

		const result = parseTibiaSession(sessionText);
		if (result === null) {
			setError("Failed to parse session data. Please check the format.");
			setParsedSession(null);
			setExtraWaste({});
		} else {
			setParsedSession(result);
			// Initialize extra waste tracking for all players
			const initialWaste: Record<string, number> = {};
			result.players.forEach((player) => {
				initialWaste[player.name] = 0;
			});
			setExtraWaste(initialWaste);
		}
	};

	// Recalculate session with extra waste applied
	const sessionWithBlessings = useMemo(() => {
		if (!parsedSession) return null;

		const playersWithExtraWaste: Player[] = parsedSession.players.map((player) => {
			const additionalWaste = extraWaste[player.name] || 0;
			return {
				...player,
				supplies: player.supplies + additionalWaste,
				balance: player.balance - additionalWaste,
			};
		});

		// Recalculate totals
		const totalProfit = playersWithExtraWaste.reduce(
			(sum, p) => sum + p.balance,
			0,
		);
		const totalWaste = playersWithExtraWaste.reduce(
			(sum, p) => sum + p.supplies,
			0,
		);

		const exactProfitPerPlayer = totalProfit / playersWithExtraWaste.length;
		const roundedProfitPerPlayer = Math.round(exactProfitPerPlayer);
		const totalRounded = roundedProfitPerPlayer * playersWithExtraWaste.length;
		const remainder = totalProfit - totalRounded;

		const profitPerPlayer = roundedProfitPerPlayer;
		const wastePerPlayer = Math.round(totalWaste / playersWithExtraWaste.length);

		const transfers = calculateTransfers(
			playersWithExtraWaste,
			exactProfitPerPlayer,
			remainder,
		);

		return {
			...parsedSession,
			players: playersWithExtraWaste,
			totalProfit,
			totalWaste,
			profitPerPlayer,
			wastePerPlayer,
			transfers,
		};
	}, [parsedSession, extraWaste]);

	// Notify parent when transfers change
	useEffect(() => {
		if (sessionWithBlessings && onTransfersChange) {
			onTransfersChange(sessionWithBlessings.transfers);
		}
	}, [sessionWithBlessings, onTransfersChange]);

	// Auto-save when transfers are calculated (after extra waste is applied)
	useEffect(() => {
		if (
			autoSave &&
			groupId &&
			sessionWithBlessings &&
			sessionWithBlessings.transfers.length > 0
		) {
			// Create a unique key for this session's transfers to prevent duplicate saves
			const transfersKey = JSON.stringify(sessionWithBlessings.transfers);
			if (
				hasAutoSavedRef.current !== transfersKey &&
				!saveTransfersMutation.isPending
			) {
				hasAutoSavedRef.current = transfersKey;
				saveTransfersMutation.mutate({
					groupId,
					transfers: sessionWithBlessings.transfers,
				});
			}
		}
	}, [sessionWithBlessings, autoSave, groupId, saveTransfersMutation]);

	const handleOpenWasteModal = (playerName: string) => {
		setOpenWasteModal(playerName);
		setTempWasteInput((extraWaste[playerName] || 0).toString());
	};

	const handleCloseWasteModal = () => {
		setOpenWasteModal(null);
		setTempWasteInput("");
	};

	const handleSaveExtraWaste = (playerName: string) => {
		const wasteAmount = parseInt(tempWasteInput.replace(/,/g, "")) || 0;
		setExtraWaste((prev) => ({
			...prev,
			[playerName]: wasteAmount,
		}));
		handleCloseWasteModal();
	};

	const handleCalculateBless = (playerName: string) => {
		const levelInput = prompt(
			`Enter level for ${playerName} to calculate blessing cost:`,
		);
		if (!levelInput) return;

		const level = parseInt(levelInput);
		if (Number.isNaN(level) || level < 1) {
			alert("Please enter a valid level (1 or higher)");
			return;
		}

		try {
			const blessingCosts = calculateBlessingCost(level);
			const blessingCost = blessingCosts.allSevenWithTwist;
			const currentWaste = extraWaste[playerName] || 0;
			setTempWasteInput((currentWaste + blessingCost).toString());
		} catch (err) {
			alert("Error calculating blessing cost. Please try again.");
			console.error("Error calculating blessing cost:", err);
		}
	};

	const formatNumber = (num: number): string => {
		return num.toLocaleString("en-US");
	};

	const handleCopyTransfer = async (
		transfer: { from: string; to: string; amount: number },
		transferKey: string,
	) => {
		// Use raw number without commas for the transfer command
		const text = `transfer ${transfer.amount} to ${transfer.to}`;
		await navigator.clipboard.writeText(text);
		setCopiedTransfer(transferKey);
		setTimeout(() => {
			setCopiedTransfer(null);
		}, 2000);
	};

	const handleSave = () => {
		if (groupId && sessionWithBlessings) {
			setError(null);
			saveTransfersMutation.mutate({
				groupId,
				transfers: sessionWithBlessings.transfers,
			});
		}
	};

	return (
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
				{saveTransfersMutation.isError && !error && (
					<div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-3">
						{saveTransfersMutation.error instanceof Error
							? saveTransfersMutation.error.message
							: "Failed to save transfers. Please try again."}
					</div>
				)}
				{saveTransfersMutation.isSuccess && (
					<div className="text-green-600 dark:text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-md p-3">
						Successfully saved {saveTransfersMutation.data} transfer
						{saveTransfersMutation.data !== 1 ? "s" : ""} to{" "}
						{groupName || "group"}!
					</div>
				)}
			</div>

			{/* Results Section */}
			{sessionWithBlessings && (
				<div className="space-y-6">
					{/* Session Summary */}
					<div className="border rounded-lg p-6 bg-card">
						<h2 className="text-2xl font-semibold mb-4">Session Summary</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
							{sessionWithBlessings.duration && (
								<div>
									<div className="text-sm text-muted-foreground">
										Duration
									</div>
									<div className="text-lg font-semibold">
										{sessionWithBlessings.duration}
									</div>
								</div>
							)}
							{sessionWithBlessings.lootType && (
								<div>
									<div className="text-sm text-muted-foreground">
										Loot Type
									</div>
									<div className="text-lg font-semibold">
										{sessionWithBlessings.lootType}
									</div>
								</div>
							)}
							<div>
								<div className="text-sm text-muted-foreground">
									Total Profit
								</div>
								<div className="text-lg font-semibold text-green-600 dark:text-green-400">
									{formatNumber(sessionWithBlessings.totalProfit)} gp
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">
									Total Waste
								</div>
								<div className="text-lg font-semibold text-red-600 dark:text-red-400">
									{formatNumber(sessionWithBlessings.totalWaste)} gp
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">
									Profit per Player
								</div>
								<div className="text-lg font-semibold">
									{formatNumber(sessionWithBlessings.profitPerPlayer)} gp
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">
									Waste per Player
								</div>
								<div className="text-lg font-semibold">
									{formatNumber(sessionWithBlessings.wastePerPlayer)} gp
								</div>
							</div>
							{sessionWithBlessings.totalLoot && (
								<div>
									<div className="text-sm text-muted-foreground">
										Total Loot
									</div>
									<div className="text-lg font-semibold">
										{formatNumber(sessionWithBlessings.totalLoot)} gp
									</div>
								</div>
							)}
							{sessionWithBlessings.totalSupplies && (
								<div>
									<div className="text-sm text-muted-foreground">
										Total Supplies
									</div>
									<div className="text-lg font-semibold">
										{formatNumber(sessionWithBlessings.totalSupplies)} gp
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
										<th className="text-center p-2">Actions</th>
										{sessionWithBlessings.players.some((p) => p.damage) && (
											<th className="text-right p-2">Damage</th>
										)}
										{sessionWithBlessings.players.some((p) => p.healing) && (
											<th className="text-right p-2">Healing</th>
										)}
									</tr>
								</thead>
								<tbody>
									{sessionWithBlessings.players.map((player) => {
										const additionalWaste = extraWaste[player.name] || 0;

										return (
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
														onClick={() => handleOpenWasteModal(player.name)}
													>
														Add Extra Waste
													</Button>
												</td>
												{sessionWithBlessings.players.some(
													(p) => p.damage,
												) && (
													<td className="text-right p-2">
														{player.damage
															? formatNumber(player.damage)
															: "-"}
													</td>
												)}
												{sessionWithBlessings.players.some(
													(p) => p.healing,
												) && (
													<td className="text-right p-2">
														{player.healing
															? formatNumber(player.healing)
															: "-"}
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>

					{/* Transfers Section */}
					{sessionWithBlessings.transfers.length > 0 && (
						<div className="border rounded-lg p-6 bg-card">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h2 className="text-2xl font-semibold">
										Transfers Required
									</h2>
									<p className="text-sm text-muted-foreground mt-1">
										To evenly distribute the profit, the following transfers
										are needed:
									</p>
								</div>
								{auth.isAuthenticated && showSaveButton && (
									<Button
										onClick={() => {
											if (onSaveRequest && sessionWithBlessings) {
												onSaveRequest(sessionWithBlessings.transfers);
											} else if (groupId && !autoSave) {
												handleSave();
											}
										}}
										variant="outline"
										disabled={
											saveTransfersMutation.isPending ||
											(!groupId && !onSaveRequest) ||
											!sessionWithBlessings
										}
									>
										<Save className="h-4 w-4 mr-2" />
										{saveTransfersMutation.isPending
											? "Saving..."
											: "Save to Group"}
									</Button>
								)}
							</div>
							<div className="space-y-2">
								{sessionWithBlessings.transfers.map((transfer) => {
									const transferKey = `${transfer.from}-${transfer.to}-${transfer.amount}`;
									const isCopied = copiedTransfer === transferKey;
									return (
										<div
											key={transferKey}
											className="flex items-center justify-between p-3 bg-accent/50 rounded-md"
										>
											<div className="flex items-center gap-2">
												<span className="font-semibold">{transfer.from}</span>
												<span className="text-muted-foreground">→</span>
												<span className="font-semibold">{transfer.to}</span>
											</div>
											<div className="flex items-center gap-3">
												<span className="font-semibold text-lg">
													{formatNumber(transfer.amount)} gp
												</span>
												<Button
													size="sm"
													variant="outline"
													onClick={() =>
														handleCopyTransfer(transfer, transferKey)
													}
													className="p-2"
												>
													{isCopied ? (
														<Check className="h-4 w-4" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Add Extra Waste Dialog */}
			{openWasteModal && (
				<Dialog open={!!openWasteModal} onOpenChange={handleCloseWasteModal}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add Extra Waste for {openWasteModal}</DialogTitle>
							<DialogDescription>
								Add additional waste (e.g., blessing costs, other expenses) to
								this player's total.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="waste-input">Extra Waste (gp)</Label>
								<Input
									id="waste-input"
									type="text"
									value={tempWasteInput}
									onChange={(e) => {
										// Allow numbers and commas
										const value = e.target.value.replace(/[^0-9,]/g, "");
										setTempWasteInput(value);
									}}
									placeholder="Enter amount in gold"
									className="text-lg"
								/>
								{tempWasteInput && (
									<div className="text-sm text-muted-foreground">
										Current:{" "}
										{formatNumber(
											parseInt(tempWasteInput.replace(/,/g, "")) || 0,
										)}{" "}
										gp
									</div>
								)}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => handleCalculateBless(openWasteModal)}
									className="flex-1"
								>
									Calculate Bless
								</Button>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={handleCloseWasteModal}>
								Cancel
							</Button>
							<Button onClick={() => handleSaveExtraWaste(openWasteModal)}>
								Save
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}

