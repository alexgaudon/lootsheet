import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import type {
	CollectionResponses,
	GroupsResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";

export const Route = createFileRoute("/groups/")({
	component: RouteComponent,
});

type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
}>;

function RouteComponent() {
	const auth = useAuth();
	const queryClient = useQueryClient();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");

	// Fetch groups
	const { data: groups = [], isLoading } = useQuery<GroupWithExpand[]>({
		queryKey: ["groups"],
		queryFn: async () => {
			const records = await pb
				.collection("groups")
				.getFullList<GroupWithExpand>({
					sort: "-created",
					expand: "owner,members",
				});
			return records;
		},
		enabled: auth.isAuthenticated,
	});

	// Create group mutation
	const createGroupMutation = useMutation({
		mutationFn: async (name: string) => {
			if (!auth.record?.id) {
				throw new Error("You must be logged in to create a group");
			}
			const record = await pb
				.collection("groups")
				.create<CollectionResponses["groups"]>({
					name,
					owner: auth.record.id,
					members: [auth.record.id], // Add owner as a member
				});
			return record;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
			setIsCreateDialogOpen(false);
			setNewGroupName("");
		},
	});

	const handleCreateGroup = () => {
		if (!newGroupName.trim()) {
			return;
		}
		createGroupMutation.mutate(newGroupName.trim());
	};

	if (!auth.isAuthenticated) {
		return (
			<div className="container mx-auto max-w-6xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground">
						Please log in to view and create groups.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-3xl font-bold">Groups</h1>
				<Button onClick={() => setIsCreateDialogOpen(true)}>
					Create a Group
				</Button>
			</div>

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

			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create a Group</DialogTitle>
						<DialogDescription>
							Enter a name for your new group.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="group-name">Group Name</Label>
							<Input
								id="group-name"
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
		</div>
	);
}
