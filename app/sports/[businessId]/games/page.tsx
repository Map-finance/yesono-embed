import CommentSection from "@/components/common/CommentSection";
import GameList from "@/components/sports/GameList";
import { mockStartingSoonGames } from "@/lib/mockData";


export default function SportGamesPage() {
  return (
    <div className="mt-6">
      <GameList games={mockStartingSoonGames} showTimeDivider />
      <CommentSection entityId="1" />
    </div>
  );
}
