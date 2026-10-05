import { redirect } from "next/navigation";

// Employee Directory now lives on the Overview page.
export default function DirectoryRedirect() {
  redirect("/");
}
