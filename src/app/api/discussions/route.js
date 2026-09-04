import { NextResponse } from 'next/server';
import { encodePayload } from '@/lib/secure-payload';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { ensureCsrfToken } from '@/lib/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Extract stock mentions from message content
 * $CODE for IDX stocks (e.g., $BMRI -> BMRI.JK)
 * US$CODE for US stocks (e.g., US$AAPL -> AAPL)
 */
function extractMentions(content) {
  const mentions = [];
  
  // Match US$ prefix for US stocks
  const usMatches = content.match(/US\$([A-Z]{1,5})/gi) || [];
  usMatches.forEach(match => {
    const code = match.replace(/US\$/i, '').toUpperCase();
    mentions.push({ type: 'US', code, original: match });
  });
  
  // Match $ prefix for IDX stocks (but not US$)
  const idxMatches = content.match(/(?<!US)\$([A-Z]{4})/gi) || [];
  idxMatches.forEach(match => {
    const code = match.replace('$', '').toUpperCase();
    mentions.push({ type: 'IDX', code: `${code}.JK`, original: match });
  });
  
  return mentions;
}

/**
 * GET /api/discussions
 * Fetches discussion messages with pagination
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Supabase configuration missing' }) },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch messages
    const { data: messages, error, count } = await supabase
      .from('discussion_messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to fetch messages' }) },
        { status: 500 }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set((messages || []).map(m => m.user_id))];
    
    // Fetch profiles for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', userIds);

    // Create profile map
    const profileMap = {};
    (profiles || []).forEach(profile => {
      profileMap[profile.id] = profile;
    });

    // Format messages with user data
    const formattedMessages = (messages || []).map(msg => {
      const profile = profileMap[msg.user_id];
      return {
        id: msg.id,
        content: msg.content,
        mentions: msg.mentions || [],
        replyToId: msg.reply_to_id,
        isSystem: msg.is_system || false,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at,
        userId: msg.user_id,
        user: profile ? {
          name: profile.full_name || profile.email?.split('@')[0] || 'Anonymous',
          avatar: profile.avatar_url,
        } : { name: 'Anonymous', avatar: null },
      };
    });

    const payload = {
      messages: formattedMessages.reverse(), // Oldest first for chat display
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
    };

    return NextResponse.json({
      payload: encodePayload(payload),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { payload: encodePayload({ error: 'Internal server error' }) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discussions
 * Create a new discussion message
 */
export async function POST(request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Supabase configuration missing' }) },
        { status: 500 }
      );
    }

    if (!ensureCsrfToken(request)) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Invalid request origin' }) },
        { status: 403 }
      );
    }

    // Create authenticated client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Authentication required' }) },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, replyToId } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Message content is required' }) },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Message too long (max 1000 characters)' }) },
        { status: 400 }
      );
    }

    // Extract mentions
    const extractedMentions = extractMentions(content);
    const mentionCodes = extractedMentions.map(m => m.code);

    // Insert message
    const { data: message, error } = await supabase
      .from('discussion_messages')
      .insert({
        user_id: user.id,
        content: content.trim(),
        mentions: mentionCodes,
        reply_to_id: replyToId || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to send message' }) },
        { status: 500 }
      );
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, email')
      .eq('id', user.id)
      .single();

    const formattedMessage = {
      id: message.id,
      content: message.content,
      mentions: message.mentions || [],
      replyToId: message.reply_to_id,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      userId: message.user_id,
      user: profile ? {
        name: profile.full_name || profile.email?.split('@')[0] || 'Anonymous',
        avatar: profile.avatar_url,
      } : { name: 'Anonymous', avatar: null },
    };

    return NextResponse.json({
      payload: encodePayload({ message: formattedMessage }),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { payload: encodePayload({ error: 'Internal server error' }) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/discussions
 * Delete a message
 */
export async function DELETE(request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Supabase configuration missing' }) },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Authentication required' }) },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');

    if (!messageId) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Message ID is required' }) },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('discussion_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to delete message' }) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payload: encodePayload({ success: true }),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { payload: encodePayload({ error: 'Internal server error' }) },
      { status: 500 }
    );
  }
}
