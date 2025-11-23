import { Check, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Transfer } from "@/lib/tibia-parser";
import { formatNumber } from "@/lib/utils";

interface TransfersListProps {
	transfers: Transfer[];
	copiedTransfer: string | null;
	onCopyTransfer: (transfer: Transfer, transferKey: string) => void;
	onSave?: () => void;
	isSaving?: boolean;
	showSaveButton?: boolean;
}

export function TransfersList({
	transfers,
	copiedTransfer,
	onCopyTransfer,
	onSave,
	isSaving = false,
	showSaveButton = true,
}: TransfersListProps) {
	if (transfers.length === 0) return null;

	return (
		<div className="border rounded-lg p-6 bg-card">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="text-2xl font-semibold">Transfers Required</h2>
					<p className="text-sm text-muted-foreground mt-1">
						To evenly distribute the profit, the following transfers are needed:
					</p>
				</div>
				{showSaveButton && onSave && (
					<Button onClick={onSave} variant="outline" disabled={isSaving}>
						<Save className="h-4 w-4 mr-2" />
						{isSaving ? "Saving..." : "Save to Group"}
					</Button>
				)}
			</div>
			<div className="space-y-2">
				{transfers.map((transfer) => {
					const transferKey = `${transfer.from}-${transfer.to}-${transfer.amount}`;
					const isCopied = copiedTransfer === transferKey;

					return (
						<div
							key={transferKey}
							className="flex items-center justify-between p-3 bg-accent/50 rounded-md"
						>
							<div className="flex items-center gap-2">
								<span className="font-semibold">{transfer.from}</span>
								<span className="text-muted-foreground">→</span>
								<span className="font-semibold">{transfer.to}</span>
							</div>
							<div className="flex items-center gap-3">
								<span className="font-semibold text-lg">
									{formatNumber(transfer.amount)} gp
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onCopyTransfer(transfer, transferKey)}
									className="p-2"
								>
									{isCopied ? (
										<Check className="h-4 w-4" />
									) : (
										<Copy className="h-4 w-4" />
									)}
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
