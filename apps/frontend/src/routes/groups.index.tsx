import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useState } from "react";
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
import { PageContainer } from "@/components/ui/page-container";
import { useCreateGroup, useGroups } from "@/hooks/use-groups";
import { useAuth } from "@/lib/pb";

export const Route = createFileRoute("/groups/")({
	component: RouteComponent,
});

function RouteComponent() {
	const auth = useAuth();
	const groupNameInputId = useId();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");

	const { data: groups = [], isLoading } = useGroups();
	const createGroupMutation = useCreateGroup();

	const handleCreateGroup = () => {
		if (!newGroupName.trim()) {
			return;
		}
		createGroupMutation.mutate(newGroupName.trim());
	};

	if (!auth.isAuthenticated) {
		return (
			<PageContainer>
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground">
						Please log in to view and create groups.
					</p>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer
			title="Groups"
			actions={
				<Button onClick={() => setIsCreateDialogOpen(true)}>
					Create a Group
				</Button>
			}
		>
			{isLoading ? (
				<div className="text-muted-foreground">Loading groups...</div>
			) : groups.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					<p className="text-lg mb-2">No groups yet</p>
					<p className="text-sm">Create your first group to get started!</p>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{groups.map((group) => {
						const ownerName =
							group.expand?.owner?.name ||
							group.expand?.owner?.username ||
							"Unknown";
						const memberCount =
							group.expand?.members?.length || group.members?.length || 0;
						const isOwner = group.owner === auth.record?.id;
						const isMember =
							isOwner ||
							group.members?.includes(auth.record?.id || "") ||
							group.expand?.members?.some(
								(member) => member.id === auth.record?.id,
							) ||
							false;
						const canView = isOwner || isMember;

						return (
							<div
								key={group.id}
								className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors flex flex-col"
							>
								<div className="flex items-start justify-between mb-2">
									<h3 className="text-lg font-semibold">{group.name}</h3>
									{isOwner && (
										<span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
											Owner
										</span>
									)}
								</div>
								<div className="space-y-1 text-sm text-muted-foreground mb-4 grow">
									<p>Owner: {ownerName}</p>
									<p>Members: {memberCount}</p>
									<p>Created {new Date(group.created).toLocaleDateString()}</p>
								</div>
								{canView && (
									<Link to="/groups/$id" params={{ id: group.id }}>
										<Button variant="outline" className="w-full">
											View
										</Button>
									</Link>
								)}
							</div>
						);
					})}
				</div>
			)}

			<Dialog
				open={isCreateDialogOpen}
				onOpenChange={(open) => {
					setIsCreateDialogOpen(open);
					if (!open) setNewGroupName("");
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create a Group</DialogTitle>
						<DialogDescription>
							Enter a name for your new group.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor={groupNameInputId}>Group Name</Label>
							<Input
								id={groupNameInputId}
								placeholder="My Group"
								value={newGroupName}
								onChange={(e) => setNewGroupName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleCreateGroup();
									}
								}}
								autoFocus
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCreateDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateGroup}
							disabled={!newGroupName.trim() || createGroupMutation.isPending}
						>
							{createGroupMutation.isPending ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
