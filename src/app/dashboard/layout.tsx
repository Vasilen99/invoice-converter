import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/page-components/dashboard"));

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <div className="grid gap-12 grid-cols-[323px_1fr]">
        <Dashboard />
        <main className="pb-16">{children}</main>
      </div>
    </div>
  );
};
export default AdminLayout;
