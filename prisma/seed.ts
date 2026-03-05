import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  const passwordHash = await bcrypt.hash("demo1234", 12);

  const agent = await prisma.user.upsert({
    where: { email: "demo@agentsecurelinks.com" },
    update: {},
    create: {
      email: "demo@agentsecurelinks.com",
      passwordHash,
      displayName: "Alex Rivera",
      agencyName: "Rivera Financial Group",
      phone: "555-000-0001",
      licenseNumber: "LA-123456",
      licensedStates: "CA,TX,FL",
      agentSlug: "alex-rivera",
    },
  });

  console.log(`Created demo agent: ${agent.email}`);
  console.log("Login: demo@agentsecurelinks.com / demo1234");
  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
