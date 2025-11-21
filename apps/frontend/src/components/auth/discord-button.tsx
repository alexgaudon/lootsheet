import { Button } from "@/components/ui/button";
import pb, { useAuth } from "@/lib/pb";

export function DiscordButton() {
	const authState = useAuth();

	const handleSignOut = () => pb.authStore.clear();
	const handleSignIn = () =>
		pb
			.collection("users")
			.authWithOAuth2({ provider: "discord" })
			.then((data) => {
				console.log(JSON.stringify(data));
				data.meta?.id;
			});

	const isSignedIn = !!authState?.isAuthenticated;

	return isSignedIn ? (
		<Button onClick={handleSignOut} className="w-auto min-w-0 px-4">
			Sign Out
		</Button>
	) : (
		<Button
			onClick={handleSignIn}
			className="flex items-center gap-2 justify-center cursor-pointer w-auto min-w-0 px-4"
			style={{ backgroundColor: "#5865F2", color: "#fff" }}
		>
			Continue with
			<img
				src="/Discord-Logo-White.svg"
				alt="Discord logo"
				className="h-3 inline align-middle"
			/>
		</Button>
	);
}
