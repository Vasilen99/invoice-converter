import DashboardAnalytics from "@/page-components/dashboard-analytics";
import { server } from "@/utility/constants";
import { cookies } from "next/headers";

const Page = async () => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const response = await Promise.all([
    fetch(`${server}/api/credit-transactions`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    }),
    fetch(`${server}/api/organizations`, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    }),
  ]);
  const creditTransactions = await response[0].json();
  const organizations = await response[1].json();

  return (
    <DashboardAnalytics
      creditsData={creditTransactions.data}
      organizationsData={organizations.data}
    />
  );
};

export default Page;
