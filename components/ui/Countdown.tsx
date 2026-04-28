"use client";

import { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";

interface CountdownProps {
    targetTime: string | Date;
}

export default function Countdown({ targetTime }: CountdownProps) {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    useEffect(() => {
        const target = new Date(targetTime).getTime();

        const updateCountdown = () => {
            const now = new Date().getTime();
            const difference = target - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((difference % (1000 * 60)) / 1000);

                setTimeLeft({ days, hours, minutes, seconds });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [targetTime]);

    return (
        <div className="flex items-center gap-2 font-semibold">
            <div className="flex flex-col items-center bg-(--bg-secondary) px-3 py-2 rounded-md">
                <NumberFlow value={timeLeft.days} />
                <div className="uppercase text-xs text-(--text-secondary)">days</div>
            </div>
            <div className="flex flex-col items-center bg-(--bg-secondary) px-3 py-2 rounded-md">
                <NumberFlow value={timeLeft.hours} />
                <div className="uppercase text-xs text-(--text-secondary)">hrs</div>
            </div>
            <div className="flex flex-col items-center bg-(--bg-secondary) px-3 py-2 rounded-md">
                <NumberFlow value={timeLeft.minutes} />
                <div className="uppercase text-xs text-(--text-secondary)">min</div>
            </div>
            <div className="flex flex-col items-center bg-(--bg-secondary) px-3 py-2 rounded-md">
                <NumberFlow value={timeLeft.seconds} />
                <div className="uppercase text-xs text-(--text-secondary)">sec</div>
            </div>
        </div>
    );
}