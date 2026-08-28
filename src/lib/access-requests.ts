import { supabase } from '@/lib/supabase';

export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export interface AccessRequest {
  id: string;
  email: string;
  requested_at: string;
  status: AccessRequestStatus;
  reviewed_at: string | null;
  invite_code: string | null;
}

export interface AccessReviewResult {
  id: string;
  email: string;
  status: AccessRequestStatus;
  invite_code: string | null;
  emailed?: boolean;
  email_error?: string | null;
}

type ReviewAction = 'list' | 'approve' | 'deny';

async function invokeReview(
  action: ReviewAction,
  id?: string,
): Promise<{ requests?: AccessRequest[]; result?: AccessReviewResult; error?: string }> {
  const { data, error } = await supabase.functions.invoke('review-access', {
    body: id ? { action, id } : { action },
  });
  if (error) {
    const message = error.message || 'review_failed';
    return { error: message };
  }
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return { error: data.error };
  }
  return (data ?? {}) as { requests?: AccessRequest[]; result?: AccessReviewResult };
}

export async function listPendingAccessRequests(): Promise<AccessRequest[]> {
  const { requests, error } = await invokeReview('list');
  if (error) throw new Error(error);
  return requests ?? [];
}

export async function approveAccessRequest(id: string): Promise<AccessReviewResult> {
  const { result, error } = await invokeReview('approve', id);
  if (error) throw new Error(error);
  if (!result) throw new Error('review_failed');
  return result;
}

export async function denyAccessRequest(id: string): Promise<AccessReviewResult> {
  const { result, error } = await invokeReview('deny', id);
  if (error) throw new Error(error);
  if (!result) throw new Error('review_failed');
  return result;
}
