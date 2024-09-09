import { useAppContext } from "../../context/useAppContext";
import LeaderboardTable from "../LeaderboardTable";
import Tabs from "../Tabs";

const GlobalLeaderBoard = () => {
  const { globalQuery } = useAppContext();
  const kills = globalQuery?.data?.kills_leaderboard;
  const items = globalQuery?.data?.items_leaderboard;
  const secrets = globalQuery?.data?.secrets_leaderboard;

  const tabs = [
    {
      id: 0,
      title: "Kills",
      content: kills && <LeaderboardTable data={kills} />,
    },
    {
      id: 1,
      title: "Items",
      content: items && <LeaderboardTable data={items} />,
    },
    {
      id: 2,
      title: "Secret",
      content: secrets && <LeaderboardTable data={secrets} />,
    },
  ];

  return <Tabs tabs={tabs} />;
};

export default GlobalLeaderBoard;
