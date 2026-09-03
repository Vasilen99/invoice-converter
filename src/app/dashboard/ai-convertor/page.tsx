import { InvoiceUploader } from "@/components";
import { getAccountData } from "./action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getAccountData();
  return <InvoiceUploader account={account} />;
};

export default Page;
