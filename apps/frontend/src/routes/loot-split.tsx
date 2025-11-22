import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
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
import pb, { useAuth } from "@/lib/pb";
import type {
	CollectionResponses,
	GroupsResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";
import type { ParsedSession } from "@/lib/tibia-parser";

export const Route = createFileRoute("/loot-split")({
	component: RouteComponent,
});

type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
}>;

function RouteComponent() {
	const auth = useAuth();
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [currentTransfers, setCurrentTransfers] = useState<
		ParsedSession["transfers"]
	>([]);
	const [saveSuccess, setSaveSuccess] = useState<{
		groupId: string;
		groupName: string;
		count: number;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);

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
			if (error instanceof Error && error.message.includes("autocancelled")) {
				// Check if transfers were actually created by refetching
				// For now, just show a warning
				console.warn(
					"Request was auto-cancelled, but transfers may have been saved",
				);
				return;
			}
			setError(
				error instanceof Error
					? error.message
					: "Failed to save transfers. Please try again.",
			);
		},
	});

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">Loot Split Calculator</h1>

			<LootSplitImporter
				onSaveRequest={(transfers) => {
					setCurrentTransfers(transfers);
					setIsSaveDialogOpen(true);
				}}
				onTransfersChange={(transfers) => {
					setCurrentTransfers(transfers);
				}}
			/>

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
									{saveSuccess.count} transfer
									{saveSuccess.count !== 1 ? "s" : ""}{" "}
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
										if (selectedGroupId && currentTransfers.length > 0) {
											setError(null);
											const selectedGroup = groups.find(
												(g) => g.id === selectedGroupId,
											);
											saveTransfersMutation.mutate({
												groupId: selectedGroupId,
												transfers: currentTransfers,
												groupName: selectedGroup?.name || "Group",
											});
										}
									}}
									disabled={
										!selectedGroupId ||
										groups.length === 0 ||
										saveTransfersMutation.isPending ||
										currentTransfers.length === 0
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
