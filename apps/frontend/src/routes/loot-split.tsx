import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { LootSplitImporter } from "@/components/loot-split-importer";
import { ErrorMessage, SuccessMessage } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/ui/page-container";
import { useUserGroups } from "@/hooks/use-groups";
import { useSaveTransfers } from "@/hooks/use-transfers";
import type { ParsedSession } from "@/lib/tibia-parser";

export const Route = createFileRoute("/loot-split")({
	component: RouteComponent,
});

function RouteComponent() {
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

	const { data: groups = [] } = useUserGroups();
	const saveTransfersMutation = useSaveTransfers();

	// Auto-select first group when dialog opens and there's only one group
	useEffect(() => {
		if (isSaveDialogOpen && groups.length === 1 && !selectedGroupId) {
			setSelectedGroupId(groups[0].id);
		}
	}, [isSaveDialogOpen, groups, selectedGroupId]);

	return (
		<PageContainer title="Loot Split Calculator">
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
								<SuccessMessage
									message={`Successfully saved ${saveSuccess.count} transfer${saveSuccess.count !== 1 ? "s" : ""}`}
								/>
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
								{error && <ErrorMessage message={error} />}
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

											saveTransfersMutation.mutate(
												{
													groupId: selectedGroupId,
													transfers: currentTransfers,
												},
												{
													onSuccess: (count) => {
														setSaveSuccess({
															groupId: selectedGroupId,
															groupName: selectedGroup?.name || "Group",
															count,
														});
													},
													onError: (error) => {
														setError(
															error instanceof Error
																? error.message
																: "Failed to save transfers",
														);
													},
												},
											);
										}
									}}
									disabled={
										!selectedGroupId ||
										groups.length === 0 ||
										currentTransfers.length === 0 ||
										saveTransfersMutation.isPending
									}
								>
									Save Transfers
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
