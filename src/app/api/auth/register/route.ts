
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Public registration is disabled. Staff accounts must be created by authorized administrators through Staff Management.',
    },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:
        'Public registration is disabled. Staff accounts must be created by authorized administrators through Staff Management.',
    },
    { status: 403 }
  );
}
