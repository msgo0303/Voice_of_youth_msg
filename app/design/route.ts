import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET /design - Serve design showcase index.html
export async function GET(req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'design', 'index.html');
    
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Design index.html not found in public/design', { status: 404 });
    }

    const htmlContent = fs.readFileSync(filePath, 'utf-8');

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error loading design page: ${error.message}`, { status: 500 });
  }
}
