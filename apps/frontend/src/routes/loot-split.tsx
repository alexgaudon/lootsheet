import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import pb, { useAuth } from "@/lib/pb";
import type {
	CollectionResponses,
	GroupsResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";
import { type ParsedSession, parseTibiaSession } from "@/lib/tibia-parser";

export const Route = createFileRoute("/loot-split")({
	component: RouteComponent,
});

type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
}>;

function RouteComponent() {
	const auth = useAuth();
	const [sessionText, setSessionText] = useState("");
	const [parsedSession, setParsedSession] = useState<ParsedSession | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [copiedTransfer, setCopiedTransfer] = useState<string | null>(null);
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState<{
		groupId: string;
		groupName: string;
		count: number;
	} | null>(null);

	// Fetch user's groups
	const { data: groups = [] } = useQuery<GroupWithExpand[]>({
		queryKey: ["groups"],
		queryFn: async () => {
			const records = await pb
				.collection("groups")
				.getFullList<GroupWithExpand>({
					sort: "-created",
					expand: "owner,members",
					filter: `owner.id = "${auth.record?.id}" || members.id ?= "${auth.record?.id}"`,
				});
			return records;
		},
		enabled: auth.isAuthenticated,
	});

	// Auto-select first group when dialog opens and there's only one group
	useEffect(() => {
		if (isSaveDialogOpen && groups.length === 1 && !selectedGroupId) {
			setSelectedGroupId(groups[0].id);
		}
	}, [isSaveDialogOpen, groups, selectedGroupId]);

	// Save transfers to group mutation
	const saveTransfersMutation = useMutation({
		mutationFn: async ({
			groupId,
			transfers,
			groupName,
		}: {
			groupId: string;
			transfers: ParsedSession["transfers"];
			groupName: string;
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
								group: groupId,
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

			return {
				groupId,
				groupName,
				count: createdTransfers.length,
			};
		},
		onSuccess: (result) => {
			setSaveSuccess(result);
			setError(null);
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
									{auth.isAuthenticated && (
										<Button
											onClick={() => setIsSaveDialogOpen(true)}
											variant="outline"
										>
											<Save className="h-4 w-4 mr-2" />
											Save to Group
										</Button>
									)}
								</div>
								<div className="space-y-2">
									{parsedSession.transfers.map((transfer) => {
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
			</div>

			{/* Save to Group Dialog */}
			<Dialog
				open={isSaveDialogOpen}
				onOpenChange={(open) => {
					if (!open) {
						setIsSaveDialogOpen(false);
						setSelectedGroupId(null);
						setSaveSuccess(null);
						setError(null);
					}
				}}
			>
				<DialogContent>
					{saveSuccess ? (
						<>
							<DialogHeader>
								<DialogTitle>Transfers Saved!</DialogTitle>
								<DialogDescription>
									{saveSuccess.count} transfer{saveSuccess.count !== 1 ? "s" : ""}{" "}
									{saveSuccess.count !== 1 ? "have" : "has"} been saved to{" "}
									{saveSuccess.groupName}.
								</DialogDescription>
							</DialogHeader>
							<div className="py-4">
								<div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
									<Check className="h-5 w-5" />
									<span className="font-medium">
										Successfully saved {saveSuccess.count} transfer
										{saveSuccess.count !== 1 ? "s" : ""}
									</span>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setIsSaveDialogOpen(false);
										setSelectedGroupId(null);
										setSaveSuccess(null);
									}}
								>
									Close
								</Button>
								<Link to="/groups/$id" params={{ id: saveSuccess.groupId }}>
									<Button>
										View Group
										<ExternalLink className="h-4 w-4 ml-2" />
									</Button>
								</Link>
							</DialogFooter>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>Save Transfers to Group</DialogTitle>
								<DialogDescription>
									Select a group to save these transfers to. Group members will
									be able to track and mark transfers as complete.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								{error && (
									<div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-3">
										{error}
									</div>
								)}
								{groups.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										You need to be a member of at least one group to save
										transfers.
									</p>
								) : (
									<div className="space-y-2">
										{groups.map((group) => (
											<button
												key={group.id}
												type="button"
												onClick={() => {
													setSelectedGroupId(group.id);
													setError(null);
												}}
												disabled={saveTransfersMutation.isPending}
												className={`w-full text-left p-3 rounded-md border transition-colors ${
													selectedGroupId === group.id
														? "border-primary bg-primary/10"
														: "border-input hover:bg-accent/50"
												} disabled:opacity-50 disabled:cursor-not-allowed`}
											>
												<div className="font-semibold">{group.name}</div>
												<div className="text-sm text-muted-foreground">
													{group.expand?.members?.length || 0} members
												</div>
											</button>
										))}
									</div>
								)}
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setIsSaveDialogOpen(false);
										setSelectedGroupId(null);
										setError(null);
									}}
									disabled={saveTransfersMutation.isPending}
								>
									Cancel
								</Button>
								<Button
									onClick={() => {
										if (selectedGroupId && parsedSession) {
											setError(null);
											const selectedGroup = groups.find(
												(g) => g.id === selectedGroupId,
											);
											saveTransfersMutation.mutate({
												groupId: selectedGroupId,
												transfers: parsedSession.transfers,
												groupName: selectedGroup?.name || "Group",
											});
										}
									}}
									disabled={
										!selectedGroupId ||
										groups.length === 0 ||
										saveTransfersMutation.isPending ||
										!parsedSession
									}
								>
									{saveTransfersMutation.isPending ? (
										<>
											<span className="mr-2">Saving...</span>
											<span className="inline-block animate-spin">⏳</span>
										</>
									) : (
										"Save Transfers"
									)}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
