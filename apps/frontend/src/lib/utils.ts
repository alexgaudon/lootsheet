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

export function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Formats a date as a relative time string (e.g., "2 minutes ago", "yesterday").
 * @param date - The date string to format
 * @returns A human-readable relative time string
 */
export function formatRelativeTime(date: string): string {
	const now = new Date();
	const transferDate = new Date(date);
	const diffInSeconds = Math.floor(
		(now.getTime() - transferDate.getTime()) / 1000,
	);

	if (diffInSeconds < 60) {
		return "right now";
	}

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) {
		return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
	}

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) {
		return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
	}

	const diffInDays = Math.floor(diffInHours / 24);
	if (diffInDays === 1) {
		return "yesterday";
	}
	if (diffInDays < 7) {
		return `${diffInDays} days ago`;
	}
	if (diffInDays < 14) {
		return "last week";
	}
	if (diffInDays < 30) {
		const weeks = Math.floor(diffInDays / 7);
		return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
	}
	if (diffInDays < 365) {
		const months = Math.floor(diffInDays / 30);
		return `${months} month${months !== 1 ? "s" : ""} ago`;
	}

	const years = Math.floor(diffInDays / 365);
	return `${years} year${years !== 1 ? "s" : ""} ago`;
}
