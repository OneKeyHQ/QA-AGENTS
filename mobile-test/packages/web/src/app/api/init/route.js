import { NextRequest, NextResponse } from 'next/server';
import loadSteps from '@/utils/loadSteps';

export async function GET(req, res) {
  try {
    const steps = await loadSteps();
    return NextResponse.json({ steps });
  } catch (error) {
    // 处理外层错误
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
