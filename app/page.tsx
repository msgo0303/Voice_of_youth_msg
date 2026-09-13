import { redirect } from 'next/navigation';
import fs from 'fs';
import path from 'path';

export default function RootHomePage() {
  // Read index.html from public/index.html or public/design/index.html
  const publicIndexPath = path.join(process.cwd(), 'public', 'index.html');
  const designIndexPath = path.join(process.cwd(), 'public', 'design', 'index.html');
  
  let htmlContent = '';
  if (fs.existsSync(publicIndexPath)) {
    htmlContent = fs.readFileSync(publicIndexPath, 'utf-8');
  } else if (fs.existsSync(designIndexPath)) {
    htmlContent = fs.readFileSync(designIndexPath, 'utf-8');
  }

  if (htmlContent) {
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  // Fallback redirect to /admin if HTML is not found
  redirect('/admin');
}
