import { AIAssistantPage } from "../../../page-components/ai-assistant";
import { getAccountData } from "../ai-convertor/action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getAccountData();

  return <AIAssistantPage account={account} />;
};

export default Page;
