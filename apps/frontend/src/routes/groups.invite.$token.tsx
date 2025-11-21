import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import pb, { useAuth } from "@/lib/pb";
import type {
	GroupInvitationsResponse,
	GroupsResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";

export const Route = createFileRoute("/groups/invite/$token")({
	component: RouteComponent,
});

type InvitationWithExpand = GroupInvitationsResponse<{
	group?: GroupsResponse<{
		owner?: UsersResponse;
	}>;
	inviter?: UsersResponse;
}>;

function RouteComponent() {
	const { token } = useParams({ from: "/groups/invite/$token" });
	const auth = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [actionTaken, setActionTaken] = useState<
		"accepted" | "rejected" | null
	>(null);

	// Fetch invitation
	const {
		data: invitation,
		isLoading,
		error,
	} = useQuery<InvitationWithExpand>({
		queryKey: ["invitation", token],
		queryFn: async () => {
			const records = await pb
				.collection("group_invitations")
				.getList<InvitationWithExpand>(1, 1, {
					filter: `token = "${token}"`,
					expand: "group,group.owner,group.members,inviter",
				});
			if (records.items.length === 0) {
				throw new Error("Invitation not found");
			}
			return records.items[0];
		},
		enabled: !!token,
	});

	// Accept invitation mutation
	const acceptMutation = useMutation({
		mutationFn: async () => {
			if (!invitation || !auth.record?.id) {
				throw new Error("Invalid invitation or not logged in");
			}

			if (!invitation.group) {
				throw new Error("Invalid invitation: missing group reference");
			}

			// Check if already used
			if (invitation.used) {
				throw new Error("This invitation has already been used");
			}

			// Mark invitation as used and accepted
			// The backend hook will handle adding the user to the group
			await pb.collection("group_invitations").update(invitation.id, {
				used: true,
				accepted: true,
			});

			return invitation.group;
		},
		onSuccess: (groupId) => {
			setActionTaken("accepted");
			queryClient.invalidateQueries({ queryKey: ["groups"] });
			queryClient.invalidateQueries({ queryKey: ["group", groupId] });
			// Navigate to the group after a short delay
			setTimeout(() => {
				navigate({ to: "/groups/$id", params: { id: groupId } });
			}, 2000);
		},
	});

	// Reject invitation mutation
	const rejectMutation = useMutation({
		mutationFn: async () => {
			if (!invitation || !auth.record?.id) {
				throw new Error("Invalid invitation or not logged in");
			}

			// Check if already used
			if (invitation.used) {
				throw new Error("This invitation has already been used");
			}

			// Mark invitation as used and rejected
			await pb.collection("group_invitations").update(invitation.id, {
				used: true,
				accepted: false,
			});
		},
		onSuccess: () => {
			setActionTaken("rejected");
		},
	});

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-muted-foreground">Loading invitation...</p>
				</div>
			</div>
		);
	}

	if (error || !invitation) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-destructive mb-4">
						Invitation not found or has expired.
					</p>
					<Link to="/">
						<Button variant="outline">Go Home</Button>
					</Link>
				</div>
			</div>
		);
	}

	// Check if already used
	if (invitation.used) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground mb-4">
						This invitation has already been used.
					</p>
					<Link to="/">
						<Button variant="outline">Go Home</Button>
					</Link>
				</div>
			</div>
		);
	}

	// Check if user is logged in
	if (!auth.isAuthenticated) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-lg text-muted-foreground mb-4">
						Please log in to accept this invitation.
					</p>
					<Link to="/">
						<Button variant="outline">Go Home</Button>
					</Link>
				</div>
			</div>
		);
	}

	const group = invitation.expand?.group;
	const inviter = invitation.expand?.inviter;
	const inviterName = inviter?.name || inviter?.username || "Someone";
	const groupName = group?.name || "a group";

	// Show success/rejection message
	if (actionTaken === "accepted") {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-2xl font-bold mb-4 text-green-600 dark:text-green-400">
						You've joined {groupName}!
					</p>
					<p className="text-muted-foreground mb-6">
						Redirecting you to the group...
					</p>
				</div>
			</div>
		);
	}

	if (actionTaken === "rejected") {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="text-center py-12">
					<p className="text-2xl font-bold mb-4">Sorry to see that</p>
					<p className="text-muted-foreground mb-6">
						You've declined the invitation to join {groupName}.
					</p>
					<Link to="/">
						<Button variant="outline">Go Home</Button>
					</Link>
				</div>
			</div>
		);
	}

	// Show invitation prompt
	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			<div className="border rounded-lg p-8 bg-card text-center">
				<h1 className="text-3xl font-bold mb-4">Group Invitation</h1>
				<p className="text-lg text-muted-foreground mb-6">
					<strong>{inviterName}</strong> has invited you to join{" "}
					<strong>{groupName}</strong>
				</p>
				<div className="flex gap-4 justify-center">
					<Button
						onClick={() => acceptMutation.mutate()}
						disabled={acceptMutation.isPending || rejectMutation.isPending}
						size="lg"
					>
						{acceptMutation.isPending ? "Joining..." : "Yes, join group"}
					</Button>
					<Button
						variant="outline"
						onClick={() => rejectMutation.mutate()}
						disabled={acceptMutation.isPending || rejectMutation.isPending}
						size="lg"
					>
						{rejectMutation.isPending ? "Declining..." : "No, thanks"}
					</Button>
				</div>
			</div>
		</div>
	);
}
