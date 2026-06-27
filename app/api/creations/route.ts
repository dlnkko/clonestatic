import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CREATIONS_LIST_LIMIT } from '@/lib/creations/constants';
import { creationsRetentionCutoff, purgeExpiredCreations } from '@/lib/creations/purge';

export const dynamic = 'force-dynamic';

function isSupabaseConfigured(): boolean {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && key);
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ creations: [] });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ creations: [] });
    }

    const admin = createAdminClient();
    await purgeExpiredCreations(admin, user.id);

    const cutoff = creationsRetentionCutoff();
    const { data, error } = await supabase
      .from('creations')
      .select('id, image_url, aspect_ratio, created_at, status, error_message, reference_image_url')
      .eq('user_id', user.id)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(CREATIONS_LIST_LIMIT);

    if (error) {
      console.error('Supabase creations list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ creations: data ?? [] });
  } catch (err) {
    console.error('GET /api/creations:', err);
    return NextResponse.json({ error: 'Failed to list creations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const body = await request.json();
    const { image_url, aspect_ratio, prompt, status: statusParam, reference_image_url } = body as {
      image_url?: string;
      aspect_ratio?: string;
      prompt?: string;
      status?: 'generating' | 'completed' | 'failed';
      reference_image_url?: string;
    };
    const referenceUrl =
      typeof reference_image_url === 'string' && reference_image_url.startsWith('http')
        ? reference_image_url
        : null;
    const status =
      statusParam === 'generating'
        ? 'generating'
        : statusParam === 'failed'
          ? 'failed'
          : 'completed';
    if (status === 'completed' && (!image_url || typeof image_url !== 'string')) {
      return NextResponse.json(
        { error: 'image_url is required when status is completed' },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from('creations')
      .insert({
        user_id: user.id,
        image_url: image_url ?? null,
        aspect_ratio: aspect_ratio ?? null,
        prompt: prompt ?? null,
        status,
        reference_image_url: referenceUrl,
      })
      .select('id, created_at, status, aspect_ratio, image_url, reference_image_url')
      .single();
    if (error) {
      console.error('Supabase creations insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('POST /api/creations:', err);
    return NextResponse.json({ error: 'Failed to save creation' }, { status: 500 });
  }
}
