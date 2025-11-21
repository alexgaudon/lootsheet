import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
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
import pb, { useAuth } from "@/lib/pb";
import type { GroupsResponse, UsersResponse } from "@/lib/pocketbase-types";

export const Route = createFileRoute("/groups/$id")({
	component: RouteComponent,
});

type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
}>;

function RouteComponent() {
	const { id } = useParams({ from: "/groups/$id" });
	const auth = useAuth();
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// Fetch group
	const {
		data: group,
		isLoading,
		error,
	} = useQuery<GroupWithExpand>({
		queryKey: ["group", id],
		queryFn: async () => {
			return await pb.collection("groups").getOne<GroupWithExpand>(id, {
				expand: "owner,members",
			});
		},
		enabled: auth.isAuthenticated && !!id,
		retry: false, // Don't retry on 404 errors
	});

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

	const handleCopyLink = async () => {
		if (inviteLink) {
			await navigator.clipboard.writeText(inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<Link to="/groups">
				<Button variant="ghost" className="mb-6">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Groups
				</Button>
			</Link>

			<div className="space-y-6">
				{/* Group Header */}
				<div className="border rounded-lg p-6 bg-card">
					<div className="flex items-start justify-between mb-4">
						<div>
							<h1 className="text-3xl font-bold mb-2">{group.name}</h1>
							<p className="text-sm text-muted-foreground">
								Created {new Date(group.created).toLocaleDateString()}
							</p>
						</div>
						{isOwner && (
							<span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
								Owner
							</span>
						)}
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
								const memberName = member.name || member.username || "Unknown";
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
		</div>
	);
}
