import InvoiceTemplatePage from "@/page-components/invoice-template";
import { getAccountDataTemplate } from "./action";

export const dynamic = "force-dynamic";

const Page = async () => {
  const account = await getAccountDataTemplate();

  return <InvoiceTemplatePage account={account} />;
};

export default Page;
