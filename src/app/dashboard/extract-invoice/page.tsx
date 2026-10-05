import { InvoiceUploader } from "@/components";
import { getAccountData } from "../ai-convertor/action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getAccountData();
  return <InvoiceUploader account={account} />;
};

export default Page;
