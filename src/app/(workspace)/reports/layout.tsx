import AdminOnly from "@/components/AdminOnly";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
