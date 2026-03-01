import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
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
    const { data, error } = await supabase
      .from('creations')
      .select('id, image_url, aspect_ratio, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
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
    const { image_url, aspect_ratio, prompt } = body as {
      image_url?: string;
      aspect_ratio?: string;
      prompt?: string;
    };
    if (!image_url || typeof image_url !== 'string') {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('creations')
      .insert({
        user_id: user.id,
        image_url,
        aspect_ratio: aspect_ratio ?? null,
        prompt: prompt ?? null,
      })
      .select('id, created_at')
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
