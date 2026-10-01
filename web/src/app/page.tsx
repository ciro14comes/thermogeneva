import { redirect } from "next/navigation";

// La radice "/" viene normalmente gestita dal proxy (lingua del browser); questo è il fallback.
export default function RootPage() {
  redirect("/en");
}
