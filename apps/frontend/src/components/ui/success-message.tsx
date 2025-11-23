import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessMessageProps {
	message: string;
	className?: string;
}

export function SuccessMessage({ message, className }: SuccessMessageProps) {
	return (
		<div
			className={cn(
				"text-green-600 dark:text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-md p-3",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<Check className="h-4 w-4" />
				{message}
			</div>
		</div>
	);
}
