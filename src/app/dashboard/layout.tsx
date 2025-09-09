import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className={`
          flex-1 overflow-y-auto transition-all duration-300
          ${'ml-0 lg:ml-64'} /* No margin on mobile, full margin on lg+ */
          ${'pt-16'} /* Offset for header height */
        `}>
          <Header />
          <div className={`
            p-2 sm:p-4 lg:p-6
            ${'min-h-[calc(100vh-4rem)]'} /* Adjust for header height */
          `}>
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
