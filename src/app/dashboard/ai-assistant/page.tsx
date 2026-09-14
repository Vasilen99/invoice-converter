import { AIAssistantPage } from "@/page-components/ai-assistant";
import { getUserAccountData } from "./action";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getUserAccountData();

  if (!account) {
    notFound();
  }

  return <AIAssistantPage account={account} />;
};

export default Page;
