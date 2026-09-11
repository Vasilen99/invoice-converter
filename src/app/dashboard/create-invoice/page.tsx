import { CreateInvoiceMain } from "@/page-components/create-invoice";
import { getAccountData } from "./action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getAccountData();

  return <CreateInvoiceMain data={account} />;
};

export default Page;
