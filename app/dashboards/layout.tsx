import DashboardNav from "@/components/dashboards/DashboardNav";

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex mx-auto gap-8 max-md:block max-md:w-full">
        <div
          className={`py-8 w-40 sticky overflow-y-auto scrollbar-hide top-[120px] h-[calc(100vh-120px)] max-md:static max-md:w-full max-md:h-auto max-md:p-2 max-md:overflow-x-auto`}
        >
          <DashboardNav />
        </div>
        <div className="py-8 flex-1 w-[calc(1400px-12rem)] max-md:px-4 max-md:w-full">{children}</div>
      </div>
    </div>
  );
}
