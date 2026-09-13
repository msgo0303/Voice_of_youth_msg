import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET /design/screenshots/[name] - Serve screenshot image files
export async function GET(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const imageName = params.name;
    const imgPath = path.join(process.cwd(), 'public', 'design', 'screenshots', imageName);

    if (fs.existsSync(imgPath)) {
      const imageBuffer = fs.readFileSync(imgPath);
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new NextResponse('Screenshot not found', { status: 404 });
  } catch (error: any) {
    return new NextResponse(`Error serving screenshot: ${error.message}`, { status: 500 });
  }
}
