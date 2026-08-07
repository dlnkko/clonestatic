import type { SupabaseClient } from '@supabase/supabase-js';
import { getKieTaskResultOnce, GENERATION_SERVER_ERROR } from '@/lib/kie';

/**
 * For generating creations that have a Kie task id, check Kie once and
 * complete/fail the row so the UI can show the image even after serverless cutoff.
 */
export async function syncGeneratingCreationsFromKie(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: rows, error } = await admin
    .from('creations')
    .select('id, kie_task_id')
    .eq('user_id', userId)
    .eq('status', 'generating')
    .not('kie_task_id', 'is', null)
    .limit(20);

  if (error) {
    console.error('syncGeneratingCreationsFromKie list:', error.message);
    return;
  }
  if (!rows?.length) return;

  for (const row of rows) {
    const taskId = typeof row.kie_task_id === 'string' ? row.kie_task_id.trim() : '';
    if (!taskId) continue;

    try {
      const result = await getKieTaskResultOnce(taskId);
      if (result.state === 'success') {
        await admin
          .from('creations')
          .update({
            image_url: result.urls[0],
            status: 'completed',
            error_message: null,
            kie_task_id: null,
          })
          .eq('id', row.id)
          .eq('user_id', userId)
          .eq('status', 'generating');
      } else if (result.state === 'fail') {
        await admin
          .from('creations')
          .update({
            status: 'failed',
            error_message: GENERATION_SERVER_ERROR,
            kie_task_id: null,
          })
          .eq('id', row.id)
          .eq('user_id', userId)
          .eq('status', 'generating');
      }
      // pending → leave generating; client will poll again
    } catch (err) {
      console.warn('syncGeneratingCreationsFromKie task:', taskId, err);
    }
  }
}
