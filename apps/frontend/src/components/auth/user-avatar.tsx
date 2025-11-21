import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import pb, { useAuth } from "@/lib/pb";
import type { CollectionResponses } from "@/lib/pocketbase-types";

function getAvatarUrl(
	record: CollectionResponses["users"],
): string | undefined {
	if (!record.avatar) return undefined;
	// Use the record from authStore directly for getURL
	const authRecord = pb.authStore.record;
	if (!authRecord || authRecord.collectionName !== "users") return undefined;
	return pb.files.getURL(authRecord, record.avatar);
}

function getInitials(record: CollectionResponses["users"]): string {
	if (record.name) {
		const parts = record.name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return parts[0][0].toUpperCase();
	}
	if (record.email) {
		return record.email[0].toUpperCase();
	}
	return "?";
}

export function UserAvatar() {
	const authState = useAuth();

	if (!authState.isAuthenticated || !authState.record) {
		return null;
	}

	const userRecord =
		authState.record.collectionName === "users"
			? (authState.record as CollectionResponses["users"])
			: null;

	if (!userRecord) {
		return null;
	}

	const avatarUrl = getAvatarUrl(userRecord);
	const initials = getInitials(userRecord);

	return (
		<Avatar>
			{avatarUrl && (
				<AvatarImage
					src={avatarUrl}
					alt={userRecord.name || userRecord.email}
				/>
			)}
			<AvatarFallback>{initials}</AvatarFallback>
		</Avatar>
	);
}
