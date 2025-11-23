import { cn } from "@/lib/utils";

interface PageContainerProps {
	children: React.ReactNode;
	className?: string;
	title?: string;
	actions?: React.ReactNode;
}

export function PageContainer({
	children,
	className,
	title,
	actions,
}: PageContainerProps) {
	return (
		<div className={cn("container mx-auto max-w-6xl px-4 py-8", className)}>
			{title && (
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-3xl font-bold">{title}</h1>
					{actions}
				</div>
			)}
			{children}
		</div>
	);
}
