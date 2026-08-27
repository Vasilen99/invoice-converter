import ContragentsPage from "@/page-components/contragents-dashboard";
import { getContragents, getOrganizationsForContragents } from "./action";

const Page = async () => {
  const response = await getContragents();
  const organizations = await getOrganizationsForContragents();

  return (
    <ContragentsPage
      contragents={response.data}
      organizations={organizations}
      hasAccount={response.hasAccount}
    />
  );
};

export default Page;
