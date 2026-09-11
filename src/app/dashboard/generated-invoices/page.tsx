import { getOrganizationsWithGeneratedInvoices } from "./action";
import GeneratedInvoices from "@/page-components/generated-invoices";

export const dynamic = "force-dynamic";

const Page = async () => {
  const response = await getOrganizationsWithGeneratedInvoices();
  return (
    <GeneratedInvoices
      organizations={response.organizations}
      hasAccount={response.hasAccount}
      accountId={response.accountId}
      composerName={response.composerName}
    />
  );
};

export default Page;
