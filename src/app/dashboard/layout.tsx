import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/page-components/dashboard"));

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <div className="flex">
        <div className="flex-1/5">
          <Dashboard />
        </div>
        <main className="flex-5/6">
          <section className="bg-background h-full w-full pt-12 px-4">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
};
export default AdminLayout;
