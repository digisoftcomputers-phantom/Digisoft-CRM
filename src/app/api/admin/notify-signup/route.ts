import { NextResponse } from 'next/server';
import { notifyAdminOnNewRegistration } from '@/lib/email/admin-notifier';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { fullName, email, invite } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const result = await notifyAdminOnNewRegistration({
      fullName: typeof fullName === 'string' ? fullName : '',
      email,
      invite: typeof invite === 'string' ? invite : null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[/api/admin/notify-signup] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
