import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("@/page-components/dashboard"));

const AdminLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <div className="flex">
        <div className="flex-1/5">
          <Dashboard />
        </div>
        <main className="pb-16 flex-5/6">{children}</main>
      </div>
    </div>
  );
};
export default AdminLayout;
