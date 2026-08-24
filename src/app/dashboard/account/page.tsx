import AccountDashboardPage from "@/page-components/account-dashboard";
import { getAccountData } from "./action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const accountData = await getAccountData();

  return <AccountDashboardPage initialData={accountData} />;
};

export default Page;
