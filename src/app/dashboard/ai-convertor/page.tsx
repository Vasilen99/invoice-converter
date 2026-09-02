import { InvoiceUploader } from "@/components";
import { getAccountData } from "./action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const response = await getAccountData();
  const { data } = await response.json();
  return <InvoiceUploader account={data} />;
};

export default Page;
