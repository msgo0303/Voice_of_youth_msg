import { redirect } from 'next/navigation';

// Root Homepage: Redirect directly to the REAL working FormGram Admin Dashboard (/admin)
export default function RootHomePage() {
  redirect('/admin');
}
