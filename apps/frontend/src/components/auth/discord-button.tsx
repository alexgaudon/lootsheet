import { Button } from "@/components/ui/button";
import pb, { useAuth } from "@/lib/pb";

export function DiscordButton() {
	const authState = useAuth();

	const handleSignOut = () => pb.authStore.clear();
	const handleSignIn = () =>
		pb.collection("users").authWithOAuth2({ provider: "discord" });

	const isSignedIn = !!authState?.isAuthenticated;

	return isSignedIn ? (
		<Button onClick={handleSignOut} className="w-auto min-w-0 px-4">
			Sign Out
		</Button>
	) : (
		<Button
			onClick={handleSignIn}
			className="flex items-center gap-2 justify-center cursor-pointer w-auto min-w-0 px-4"
		>
			Continue with
			<img
				src="/Discord-Logo-Blurple.svg"
				alt="Discord logo"
				className="h-3 inline align-middle"
			/>
		</Button>
	);
}
