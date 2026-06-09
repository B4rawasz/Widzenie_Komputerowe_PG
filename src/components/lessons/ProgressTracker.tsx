"use client";
import { useEffect } from "react";

export function ProgressTracker({ lessonSlug, partSlug }: { lessonSlug: string, partSlug?: string }) {
    useEffect(() => {
        const path = partSlug ? `/${partSlug}` : '/';
        const key = `progress-${lessonSlug}`;
        
        try {
            const visited = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(visited) && !visited.includes(path)) {
                visited.push(path);
                localStorage.setItem(key, JSON.stringify(visited));
            }
        } catch (e) {
            console.error("Failed to track progress:", e);
        }
    }, [lessonSlug, partSlug]);
    
    return null;
}
