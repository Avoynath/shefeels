import { useEffect, useState } from "react";

export function useCountdown(startSeconds = 6 * 60 * 60) {
	const [seconds, setSeconds] = useState<number>(startSeconds);

	useEffect(() => {
		setSeconds(startSeconds);
	}, [startSeconds]);

	useEffect(() => {
		if (seconds <= 0) return;
		const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
		return () => clearInterval(id);
	}, [seconds]);
	
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	
	const hh = String(hours).padStart(2, "0");
	const mm = String(minutes).padStart(2, "0");
	const ss = String(secs).padStart(2, "0");
	
	return `${hh}:${mm}:${ss}`;
}
