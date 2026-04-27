import ElectionCard from "@/components/dashboards/ElectionCard";
import { fetchElectionData } from "@/lib/mockData";
import { useTranslation } from "@/lib/i18n";

export interface Candidate {
  name: string;
  avatar: string;
  winRate: number;
}

export interface Election {
  id: number;
  country: string;
  electionDate: string;
  flagUrl: string;
  electionType: string;
  candidates: Candidate[];
}


export default async function GlobalElectionsPage() {
  const electionData = await fetchElectionData();
  // Note: For Server Components, we'll need to handle i18n differently
  // This is a placeholder - actual implementation would use server-side i18n
  return (
    <div>
      <div className="text-3xl font-semibold">Election odds & predictions</div>
      <div className="grid grid-cols-3 gap-4 mt-6 max-md:grid-cols-1">
        {electionData.map((election) => (
          <ElectionCard key={election.id} {...election} />
        ))}
      </div>
    </div>
  );
}
