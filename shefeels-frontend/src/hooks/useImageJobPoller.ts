/**
 * useImageJobPoller - Hook for non-blocking async image generation polling
 * 
 * This hook manages background polling for image generation jobs.
 * It polls the backend until each job completes or fails, then updates
 * the message with the final image URL.
 * 
 * Features:
 * - Multiple concurrent image jobs per message
 * - Configurable polling interval
 * - Automatic cleanup on unmount
 * - Does NOT block UI input
 */

import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../utils/api';
import type { Message, ImageJobStatus } from '../types/chat';

export interface ImageJob {
    jobId: string;
    messageId: string;
    status: ImageJobStatus;
    imageUrl?: string | null;
    error?: string | null;
}

interface UseImageJobPollerOptions {
    /** Polling interval in milliseconds (default: 2000ms) */
    pollInterval?: number;
    /** Maximum number of retries for network errors (default: 3) */
    maxRetries?: number;
    /** Callback when a job completes successfully */
    onJobComplete?: (job: ImageJob) => void;
    /** Callback when a job fails */
    onJobFailed?: (job: ImageJob) => void;
}

export function useImageJobPoller(
    messages: Message[],
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    options: UseImageJobPollerOptions = {}
) {
    const {
        pollInterval = 2000,
        maxRetries = 3,
        onJobComplete,
        onJobFailed,
    } = options;

    // Track active polling jobs to avoid duplicates
    const activeJobsRef = useRef<Map<string, { retries: number; intervalId: ReturnType<typeof setInterval> }>>(new Map());
    // Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Function to poll a single job
    const pollJob = useCallback(async (jobId: string, messageId: string) => {
        if (!isMountedRef.current) return;

        const activeJob = activeJobsRef.current.get(jobId);
        if (!activeJob) return;

        try {
            const response = await apiClient.getImageJobStatus(jobId);

            if (!isMountedRef.current) return;

            const status = response.status;

            if (status === 'completed' && response.image_url) {
                // Job completed successfully - update the message
                setMessages((prev) => {
                    const alreadyExists = prev.some(m => m.type === 'image' && m.imageUrl === response.image_url);
                    if (alreadyExists) {
                        // The backend history already loaded the completed image, so just drop the pending message
                        return prev.filter(m => !(m.id === messageId || m.imageJobId === jobId));
                    }
                    return prev.map((m) => {
                        if (m.id === messageId || m.imageJobId === jobId) {
                            return {
                                ...m,
                                type: 'image' as const,
                                imageUrl: response.image_url,
                                imageJobId: null,
                                imageJobStatus: 'completed' as const,
                                imageJobError: null,
                            };
                        }
                        return m;
                    });
                });

                // Cleanup polling
                clearInterval(activeJob.intervalId);
                activeJobsRef.current.delete(jobId);

                // Notify callback
                if (onJobComplete) {
                    onJobComplete({
                        jobId,
                        messageId,
                        status: 'completed',
                        imageUrl: response.image_url,
                    });
                }
            } else if (status === 'failed') {
                // Job failed - update message with error
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.id === messageId || m.imageJobId === jobId) {
                            return {
                                ...m,
                                type: 'text' as const,
                                text: m.text || 'Image generation failed',
                                imageJobId: null,
                                imageJobStatus: 'failed' as const,
                                imageJobError: response.error || 'Image generation failed',
                            };
                        }
                        return m;
                    })
                );

                // Cleanup polling
                clearInterval(activeJob.intervalId);
                activeJobsRef.current.delete(jobId);

                // Notify callback
                if (onJobFailed) {
                    onJobFailed({
                        jobId,
                        messageId,
                        status: 'failed',
                        error: response.error,
                    });
                }
            }
            // Note: For in-progress states (queued/generating), we intentionally
            // do NOT update the message state. This prevents unnecessary re-renders
            // and scroll jumps in the chat interface during polling. The UI already
            // shows a loading state for pending images, so status updates provide
            // no user benefit while causing scroll instability.

            // Reset retry count on success
            activeJob.retries = 0;
        } catch (error) {
            console.warn('[ImageJobPoller] Poll error for job', jobId, error);

            if (!isMountedRef.current) return;

            // Increment retry count
            activeJob.retries += 1;

            if (activeJob.retries >= maxRetries) {
                // Too many retries - mark as failed
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.id === messageId || m.imageJobId === jobId) {
                            return {
                                ...m,
                                type: 'text' as const,
                                text: m.text || 'Failed to check image status',
                                imageJobId: null,
                                imageJobStatus: 'failed' as const,
                                imageJobError: 'Failed to check image status after multiple retries',
                            };
                        }
                        return m;
                    })
                );

                // Cleanup polling
                clearInterval(activeJob.intervalId);
                activeJobsRef.current.delete(jobId);

                if (onJobFailed) {
                    onJobFailed({
                        jobId,
                        messageId,
                        status: 'failed',
                        error: 'Network error - max retries exceeded',
                    });
                }
            }
        }
    }, [setMessages, maxRetries, onJobComplete, onJobFailed]);

    // Start polling for a job
    const startPolling = useCallback((jobId: string, messageId: string) => {
        if (activeJobsRef.current.has(jobId)) {
            // Already polling this job
            return;
        }

        // Initial poll
        pollJob(jobId, messageId);

        // Set up interval polling
        const intervalId = setInterval(() => {
            pollJob(jobId, messageId);
        }, pollInterval);

        activeJobsRef.current.set(jobId, { retries: 0, intervalId });
    }, [pollJob, pollInterval]);

    // Stop polling for a job
    const stopPolling = useCallback((jobId: string) => {
        const activeJob = activeJobsRef.current.get(jobId);
        if (activeJob) {
            clearInterval(activeJob.intervalId);
            activeJobsRef.current.delete(jobId);
        }
    }, []);

    // Scan messages for new image jobs to poll
    useEffect(() => {
        if (!isMountedRef.current) return;

        for (const message of messages) {
            if (
                message.imageJobId &&
                message.imageJobStatus !== 'completed' &&
                message.imageJobStatus !== 'failed' &&
                !activeJobsRef.current.has(message.imageJobId)
            ) {
                startPolling(message.imageJobId, message.id);
            }
        }
    }, [messages, startPolling]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            // Clear all active polling intervals
            for (const [, job] of activeJobsRef.current) {
                clearInterval(job.intervalId);
            }
            activeJobsRef.current.clear();
        };
    }, []);

    return {
        startPolling,
        stopPolling,
        activeJobCount: activeJobsRef.current.size,
    };
}

export default useImageJobPoller;
