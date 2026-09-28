import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/page-components/dashboard"));

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <div className="flex flex-row h-screen w-screen">
        <div>
          <Dashboard />
        </div>
        <main className="min-h-0 overflow-hidden w-full mt-16 lg:ml-10 lg:mt-0 ml-0">
          <section className="bg-background h-full w-full overflow-y-auto px-4 py-6 lg:py-12">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
export default AdminLayout;
