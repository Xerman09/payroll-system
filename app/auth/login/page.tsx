import { cookies } from "next/headers";
import { getCompanyById } from "@/lib/companies";
import LoginModule from "@/modules/auth/login/LoginModule";

export default async function Page() {
  const cookieStore = await cookies();
  const companyId = cookieStore.get("selected_company_id")?.value;
  const company = getCompanyById(companyId);

  return <LoginModule companyName={company?.name} companyColor={company?.color} />;
}
