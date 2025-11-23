import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import pb, { useAuth } from "@/lib/pb";
import type {
	CollectionResponses,
	GroupsResponse,
	UsersResponse,
} from "@/lib/pocketbase-types";

export type GroupWithExpand = GroupsResponse<{
	owner?: UsersResponse;
	members?: UsersResponse[];
}>;

export function useGroups() {
	const auth = useAuth();

	return useQuery<GroupWithExpand[]>({
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
}

export function useUserGroups() {
	const auth = useAuth();

	return useQuery<GroupWithExpand[]>({
		queryKey: ["user-groups"],
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
}

export function useCreateGroup() {
	const auth = useAuth();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (name: string) => {
			if (!auth.record?.id) {
				throw new Error("You must be logged in to create a group");
			}
			const record = await pb
				.collection("groups")
				.create<CollectionResponses["groups"]>({
					name,
					owner: auth.record.id,
					members: [auth.record.id],
				});
			return record;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
			queryClient.invalidateQueries({ queryKey: ["user-groups"] });
		},
	});
}
