import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Removes the Discord discriminator from a username.
 * Example: "username#1234" -> "username"
 * @param name - The Discord username (may include discriminator)
 * @returns The username without the discriminator
 */
export function formatDiscordName(name: string): string {
	return name.split("#")[0];
}
