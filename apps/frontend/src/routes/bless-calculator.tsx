import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { calculateBlessingCost } from "@/lib/tibia-parser";

export const Route = createFileRoute("/bless-calculator")({
	component: RouteComponent,
});

function RouteComponent() {
	const [level, setLevel] = useState<string>("");
	const [inqBless, setInqBless] = useState<boolean>(true);
	const [twist, setTwist] = useState<boolean>(true);
	const [result, setResult] = useState<ReturnType<
		typeof calculateBlessingCost
	> | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleCalculate = ({
		level,
		inqBless,
	}: {
		level: string;
		inqBless: boolean;
	}) => {
		setError(null);
		const levelNum = Number(level);
		if (Number.isNaN(levelNum) || levelNum < 1) {
			setResult(null);
			setError("Please enter a valid level (at least 1).");
			return;
		}
		try {
			const costs = calculateBlessingCost(levelNum, inqBless);
			setResult(costs);
		} catch (_err: unknown) {
			setError("Error calculating blessings. Please check your input.");
			setResult(null);
		}
	};

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">Blessings Calculator</h1>
			<div className="mb-6 flex flex-col gap-4 max-w-sm mx-auto">
				<label className="font-medium">
					Character Level
					<input
						type="number"
						min={1}
						className="block mt-1 border rounded p-2 w-full"
						value={level}
						onChange={(e) => {
							setLevel(e.target.value);
							handleCalculate({
								level: e.target.value,
								inqBless,
							});
						}}
						placeholder="Enter level (e.g. 150)"
					/>
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={inqBless}
						onChange={(e) => {
							setInqBless(e.target.checked);
							handleCalculate({
								inqBless: e.target.checked,
								level,
							});
						}}
					/>
					Include Inquisition Blessing? (slight cost increase)
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={twist}
						onChange={(e) => {
							setTwist(e.target.checked);
							handleCalculate({
								level,
								inqBless,
							});
						}}
					/>
					Include Twist of Fate? (not available on non-pvp servers)
				</label>
			</div>
			{error && (
				<div className="text-red-600 font-medium mb-4 flex justify-center">
					{error}
				</div>
			)}
			{result && (
				<div className="bg-accent p-4 rounded shadow space-y-2 max-w-md mx-auto">
					<div>
						<span className="font-semibold">5 regular blessings:</span>
						{result.fiveRegular.toLocaleString()} gp
					</div>
					<div>
						<span className="font-semibold">All 7 blessings:</span>
						{result.allSeven.toLocaleString()} gp
					</div>
					{twist && (
						<div>
							<span className="font-semibold">All 7 + Twist of Fate:</span>
							{result.allSevenWithTwist.toLocaleString()} gp
						</div>
					)}
					<details className="pt-2">
						<summary className="cursor-pointer text-sm text-muted-foreground">
							Show individual blessing costs
						</summary>
						<ul className="mt-2 text-sm space-y-1">
							{Object.entries(result.individual)
								.filter(([k]) => k !== "twistOfFate" || twist)
								.map(([k, v]) => (
									<li key={k}>
										<span className="capitalize">
											{k.replace(/([A-Z])/g, " $1")}:
										</span>
										{v.toLocaleString()} gp
									</li>
								))}
						</ul>
					</details>
				</div>
			)}
		</div>
	);
}
