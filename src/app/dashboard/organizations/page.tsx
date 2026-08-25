import Organizations from "@/components/Organizations";
import { getOrganizations } from "./action";

const Page = async () => {
  const response = await getOrganizations();
  return <Organizations organizations={response.data} />;
};

export default Page;
