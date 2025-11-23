import { useMutation, useQueryClient } from "@tanstack/react-query";
import pb, { useAuth } from "@/lib/pb";
import type { CollectionResponses } from "@/lib/pocketbase-types";
import type { ParsedSession } from "@/lib/tibia-parser";

export function useSaveTransfers() {
	const auth = useAuth();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			groupId,
			transfers,
		}: {
			groupId: string;
			transfers: ParsedSession["transfers"];
		}) => {
			if (!auth.record?.id) {
				throw new Error("Missing authentication");
			}

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
							{ requestKey: null },
						);
					createdTransfers.push(created);
				} catch (err) {
					console.error("Failed to create transfer:", err);
					if (err instanceof Error && !err.message.includes("autocancelled")) {
						throw err;
					}
				}
			}

			return createdTransfers.length;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transfers"] });
			queryClient.invalidateQueries({ queryKey: ["groups"] });
		},
	});
}
