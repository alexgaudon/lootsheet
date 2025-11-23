import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronDown,
	ChevronUp,
	Copy,
	Merge,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LootSplitImporter } from "@/components/loot-split-importer";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import pb, { useAuth } from "@/lib/pb";
import type {
	CollectionResponses,
	GroupsResponse,
	TransfersResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";
import type { ParsedSession } from "@/lib/tibia-parser";
import { formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/groups/$id")({
	component: RouteComponent,
});

type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
	transfers?: TransfersResponse[];
}>;

function RouteComponent() {
	const { id } = useParams({ from: "/groups/$id" });
	const auth = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [showCompletedTransfers, setShowCompletedTransfers] = useState(false);
	const [copiedTransferId, setCopiedTransferId] = useState<string | null>(null);
	const [isQuickImportOpen, setIsQuickImportOpen] = useState(false);
	const [importSaveSuccess, setImportSaveSuccess] = useState<number | null>(
		null,
	);
	const [quickImportTransfers, setQuickImportTransfers] = useState<
		ParsedSession["transfers"]
	>([]);
	const [isSavingQuickImport, setIsSavingQuickImport] = useState(false);
	const [quickImportError, setQuickImportError] = useState<string | null>(null);

	// Fetch group with expanded transfers
	const {
		data: group,
		isLoading,
		error,
		refetch,
	} = useQuery<GroupWithExpand>({
		queryKey: ["group", id],
		queryFn: async () => {
			const groupData = await pb
				.collection("groups")
				.getOne<GroupWithExpand>(id, {
					expand: "owner,members",
				});

			// Fetch transfers for this group
			const transfers = await pb
				.collection("transfers")
				.getFullList<TransfersResponse>({
					filter: `group = "${id}"`,
					sort: "-created",
				});

			return {
				...groupData,
				expand: {
					...groupData.expand,
					transfers,
				},
			};
		},
		enabled: auth.isAuthenticated && !!id,
		retry: false, // Don't retry on 404 errors
	});

	// Subscribe to real-time changes
	useEffect(() => {
		if (!auth.isAuthenticated || !id) {
			return;
		}

		let unsubscribe: (() => void) | null = null;

		// Subscribe to group changes (this will also refetch transfers since they're fetched together)
		pb.collection("groups")
			.subscribe(id, (e) => {
				if (e.action === "update") {
					// Refetch when group is updated (includes transfers)
					refetch();
				} else if (e.action === "delete") {
					// Navigate away if group is deleted
					navigate({ to: "/groups" });
				}
			})
			.then((unsub) => {
				unsubscribe = unsub;
			})
			.catch((err) => {
				console.error("Failed to subscribe to group changes:", err);
			});

		// Also subscribe to transfers to catch transfer updates
		let unsubscribeTransfers: (() => void) | null = null;
		pb.collection("transfers")
			.subscribe("*", (e) => {
				if (e.record && e.record.group === id) {
					// Refetch group (which includes transfers) when any transfer for this group changes
					refetch();
				}
			})
			.then((unsub) => {
				unsubscribeTransfers = unsub;
			})
			.catch((err) => {
				console.error("Failed to subscribe to transfer changes:", err);
			});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
			if (unsubscribeTransfers) {
				unsubscribeTransfers();
			}
		};
	}, [auth.isAuthenticated, id, refetch, navigate]);

	// Create invitation mutation (must be called before any conditional returns)
	const createInvitationMutation = useMutation({
		mutationFn: async () => {
			if (!auth.record?.id) {
				throw new Error("You must be logged in to create an invitation");
			}

			// Generate a unique token
			const token = crypto.randomUUID();

			// Create the invitation
			const invitation = await pb.collection("group_invitations").create({
				group: id,
				inviter: auth.record.id,
				token,
				used: false,
			});

			// Generate the invitation link
			const baseUrl = window.location.origin;
			const link = `${baseUrl}/groups/invite/${token}`;
			setInviteLink(link);
			return invitation;
		},
	});

	// Delete group mutation
	const deleteGroupMutation = useMutation({
		mutationFn: async () => {
			await pb.collection("groups").delete(id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
			navigate({ to: "/groups" });
		},
	});

	// Update transfer status mutation
	const updateTransferStatusMutation = useMutation({
		mutationFn: async ({
			transferId,
			status,
		}: {
			transferId: string;
			status: "pending" | "complete";
		}) => {
			await pb.collection("transfers").update(transferId, { status });
		},
		onSuccess: () => {
			// Refetch group which includes transfers
			refetch();
		},
	});

	// Combine transfers mutation
	const combineTransfersMutation = useMutation({
		mutationFn: async ({
			transferIds,
			from,
			to,
			totalAmount,
		}: {
			transferIds: string[];
			from: string;
			to: string;
			totalAmount: number;
		}) => {
			// Create the combined transfer
			const combinedTransfer = await pb
				.collection("transfers")
				.create<CollectionResponses["transfers"]>(
					{
						group: id,
						from,
						to,
						amount: totalAmount,
						status: "pending",
					},
					{ requestKey: null },
				);

			// Delete the original transfers
			for (const transferId of transferIds) {
				await pb.collection("transfers").delete(transferId);
			}

			return combinedTransfer;
		},
		onSuccess: () => {
			// Refetch group which includes transfers
			refetch();
		},
	});

	if (!auth.isAuthenticated) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground">
						Please log in to view this group.
					</p>
					<Link to="/groups">
						<Button variant="outline" className="mt-4">
							Back to Groups
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="text-muted-foreground">Loading group...</div>
			</div>
		);
	}

	if (error || !group) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-destructive mb-4">
						Group not found or you don't have access to view it.
					</p>
					<Link to="/groups">
						<Button variant="outline">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Groups
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	// Check if user has access
	const isOwner = group.owner === auth.record?.id;
	const isMember =
		isOwner ||
		group.members?.includes(auth.record?.id || "") ||
		group.expand?.members?.some((member) => member.id === auth.record?.id) ||
		false;

	if (!isOwner && !isMember) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground mb-4">
						You don't have access to view this group.
					</p>
					<Link to="/groups">
						<Button variant="outline">
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Groups
						</Button>
					</Link>
				</div>
			</div>
		);
	}

	const ownerName =
		group.expand?.owner?.name || group.expand?.owner?.username || "Unknown";
	const members = group.expand?.members || [];
	const transfers = group.expand?.transfers || [];

	const handleCopyLink = async () => {
		if (inviteLink) {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleCopyTransfer = async (transfer: TransfersResponse) => {
		// Use raw number without commas for the transfer command
		const text = `transfer ${transfer.amount || 0} to ${transfer.to}`;
		await navigator.clipboard.writeText(text);
		setCopiedTransferId(transfer.id);
		setTimeout(() => setCopiedTransferId(null), 2000);
	};

	return (
		<div className="container mx-auto max-w-7xl px-4 py-8">
			<Link to="/groups">
				<Button variant="ghost" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Groups
				</Button>
			</Link>

			{/* Two Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left Column: Group Info */}
				<div className="lg:col-span-1 space-y-6">
					{/* Group Header */}
					<div className="border rounded-lg p-6 bg-card">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h1 className="text-3xl font-bold mb-2">{group.name}</h1>
								<p className="text-sm text-muted-foreground">
									Created {new Date(group.created).toLocaleDateString()}
								</p>
							</div>
							<div className="flex items-center gap-2">
								{isOwner && (
									<span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
										Owner
									</span>
								)}
								{isOwner && (
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setIsDeleteDialogOpen(true)}
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Delete Group
									</Button>
								)}
							</div>
						</div>
					</div>

					{/* Owner Section */}
					<div className="border rounded-lg p-6 bg-card">
						<h2 className="text-xl font-semibold mb-4">Owner</h2>
						<div className="flex items-center gap-3">
							<div className="flex-1">
								<p className="font-medium">{ownerName}</p>
							</div>
						</div>
					</div>

					{/* Members Section */}
					<div className="border rounded-lg p-6 bg-card">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold">
								Members ({members.length})
							</h2>
							{isOwner && (
								<Button
									size="sm"
									onClick={() => {
										setIsInviteDialogOpen(true);
										createInvitationMutation.mutate();
									}}
									disabled={createInvitationMutation.isPending}
								>
									Invite People
								</Button>
							)}
						</div>
						{members.length === 0 ? (
							<p className="text-muted-foreground">No members yet.</p>
						) : (
							<div className="space-y-3">
								{members.map((member) => {
									const memberName =
										member.name || member.username || "Unknown";
									const isCurrentUser = member.id === auth.record?.id;
									return (
										<div
											key={member.id}
											className="flex items-center justify-between p-3 rounded-md bg-accent/50"
										>
											<div className="flex-1">
												<p className="font-medium">
													{memberName}
													{isCurrentUser && (
														<span className="ml-2 text-xs text-muted-foreground">
															(You)
														</span>
													)}
												</p>
											</div>
											{member.id === group.owner && (
												<span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
													Owner
												</span>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{/* Right Column: Transfers */}
				<div className="lg:col-span-2">
					<div className="border rounded-lg p-6 bg-card lg:sticky lg:top-24">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-2xl font-semibold">
								Transfers ({transfers?.length || 0})
							</h2>
							{isMember && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsQuickImportOpen(true)}
								>
									<Upload className="h-4 w-4 mr-2" />
									Quick Import Session
								</Button>
							)}
						</div>
						{transfers.length === 0 ? (
							<p className="text-muted-foreground">
								No transfers yet. Save a loot split session to create transfers.
							</p>
						) : (
							<TooltipProvider>
								{(() => {
									const formatNumber = (num: number): string => {
										return num.toLocaleString("en-US");
									};

									const formatFullDateTime = (date: string): string => {
										const d = new Date(date);
										const dateStr = d.toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
											year: "numeric",
										});
										const timeStr = d.toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
										});
										return `${dateStr} • ${timeStr}`;
									};

									const getStatusColor = (status: string) => {
										switch (status) {
											case "complete":
												return "bg-green-500/10 text-green-600 dark:text-green-400";
											default:
												return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
										}
									};

									// Group transfers by from and to
									const groupTransfers = (
										transferList: TransfersResponse[],
									): Map<string, TransfersResponse[]> => {
										const groups = new Map<string, TransfersResponse[]>();
										for (const transfer of transferList) {
											const key = `${transfer.from}→${transfer.to}`;
											if (!groups.has(key)) {
												groups.set(key, []);
											}
											const group = groups.get(key);
											if (group) {
												group.push(transfer);
											}
										}
										return groups;
									};

									const incompleteTransfers = transfers.filter(
										(t) => t.status !== "complete",
									);
									const completedTransfers = transfers.filter(
										(t) => t.status === "complete",
									);

									const incompleteGroups = groupTransfers(incompleteTransfers);
									const completedGroups = groupTransfers(completedTransfers);

									const renderTransfer = (transfer: TransfersResponse) => {
										const isCopied = copiedTransferId === transfer.id;
										return (
											<div
												key={transfer.id}
												className="group relative flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors shadow-sm hover:shadow-md"
											>
												{/* Status indicator bar */}
												<div
													className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
														transfer.status === "complete"
															? "bg-green-500"
															: "bg-yellow-500"
													}`}
												/>

												{/* Main content */}
												<div className="flex-1 min-w-0">
													<div className="flex items-start justify-between gap-4 mb-2">
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-1.5">
																<span className="font-semibold text-base truncate">
																	{transfer.from}
																</span>
																<span className="text-muted-foreground shrink-0">
																	→
																</span>
																<span className="font-semibold text-base truncate">
																	{transfer.to}
																</span>
															</div>
															{transfer.created && (
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span className="text-xs text-muted-foreground/80 cursor-help hover:text-muted-foreground transition-colors">
																			{formatRelativeTime(transfer.created)}
																		</span>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>
																			{formatFullDateTime(transfer.created)}
																		</p>
																	</TooltipContent>
																</Tooltip>
															)}
														</div>
														<div className="flex flex-col items-end gap-2 shrink-0">
															<span className="font-bold text-xl text-foreground">
																{formatNumber(transfer.amount || 0)} gp
															</span>
															<span
																className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${getStatusColor(
																	transfer.status || "pending",
																)}`}
															>
																{transfer.status || "pending"}
															</span>
														</div>
													</div>
												</div>

												{/* Action buttons */}
												<div className="flex items-center gap-2 shrink-0">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => handleCopyTransfer(transfer)}
														className="h-8 w-8 p-0"
														title="Copy transfer command"
													>
														{isCopied ? (
															<Check className="h-4 w-4 text-green-600 dark:text-green-400" />
														) : (
															<Copy className="h-4 w-4" />
														)}
													</Button>
													{isMember && transfer.status !== "complete" && (
														<Button
															size="sm"
															variant="outline"
															onClick={() =>
																updateTransferStatusMutation.mutate({
																	transferId: transfer.id,
																	status: "complete",
																})
															}
															disabled={updateTransferStatusMutation.isPending}
															className="text-xs"
														>
															Mark as Complete
														</Button>
													)}
												</div>
											</div>
										);
									};

									const renderTransferGroup = (
										groupKey: string,
										groupTransfers: TransfersResponse[],
										isCompleted: boolean,
									) => {
										if (groupTransfers.length === 1) {
											return renderTransfer(groupTransfers[0]);
										}

										const totalAmount = groupTransfers.reduce(
											(sum, t) => sum + (t.amount || 0),
											0,
										);
										const canCombine =
											isMember &&
											!isCompleted &&
											groupTransfers.every((t) => t.status === "pending");

										return (
											<div
												key={groupKey}
												className="space-y-2 border-l-2 border-primary/30 pl-3"
											>
												{groupTransfers.map((transfer) =>
													renderTransfer(transfer),
												)}
												{canCombine && (
													<div className="flex items-center justify-between p-2 bg-primary/5 rounded-md border border-primary/20">
														<div className="flex items-center gap-2">
															<span className="text-sm text-muted-foreground">
																{groupTransfers.length} transfers → Combined:{" "}
																{formatNumber(totalAmount)} gp
															</span>
														</div>
														<Button
															size="sm"
															variant="outline"
															onClick={() => {
																combineTransfersMutation.mutate({
																	transferIds: groupTransfers.map((t) => t.id),
																	from: groupTransfers[0].from || "",
																	to: groupTransfers[0].to || "",
																	totalAmount,
																});
															}}
															disabled={combineTransfersMutation.isPending}
														>
															<Merge className="h-4 w-4 mr-2" />
															{combineTransfersMutation.isPending
																? "Combining..."
																: "Combine"}
														</Button>
													</div>
												)}
											</div>
										);
									};

									return (
										<div className="space-y-4">
											{/* Incomplete Transfers */}
											{incompleteTransfers.length > 0 && (
												<div className="space-y-3">
													{Array.from(incompleteGroups.entries()).map(
														([key, group]) =>
															renderTransferGroup(key, group, false),
													)}
												</div>
											)}

											{/* Completed Transfers (Collapsible) */}
											{completedTransfers.length > 0 && (
												<div>
													<button
														type="button"
														onClick={() =>
															setShowCompletedTransfers(!showCompletedTransfers)
														}
														className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
													>
														{showCompletedTransfers ? (
															<ChevronUp className="h-4 w-4" />
														) : (
															<ChevronDown className="h-4 w-4" />
														)}
														Completed Transfers ({completedTransfers.length})
													</button>
													{showCompletedTransfers && (
														<div className="space-y-3">
															{Array.from(completedGroups.entries()).map(
																([key, group]) =>
																	renderTransferGroup(key, group, true),
															)}
														</div>
													)}
												</div>
											)}
										</div>
									);
								})()}
							</TooltipProvider>
						)}
					</div>
				</div>
			</div>

			{/* Invite Dialog */}
			<Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Invite People to {group.name}</DialogTitle>
						<DialogDescription>
							Share this link with people you want to invite. The link can only
							be used once.
						</DialogDescription>
					</DialogHeader>
					{createInvitationMutation.isPending ? (
						<div className="py-4 text-center text-muted-foreground">
							Creating invitation...
						</div>
					) : inviteLink ? (
						<div className="space-y-4 py-4">
							<div className="flex items-center gap-2">
								<input
									type="text"
									readOnly
									value={inviteLink}
									className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
								/>
								<Button variant="outline" size="icon" onClick={handleCopyLink}>
									{copied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>
					) : null}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsInviteDialogOpen(false);
								setInviteLink(null);
								setCopied(false);
							}}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Group</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete "{group.name}"? This action cannot
							be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={deleteGroupMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => deleteGroupMutation.mutate()}
							disabled={deleteGroupMutation.isPending}
						>
							{deleteGroupMutation.isPending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Quick Import Session Dialog */}
			<Dialog open={isQuickImportOpen} onOpenChange={setIsQuickImportOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Quick Import Session</DialogTitle>
						<DialogDescription>
							Paste your Tibia session data below. Click Save to add transfers
							to this group.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<LootSplitImporter
							groupId={id}
							groupName={group.name}
							autoSave={false}
							showSaveButton={false}
							onTransfersChange={(transfers) => {
								setQuickImportTransfers(transfers);
							}}
						/>
					</div>
					{quickImportError && (
						<div className="py-2">
							<div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-3">
								{quickImportError}
							</div>
						</div>
					)}
					{importSaveSuccess !== null && (
						<div className="py-2">
							<div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-md p-3">
								<Check className="h-4 w-4" />
								<span>
									Successfully saved {importSaveSuccess} transfer
									{importSaveSuccess !== 1 ? "s" : ""} to {group.name}!
								</span>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsQuickImportOpen(false);
								setImportSaveSuccess(null);
								setQuickImportTransfers([]);
								setQuickImportError(null);
							}}
							disabled={isSavingQuickImport}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								if (quickImportTransfers.length === 0) return;

								setIsSavingQuickImport(true);
								setQuickImportError(null);

								try {
									// Create all transfers sequentially
									const createdTransfers = [];
									for (const transfer of quickImportTransfers) {
										try {
											const created = await pb
												.collection("transfers")
												.create<CollectionResponses["transfers"]>(
													{
														group: id,
														from: transfer.from,
														to: transfer.to,
														amount: transfer.amount,
														status: "pending",
													},
													{ requestKey: null },
												);
											createdTransfers.push(created);
										} catch (err) {
											console.error("Failed to create transfer:", err);
											if (
												err instanceof Error &&
												!err.message.includes("autocancelled")
											) {
												throw err;
											}
										}
									}

									setImportSaveSuccess(createdTransfers.length);
									// Refetch transfers after a short delay
									setTimeout(() => {
										refetch();
									}, 500);
									// Close the modal immediately after successful save
									setTimeout(() => {
										setIsQuickImportOpen(false);
										setImportSaveSuccess(null);
										setQuickImportTransfers([]);
										setQuickImportError(null);
									}, 1500);
								} catch (err) {
									setQuickImportError(
										err instanceof Error
											? err.message
											: "Failed to save transfers. Please try again.",
									);
								} finally {
									setIsSavingQuickImport(false);
								}
							}}
							disabled={
								isSavingQuickImport ||
								quickImportTransfers.length === 0 ||
								importSaveSuccess !== null
							}
						>
							{isSavingQuickImport ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
