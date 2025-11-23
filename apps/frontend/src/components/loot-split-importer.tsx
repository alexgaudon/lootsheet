import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ExtraWasteDialog } from "@/components/loot-split/extra-waste-dialog";
import { PlayersTable } from "@/components/loot-split/players-table";
import { SessionSummary } from "@/components/loot-split/session-summary";
import { TransfersList } from "@/components/loot-split/transfers-list";
import { ErrorMessage, SuccessMessage } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSaveTransfers } from "@/hooks/use-transfers";
import {
	calculateTransfers,
	type ParsedSession,
	type Player,
	parseTibiaSession,
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
	onSaveRequest,
	onTransfersChange,
	showSaveButton = true,
	autoSave = false,
}: LootSplitImporterProps) {
	const sessionInputId = useId();
	const [sessionText, setSessionText] = useState("");
	const [parsedSession, setParsedSession] = useState<ParsedSession | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [copiedTransfer, setCopiedTransfer] = useState<string | null>(null);
	const [extraWaste, setExtraWaste] = useState<Record<string, number>>({});
	const [openWasteModal, setOpenWasteModal] = useState<string | null>(null);
	const hasAutoSavedRef = useRef<string | null>(null);

	const saveTransfersMutation = useSaveTransfers();

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

		const playersWithExtraWaste: Player[] = parsedSession.players.map(
			(player) => {
				const additionalWaste = extraWaste[player.name] || 0;
				return {
					...player,
					supplies: player.supplies + additionalWaste,
					balance: player.balance - additionalWaste,
				};
			},
		);

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
		const wastePerPlayer = Math.round(
			totalWaste / playersWithExtraWaste.length,
		);

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

	// Auto-save when transfers are calculated
	useEffect(() => {
		if (
			autoSave &&
			groupId &&
			sessionWithBlessings &&
			sessionWithBlessings.transfers.length > 0
		) {
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
	};

	const handleSaveExtraWaste = (playerName: string, wasteAmount: number) => {
		setExtraWaste((prev) => ({
			...prev,
			[playerName]: wasteAmount,
		}));
		setOpenWasteModal(null);
	};

	const handleCopyTransfer = async (
		transfer: { from: string; to: string; amount: number },
		transferKey: string,
	) => {
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
				<Label htmlFor={sessionInputId}>Session Data</Label>
				<textarea
					id={sessionInputId}
					value={sessionText}
					onChange={(e) => setSessionText(e.target.value)}
					placeholder="Paste your Tibia session data here..."
					className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] font-mono"
				/>
				<Button onClick={handleParse} className="w-full sm:w-auto">
					Parse Session
				</Button>
				{error && <ErrorMessage message={error} />}
				{saveTransfersMutation.isError && !error && (
					<ErrorMessage
						message={
							saveTransfersMutation.error instanceof Error
								? saveTransfersMutation.error.message
								: "Failed to save transfers. Please try again."
						}
					/>
				)}
				{saveTransfersMutation.isSuccess && (
					<SuccessMessage
						message={`Successfully saved ${saveTransfersMutation.data} transfer${saveTransfersMutation.data !== 1 ? "s" : ""} to ${groupName || "group"}!`}
					/>
				)}
			</div>

			{/* Results Section */}
			{sessionWithBlessings && (
				<div className="space-y-6">
					<SessionSummary session={sessionWithBlessings} />

					<PlayersTable
						players={sessionWithBlessings.players}
						extraWaste={extraWaste}
						onAddExtraWaste={handleOpenWasteModal}
					/>

					<TransfersList
						transfers={sessionWithBlessings.transfers}
						copiedTransfer={copiedTransfer}
						onCopyTransfer={handleCopyTransfer}
						onSave={() => {
							if (onSaveRequest && sessionWithBlessings) {
								onSaveRequest(sessionWithBlessings.transfers);
							} else if (groupId && !autoSave) {
								handleSave();
							}
						}}
						isSaving={saveTransfersMutation.isPending}
						showSaveButton={showSaveButton}
					/>
				</div>
			)}

			<ExtraWasteDialog
				isOpen={!!openWasteModal}
				onClose={() => setOpenWasteModal(null)}
				playerName={openWasteModal || ""}
				currentWaste={extraWaste[openWasteModal || ""] || 0}
				onSave={handleSaveExtraWaste}
			/>
		</div>
	);
}
