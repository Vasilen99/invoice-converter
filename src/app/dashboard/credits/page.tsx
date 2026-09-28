import CreditsPage from "@/page-components/credits-dashboard";
import { getAccountData } from "./action";
const Page = async () => {
  const accountData = await getAccountData();
  return <CreditsPage accountData={accountData} />;
};

export default Page;
