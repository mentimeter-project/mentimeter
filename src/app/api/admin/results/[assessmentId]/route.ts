import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { assessmentId: string } }) {
  return NextResponse.redirect(new URL(`/api/admin/responses/${params.assessmentId}`, req.url));
}
