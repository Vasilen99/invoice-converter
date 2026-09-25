import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/page-components/dashboard"));

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <div className="grid h-screen w-screen grid-rows-[50px_1fr] lg:grid-cols-[50px_1fr] lg:grid-rows-1">
        <div>
          <Dashboard />
        </div>
        <main className="min-h-0 overflow-hidden">
          <section className="bg-background h-full w-full overflow-y-auto px-4 py-6 lg:py-12">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
export default AdminLayout;
