import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET /design/[slug] - Serve specific design HTML page or screenshot
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    let rawSlug = params.slug;

    // Handle screenshots folder requests (e.g. /design/screenshots/dashboard.png)
    if (rawSlug === 'screenshots') {
      const url = new URL(req.url);
      const pathname = url.pathname; // e.g. /design/screenshots/dashboard.png
      const imgName = path.basename(pathname);
      const imgPath = path.join(process.cwd(), 'public', 'design', 'screenshots', imgName);

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
    }

    // Strip trailing .html if present
    const cleanSlug = rawSlug.replace(/\.html$/, '');
    const fileName = `${cleanSlug}.html`;
    const filePath = path.join(process.cwd(), 'public', 'design', fileName);

    if (fs.existsSync(filePath)) {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    return new NextResponse(`Design page '${rawSlug}' not found`, { status: 404 });
  } catch (error: any) {
    return new NextResponse(`Error serving design file: ${error.message}`, { status: 500 });
  }
}
