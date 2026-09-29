import CreditsPage from "@/page-components/credits-dashboard";
import { getAccountData } from "./action";

const Page = async () => {
  const data = await getAccountData();
  return <CreditsPage {...data} />;
};

export default Page;
