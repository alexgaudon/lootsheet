import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
	message: string;
	className?: string;
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
	return (
		<div
			className={cn(
				"text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-md p-3",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<AlertCircle className="h-4 w-4" />
				{message}
			</div>
		</div>
	);
}
