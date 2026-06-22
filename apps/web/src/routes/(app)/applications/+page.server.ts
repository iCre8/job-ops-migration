import { trpcServer } from "$lib/server/trpc/server.js";
import type { PageServerLoad } from "./$types.js";

const STAGES = [
  { key: "applied", label: "Applied" },
  { key: "phone_screen", label: "Phone Screen" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

export const load: PageServerLoad = async (event) => {
  const trpc = await trpcServer(event);
  const { jobs } = await trpc.jobs.list({ status: "applied", pageSize: 200 });

  const columns = STAGES.map(({ key, label }) => ({
    key,
    label,
    jobs: jobs.filter((j) => (j.applicationStage ?? "applied") === key),
  }));

  // Jobs with no stage go into the "Applied" column
  return { columns };
};
