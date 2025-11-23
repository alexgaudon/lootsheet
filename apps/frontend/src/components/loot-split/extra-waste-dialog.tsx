import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateBlessingCost } from "@/lib/tibia-parser";
import { formatNumber } from "@/lib/utils";

interface ExtraWasteDialogProps {
	isOpen: boolean;
	onClose: () => void;
	playerName: string;
	currentWaste: number;
	onSave: (playerName: string, wasteAmount: number) => void;
}

export function ExtraWasteDialog({
	isOpen,
	onClose,
	playerName,
	currentWaste,
	onSave,
}: ExtraWasteDialogProps) {
	const wasteInputId = useId();
	const [tempWasteInput, setTempWasteInput] = useState(currentWaste.toString());

	const handleCalculateBless = () => {
		const levelInput = prompt(
			`Enter level for ${playerName} to calculate blessing cost:`,
		);
		if (!levelInput) return;

		const level = parseInt(levelInput, 10);
		if (Number.isNaN(level) || level < 1) {
			alert("Please enter a valid level (1 or higher)");
			return;
		}

		try {
			const blessingCosts = calculateBlessingCost(level);
			const blessingCost = blessingCosts.allSevenWithTwist;
			setTempWasteInput((currentWaste + blessingCost).toString());
		} catch (err) {
			alert("Error calculating blessing cost. Please try again.");
			console.error("Error calculating blessing cost:", err);
		}
	};

	const handleSave = () => {
		const wasteAmount = parseInt(tempWasteInput.replace(/,/g, ""), 10) || 0;
		onSave(playerName, wasteAmount);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Extra Waste for {playerName}</DialogTitle>
					<DialogDescription>
						Add additional waste (e.g., blessing costs, other expenses) to this
						player's total.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor={wasteInputId}>Extra Waste (gp)</Label>
						<Input
							id={wasteInputId}
							type="text"
							value={tempWasteInput}
							onChange={(e) => {
								const value = e.target.value.replace(/[^0-9,]/g, "");
								setTempWasteInput(value);
							}}
							placeholder="Enter amount in gold"
							className="text-lg"
						/>
						{tempWasteInput && (
							<div className="text-sm text-muted-foreground">
								Current:{" "}
								{formatNumber(
									parseInt(tempWasteInput.replace(/,/g, ""), 10) || 0,
								)}{" "}
								gp
							</div>
						)}
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={handleCalculateBless}
							className="flex-1"
						>
							Calculate Bless
						</Button>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSave}>Save</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
